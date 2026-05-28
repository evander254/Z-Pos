import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { 
  UserCog, Search, Plus, Trash2, Edit2, Fingerprint, FileText, Phone, 
  Mail, CreditCard, Loader2, Upload, X, ShieldAlert, UserCheck, UserX, Image as ImageIcon,
  Key
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  createEmployeeFn, 
  updateEmployeeFn, 
  deleteEmployeeFn,
  listMockEmployeesFn
} from "@/lib/employee-actions";

export const Route = createFileRoute("/t/$slug/employees")({ component: Employees });

type EmployeeWithProfile = {
  id: string;
  user_id: string;
  role: string;
  active: boolean;
  username: string | null;
  id_number: string | null;
  id_document_url: string | null;
  account_number: string | null;
  work_account_number: string | null;
  password_plain: string | null;
  email: string | null;
  created_at: string | null;
  profiles: {
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
  } | null;
};

function Employees() {
  const { business } = useTenant();
  const [list, setList] = useState<EmployeeWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
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
  const [workAccountNumber, setWorkAccountNumber] = useState("");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [fingerprintRegistered, setFingerprintRegistered] = useState(false);

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

  useEffect(() => {
    loadEmployees();
  }, [business]);

  // Search & Filter
  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter(e => {
      const matchSearch = 
        (e.profiles?.full_name || "").toLowerCase().includes(q) ||
        (e.username || "").toLowerCase().includes(q) ||
        (e.work_account_number || "").toLowerCase().includes(q) ||
        (e.email || "").toLowerCase().includes(q);
      
      const matchRole = selectedRoleFilter === "all" || e.role === selectedRoleFilter;
      return matchSearch && matchRole;
    });
  }, [list, search, selectedRoleFilter]);

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
    setEditingEmployee(null);
    setFullName("");
    setUsername("");
    setEmail("");
    setPhone("");
    setIdNumber("");
    setAccountNumber("");
    setRole("cashier");
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

        if (uploadError) throw new Error("Failed to upload profile picture: " + uploadError.message);
        const { data: { publicUrl } } = supabase.storage.from("profiles").getPublicUrl(fileName);
        finalProfileUrl = publicUrl;
      }

      // 2. Upload ID Document Copy if selected
      if (idDocFile) {
        const fileExt = idDocFile.name.split(".").pop();
        const fileName = `${business.id}/${Date.now()}-iddoc.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("IDs")
          .upload(fileName, idDocFile, { upsert: true });

        if (uploadError) throw new Error("Failed to upload ID document copy: " + uploadError.message);
        const { data: { publicUrl } } = supabase.storage.from("IDs").getPublicUrl(fileName);
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
            active: isActive,
            profile_picture_url: finalProfileUrl
          }
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
            profile_picture_url: finalProfileUrl
          }
        });
        if (result && "error" in (result as any)) {
          throw new Error((result as any).error);
        }
        
        const emailStatus = (result as any).emailStatus;
        if (emailStatus) {
          if (emailStatus.simulated) {
            toast.success("Employee created successfully! (Simulated credentials email logged to server console)");
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
    if (!confirm(`Are you sure you want to remove ${emp.profiles?.full_name || "this employee"}? This will permanently delete their account.`)) return;

    toast.loading("Removing employee...", { id: "delete-emp" });
    try {
      const result = await deleteEmployeeFn({
        data: {
          employee_id: emp.id,
          user_id: emp.user_id,
          business_id: business.id
        }
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

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCog className="h-6 w-6 text-primary" /> Employees
          </h1>
          <p className="text-sm text-muted-foreground">Manage your staff details, login credentials, and permission settings.</p>
        </div>
        <Button onClick={openAdd} className="gradient-violet text-white border-0 gap-2 cursor-pointer shadow-md hover:shadow-lg transition-all">
          <Plus className="h-4 w-4" /> Add Employee
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            className="pl-9 h-11" 
            placeholder="Search by name, username, work account or email..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
        <div className="flex gap-2">
          <select 
            className="h-11 rounded-md border border-border bg-card px-3 text-sm min-w-[140px]" 
            value={selectedRoleFilter} 
            onChange={e => setSelectedRoleFilter(e.target.value)}
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
          <p className="text-sm text-muted-foreground mt-1">Try modifying your search or filters, or add a new employee above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredList.map(emp => (
            <div key={emp.id} className={`glass rounded-2xl overflow-hidden border transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col ${!emp.active && "opacity-60"}`}>
              {/* Profile Card Header */}
              <div className="p-5 flex items-start gap-4 border-b border-border/40 bg-muted/10">
                <div className="h-14 w-14 rounded-full overflow-hidden border border-border shrink-0 bg-muted flex items-center justify-center">
                  {emp.profiles?.avatar_url ? (
                    <img src={emp.profiles.avatar_url} alt={emp.profiles.full_name || "Employee"} className="h-full w-full object-cover" />
                  ) : (
                    <UserCog className="h-6 w-6 text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base truncate text-foreground">{emp.profiles?.full_name || "Unnamed"}</h3>
                  <p className="text-xs text-muted-foreground font-medium">@{emp.username || "username"}</p>
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
                    <span className="font-medium text-foreground font-mono text-xs">{emp.account_number}</span>
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
                    <span>Fingerprint Status: <span className="font-semibold text-foreground">Registered</span></span>
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
                {editingEmployee ? <Edit2 className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                {editingEmployee ? "Edit Employee Details" : "Register New Employee"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
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
                    onChange={e => setFullName(e.target.value)}
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
                    onChange={e => setUsername(e.target.value)}
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
                    onChange={e => setPhone(e.target.value)}
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
                    onChange={e => setEmail(e.target.value)}
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
                    onChange={e => setIdNumber(e.target.value)}
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
                    onChange={e => setAccountNumber(e.target.value)}
                  />
                </div>

                {/* Role */}
                <div>
                  <Label htmlFor="role">Role</Label>
                  <select 
                    id="role"
                    className="mt-1 w-full h-10 rounded-md border border-border bg-input/30 px-3 text-sm"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                  >
                    <option value="cashier">Cashier</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {/* Status Toggle */}
                {editingEmployee && (
                  <div className="flex items-center gap-3 pt-6">
                    <Label htmlFor="active" className="cursor-pointer">Active Account</Label>
                    <input 
                      id="active"
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={isActive}
                      onChange={e => setIsActive(e.target.checked)}
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
                        <img src={profilePreview} alt="Profile Preview" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                      )}
                    </div>
                    <label className="px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 cursor-pointer transition-colors">
                      <Upload className="h-3 w-3 inline mr-1" /> Profile Pic
                      <input type="file" accept="image/*" className="hidden" onChange={handleProfileChange} />
                    </label>
                  </div>
                </div>

                {/* ID Copy Upload */}
                <div className="space-y-2">
                  <Label>Copy of ID Card</Label>
                  <div className="flex items-center gap-3 border border-dashed border-border rounded-xl p-3 bg-muted/10">
                    <div className="h-14 w-14 rounded border border-border overflow-hidden bg-muted flex items-center justify-center shrink-0">
                      {idDocPreview ? (
                        <img src={idDocPreview} alt="ID preview" className="h-full w-full object-cover" />
                      ) : (
                        <FileText className="h-5 w-5 text-muted-foreground/40" />
                      )}
                    </div>
                    <label className="px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 cursor-pointer transition-colors">
                      <Upload className="h-3 w-3 inline mr-1" /> Upload ID
                      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleIdDocChange} />
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
                        onChange={e => setWorkAccountNumber(e.target.value.toUpperCase())}
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
                      Password {editingEmployee && <span className="text-xs text-muted-foreground font-normal">(Leave blank to keep current)</span>}
                    </Label>
                    <Input 
                      id="password" 
                      type="text" // Plain text for easy copy by owner
                      required={!editingEmployee}
                      placeholder={editingEmployee ? "••••••••" : "Enter temporary password"}
                      className="mt-1"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                {/* Fingerprint registration switch */}
                <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="h-5 w-5 text-primary" />
                    <div>
                      <div className="text-xs font-semibold">Simulate Fingerprint Biometrics</div>
                      <div className="text-[10px] text-muted-foreground">Allows staff to sign in quickly using biometric mock scanner.</div>
                    </div>
                  </div>
                  <input 
                    type="checkbox"
                    className="h-4 w-4 rounded border-border"
                    checked={fingerprintRegistered}
                    onChange={e => setFingerprintRegistered(e.target.checked)}
                  />
                </div>
              </div>

              {/* Warning label */}
              {!editingEmployee && (
                <div className="text-xs text-amber-500 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 flex gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Staff will log in using this <strong>Work Account Number</strong> and <strong>Password</strong>. This action creates a secure workspace employee account inside Supabase.
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
                  ) : (
                    editingEmployee ? "Save Changes" : "Register Employee"
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
