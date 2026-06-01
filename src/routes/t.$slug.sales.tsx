import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { formatMoney } from "@/lib/format";
import { listMockEmployeesFn } from "@/lib/employee-actions";
import { 
  Search, Calendar, Printer, X, Eye, Filter, RefreshCw, 
  Smartphone, Banknote, CreditCard, Receipt, User, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { generateReceiptHTML } from "@/lib/receipt-templates";

export const Route = createFileRoute("/t/$slug/sales")({ component: Sales });

type SaleItem = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

type Sale = {
  id: string;
  business_id: string;
  cashier_id: string | null;
  customer_id: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  cashier_name?: string | null;
  amount_tendered?: number | null;
  change_due?: number | null;
  sale_items: SaleItem[];
  profiles?: {
    full_name: string | null;
  } | null;
};

type MappedSale = Sale & {
  displayPaymentMethod: string;
  displayCashierName: string;
  amountTendered?: number;
  changeDue?: number;
};

function Sales() {
  const { business } = useTenant();
  const [sales, setSales] = useState<Sale[]>([]);
  const [employees, setEmployees] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [employeeMap, setEmployeeMap] = useState<Record<string, string>>({});
  
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  
  // Receipt Modal State
  const [selectedSale, setSelectedSale] = useState<MappedSale | null>(null);

  const currency = business?.currency || "KES";
  const taxRate = Number(business?.tax_rate ?? 16) / 100;

  async function loadData() {
    if (!business) return;
    setLoading(true);
    try {
      // 1. Fetch detailed sales with items and profiles
      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select("*, sale_items(*), profiles:cashier_id(full_name)")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (salesError) throw salesError;
      
      const loadedSales = (salesData || []) as Sale[];
      setSales(loadedSales);

      // 2. Fetch employee list to populate filters and build the name mapping
      const names = new Set<string>();
      const empMap: Record<string, string> = {};
      
      // Load real employees from DB
      const { data: dbEmployees } = await supabase
        .from("employees")
        .select("user_id, username, profiles(full_name)")
        .eq("business_id", business.id);

      dbEmployees?.forEach(emp => {
        const name = (emp.profiles as any)?.full_name || emp.username;
        if (name) {
          names.add(name);
          if (emp.user_id) {
            empMap[emp.user_id] = name;
          }
        }
      });

      // Load mock employees if in simulated mode
      try {
        const mockResult = await listMockEmployeesFn({ data: { business_id: business.id } });
        if (mockResult && "employees" in mockResult) {
          (mockResult.employees as any[]).forEach(emp => {
            const name = emp.profiles?.full_name || emp.username;
            if (name) {
              names.add(name);
              if (emp.user_id) {
                empMap[emp.user_id] = name;
              }
            }
          });
        }
      } catch (err) {
        console.error("Failed to load mock employees for filter:", err);
      }

      // Add any names already saved in loaded sales to make sure no historical cashier is missed
      loadedSales.forEach(s => {
        let name = s.cashier_name || s.profiles?.full_name;
        if (s.payment_method?.includes("::")) {
          name = s.payment_method.split("::")[1];
        }
        if (name) names.add(name);
      });

      setEmployeeMap(empMap);
      setEmployees(Array.from(names));
    } catch (err: any) {
      toast.error(err.message || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [business]);

  const parsedSales = useMemo(() => {
    return sales.map(s => {
      let method = s.payment_method;
      let cashierName = s.cashier_name || s.profiles?.full_name || (s.cashier_id ? employeeMap[s.cashier_id] : null) || "Staff";
      
      if (s.payment_method?.includes("::")) {
        const parts = s.payment_method.split("::");
        method = parts[0];
        cashierName = parts[1];
      }

      let amountTendered = s.amount_tendered;
      let changeDue = s.change_due;

      if (amountTendered === undefined || amountTendered === null) {
        if (method?.includes("Tendered:")) {
          const matchChange = method.match(/Tendered:\s*([\d.]+),\s*Change:\s*([\d.]+)/i);
          if (matchChange) {
            amountTendered = parseFloat(matchChange[1]);
            changeDue = parseFloat(matchChange[2]);
          } else {
            const matchOutstanding = method.match(/Tendered:\s*([\d.]+),\s*Outstanding:\s*([\d.]+)/i);
            if (matchOutstanding) {
              amountTendered = parseFloat(matchOutstanding[1]);
              changeDue = -parseFloat(matchOutstanding[2]);
            }
          }
        }
      }
      
      return {
        ...s,
        displayPaymentMethod: method,
        displayCashierName: cashierName,
        amountTendered: amountTendered ?? undefined,
        changeDue: changeDue ?? undefined
      };
    });
  }, [sales, employeeMap]);

  // Client-side search and filtering
  const filteredSales = useMemo(() => {
    return parsedSales.filter(s => {
      // Search matches short ID or full ID
      const shortId = s.id.substring(0, 8).toUpperCase();
      const matchesSearch = 
        searchQuery.trim() === "" || 
        s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shortId.includes(searchQuery.toUpperCase());

      // Filter matches cashier profile full name or compound cashier name
      const matchesEmployee = 
        selectedEmployee === "all" || 
        s.displayCashierName === selectedEmployee;

      return matchesSearch && matchesEmployee;
    });
  }, [parsedSales, searchQuery, selectedEmployee]);

  function getPaymentIcon(method: string) {
    switch (method.toLowerCase()) {
      case "mpesa":
        return <Smartphone className="h-4 w-4 text-emerald-500" />;
      case "cash":
        return <Banknote className="h-4 w-4 text-amber-500" />;
      case "card":
        return <CreditCard className="h-4 w-4 text-blue-500" />;
      default:
        return <Receipt className="h-4 w-4 text-muted-foreground" />;
    }
  }

  function printReceipt(sale: any) {
    if (!business) return;

    const printWindow = window.open("", "_blank", "width=600,height=600");
    if (!printWindow) {
      toast.error("Popup blocker prevented printing. Please allow popups for this site.");
      return;
    }

    const htmlContent = generateReceiptHTML(sale, business, business.receipt_type);

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" /> Sales
          </h1>
          <p className="text-sm text-muted-foreground">Recent transactions across your business.</p>
        </div>
        <Button 
          variant="outline" 
          onClick={loadData} 
          disabled={loading}
          className="cursor-pointer gap-2 h-10 shrink-0 self-start sm:self-center"
        >
          <RefreshCw className={`h-4 w-4 ${loading && "animate-spin"}`} />
          Refresh
        </Button>
      </div>

      {/* Filters & Search Control */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            className="pl-9 h-11" 
            placeholder="Search by receipt number..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
          />
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative flex items-center shrink-0">
            <Filter className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            <select 
              className="h-11 pl-9 pr-8 rounded-md border border-border bg-card text-sm min-w-[170px] appearance-none focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer" 
              value={selectedEmployee} 
              onChange={e => setSelectedEmployee(e.target.value)}
            >
              <option value="all">All Employees</option>
              {employees.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Transaction List Table */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span>Loading sales records...</span>
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center max-w-xl mx-auto border border-border/40">
          <Receipt className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No sales found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {searchQuery || selectedEmployee !== "all" 
              ? "Try adjusting your search criteria or employee filters." 
              : "No sales recorded yet. Head over to the POS page to process your first sale."}
          </p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden border border-border/40">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border bg-muted/10">
                <tr>
                  <th className="p-4 font-semibold">Receipt No</th>
                  <th className="p-4 font-semibold">Date & Time</th>
                  <th className="p-4 font-semibold">Cashier</th>
                  <th className="p-4 font-semibold">Payment Method</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold text-right">Total</th>
                  <th className="p-4 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map(s => {
                  const receiptNo = s.id.substring(0, 8).toUpperCase();
                  return (
                    <tr 
                      key={s.id} 
                      onClick={() => setSelectedSale(s)}
                      className="border-b border-border/30 last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
                    >
                      <td className="p-4 font-mono font-bold text-foreground">
                        #{receiptNo}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {new Date(s.created_at).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="font-medium text-foreground">{s.displayCashierName}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 capitalize text-foreground">
                          {getPaymentIcon(s.displayPaymentMethod)}
                          <span>{s.displayPaymentMethod}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-[10px] uppercase tracking-wider font-extrabold rounded-full px-2 py-0.5 bg-primary/10 text-primary border border-primary/20">
                          {s.status}
                        </span>
                      </td>
                      <td className="p-4 text-right font-bold text-foreground">
                        {formatMoney(s.total_amount, currency)}
                      </td>
                      <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={() => setSelectedSale(s)}
                            title="View Receipt Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-primary cursor-pointer"
                            onClick={() => printReceipt(s)}
                            title="Print Receipt"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slide-over / Modal - Transaction Receipt Details Preview */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 relative max-h-[95vh] flex flex-col my-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Receipt Preview
              </h2>
              <button 
                onClick={() => setSelectedSale(null)} 
                className="text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded-lg hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Virtual Paper Receipt Area */}
            <div className="flex-1 overflow-y-auto pr-1 my-4">
              <div className="bg-[#FAF9F5] text-slate-800 p-5 rounded-xl border border-amber-100 shadow-inner font-mono text-xs max-w-sm mx-auto">
                {business?.logo_url && (
                  <img src={business.logo_url} alt="Logo" className="max-w-[70px] h-auto mx-auto mb-2 filter grayscale" />
                )}
                <h3 className="text-center font-bold text-sm uppercase tracking-wider">{business?.business_name || "ZPos Retail"}</h3>
                {business?.description && <p className="text-center text-[10px] text-slate-500 leading-tight mb-2">{business.description}</p>}
                
                <div className="border-t border-dashed border-slate-300 my-2"></div>
                
                {(() => {
                  const previewPaymentLower = selectedSale.displayPaymentMethod.toLowerCase();
                  const previewMpesaMatch = previewPaymentLower.match(/ref:\s*([a-z0-9]+)/i);
                  const previewMpesaRef = previewMpesaMatch ? previewMpesaMatch[1].toUpperCase() : null;
                  const previewIsCard = previewPaymentLower.includes("card");
                  return (
                    <>
                      <div className="space-y-0.5">
                        <div><b>Receipt:</b> #{selectedSale.id.substring(0, 8).toUpperCase()}</div>
                        <div><b>Date:</b> {new Date(selectedSale.created_at).toLocaleString()}</div>
                        <div><b>Cashier:</b> {selectedSale.displayCashierName}</div>
                        <div><b>Payment:</b> {previewIsCard ? "CARD (DETAILS N/A)" : selectedSale.displayPaymentMethod.toUpperCase()}</div>
                        {previewMpesaRef && <div><b>M-Pesa Ref:</b> {previewMpesaRef}</div>}
                      </div>
                      
                      <div className="border-t border-dashed border-slate-300 my-2"></div>
                      
                      <div className="space-y-1.5">
                        <div className="font-bold border-b border-slate-200 pb-0.5">ITEMS</div>
                        {selectedSale.sale_items && selectedSale.sale_items.length > 0 ? (
                          selectedSale.sale_items.map((item, idx) => (
                            <div key={item.id || idx}>
                              <div className="flex justify-between">
                                <span>{item.quantity}x {item.product_name}</span>
                                <span>{formatMoney(item.subtotal, currency)}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 pl-3">
                                {item.quantity} x {formatMoney(item.unit_price, currency)}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-slate-400 italic">No item details saved</div>
                        )}
                      </div>
                      
                      <div className="border-t border-dashed border-slate-300 my-2"></div>
                      
                      <div className="space-y-0.5">
                        <div className="flex justify-between">
                          <span>Subtotal</span>
                          <span>{formatMoney(selectedSale.subtotal, currency)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tax (${((selectedSale.tax_amount && selectedSale.subtotal ? (selectedSale.tax_amount / selectedSale.subtotal) : taxRate) * 100).toFixed(0)}%)</span>
                          <span>{formatMoney(selectedSale.tax_amount, currency)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-sm pt-1">
                          <span>Total</span>
                          <span>{formatMoney(selectedSale.total_amount, currency)}</span>
                        </div>
                        {selectedSale.amountTendered !== undefined && (
                          <>
                            <div className="flex justify-between text-slate-600 mt-2">
                              <span>Cash Tendered</span>
                              <span>{formatMoney(selectedSale.amountTendered, currency)}</span>
                            </div>
                            {selectedSale.changeDue !== undefined && selectedSale.changeDue >= 0 ? (
                              <div className="flex justify-between font-semibold text-slate-700">
                                <span>Change Due</span>
                                <span>{formatMoney(selectedSale.changeDue, currency)}</span>
                              </div>
                            ) : (
                              <div className="flex justify-between font-semibold text-destructive">
                                <span>Outstanding Balance</span>
                                <span>{formatMoney(Math.abs(selectedSale.changeDue || 0), currency)}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  );
                })()}
                
                <div className="border-t border-dashed border-slate-300 my-2"></div>
                
                <p className="text-center text-[9px] text-slate-400 mt-1 leading-tight">
                  Thank you for shopping with us!<br />
                  Powered by ZPos
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 pt-3 border-t border-border shrink-0">
              <Button
                variant="outline"
                className="flex-1 h-11 cursor-pointer font-medium"
                onClick={() => printReceipt(selectedSale)}
              >
                <Printer className="h-4 w-4 mr-1.5" />
                Print Receipt
              </Button>
              <Button
                className="flex-1 h-11 gradient-violet text-white border-0 cursor-pointer font-medium"
                onClick={() => setSelectedSale(null)}
              >
                Close Details
              </Button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
