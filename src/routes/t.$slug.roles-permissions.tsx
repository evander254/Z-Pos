import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, ShieldAlert, ShieldCheck, UserCog, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { listMockEmployeesFn, updateEmployeePermissionsFn } from "@/lib/employee-actions";
import { useTenant } from "@/lib/tenant-context";
import { useBusinessRealtime } from "@/lib/use-business-realtime";

export const Route = createFileRoute("/t/$slug/roles-permissions")({
  component: RolesPermissions,
});

type StaffMember = {
  id: string;
  role: string;
  permissions: string[] | null;
  active: boolean;
  username: string | null;
  email: string | null;
  work_account_number: string | null;
  profiles: {
    full_name: string | null;
  } | null;
};

const PERMISSION_OPTIONS = [
  { key: "dashboard", label: "Dashboard", description: "View the workspace dashboard." },
  { key: "pos", label: "POS", description: "Sell and process checkout transactions." },
  { key: "stores", label: "Multi-branch support", description: "View and manage branch records." },
  {
    key: "employees",
    label: "Employee management",
    description: "View staff records and employee operations.",
  },
  {
    key: "roles_permissions",
    label: "Roles & permissions",
    description: "Assign access to other non-owner staff.",
  },
  {
    key: "offline_mode",
    label: "Offline mode",
    description: "Use the device offline mode controls.",
  },
  {
    key: "finance",
    label: "Finance",
    description: "Access insights, cash flow, expenses, and reconciliation modules.",
  },
  {
    key: "inventory",
    label: "Inventory",
    description: "Access products, purchase orders, transfers, stock takes, and returns.",
  },
  {
    key: "customers",
    label: "Customer management",
    description: "Access customers, loyalty, wallets, credit, and communication tools.",
  },
  {
    key: "sales_reports",
    label: "Sales reports",
    description: "View sales and business performance reports.",
  },
  {
    key: "suppliers",
    label: "Supplier management",
    description: "Manage supplier contacts and purchasing workflows.",
  },
  { key: "settings", label: "Settings", description: "Access workspace settings." },
];

function getStaffName(staff: StaffMember) {
  return (
    staff.profiles?.full_name ||
    staff.username ||
    staff.email ||
    staff.work_account_number ||
    "Unnamed staff"
  );
}

function RolesPermissions() {
  const { business, role } = useTenant();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const selectableStaff = useMemo(() => staff.filter((member) => member.role !== "owner"), [staff]);
  const selectedStaff = useMemo(
    () => selectableStaff.find((member) => member.id === selectedStaffId) || null,
    [selectableStaff, selectedStaffId],
  );

  function loadStaff() {
    if (!business) return;
    setLoading(true);
    supabase
      .from("employees")
      .select(
        "id, role, permissions, active, username, email, work_account_number, profiles(full_name)",
      )
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .then(async ({ data, error }) => {
        let dbStaff: StaffMember[] = [];
        if (error) {
          console.error("Failed to load staff for permissions:", error);
        } else {
          dbStaff = (data || []) as unknown as StaffMember[];
        }

        try {
          const mockResult = await listMockEmployeesFn({ data: { business_id: business.id } });
          if (mockResult && "employees" in mockResult) {
            dbStaff = [...(mockResult.employees as StaffMember[]), ...dbStaff];
          }
        } catch (mockError) {
          console.error("Failed to load simulated staff for permissions:", mockError);
        }

        setStaff(dbStaff);
        setLoading(false);
      });
  }

  useEffect(() => {
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business]);

  useBusinessRealtime(business?.id, ["employees"], loadStaff);

  useEffect(() => {
    if (selectableStaff.length === 0) return;
    if (!selectedStaffId || !selectableStaff.some((member) => member.id === selectedStaffId)) {
      setSelectedStaffId(selectableStaff[0].id);
    }
  }, [selectableStaff, selectedStaffId]);

  useEffect(() => {
    setSelectedPermissions(
      Array.isArray(selectedStaff?.permissions) ? selectedStaff.permissions : [],
    );
  }, [selectedStaff]);

  function togglePermission(permission: string) {
    setSelectedPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    );
  }

  async function savePermissions() {
    if (!business || !selectedStaff) return;
    setSaving(true);
    try {
      await updateEmployeePermissionsFn({
        data: {
          business_id: business.id,
          employee_id: selectedStaff.id,
          permissions: selectedPermissions,
        },
      });
      toast.success("Permissions updated");
      loadStaff();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update permissions");
    } finally {
      setSaving(false);
    }
  }

  if (!business) return null;

  if (role !== "owner") {
    return (
      <div className="w-full p-4 md:p-8">
        <div className="rounded-2xl border border-border/60 bg-card p-8 text-center shadow-sm">
          <UserX className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <h1 className="mt-4 text-2xl font-bold">Owner access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Only business owners can assign roles and permissions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-4 md:p-8 space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 md:p-8 shadow-sm">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary/20 via-blue-500/10 to-transparent" />
        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <ShieldAlert className="h-3.5 w-3.5" /> Access control
            </div>
            <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">
              Roles & permissions
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
              Select staff members who are not owners, then assign exactly which areas of the
              workspace they can access.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/60 p-4 min-w-44">
            <div className="text-2xl font-bold">{selectableStaff.length}</div>
            <div className="text-xs text-muted-foreground">Non-owner staff</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading staff...
        </div>
      ) : selectableStaff.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center max-w-xl mx-auto">
          <UserCog className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No staff available</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add employees in the Employees section before assigning permissions.
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[22rem_1fr] gap-6">
          <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm h-fit">
            <Label htmlFor="staffMember">Staff member</Label>
            <select
              id="staffMember"
              className="mt-1 w-full h-10 rounded-md border border-border bg-input/30 px-3 text-sm"
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
            >
              {selectableStaff.map((member) => (
                <option key={member.id} value={member.id}>
                  {getStaffName(member)} · {member.role}
                </option>
              ))}
            </select>

            {selectedStaff && (
              <div className="mt-4 rounded-xl bg-muted/20 p-4 text-sm space-y-2">
                <div className="font-semibold">{getStaffName(selectedStaff)}</div>
                <div className="text-xs text-muted-foreground capitalize">
                  Current role: {selectedStaff.role}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedPermissions.length} permission
                  {selectedPermissions.length === 1 ? "" : "s"} selected
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
              <div>
                <h2 className="font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Workspace permissions
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Checked permissions appear in the staff member's sidebar and are allowed by the
                  workspace guard.
                </p>
              </div>
              <Button
                type="button"
                onClick={savePermissions}
                disabled={saving || !selectedStaff}
                className="gradient-violet text-white border-0 cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save permissions
              </Button>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              {PERMISSION_OPTIONS.map((permission) => (
                <label
                  key={permission.key}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/10 p-4 text-sm cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-border"
                    checked={selectedPermissions.includes(permission.key)}
                    onChange={() => togglePermission(permission.key)}
                  />
                  <span>
                    <span className="block font-medium">{permission.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {permission.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
