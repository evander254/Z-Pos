import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";

export type Business = Database["public"]["Tables"]["businesses"]["Row"];
export type Employee = Database["public"]["Tables"]["employees"]["Row"];

interface TenantCtx {
  business: Business | null;
  employee: Employee | null;
  role: 'owner' | 'admin' | 'manager' | 'cashier' | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<TenantCtx>({ 
  business: null, 
  employee: null,
  role: null,
  loading: true, 
  refresh: async () => {} 
});

export function TenantProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const { user } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [role, setRole] = useState<'owner' | 'admin' | 'manager' | 'cashier' | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: bizData } = await supabase.from("businesses").select("*").eq("slug", slug).maybeSingle();
    const currentBiz = bizData as Business | null;
    setBusiness(currentBiz);

    if (currentBiz && user) {
      let currentEmp: Employee | null = null;
      if (typeof window !== 'undefined') {
        const storedEmp = localStorage.getItem("zpos-mock-employee");
        if (storedEmp) {
          try {
            const parsed = JSON.parse(storedEmp);
            if (parsed.user_id === user.id) {
              currentEmp = parsed;
            }
          } catch (e) {
            console.error("Failed to parse mock employee", e);
          }
        }
      }

      if (currentEmp) {
        setEmployee(currentEmp);
        setRole(currentEmp.role as 'owner' | 'admin' | 'manager' | 'cashier');
      } else {
        const { data: empData } = await supabase
          .from("employees")
          .select("*, profiles(*)")
          .eq("business_id", currentBiz.id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (empData) {
          setEmployee(empData as any);
          setRole(empData.role as 'owner' | 'admin' | 'manager' | 'cashier');
        } else if (currentBiz.owner_id === user.id) {
          const { data: ownerProfile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

          setEmployee({
            user_id: user.id,
            role: "owner",
            profiles: ownerProfile
          } as any);
          setRole("owner");
        } else {
          setEmployee(null);
          setRole(null);
        }
      }
    } else {
      setEmployee(null);
      setRole(null);
    }
    setLoading(false);
  }
  
  useEffect(() => { 
    load(); 
    /* eslint-disable-next-line */ 
  }, [slug, user]);

  return (
    <Ctx.Provider value={{ business, employee, role, loading, refresh: load }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTenant = () => useContext(Ctx);
