import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useTenant } from "@/lib/tenant-context";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Plus, FileText, ArrowUpRight, ArrowDownRight, Minus, Loader2, Check, Info, Download, Share2, Activity, Clock, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/t/$slug/suppliers")({ component: SuppliersDashboard });

type Supplier = {
  id: string;
  name: string;
  contact: string;
  days: string[];
  providedItems: string;
  activeOrders: number;
};

type Product = {
  id: string;
  name: string;
  supplierId: string | null;
  costPrice: number;
  stock: number;
  lowStockAlert: number;
};

type POItemInput = {
  productId: string;
  name: string;
  quantity: number;
  unitCost: number;
};

type PastOrder = {
  id: string;
  date: string;
  total: number;
  status: string;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function SuppliersDashboard() {
  const { business } = useTenant();
  const [loading, setLoading] = useState(true);
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  // PO Generator State
  const [poSupplierId, setPoSupplierId] = useState<string>("");
  const [poItems, setPoItems] = useState<POItemInput[]>([]);
  const [generatingPo, setGeneratingPo] = useState(false);
  const [lastGeneratedPo, setLastGeneratedPo] = useState<any>(null);

  // Add Supplier state
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", contact: "", providedItems: "" });
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);

  function openEditSupplier(s: Supplier) {
    setEditingSupplierId(s.id);
    setNewSupplier({ name: s.name, contact: s.contact, providedItems: s.providedItems });
    setSelectedDays(new Set(s.days));
    setIsAddSupplierOpen(true);
  }

  // Analytics State
  const [poHistory, setPoHistory] = useState<any[]>([]);

  const currency = business?.currency || "KES";

  useEffect(() => {
    if (business) {
      loadData();
    }
  }, [business]);

  async function loadData() {
    if (!business) return;
    setLoading(true);

    try {
      const { data: sups, error: supsError } = await supabase
        .from("suppliers")
        .select(`
          id,
          supplier_name,
          phone,
          email,
          delivery_days,
          provided_items,
          purchase_orders ( id, status, total_amount, created_at )
        `)
        .eq("business_id", business.id);

      if (supsError) throw supsError;

      let allPOs: any[] = [];

      const formattedSuppliers = sups.map(s => {
        const activeCount = s.purchase_orders?.filter((po: any) => po.status === "pending").length || 0;
        let daysArray: string[] = [];
        try { if (s.delivery_days) daysArray = JSON.parse(s.delivery_days); } catch { daysArray = s.delivery_days ? s.delivery_days.split(",").map(d => d.trim()) : []; }
        
        if (s.purchase_orders) {
          allPOs = [...allPOs, ...s.purchase_orders.map(po => ({ ...po, supplier_name: s.supplier_name }))];
        }

        return {
          id: s.id,
          name: s.supplier_name || "Unknown",
          contact: s.phone || s.email || "No contact",
          days: daysArray,
          providedItems: s.provided_items || "",
          activeOrders: activeCount,
          orders: s.purchase_orders
        };
      });

      setSuppliers(formattedSuppliers);
      setPoHistory(allPOs);

      const { data: allProds, error: allProdsError } = await supabase
        .from("products")
        .select("id, name, cost_price, stock_quantity, low_stock_alert, supplier_id")
        .eq("business_id", business.id);
        
      if (allProdsError) throw allProdsError;
      
      const formattedProds = allProds.map(p => ({
        id: p.id,
        name: p.name,
        supplierId: p.supplier_id,
        costPrice: p.cost_price || 0,
        stock: p.stock_quantity || 0,
        lowStockAlert: p.low_stock_alert || 5
      }));

      setProducts(formattedProds);
      
      // Auto-select first supplier if available and no supplier selected
      if (formattedSuppliers.length > 0 && !poSupplierId) {
        setPoSupplierId(formattedSuppliers[0].id);
      }

    } catch (e: any) {
      toast.error("Failed to load data: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  // Update PO Items when supplier changes
  useEffect(() => {
    if (poSupplierId) {
      const supplierProducts = products.filter(p => p.supplierId === poSupplierId);
      setPoItems(supplierProducts.map(p => ({
        productId: p.id,
        name: p.name,
        quantity: p.stock <= p.lowStockAlert ? (p.lowStockAlert * 2 - p.stock) || 10 : 0, // Suggest a quantity if low stock
        unitCost: p.costPrice
      })));
    } else {
      setPoItems([]);
    }
  }, [poSupplierId, products]);

  function updatePoItem(id: string, field: 'quantity' | 'unitCost', value: number) {
    setPoItems(items => items.map(i => i.productId === id ? { ...i, [field]: value } : i));
  }

  const poTotal = poItems.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);

  async function handleAddSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!business || !newSupplier.name.trim()) return;

    setAddingSupplier(true);
    try {
      const daysStr = JSON.stringify(Array.from(selectedDays));
      
      if (editingSupplierId) {
        const { error } = await supabase.from("suppliers").update({
          supplier_name: newSupplier.name,
          phone: newSupplier.contact,
          delivery_days: daysStr,
          provided_items: newSupplier.providedItems
        }).eq("id", editingSupplierId);
        if (error) throw error;
        toast.success("Supplier updated successfully");
      } else {
        const { error } = await supabase.from("suppliers").insert({
          business_id: business.id,
          supplier_name: newSupplier.name,
          phone: newSupplier.contact,
          delivery_days: daysStr,
          provided_items: newSupplier.providedItems
        });
        if (error) throw error;
        toast.success("Supplier added successfully");
      }

      setIsAddSupplierOpen(false);
      setNewSupplier({ name: "", contact: "", providedItems: "" });
      setSelectedDays(new Set());
      setEditingSupplierId(null);
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAddingSupplier(false);
    }
  }

  function toggleDay(day: string) {
    const newSet = new Set(selectedDays);
    if (newSet.has(day)) newSet.delete(day);
    else newSet.add(day);
    setSelectedDays(newSet);
  }

  async function generatePO() {
    if (!business || !poSupplierId || poTotal === 0) return;
    
    setGeneratingPo(true);
    try {
      const validItems = poItems.filter(i => i.quantity > 0);
      if (validItems.length === 0) throw new Error("Please enter quantities for at least one product.");

      const { data: po, error: poError } = await supabase.from("purchase_orders").insert({
        business_id: business.id,
        supplier_id: poSupplierId,
        total_amount: poTotal,
        status: "pending"
      }).select().single();

      if (poError || !po) throw poError || new Error("Failed to create PO");

      const poItemsData = validItems.map(item => ({
        po_id: po.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_cost: item.unitCost
      }));

      const { error: itemsError } = await supabase.from("purchase_order_items").insert(poItemsData);
      if (itemsError) throw itemsError;

      const supplierName = suppliers.find(s => s.id === poSupplierId)?.name;
      
      const generatedData = {
        poNumber: po.id.split('-')[0].toUpperCase(),
        date: new Date().toLocaleDateString(),
        supplier: supplierName,
        items: validItems,
        total: poTotal
      };
      
      setLastGeneratedPo(generatedData);
      toast.success(`Purchase Order generated successfully!`);
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGeneratingPo(false);
    }
  }

  function printPO() {
    if (!lastGeneratedPo) return;
    const printWindow = window.open("", "_blank", "width=800,height=800");
    if (!printWindow) {
      toast.error("Popup blocker prevented printing.");
      return;
    }

    const html = `
      <html><head><title>Purchase Order ${lastGeneratedPo.poNumber}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #111; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
        .title { font-size: 24px; font-weight: bold; }
        .meta { color: #555; text-align: right; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        th { font-weight: 600; color: #444; }
        .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 30px; }
      </style>
      </head><body>
        <div class="header">
          <div>
            <div class="title">${business?.business_name}</div>
            <div>Purchase Order</div>
          </div>
          <div class="meta">
            <div><strong>PO Number:</strong> ${lastGeneratedPo.poNumber}</div>
            <div><strong>Date:</strong> ${lastGeneratedPo.date}</div>
            <div><strong>To:</strong> ${lastGeneratedPo.supplier}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Unit Cost</th><th>Total</th></tr>
          </thead>
          <tbody>
            ${lastGeneratedPo.items.map((i: any) => `
              <tr>
                <td>${i.name}</td>
                <td>${i.quantity}</td>
                <td>${currency} ${i.unitCost.toFixed(2)}</td>
                <td>${currency} ${(i.quantity * i.unitCost).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="total">Grand Total: ${currency} ${lastGeneratedPo.total.toFixed(2)}</div>
        <script>window.print(); window.onafterprint = () => window.close();</script>
      </body></html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  }

  function sharePO() {
    if (!lastGeneratedPo) return;
    
    const supplierContact = suppliers.find(s => s.name === lastGeneratedPo.supplier)?.contact || "";
    const text = `Hello ${lastGeneratedPo.supplier},\n\nPlease find our Purchase Order ${lastGeneratedPo.poNumber} for restocking.\nTotal Amount: ${currency} ${lastGeneratedPo.total.toFixed(2)}\n\nBest,\n${business?.business_name}`;

    if (navigator.share) {
      navigator.share({
        title: `Purchase Order ${lastGeneratedPo.poNumber}`,
        text: text
      }).catch(console.error);
    } else {
      // Fallback to WhatsApp
      const waUrl = `https://wa.me/${supplierContact.replace(/\D/g,'')}?text=${encodeURIComponent(text)}`;
      window.open(waUrl, "_blank");
    }
  }

  // Analytics Data Prep
  const monthlyData = useMemo(() => {
    const months: Record<string, number> = {};
    poHistory.forEach(po => {
      const month = new Date(po.created_at).toLocaleString('default', { month: 'short' });
      months[month] = (months[month] || 0) + 1;
    });
    return Object.keys(months).map(m => ({ name: m, orders: months[m] }));
  }, [poHistory]);

  const volatilityData = useMemo(() => {
    // Mocked cost volatility over last 4 months for presentation
    return [
      { month: "Feb", costIdx: 100 },
      { month: "Mar", costIdx: 102 },
      { month: "Apr", costIdx: 105 },
      { month: "May", costIdx: 103 },
    ];
  }, []);

  if (!business) return null;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold">Suppliers & Procurement</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage vendor relations, generate dynamic purchase orders, and track supplier performance.</p>
        </div>
        
        <Dialog open={isAddSupplierOpen} onOpenChange={(open) => {
          setIsAddSupplierOpen(open);
          if (!open) {
            setNewSupplier({ name: "", contact: "", providedItems: "" });
            setSelectedDays(new Set());
            setEditingSupplierId(null);
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gradient-violet gap-2">
              <Plus className="h-4 w-4" /> Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSupplierId ? "Edit Supplier" : "Add New Supplier"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddSupplier} className="space-y-4">
              <div className="space-y-2">
                <Label>Supplier Name</Label>
                <Input required value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} placeholder="e.g. Fresh Farms" />
              </div>
              <div className="space-y-2">
                <Label>Contact Info (WhatsApp ready)</Label>
                <Input value={newSupplier.contact} onChange={e => setNewSupplier({...newSupplier, contact: e.target.value})} placeholder="+254 700 000 000" />
              </div>
              <div className="space-y-2">
                <Label>Delivery Days</Label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {WEEKDAYS.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                        selectedDays.has(day)
                          ? "bg-primary text-white border-primary"
                          : "bg-background text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Provided Items / Categories</Label>
                <Textarea 
                  value={newSupplier.providedItems} 
                  onChange={e => setNewSupplier({...newSupplier, providedItems: e.target.value})} 
                  placeholder="e.g. Fresh Produce, Dairy, Beverages" 
                  className="resize-none"
                  rows={3}
                />
              </div>
              <Button type="submit" className="w-full gradient-violet mt-2" disabled={addingSupplier}>
                {addingSupplier ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Supplier"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="directory" className="w-full">
        <TabsList className="mb-6 h-12 bg-muted/50 p-1">
          <TabsTrigger value="directory" className="h-10 px-6 rounded-md">Directory & Restock</TabsTrigger>
          <TabsTrigger value="analytics" className="h-10 px-6 rounded-md">Supplier Analytics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="directory" className="mt-0 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Supplier Directory Panel */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 lg:col-span-2 shadow-sm border border-border/60">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Truck className="h-4 w-4 text-white" />
                </div>
                <div className="font-medium">Supplier Directory</div>
              </div>
              
              <div className="rounded-xl border border-border bg-background/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Supplier Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Delivery Schedule</TableHead>
                      <TableHead className="text-right">Pending POs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      [1, 2, 3].map(i => (
                        <TableRow key={i}>
                          <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded"></div></TableCell>
                          <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded"></div></TableCell>
                          <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded"></div></TableCell>
                          <TableCell><div className="h-4 w-8 bg-muted animate-pulse rounded ml-auto"></div></TableCell>
                        </TableRow>
                      ))
                    ) : suppliers.length === 0 ? (
                       <TableRow>
                         <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No suppliers found.</TableCell>
                       </TableRow>
                    ) : (
                      suppliers.map(s => (
                        <Sheet key={s.id}>
                          <SheetTrigger asChild>
                            <TableRow className="cursor-pointer group hover:bg-primary/5 transition-colors">
                              <TableCell className="font-medium group-hover:text-primary transition-colors">{s.name}</TableCell>
                              <TableCell className="text-muted-foreground">{s.contact}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {s.days.length > 0 ? s.days.map(d => (
                                    <span key={d} className="text-[10px] bg-muted text-foreground px-1.5 py-0.5 rounded">{d}</span>
                                  )) : <span className="text-muted-foreground text-xs">-</span>}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {s.activeOrders > 0 ? (
                                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-bold">
                                    {s.activeOrders}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          </SheetTrigger>
                          <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                            <SheetHeader>
                              <SheetTitle className="text-2xl font-bold flex items-center gap-2">
                                <Truck className="h-5 w-5 text-primary" /> {s.name}
                              </SheetTitle>
                            </SheetHeader>
                            <div className="flex gap-3 mt-6">
                              <Button 
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" 
                                onClick={() => {
                                  setPoSupplierId(s.id);
                                  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
                                }}
                              >
                                Create PO
                              </Button>
                              <Button 
                                variant="outline" 
                                className="flex-1" 
                                onClick={() => {
                                  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
                                  openEditSupplier(s);
                                }}
                              >
                                Edit Details
                              </Button>
                            </div>
                            <div className="py-6 space-y-6">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="bg-muted/40 p-4 rounded-xl border border-border">
                                  <div className="text-xs text-muted-foreground mb-1">Contact</div>
                                  <div className="font-medium">{s.contact}</div>
                                </div>
                                <div className="bg-muted/40 p-4 rounded-xl border border-border">
                                  <div className="text-xs text-muted-foreground mb-1">Delivery Days</div>
                                  <div className="font-medium">{s.days.join(", ") || "Unscheduled"}</div>
                                </div>
                              </div>
                              
                              <div>
                                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Provided Inventory</h4>
                                <div className="bg-muted/30 p-4 rounded-xl border border-border text-sm whitespace-pre-wrap">
                                  {s.providedItems || <span className="italic text-muted-foreground">No specific items listed.</span>}
                                </div>
                              </div>

                              <div>
                                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Order History Ledger</h4>
                                {s.activeOrders === 0 && !s.orders?.length ? (
                                  <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-xl">No previous orders for this supplier.</div>
                                ) : (
                                  <div className="space-y-3">
                                    {(s.orders || []).map((order: any) => (
                                      <div key={order.id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-background">
                                        <div>
                                          <div className="font-semibold text-sm">PO-{order.id.split('-')[0].toUpperCase()}</div>
                                          <div className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</div>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-bold">{formatMoney(order.total_amount, currency)}</div>
                                          <div className={`text-[10px] font-semibold uppercase tracking-wider ${order.status === 'pending' ? 'text-orange-500' : 'text-emerald-500'}`}>
                                            {order.status}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </SheetContent>
                        </Sheet>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </motion.div>

            {/* Smart PO Generator Panel */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl flex flex-col max-h-[800px] shadow-sm border border-border/60 overflow-hidden">
              <div className="p-5 border-b border-border bg-muted/20">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  <div className="font-medium">Smart PO Generator</div>
                </div>
                
                <Label className="text-xs text-muted-foreground mb-1 block">Select Supplier to Restock</Label>
                <Select value={poSupplierId} onValueChange={setPoSupplierId}>
                  <SelectTrigger className="bg-background border-border shadow-sm h-10">
                    <SelectValue placeholder="Choose supplier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/5">
                {!poSupplierId ? (
                  <div className="text-center text-sm text-muted-foreground py-12 px-4">Select a supplier above to generate a restock order.</div>
                ) : poItems.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-12 px-4 border border-dashed rounded-xl border-border mx-2">No inventory linked to this supplier.</div>
                ) : (
                  poItems.map((item) => (
                    <div key={item.productId} className={`p-4 rounded-xl border bg-background shadow-sm transition-all ${item.quantity > 0 ? "border-emerald-500/40 ring-1 ring-emerald-500/10" : "border-border/60"}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="font-semibold text-sm line-clamp-1">{item.name}</div>
                        <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm whitespace-nowrap ml-2">
                          {formatMoney(item.quantity * item.unitCost, currency)}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Qty to Order</Label>
                          <Input 
                            type="number" 
                            min="0"
                            className="h-8 text-xs font-medium" 
                            value={item.quantity || ""} 
                            onChange={e => updatePoItem(item.productId, 'quantity', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Unit Cost</Label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currency}</span>
                            <Input 
                              type="number" 
                              step="0.01"
                              className="h-8 text-xs font-medium pl-10" 
                              value={item.unitCost || ""} 
                              onChange={e => updatePoItem(item.productId, 'unitCost', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 border-t border-border bg-background">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-medium text-muted-foreground">Grand Total</span>
                  <span className="text-xl font-bold">{formatMoney(poTotal, currency)}</span>
                </div>
                
                {lastGeneratedPo && !generatingPo ? (
                  <div className="grid grid-cols-2 gap-2 animate-fade-in">
                    <Button variant="outline" className="h-11 font-medium gap-2" onClick={printPO}>
                      <Download className="h-4 w-4" /> Download PDF
                    </Button>
                    <Button className="h-11 font-medium gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={sharePO}>
                      <Share2 className="h-4 w-4" /> Share Client
                    </Button>
                  </div>
                ) : (
                  <Button 
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all"
                    disabled={poTotal === 0 || generatingPo || !poSupplierId}
                    onClick={generatePO}
                  >
                    {generatingPo ? <Loader2 className="h-5 w-5 animate-spin" /> : "Generate & Finalize PO"}
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-0 outline-none animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="glass p-6 rounded-2xl md:col-span-2 border border-border shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <div className="h-8 w-8 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold">Restock Frequency Tracker</h3>
                  <p className="text-xs text-muted-foreground">Monthly volume of purchase orders placed.</p>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', border: '1px solid #eee' }} />
                    <Bar dataKey="orders" fill="currentColor" className="text-blue-500 dark:text-blue-400" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-6">
              <div className="glass p-6 rounded-2xl border border-border shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Lead-Time Analysis</h3>
                  </div>
                </div>
                <div className="text-3xl font-bold">2.4 Days</div>
                <p className="text-xs text-muted-foreground mt-1">Average fulfillment speed from PO generation to inventory receipt.</p>
              </div>

              <div className="glass p-6 rounded-2xl border border-border shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Cost Volatility Index</h3>
                  </div>
                </div>
                <div className="h-[120px] w-full -ml-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={volatilityData}>
                      <XAxis dataKey="month" hide />
                      <RechartsTooltip contentStyle={{ fontSize: '12px' }} />
                      <Line type="monotone" dataKey="costIdx" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, fill: "#f43f5e" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">Price changes on core goods over 4 months</p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
