import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import {
  UserCog,
  Search,
  Plus,
  Trash2,
  Edit2,
  Fingerprint,
  FileText,
  Phone,
  Mail,
  CreditCard,
  Loader2,
  Upload,
  X,
  ShieldAlert,
  UserCheck,
  UserX,
  Image as ImageIcon,
  Key,
  Store,
  Activity,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import { formatLimit, getPackageLimits } from "@/lib/package-limits";
import { useBusinessRealtime } from "@/lib/use-business-realtime";
import {
  createEmployeeFn,
  updateEmployeeFn,
  deleteEmployeeFn,
  listMockEmployeesFn,
  assignEmployeeStoreFn,
} from "@/lib/employee-actions";

export const Route = createFileRoute("/t/$slug/employees")({ component: Employees });

type EmployeeWithProfile = {
  id: string;
  user_id: string;
  role: string;
  permissions: string[] | null;
  active: boolean;
  username: string | null;
  id_number: string | null;
  id_document_url: string | null;
  account_number: string | null;
  work_account_number: string | null;
  password_plain: string | null;
  email: string | null;
  store_id: string | null;
  created_at: string | null;
  profiles: {
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
  } | null;
};

function Employees() {
  const { business } = useTenant();
  const nav = useNavigate();
  const [list, setList] = useState<EmployeeWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [activitySummary, setActivitySummary] = useState<
    Record<
      string,
      {
        logins: number;
        hours: number;
        sales: number;
        saleCount: number;
        avgCheckout: number;
        checkoutCount: number;
      }
    >
  >({});

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showStaffLimitModal, setShowStaffLimitModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithProfile | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [role, setRole] = useState("cashier");
  const [storeId, setStoreId] = useState("");
  const [savingStoreAssignmentId, setSavingStoreAssignmentId] = useState<string | null>(null);
  const [workAccountNumber, setWorkAccountNumber] = useState("");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [fingerprintRegistered, setFingerprintRegistered] = useState(false);
  const packageLimits = getPackageLimits(business);

  // Files
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [idDocFile, setIdDocFile] = useState<File | null>(null);
  const [idDocPreview, setIdDocPreview] = useState<string | null>(null);

  function loadEmployees() {
    if (!business) return;
    setLoading(true);
    supabase
      .from("employees")
      .select("*, profiles(*)")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .then(async ({ data, error }) => {
        let dbList: EmployeeWithProfile[] = [];
        if (error) {
          console.error("Failed to load employees from DB:", error);
        } else {
          dbList = (data || []) as unknown as EmployeeWithProfile[];
        }

        try {
          const mockResult = await listMockEmployeesFn({ data: { business_id: business.id } });
          if (mockResult && "employees" in mockResult) {
            const mockList = mockResult.employees as EmployeeWithProfile[];
            dbList = [...mockList, ...dbList];
          }
        } catch (mockError) {
          console.error("Failed to load simulated employees:", mockError);
        }

        setList(dbList);
        setLoading(false);
      });
  }

  function loadStores() {
    if (!business) return;
    supabase
      .from("stores")
      .select("id, name")
      .eq("business_id", business.id)
      .then(({ data }) => {
        if (data) setStores(data);
      });
  }

  useEffect(() => {
    loadEmployees();
    loadStores();
  }, [business]);

  useBusinessRealtime(business?.id, ["employees", "stores", "employee_shifts", "employee_login_sessions"], () => {
    loadEmployees();
    loadStores();
    loadEmployeeActivity();
  });

  useEffect(() => {
    if (!business || list.length === 0) return;
    loadEmployeeActivity();
  }, [business, list.length]);

  async function loadEmployeeActivity() {
    if (!business) return;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    const summary: Record<
      string,
      {
        logins: number;
        hours: number;
        sales: number;
        saleCount: number;
        avgCheckout: number;
        checkoutCount: number;
      }
    > = {};
    list.forEach((e) => {
      summary[e.id] = {
        logins: 0,
        hours: 0,
        sales: 0,
        saleCount: 0,
        avgCheckout: 0,
        checkoutCount: 0,
      };
    });
    const userIdToEmployeeId = new Map(list.map((e) => [e.user_id, e.id]));
    const nameToEmployeeId = new Map<string, string>();

    list.forEach((e) => {
      const names = [e.profiles?.full_name, e.username, e.email, e.work_account_number]
        .filter(Boolean)
        .map((name) => String(name).trim().toLowerCase());
      names.forEach((name) => nameToEmployeeId.set(name, e.id));
    });

    const { data: sessions, error: sessionError } = await supabase
      .from("employee_login_sessions" as any)
      .select("employee_id,login_at,logout_at,was_within_shift")
      .eq("business_id", business.id)
      .gte("login_at", weekStart.toISOString());

    if (!sessionError) {
      (sessions || []).forEach((s: any) => {
        if (!summary[s.employee_id]) return;
        summary[s.employee_id].logins += 1;
        const login = new Date(s.login_at).getTime();
        const logout = s.logout_at ? new Date(s.logout_at).getTime() : Date.now();
        summary[s.employee_id].hours += Math.max(0, logout - login) / 3600000;
      });
    }

    const { data: sales } = await supabase
      .from("sales")
      .select(
        "cashier_id,cashier_name,total_amount,payment_method,checkout_duration_seconds,created_at",
      )
      .eq("business_id", business.id)
      .gte("created_at", weekStart.toISOString());

    (sales || []).forEach((sale: any) => {
      const cashierName = String(sale.cashier_name || "")
        .trim()
        .toLowerCase();
      const paymentCashierName =
        String(sale.payment_method || "")
          .split("::")
          .pop()
          ?.trim()
          .toLowerCase() || "";
      const employeeId =
        (sale.cashier_id && userIdToEmployeeId.get(sale.cashier_id)) ||
        nameToEmployeeId.get(cashierName) ||
        nameToEmployeeId.get(paymentCashierName);

      if (!employeeId || !summary[employeeId]) return;
      summary[employeeId].sales += Number(sale.total_amount || 0);
      summary[employeeId].saleCount += 1;
      if (sale.checkout_duration_seconds !== null && sale.checkout_duration_seconds !== undefined) {
        summary[employeeId].avgCheckout += Number(sale.checkout_duration_seconds || 0);
        summary[employeeId].checkoutCount += 1;
      }
    });

    Object.values(summary).forEach((s) => {
      s.avgCheckout = s.checkoutCount ? Math.round(s.avgCheckout / s.checkoutCount) : 0;
      s.hours = Math.round(s.hours * 10) / 10;
    });
    setActivitySummary(summary);
  }

  // Search & Filter
  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((e) => {
      const matchSearch =
        (e.profiles?.full_name || "").toLowerCase().includes(q) ||
        (e.username || "").toLowerCase().includes(q) ||
        (e.work_account_number || "").toLowerCase().includes(q) ||
        (e.email || "").toLowerCase().includes(q);

      const matchRole = selectedRoleFilter === "all" || e.role === selectedRoleFilter;
      return matchSearch && matchRole;
    });
  }, [list, search, selectedRoleFilter]);

  const storeNameById = useMemo(() => {
    return Object.fromEntries(stores.map((store) => [store.id, store.name]));
  }, [stores]);

  async function assignEmployeeToStore(emp: EmployeeWithProfile, nextStoreId: string) {
    if (!business) return;
    setSavingStoreAssignmentId(emp.id);

    const previousStoreId = emp.store_id || "";
    setList((current) =>
      current.map((employee) =>
        employee.id === emp.id ? { ...employee, store_id: nextStoreId || null } : employee,
      ),
    );

    try {
      const result = await assignEmployeeStoreFn({
        data: {
          employee_id: emp.id,
          user_id: emp.user_id,
          business_id: business.id,
          store_id: nextStoreId || null,
        },
      });
      if (result && "error" in (result as any)) throw new Error((result as any).error);
      toast.success(
        nextStoreId
          ? `${emp.profiles?.full_name || emp.username || "Employee"} assigned to ${storeNameById[nextStoreId] || "store"}`
          : `${emp.profiles?.full_name || emp.username || "Employee"} unassigned from store`,
      );
    } catch (err: any) {
      setList((current) =>
        current.map((employee) =>
          employee.id === emp.id ? { ...employee, store_id: previousStoreId || null } : employee,
        ),
      );
      toast.error(err.message || "Failed to assign employee to store");
    } finally {
      setSavingStoreAssignmentId(null);
    }
  }

  // Auto-generate Work Account Number
  function generateWorkAccountNumber() {
    if (!business) return;
    const prefix = business.slug.substring(0, 3).toUpperCase();
    const random = Math.floor(1000 + Math.random() * 9000);
    setWorkAccountNumber(`${prefix}-${random}`);
  }

  // Pre-fill form when editing
  function openEdit(emp: EmployeeWithProfile) {
    setEditingEmployee(emp);
    setFullName(emp.profiles?.full_name || "");
    setUsername(emp.username || "");
    setEmail(emp.email || "");
    setPhone(emp.profiles?.phone || "");
    setIdNumber(emp.id_number || "");
    setAccountNumber(emp.account_number || "");
    setRole(emp.role);
    setStoreId(emp.store_id || "");
    setWorkAccountNumber(emp.work_account_number || "");
    setPassword(""); // Keep blank unless resetting
    setIsActive(emp.active);
    setFingerprintRegistered(emp.password_plain ? true : false); // Mock biometric status based on credential
    setProfilePreview(emp.profiles?.avatar_url || null);
    setIdDocPreview(emp.id_document_url || null);
    setProfileFile(null);
    setIdDocFile(null);
    setIsModalOpen(true);
  }

  function openAdd() {
    const staffCount = list.filter((employee) => employee.role !== "owner").length;
    if (packageLimits.maxStaff !== null && staffCount >= packageLimits.maxStaff) {
      setShowStaffLimitModal(true);
      return;
    }
    setEditingEmployee(null);
    setFullName("");
    setUsername("");
    setEmail("");
    setPhone("");
    setIdNumber("");
    setAccountNumber("");
    setRole("cashier");
    setStoreId("");
    setWorkAccountNumber("");
    setPassword("");
    setIsActive(true);
    setFingerprintRegistered(false);
    setProfilePreview(null);
    setIdDocPreview(null);
    setProfileFile(null);
    setIdDocFile(null);
    generateWorkAccountNumber();
    setIsModalOpen(true);
  }

  // Handle files
  function handleProfileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setProfilePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleIdDocChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIdDocFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setIdDocPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  // Submit Handler
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!business) return;

    if (!workAccountNumber.trim()) {
      return toast.error("Work Account Number is required.");
    }
    if (!editingEmployee && !password) {
      return toast.error("Password is required for new employees.");
    }

    if (!editingEmployee) {
      const staffCount = list.filter((employee) => employee.role !== "owner").length;
      if (packageLimits.maxStaff !== null && staffCount >= packageLimits.maxStaff) {
        setShowStaffLimitModal(true);
        return;
      }
    }

    setSubmitting(true);
    try {
      let finalProfileUrl = profilePreview;
      let finalIdDocUrl = idDocPreview;

      // 1. Upload Profile Picture if selected
      if (profileFile) {
        const fileExt = profileFile.name.split(".").pop();
        const fileName = `${business.id}/${Date.now()}-profile.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("profiles")
          .upload(fileName, profileFile, { upsert: true });

        if (uploadError)
          throw new Error("Failed to upload profile picture: " + uploadError.message);
        const {
          data: { publicUrl },
        } = supabase.storage.from("profiles").getPublicUrl(fileName);
        finalProfileUrl = publicUrl;
      }

      // 2. Upload ID Document Copy if selected
      if (idDocFile) {
        const fileExt = idDocFile.name.split(".").pop();
        const fileName = `${business.id}/${Date.now()}-iddoc.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("IDs")
          .upload(fileName, idDocFile, { upsert: true });

        if (uploadError)
          throw new Error("Failed to upload ID document copy: " + uploadError.message);
        const {
          data: { publicUrl },
        } = supabase.storage.from("IDs").getPublicUrl(fileName);
        finalIdDocUrl = publicUrl;
      }

      if (editingEmployee) {
        // Edit Action
        const result = await updateEmployeeFn({
          data: {
            employee_id: editingEmployee.id,
            user_id: editingEmployee.user_id,
            business_id: business.id,
            username,
            full_name: fullName,
            email,
            phone,
            id_number: idNumber,
            id_document_url: finalIdDocUrl,
            account_number: accountNumber,
            work_account_number: workAccountNumber,
            password: password || undefined,
            role,
            permissions: editingEmployee.permissions || [],
            active: isActive,
            profile_picture_url: finalProfileUrl,
            store_id: storeId || null,
          },
        });
        if (result && "error" in (result as any)) {
          throw new Error((result as any).error);
        }
        toast.success("Employee details updated");
      } else {
        const result = await createEmployeeFn({
          data: {
            business_id: business.id,
            username,
            full_name: fullName,
            email,
            phone,
            id_number: idNumber,
            id_document_url: finalIdDocUrl,
            account_number: accountNumber,
            work_account_number: workAccountNumber,
            password,
            role,
            profile_picture_url: finalProfileUrl,
            store_id: storeId || null,
          },
        });
        if (result && "error" in (result as any)) {
          throw new Error((result as any).error);
        }

        const emailStatus = (result as any).emailStatus;
        if (emailStatus) {
          if (emailStatus.simulated) {
            toast.success(
              "Employee created successfully! (Simulated credentials email logged to server console)",
            );
          } else if (emailStatus.success) {
            toast.success("Employee created successfully and credentials email sent!");
          } else {
            toast.success("Employee created successfully!");
            toast.warning(`Credentials email failed: ${emailStatus.error || "Unknown error"}`);
          }
        } else {
          toast.success("Employee created successfully!");
        }
      }

      setIsModalOpen(false);
      loadEmployees();
    } catch (err: any) {
      toast.error(err.message || "Operation failed");
    } finally {
      setSubmitting(false);
    }
  }

  // Delete Handler
  async function handleDelete(emp: EmployeeWithProfile) {
    if (!business) return;
    if (
      !confirm(
        `Are you sure you want to remove ${emp.profiles?.full_name || "this employee"}? This will permanently delete their account.`,
      )
    )
      return;

    toast.loading("Removing employee...", { id: "delete-emp" });
    try {
      const result = await deleteEmployeeFn({
        data: {
          employee_id: emp.id,
          user_id: emp.user_id,
          business_id: business.id,
        },
      });

      if (result && "error" in (result as any)) {
        throw new Error((result as any).error);
      }
      toast.success("Employee removed successfully", { id: "delete-emp" });
      loadEmployees();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove employee", { id: "delete-emp" });
    }
  }

  function goToPackagePage() {
    setShowStaffLimitModal(false);
    nav({ to: "/t/$slug/package", params: { slug: business.slug } });
  }

  if (!business) return null;

  return (
    <div className="w-full p-4 md:p-8 space-y-6">
      {showStaffLimitModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border/70 bg-background/95 shadow-2xl backdrop-blur">
            <div className="relative p-6">
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-primary/25 via-violet-500/10 to-transparent" />
              <div className="relative">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-semibold tracking-tight">Staff limit reached</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {packageLimits.name} allows up to {formatLimit(packageLimits.maxStaff)} staff.
                  Upgrade your package to add more team members.
                </p>
                <div className="mt-5 rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Current package</span>
                    <span className="font-medium">{packageLimits.name}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Staff included</span>
                    <span className="font-medium">{formatLimit(packageLimits.maxStaff)}</span>
                  </div>
                </div>
                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => setShowStaffLimitModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="button" className="gradient-violet rounded-2xl" onClick={goToPackagePage}>
                    Upgrade package
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 md:p-8 shadow-sm">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary/20 via-blue-500/10 to-transparent" />
        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <ShieldAlert className="h-3.5 w-3.5" /> Workforce control center
            </div>
            <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">Employees</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage staff profiles, credentials, roles, store assignments, and access readiness.
            </p>
          </div>
          <Button
            onClick={openAdd}
            className="gradient-violet text-white border-0 h-11 gap-2 cursor-pointer shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="h-4 w-4" /> Add Employee
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: "Team members",
            value: String(list.length),
            helper: `${filteredList.length} visible`,
            icon: UserCog,
            tone: "from-primary/25 to-primary/5",
          },
          {
            label: "Active staff",
            value: String(list.filter((e) => e.active).length),
            helper: "Enabled for work",
            icon: UserCheck,
            tone: "from-emerald-500/25 to-emerald-500/5",
          },
          {
            label: "Inactive staff",
            value: String(list.filter((e) => !e.active).length),
            helper: "Disabled accounts",
            icon: UserX,
            tone: "from-rose-500/25 to-rose-500/5",
          },
          {
            label: "Assigned stores",
            value: `${list.filter((e: any) => e.store_id).length}/${list.length}`,
            helper: `${stores.length} stores available`,
            icon: Store,
            tone: "from-amber-500/25 to-amber-500/5",
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border border-border/50 bg-gradient-to-br ${card.tone} p-5 shadow-sm`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{card.label}</span>
              <card.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-4 text-2xl font-bold truncate">{card.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{card.helper}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" /> Assign employees to stores
            </h2>
            <p className="text-xs text-muted-foreground">
              Choose which store each employee works from. This controls their dashboard and POS
              inventory access.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            {stores.length} store{stores.length === 1 ? "" : "s"} available
          </div>
        </div>

        {stores.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground text-center">
            Create stores first before assigning employees.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border bg-muted/20">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Current store</th>
                  <th className="p-3">Assign store</th>
                </tr>
              </thead>
              <tbody>
                {list
                  .filter((emp) => emp.role !== "owner")
                  .map((emp) => (
                    <tr key={emp.id} className="border-b border-border/40 last:border-0">
                      <td className="p-3">
                        <div className="font-medium">
                          {emp.profiles?.full_name || emp.username || "Unnamed"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {emp.work_account_number || emp.email || "No work ID"}
                        </div>
                      </td>
                      <td className="p-3 capitalize text-muted-foreground">{emp.role}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-semibold">
                          <Store className="h-3 w-3 text-primary" />
                          {emp.store_id ? storeNameById[emp.store_id] || "Unknown store" : "Headquarters"}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <select
                            className="h-10 min-w-48 rounded-md border border-border bg-background px-3 text-sm"
                            value={emp.store_id || ""}
                            disabled={savingStoreAssignmentId === emp.id}
                            onChange={(event) => assignEmployeeToStore(emp, event.target.value)}
                          >
                            <option value="">No specific store</option>
                            {stores.map((store) => (
                              <option key={store.id} value={store.id}>
                                {store.name}
                              </option>
                            ))}
                          </select>
                          {savingStoreAssignmentId === emp.id && (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Employee activity tracking
            </h2>
            <p className="text-xs text-muted-foreground">
              Weekly login sessions, working hours, sales volume, and checkout speed.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadEmployeeActivity} className="gap-2">
            <Clock className="h-4 w-4" /> Refresh activity
          </Button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border bg-muted/20">
              <tr>
                <th className="p-3">Employee</th>
                <th className="p-3 text-right">Logins</th>
                <th className="p-3 text-right">Hours</th>
                <th className="p-3 text-right">Sales</th>
                <th className="p-3 text-right">Receipts</th>
                <th className="p-3 text-right">Avg Speed</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((emp) => {
                const activity = activitySummary[emp.id] || {
                  logins: 0,
                  hours: 0,
                  sales: 0,
                  saleCount: 0,
                  avgCheckout: 0,
                  checkoutCount: 0,
                };
                return (
                  <tr
                    key={emp.id}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/20"
                  >
                    <td className="p-3">
                      <div className="font-medium">
                        {emp.profiles?.full_name || emp.username || "Unnamed"}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">{emp.role}</div>
                    </td>
                    <td className="p-3 text-right font-semibold">{activity.logins}</td>
                    <td className="p-3 text-right font-semibold">{activity.hours}h</td>
                    <td className="p-3 text-right font-semibold">
                      {formatMoney(activity.sales, business.currency || "KES")}
                    </td>
                    <td className="p-3 text-right font-semibold">{activity.saleCount}</td>
                    <td className="p-3 text-right font-semibold">
                      {activity.avgCheckout ? `${activity.avgCheckout}s` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl bg-muted/30 p-3">
            <TrendingUp className="h-4 w-4 text-primary mb-1" /> Use sales and speed to identify
            peak performers.
          </div>
          <div className="rounded-xl bg-muted/30 p-3">
            <Clock className="h-4 w-4 text-primary mb-1" /> Login sessions support working-hours
            tracking.
          </div>
          <div className="rounded-xl bg-muted/30 p-3">
            <ShieldAlert className="h-4 w-4 text-primary mb-1" /> Shift enforcement activates after
            applying the shift migration.
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-11"
            placeholder="Search by name, username, work account or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select
            className="h-11 rounded-md border border-border bg-card px-3 text-sm min-w-[140px]"
            value={selectedRoleFilter}
            onChange={(e) => setSelectedRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="cashier">Cashier</option>
          </select>
        </div>
      </div>

      {/* Employees Grid */}
      {loading ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading employees...
        </div>
      ) : filteredList.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center max-w-xl mx-auto">
          <UserCog className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No employees found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Try modifying your search or filters, or add a new employee above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredList.map((emp) => (
            <div
              key={emp.id}
              className={`glass rounded-2xl overflow-hidden border transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col ${!emp.active && "opacity-60"}`}
            >
              {/* Profile Card Header */}
              <div className="p-5 flex items-start gap-4 border-b border-border/40 bg-muted/10">
                <div className="h-14 w-14 rounded-full overflow-hidden border border-border shrink-0 bg-muted flex items-center justify-center">
                  {emp.profiles?.avatar_url ? (
                    <img
                      src={emp.profiles.avatar_url}
                      alt={emp.profiles.full_name || "Employee"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserCog className="h-6 w-6 text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base truncate text-foreground">
                    {emp.profiles?.full_name || "Unnamed"}
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium">
                    @{emp.username || "username"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="capitalize px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                      {emp.role}
                    </span>
                    {emp.active ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        <UserCheck className="h-2.5 w-2.5" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-destructive font-bold bg-destructive/10 px-2 py-0.5 rounded-full">
                        <UserX className="h-2.5 w-2.5" /> Inactive
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Body Details */}
              <div className="p-5 space-y-3 flex-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">Work ID</span>
                  <span className="font-mono text-xs font-semibold text-foreground bg-secondary px-2 py-0.5 rounded">
                    {emp.work_account_number || "Not set"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">ID Number</span>
                  <span className="font-medium text-foreground">{emp.id_number || "Not set"}</span>
                </div>
                {emp.account_number && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Account No</span>
                    <span className="font-medium text-foreground font-mono text-xs">
                      {emp.account_number}
                    </span>
                  </div>
                )}
                {emp.store_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Assigned Store</span>
                    <span className="font-medium text-foreground text-xs flex items-center gap-1">
                      <Store className="h-3 w-3" /> {storeNameById[emp.store_id] || "Unknown store"}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-border/40 space-y-2">
                  {emp.profiles?.phone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{emp.profiles.phone}</span>
                    </div>
                  )}
                  {emp.email && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span>{emp.email}</span>
                    </div>
                  )}

                  {/* Fingerprint indicator */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Fingerprint className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>
                      Fingerprint Status:{" "}
                      <span className="font-semibold text-foreground">Registered</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="px-5 py-3 border-t border-border/40 bg-muted/5 flex items-center justify-between">
                {emp.id_document_url ? (
                  <a
                    href={emp.id_document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                  >
                    <FileText className="h-3.5 w-3.5" /> ID Copy
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground italic">No ID document</span>
                )}

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => openEdit(emp)}
                    title="Edit employee"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive cursor-pointer"
                    onClick={() => handleDelete(emp)}
                    title="Delete employee"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal - Add / Edit Employee */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto flex flex-col my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                {editingEmployee ? (
                  <Edit2 className="h-5 w-5 text-primary" />
                ) : (
                  <Plus className="h-5 w-5 text-primary" />
                )}
                {editingEmployee ? "Edit Employee Details" : "Register New Employee"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="space-y-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    required
                    className="mt-1"
                    placeholder="e.g. John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                {/* Username */}
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    required
                    className="mt-1"
                    placeholder="e.g. johndoe"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>

                {/* Phone */}
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    className="mt-1"
                    placeholder="e.g. +254 700 000 000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                {/* Email */}
                <div>
                  <Label htmlFor="email">Personal Email</Label>
                  <Input
                    id="email"
                    type="email"
                    className="mt-1"
                    placeholder="e.g. john@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {/* ID Number */}
                <div>
                  <Label htmlFor="idNumber">National ID Number</Label>
                  <Input
                    id="idNumber"
                    required
                    className="mt-1"
                    placeholder="e.g. 12345678"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                  />
                </div>

                {/* Bank Account Number */}
                <div>
                  <Label htmlFor="accountNumber">Account Number (Salary)</Label>
                  <Input
                    id="accountNumber"
                    className="mt-1"
                    placeholder="e.g. 01100000000000"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />
                </div>

                {/* Role */}
                <div>
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    className="mt-1 w-full h-10 rounded-md border border-border bg-input/30 px-3 text-sm"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="cashier">Cashier</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {/* Assigned Store */}
                <div>
                  <Label htmlFor="store">Assigned Store</Label>
                  <select
                    id="store"
                    className="mt-1 w-full h-10 rounded-md border border-border bg-input/30 px-3 text-sm"
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                  >
                    <option value="">No specific store (Headquarters)</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Toggle */}
                {editingEmployee && (
                  <div className="flex items-center gap-3 pt-6">
                    <Label htmlFor="active" className="cursor-pointer">
                      Active Account
                    </Label>
                    <input
                      id="active"
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                  </div>
                )}
              </div>

              {/* Upload Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Profile Picture Upload */}
                <div className="space-y-2">
                  <Label>Profile Picture</Label>
                  <div className="flex items-center gap-3 border border-dashed border-border rounded-xl p-3 bg-muted/10">
                    <div className="h-14 w-14 rounded-full border border-border overflow-hidden bg-muted flex items-center justify-center shrink-0">
                      {profilePreview ? (
                        <img
                          src={profilePreview}
                          alt="Profile Preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                      )}
                    </div>
                    <label className="px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 cursor-pointer transition-colors">
                      <Upload className="h-3 w-3 inline mr-1" /> Profile Pic
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleProfileChange}
                      />
                    </label>
                  </div>
                </div>

                {/* ID Copy Upload */}
                <div className="space-y-2">
                  <Label>Copy of ID Card</Label>
                  <div className="flex items-center gap-3 border border-dashed border-border rounded-xl p-3 bg-muted/10">
                    <div className="h-14 w-14 rounded border border-border overflow-hidden bg-muted flex items-center justify-center shrink-0">
                      {idDocPreview ? (
                        <img
                          src={idDocPreview}
                          alt="ID preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <FileText className="h-5 w-5 text-muted-foreground/40" />
                      )}
                    </div>
                    <label className="px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 cursor-pointer transition-colors">
                      <Upload className="h-3 w-3 inline mr-1" /> Upload ID
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={handleIdDocChange}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Login Details */}
              <div className="glass rounded-xl p-4 border border-primary/20 bg-primary/5 space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Key className="h-4 w-4 text-primary" /> Workspace Login Credentials
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Work Account Number */}
                  <div>
                    <Label htmlFor="workAccountNumber">Work Account Number</Label>
                    <div className="mt-1 flex items-center rounded-md border border-border bg-background">
                      <Input
                        id="workAccountNumber"
                        required
                        placeholder="EMP-1001"
                        value={workAccountNumber}
                        onChange={(e) => setWorkAccountNumber(e.target.value.toUpperCase())}
                        className="border-0 bg-transparent"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={generateWorkAccountNumber}
                        className="h-9 px-2 text-xs font-semibold hover:bg-muted text-primary cursor-pointer border-l border-border rounded-none"
                      >
                        Auto
                      </Button>
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <Label htmlFor="password">
                      Password{" "}
                      {editingEmployee && (
                        <span className="text-xs text-muted-foreground font-normal">
                          (Leave blank to keep current)
                        </span>
                      )}
                    </Label>
                    <Input
                      id="password"
                      type="text" // Plain text for easy copy by owner
                      required={!editingEmployee}
                      placeholder={editingEmployee ? "••••••••" : "Enter temporary password"}
                      className="mt-1"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                {/* Fingerprint registration switch */}
                <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="h-5 w-5 text-primary" />
                    <div>
                      <div className="text-xs font-semibold">Simulate Fingerprint Biometrics</div>
                      <div className="text-[10px] text-muted-foreground">
                        Allows staff to sign in quickly using biometric mock scanner.
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border"
                    checked={fingerprintRegistered}
                    onChange={(e) => setFingerprintRegistered(e.target.checked)}
                  />
                </div>
              </div>

              {/* Warning label */}
              {!editingEmployee && (
                <div className="text-xs text-amber-500 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 flex gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Staff will log in using this <strong>Work Account Number</strong> and{" "}
                    <strong>Password</strong>. This action creates a secure workspace employee
                    account inside Supabase.
                  </span>
                </div>
              )}

              {/* Footer buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="gradient-violet text-white border-0 px-6 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      {editingEmployee ? "Saving..." : "Creating..."}
                    </>
                  ) : editingEmployee ? (
                    "Save Changes"
                  ) : (
                    "Register Employee"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
