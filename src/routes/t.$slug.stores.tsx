import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant-context";
import { supabase } from "@/integrations/supabase/client";
import { Store, Plus, Loader2, MapPin, Edit, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/t/$slug/stores")({ component: StoresManagement });

type StoreData = {
  id: string;
  name: string;
  location: string | null;
  store_type: string | null;
  active: boolean | null;
  phone: string | null;
  email: string | null;
  manager_name: string | null;
  created_at: string;
};

function StoresManagement() {
  const { business, role } = useTenant();
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<StoreData[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newStore, setNewStore] = useState({ 
    name: "", 
    location: "",
    store_type: "Retail Outlet",
    active: true,
    phone: "",
    email: "",
    manager_name: ""
  });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (business) loadStores();
  }, [business]);

  async function loadStores() {
    if (!business) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("business_id", business.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setStores(data || []);
    } catch (e: any) {
      toast.error("Failed to load stores: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveStore(e: React.FormEvent) {
    e.preventDefault();
    if (!business || !newStore.name.trim()) return;

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("stores")
          .update({ 
            name: newStore.name, 
            location: newStore.location,
            store_type: newStore.store_type,
            active: newStore.active,
            phone: newStore.phone,
            email: newStore.email,
            manager_name: newStore.manager_name
          })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Store updated");
      } else {
        const { error } = await supabase
          .from("stores")
          .insert({
            business_id: business.id,
            name: newStore.name,
            location: newStore.location,
            store_type: newStore.store_type,
            active: newStore.active,
            phone: newStore.phone,
            email: newStore.email,
            manager_name: newStore.manager_name
          });
        if (error) throw error;
        toast.success("Store added");
      }
      setIsAddOpen(false);
      setNewStore({ 
        name: "", location: "", store_type: "Retail Outlet", 
        active: true, phone: "", email: "", manager_name: "" 
      });
      setEditingId(null);
      loadStores();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(store: StoreData) {
    setEditingId(store.id);
    setNewStore({ 
      name: store.name, 
      location: store.location || "",
      store_type: store.store_type || "Retail Outlet",
      active: store.active ?? true,
      phone: store.phone || "",
      email: store.email || "",
      manager_name: store.manager_name || ""
    });
    setIsAddOpen(true);
  }

  async function deleteStore(id: string) {
    if (!confirm("Are you sure you want to delete this store? All associated data might be affected.")) return;
    try {
      const { error } = await supabase.from("stores").delete().eq("id", id);
      if (error) throw error;
      toast.success("Store deleted");
      loadStores();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (!business) return null;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold">Stores Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage multiple store locations and branches.</p>
        </div>
        
        {role === "owner" && (
          <Dialog open={isAddOpen} onOpenChange={(open) => {
            setIsAddOpen(open);
            if (!open) {
              setNewStore({ 
                name: "", location: "", store_type: "Retail Outlet", 
                active: true, phone: "", email: "", manager_name: "" 
              });
              setEditingId(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gradient-violet gap-2">
                <Plus className="h-4 w-4" /> Add Store
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px]">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Store" : "Add New Store"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveStore} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Left Column: Basic Info */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground border-b border-border/50 pb-2">General Info</h3>
                    
                    <div className="space-y-2">
                      <Label>Store Name <span className="text-red-500">*</span></Label>
                      <Input required value={newStore.name} onChange={e => setNewStore({...newStore, name: e.target.value})} placeholder="e.g. Downtown Branch" />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Store Type</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={newStore.store_type}
                        onChange={e => setNewStore({...newStore, store_type: e.target.value})}
                      >
                        <option value="Retail Outlet">Retail Outlet</option>
                        <option value="Wholesale">Wholesale</option>
                        <option value="Warehouse/Store">Warehouse/Store</option>
                      </select>
                    </div>
                    
                    <div className="flex items-center space-x-2 pt-2">
                      <input 
                        id="active-status" 
                        type="checkbox" 
                        className="h-4 w-4 rounded border-border cursor-pointer"
                        checked={newStore.active} 
                        onChange={e => setNewStore({...newStore, active: e.target.checked})} 
                      />
                      <Label htmlFor="active-status" className="cursor-pointer font-medium">Status (Active/Inactive)</Label>
                    </div>
                  </div>

                  {/* Right Column: Contact & Location */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground border-b border-border/50 pb-2">Contact Details</h3>
                    
                    <div className="space-y-2">
                      <Label>Location / Address <span className="text-red-500">*</span></Label>
                      <Input required value={newStore.location} onChange={e => setNewStore({...newStore, location: e.target.value})} placeholder="e.g. 123 Main St" />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <Input type="tel" value={newStore.phone} onChange={e => setNewStore({...newStore, phone: e.target.value})} placeholder="e.g. +254 700 000000" />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Branch Email</Label>
                      <Input type="email" value={newStore.email} onChange={e => setNewStore({...newStore, email: e.target.value})} placeholder="e.g. branch@example.com" />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Manager In-Charge</Label>
                      <Input value={newStore.manager_name} onChange={e => setNewStore({...newStore, manager_name: e.target.value})} placeholder="e.g. Jane Doe" />
                    </div>
                  </div>
                  
                </div>
                
                <Button type="submit" className="w-full bg-[#00a699] hover:bg-[#008c82] text-white mt-2 border-0" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {saving ? "Saving Store..." : "Save Store"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 shadow-sm border border-border/60">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Store className="h-4 w-4 text-white" />
          </div>
          <div className="font-medium">All Stores</div>
        </div>
        
        <div className="rounded-xl border border-border bg-background/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Store Name</TableHead>
                <TableHead>Location</TableHead>
                {role === "owner" && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1, 2].map(i => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-4 w-48 bg-muted animate-pulse rounded"></div></TableCell>
                    {role === "owner" && <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto"></div></TableCell>}
                  </TableRow>
                ))
              ) : stores.length === 0 ? (
                 <TableRow>
                   <TableCell colSpan={role === "owner" ? 3 : 2} className="text-center py-8 text-muted-foreground">No stores found. Add your first store above.</TableCell>
                 </TableRow>
              ) : (
                stores.map(store => (
                  <TableRow key={store.id} className="group">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-muted-foreground" />
                        {store.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {store.location || "-"}
                      </div>
                    </TableCell>
                    {role === "owner" && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(store)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => deleteStore(store.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </motion.div>
    </div>
  );
}
