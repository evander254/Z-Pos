import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant-context";
import { Truck, Plus, FileText, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { motion } from "framer-motion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/t/$slug/suppliers")({ component: SuppliersDashboard });

function SuppliersDashboard() {
  const { business } = useTenant();
  const [loading, setLoading] = useState(true);

  // Mock data
  const suppliers = [
    { id: 1, name: "Nairobi Distributors Ltd", contact: "+254 700 123456", days: "Mon, Thu", activeOrders: 2 },
    { id: 2, name: "Fresh Farms", contact: "+254 711 987654", days: "Tue, Fri", activeOrders: 0 },
    { id: 3, name: "Beverage Co.", contact: "orders@beverage.co", days: "Wed", activeOrders: 1 },
  ];

  const poItems = [
    { name: "Premium Coffee Beans", supplier: "Nairobi Distributors Ltd", currentCost: 1500, previousCost: 1450, trend: "up" },
    { name: "Almond Milk", supplier: "Fresh Farms", currentCost: 350, previousCost: 350, trend: "flat" },
    { name: "Paper Cups (Large)", supplier: "Beverage Co.", currentCost: 5, previousCost: 6, trend: "down" }
  ];

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (!business) return null;
  const currency = business.currency || "KES";

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold">Suppliers & Procurement</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage suppliers, generate purchase orders, and track cost changes.</p>
        </div>
        <Button className="gradient-violet gap-2">
          <Plus className="h-4 w-4" /> Add Supplier
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Supplier Directory */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Truck className="h-4 w-4 text-white" />
            </div>
            <div className="font-medium">Supplier Directory</div>
          </div>
          
          <div className="rounded-lg border border-border bg-background/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Delivery Days</TableHead>
                  <TableHead className="text-right">Active Orders</TableHead>
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
                ) : (
                  suppliers.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.contact}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {s.days.split(", ").map(d => (
                            <span key={d} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{d}</span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {s.activeOrders > 0 ? (
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-accent/20 text-accent text-xs font-bold">
                            {s.activeOrders}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </motion.div>

        {/* Purchase Order Generator */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <div className="font-medium">PO Generator</div>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4">Select items to generate a purchase order for restocking.</p>
          
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="h-16 w-full bg-muted animate-pulse rounded-lg"></div>)
            ) : (
              poItems.map((item, i) => (
                <div key={i} className="p-3 rounded-lg border border-border/50 bg-background/50 hover:border-primary/50 transition-colors cursor-pointer group">
                  <div className="flex justify-between items-start">
                    <div className="font-medium text-sm group-hover:text-primary transition-colors">{item.name}</div>
                    <div className="flex items-center gap-1">
                      {item.trend === "up" && <ArrowUpRight className="h-3.5 w-3.5 text-destructive" title="Price went up" />}
                      {item.trend === "down" && <ArrowDownRight className="h-3.5 w-3.5 text-emerald-500" title="Price went down" />}
                      {item.trend === "flat" && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className="text-xs font-semibold">{currency} {item.currentCost}</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">From: {item.supplier}</div>
                </div>
              ))
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-auto pt-4 border-t border-border">
            <Button variant="outline" className="w-full text-xs h-9">Download PDF</Button>
            <Button className="w-full text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white">WhatsApp Order</Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
