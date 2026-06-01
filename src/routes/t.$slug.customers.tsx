import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/t/$slug/customers")({ component: Customers });

type Customer = { id: string; full_name: string | null; phone: string | null; email: string | null; loyalty_points: number };

function Customers() {
  const { business } = useTenant();
  const [list, setList] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "" });
  async function load() {
    if (!business) return;
    const { data } = await supabase.from("customers").select("id,full_name,phone,email,loyalty_points")
      .eq("business_id", business.id).order("created_at", { ascending: false });
    setList((data || []) as Customer[]);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [business]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); if (!business) return;
    const { error } = await supabase.from("customers").insert({ business_id: business.id, ...form });
    if (error) return toast.error(error.message);
    toast.success("Customer added"); setOpen(false); setForm({ full_name: "", phone: "", email: "" }); load();
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground">Build a loyal customer base.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gradient-violet text-white border-0"><Plus className="h-4 w-4 mr-1" /> New customer</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add customer</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-3">
              <div><Label>Full name</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <Button type="submit" className="w-full gradient-violet text-white border-0">Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {list.length === 0 ? (
        <div className="mt-10 glass rounded-2xl p-12 text-center">
          <Users className="h-10 w-10 text-muted-foreground mx-auto" />
          <div className="mt-3 font-semibold">No customers yet</div>
        </div>
      ) : (
        <div className="mt-6 glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
              <tr><th className="p-4">Name</th><th className="p-4">Phone</th><th className="p-4">Email</th><th className="p-4 text-right">Loyalty</th></tr>
            </thead>
            <tbody>
              {list.map(c => (
                <tr key={c.id} className="border-b border-border/40 last:border-0">
                  <td className="p-4 font-medium">{c.full_name || "—"}</td>
                  <td className="p-4 text-muted-foreground">{c.phone || "—"}</td>
                  <td className="p-4 text-muted-foreground">{c.email || "—"}</td>
                  <td className="p-4 text-right">{c.loyalty_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
