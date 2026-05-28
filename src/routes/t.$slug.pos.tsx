import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useTenant } from "@/lib/tenant-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import { Plus, Minus, Trash2, ScanBarcode, Search, CreditCard, Smartphone, Banknote, Package, X, CheckCircle2, Camera, Zap, ZapOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { BarcodeScannerModal } from "@/components/barcode-scanner-modal";
import { generateReceiptHTML } from "@/lib/receipt-templates";

export const Route = createFileRoute("/t/$slug/pos")({ component: POS });

type Product = { 
  id: string; 
  name: string; 
  price: number; 
  stock_quantity: number; 
  barcode: string | null;
  image_url: string | null;
};
type CartItem = Product & { qty: number };

type LastSaleDetails = {
  id: string;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  cashierName: string;
  amountTendered?: number;
  changeDue?: number;
  items: { name: string; qty: number; price: number }[];
  created_at: string;
};

function POS() {
  const { business, employee } = useTenant();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState<"cash" | "mpesa" | "card">("mpesa");
  const [processing, setProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Cash Tender and Receipt States
  const [showTenderModal, setShowTenderModal] = useState(false);
  const [amountTendered, setAmountTendered] = useState("");
  const [showMpesaModal, setShowMpesaModal] = useState(false);
  const [mpesaTxCode, setMpesaTxCode] = useState("");
  const [mpesaConfirmed, setMpesaConfirmed] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastSaleDetails, setLastSaleDetails] = useState<LastSaleDetails | null>(null);

  // Camera Barcode Scanner integration handled via hook

  const itemsPerPage = 50;
  const currency = business?.currency || "KES";
  const taxRate = Number(business?.tax_rate ?? 16) / 100;

  const cashierName = 
    (employee as any)?.profiles?.full_name || 
    user?.user_metadata?.full_name || 
    employee?.username || 
    user?.email || 
    "Staff";

  function loadProducts() {
    if (!business) return;
    supabase.from("products")
      .select("id, name, price, stock_quantity, barcode, image_url")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("name")
      .then(({ data }) => setProducts((data || []) as Product[]));
  }

  useEffect(() => {
    loadProducts();
  }, [business]);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => p.name.toLowerCase().includes(q) || (p.barcode || "").includes(q));
  }, [search, products]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage]);

  function add(p: Product) {
    setCart(c => {
      const ex = c.find(i => i.id === p.id);
      if (ex) return c.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...c, { ...p, qty: 1 }];
    });
  }
  function change(id: string, d: number) {
    setCart(c => c.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + d) } : i).filter(i => i.qty > 0));
  }
  function remove(id: string) { setCart(c => c.filter(i => i.id !== id)); }

  // Barcode Scanner Integration
  const productsRef = useRef<Product[]>([]);
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  const {
    showScanner,
    setShowScanner,
    facingMode,
    setFacingMode,
    torchOn,
    setTorchOn,
    continuousScan,
    setContinuousScan,
    handleScanResult,
  } = useBarcodeScanner({
    onScanSuccess: (scannedCode) => {
      const code = scannedCode.trim().toLowerCase();
      const product = productsRef.current.find(p => 
        (p.barcode && p.barcode.trim().toLowerCase() === code) || 
        (p.id.toLowerCase() === code)
      );

      if (product) {
        add(product);
        toast.success(`Added: ${product.name} (${formatMoney(product.price, currency)})`, {
          duration: 2000
        });
      } else {
        toast.warning(`Unknown item: "${scannedCode}"`, {
          description: "This code does not match any registered product.",
          duration: 3500
        });
      }
    },
    continuous: true,
  });

  const subtotal = cart.reduce((a, i) => a + i.price * i.qty, 0);
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  // Tender logic calculations
  const parsedTendered = parseFloat(amountTendered) || 0;
  const cashBalance = parsedTendered - total;
  const changeDue = cashBalance >= 0 ? cashBalance : 0;
  const outstandingBalance = cashBalance < 0 ? Math.abs(cashBalance) : 0;
  const isValidTender = parsedTendered > 0;

  const handleQuickCash = (increment: number) => {
    const current = parseFloat(amountTendered) || 0;
    setAmountTendered((current + increment).toFixed(2).replace(/\.00$/, ""));
  };

  const handleExactCash = () => {
    setAmountTendered(total.toFixed(2));
  };

  function handleCharge() {
    if (payment === "cash") {
      if (amountTendered && parsedTendered > 0) {
        performCheckout({ cashReceived: parsedTendered });
      } else {
        setAmountTendered("");
        setShowTenderModal(true);
      }
    } else if (payment === "mpesa") {
      if (mpesaTxCode.trim() && mpesaConfirmed) {
        performCheckout({ mpesaTxCode });
      } else {
        setMpesaTxCode("");
        setMpesaConfirmed(false);
        setShowMpesaModal(true);
      }
    } else if (payment === "card") {
      performCheckout();
    }
  }

  async function performCheckout(options?: { cashReceived?: number; mpesaTxCode?: string }) {
    if (!business || !user || cart.length === 0) return;
    setProcessing(true);

    const savedCart = [...cart];

    const cashierId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)
      ? user.id
      : null;

    let displayPayment = payment as string;
    if (payment === "cash" && options?.cashReceived !== undefined) {
      const calculatedBalance = options.cashReceived - total;
      if (calculatedBalance >= 0) {
        displayPayment = `cash (Tendered: ${options.cashReceived}, Change: ${calculatedBalance.toFixed(2)})`;
      } else {
        displayPayment = `cash (Tendered: ${options.cashReceived}, Outstanding: ${Math.abs(calculatedBalance).toFixed(2)})`;
      }
    } else if (payment === "mpesa" && options?.mpesaTxCode) {
      displayPayment = `mpesa (Ref: ${options.mpesaTxCode.toUpperCase()})`;
    } else if (payment === "card") {
      displayPayment = `card (Details N/A)`;
    }

    const storedPaymentMethod = cashierName ? `${displayPayment}::${cashierName}` : displayPayment;

    const { data: sale, error } = await (supabase.from("sales") as any).insert({
      business_id: business.id, 
      cashier_id: cashierId,
      cashier_name: cashierName,
      subtotal, 
      tax_amount: tax, 
      total_amount: total,
      payment_method: storedPaymentMethod, 
      status: "completed",
      amount_tendered: payment === "cash" ? (options?.cashReceived ?? null) : null,
      change_due: payment === "cash" && options?.cashReceived !== undefined ? options.cashReceived - total : null,
    }).select().single();

    if (error || !sale) { 
      setProcessing(false); 
      toast.error(error?.message || "Failed to complete transaction"); 
      return; 
    }

    const items = savedCart.map(i => ({
      sale_id: sale.id, 
      product_id: i.id, 
      product_name: i.name,
      quantity: i.qty, 
      unit_price: i.price, 
      subtotal: i.price * i.qty,
    }));
    await supabase.from("sale_items").insert(items);

    // decrement stock (best-effort, client-side)
    for (const i of savedCart) {
      await supabase.from("products").update({ 
        stock_quantity: Math.max(0, i.stock_quantity - i.qty) 
      }).eq("id", i.id);

      await supabase.from("inventory_logs").insert({
        business_id: business.id, 
        product_id: i.id, 
        change_type: "sale", 
        quantity: -i.qty, 
        notes: `Sale ${sale.id}`,
      });
    }

    const calculatedChange = options?.cashReceived !== undefined ? options.cashReceived - total : 0;
    setLastSaleDetails({
      id: sale.id,
      subtotal,
      tax,
      total,
      paymentMethod: displayPayment,
      cashierName,
      amountTendered: options?.cashReceived,
      changeDue: options?.cashReceived !== undefined ? calculatedChange : undefined,
      items: savedCart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
      created_at: sale.created_at || new Date().toISOString(),
    });

    toast.success(`Sale completed: ${formatMoney(total, currency)}`);
    setCart([]); 
    setProcessing(false);
    setShowTenderModal(false);
    setShowMpesaModal(false);
    setShowCardModal(false);
    setMpesaTxCode("");
    setAmountTendered("");
    setMpesaConfirmed(false);
    setShowReceiptModal(true);

    // refresh products
    loadProducts();
  }

  function printReceipt() {
    if (!lastSaleDetails || !business) return;

    const printWindow = window.open("", "_blank", "width=600,height=600");
    if (!printWindow) {
      toast.error("Popup blocker prevented printing. Please allow popups for this site.");
      return;
    }

    const htmlContent = generateReceiptHTML(lastSaleDetails, business, business.receipt_type);

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div className="flex-1 p-4 md:p-6 min-w-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 h-12" placeholder="Search products or scan barcode..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button 
            onClick={() => setShowScanner(true)}
            variant="outline" 
            className="h-12 gap-2 cursor-pointer border-2 border-primary/20 hover:border-primary/80 transition-all font-medium shrink-0 shadow-sm"
          >
            <Camera className="h-4 w-4 text-primary" />
            <span>Scan Camera</span>
          </Button>
        </div>
        {products.length === 0 ? (
          <div className="mt-12 glass rounded-2xl p-10 text-center">
            <div className="text-lg font-semibold">No products yet</div>
            <p className="mt-1 text-sm text-muted-foreground">Add your first product from the Products page to start selling.</p>
          </div>
        ) : (
          <div className="mt-4 flex flex-col">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {paginatedItems.map(p => (
                <button key={p.id} onClick={() => add(p)}
                  className="text-left glass rounded-xl p-3 flex flex-col hover:border-primary/60 transition-all active:scale-[0.98] cursor-pointer">
                  <div className="aspect-square rounded-lg overflow-hidden border border-border/40 bg-muted/40 mb-3 flex items-center justify-center shrink-0">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" />
                    ) : (
                      <Package className="h-8 w-8 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="text-sm font-semibold line-clamp-2 text-foreground min-h-[40px]">{p.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Stock: {p.stock_quantity}</div>
                  <div className="mt-2 font-bold text-primary">{formatMoney(p.price, currency)}</div>
                </button>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between gap-4 p-4 border-t border-border bg-muted/10 rounded-xl">
                <div className="text-xs text-muted-foreground">
                  Showing {Math.min(filtered.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filtered.length, currentPage * itemsPerPage)} of {filtered.length} products
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="cursor-pointer h-8 text-xs"
                  >
                    Previous
                  </Button>
                  <span className="text-xs font-medium px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="cursor-pointer h-8 text-xs"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <aside className="w-full md:w-96 border-t md:border-t-0 md:border-l border-border bg-card/40 flex flex-col">
        <div className="p-5 border-b border-border">
          <div className="text-sm font-medium">Current sale</div>
          <div className="text-xs text-muted-foreground">{cart.length} item{cart.length !== 1 ? "s" : ""}</div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 && <div className="text-center text-sm text-muted-foreground py-10">Tap a product to add</div>}
          {cart.map(i => (
            <div key={i.id} className="glass rounded-lg p-3 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{i.name}</div>
                <div className="text-xs text-muted-foreground">{formatMoney(i.price, currency)} each</div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => change(i.id, -1)} className="h-7 w-7 rounded-md border border-border flex items-center justify-center cursor-pointer"><Minus className="h-3 w-3" /></button>
                <span className="w-6 text-center text-sm">{i.qty}</span>
                <button onClick={() => change(i.id, 1)} className="h-7 w-7 rounded-md border border-border flex items-center justify-center cursor-pointer"><Plus className="h-3 w-3" /></button>
              </div>
              <button onClick={() => remove(i.id)} className="text-muted-foreground hover:text-destructive cursor-pointer"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        <div className="p-5 border-t border-border space-y-3">
          <div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal</span><span>{formatMoney(subtotal, currency)}</span></div>
          <div className="flex justify-between text-sm text-muted-foreground"><span>Tax ({(taxRate * 100).toFixed(0)}%)</span><span>{formatMoney(tax, currency)}</span></div>
          <div className="flex justify-between text-lg font-semibold"><span>Total</span><span>{formatMoney(total, currency)}</span></div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            {([
              { v: "mpesa" as const, l: "M-Pesa", I: Smartphone },
              { v: "cash" as const, l: "Cash", I: Banknote },
              { v: "card" as const, l: "Card", I: CreditCard },
            ]).map(o => (
              <button key={o.v} onClick={() => setPayment(o.v)}
                className={`rounded-lg border p-2 text-xs flex flex-col items-center gap-1 cursor-pointer ${payment === o.v ? "border-primary bg-primary/10" : "border-border"}`}>
                <o.I className="h-4 w-4" /> {o.l}
              </button>
            ))}
          </div>
          
          {/* Inline Payment Details Form */}
          {cart.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-border/40">
              {payment === "mpesa" && (
                <div className="space-y-2 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] uppercase tracking-wider">
                    <Smartphone className="h-3.5 w-3.5" /> M-Pesa Confirmation
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="inlineMpesaTxCode" className="text-[10px] text-muted-foreground">Transaction Code</Label>
                    <Input
                      id="inlineMpesaTxCode"
                      className="uppercase tracking-widest text-xs font-bold bg-background border-emerald-500/20 focus:border-emerald-500 h-9"
                      placeholder="e.g. SBY789XYZ"
                      value={mpesaTxCode}
                      onChange={e => setMpesaTxCode(e.target.value)}
                    />
                  </div>
                  <label className="flex items-start gap-2 py-1 cursor-pointer select-none text-[10px] text-muted-foreground">
                    <input 
                      type="checkbox" 
                      className="rounded border-emerald-500/30 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 mt-0.5 cursor-pointer"
                      checked={mpesaConfirmed} 
                      onChange={e => setMpesaConfirmed(e.target.checked)} 
                    />
                    <span>I confirm payment of {formatMoney(total, currency)} is received</span>
                  </label>
                </div>
              )}

              {payment === "card" && (
                <div className="space-y-2 bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl">
                  <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold text-[11px] uppercase tracking-wider">
                    <CreditCard className="h-3.5 w-3.5" /> Card Details
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-2 rounded-lg text-[10px] leading-relaxed font-semibold">
                    Card terminal integration is not available at the moment.
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    Swipe or insert the card manually on your physical POS terminal. Click below to confirm.
                  </p>
                </div>
              )}

              {payment === "cash" && (
                <div className="space-y-2 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold text-[11px] uppercase tracking-wider">
                    <Banknote className="h-3.5 w-3.5" /> Cash Tender
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="inlineAmountTendered" className="text-[10px] text-muted-foreground">Amount Received</Label>
                      <button 
                        type="button" 
                        onClick={() => setShowTenderModal(true)} 
                        className="text-[9px] text-primary hover:underline cursor-pointer"
                      >
                        Use Numpad
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">{currency}</span>
                      <Input
                        id="inlineAmountTendered"
                        className="pl-10 text-xs font-bold bg-background h-9"
                        placeholder="0.00"
                        type="number"
                        step="0.01"
                        value={amountTendered}
                        onChange={e => setAmountTendered(e.target.value)}
                      />
                    </div>
                  </div>
                  {amountTendered && (
                    <div className="space-y-1 text-[11px] border-t border-border/30 pt-2 mt-1">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Cash Balance:</span>
                        <span className={`font-bold ${parsedTendered >= total ? "text-green-500" : "text-destructive"}`}>
                          {parsedTendered >= total ? "Change Due: " : "Owed/Outstanding: "}
                          {formatMoney(Math.abs(parsedTendered - total), currency)}
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Inline Quick Cash Suggestions */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    <button 
                      type="button"
                      onClick={() => setAmountTendered(total.toFixed(2))}
                      className="text-[9px] bg-background hover:bg-muted border border-border px-1.5 py-0.5 rounded font-semibold cursor-pointer"
                    >
                      Exact
                    </button>
                    {[50, 100, 200, 500, 1000].map(inc => (
                      <button
                        key={inc}
                        type="button"
                        onClick={() => {
                          const curr = parseFloat(amountTendered) || 0;
                          setAmountTendered((curr + inc).toFixed(2).replace(/\.00$/, ""));
                        }}
                        className="text-[9px] bg-background hover:bg-muted border border-border px-1.5 py-0.5 rounded cursor-pointer"
                      >
                        +{inc}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <Button 
            onClick={handleCharge} 
            disabled={
              cart.length === 0 || 
              processing || 
              (payment === "mpesa" && (!mpesaTxCode.trim() || !mpesaConfirmed)) ||
              (payment === "cash" && (!amountTendered || parsedTendered <= 0))
            } 
            className="w-full h-12 gradient-violet text-white border-0 cursor-pointer font-medium"
          >
            {processing ? "Processing..." : 
             payment === "mpesa" ? "Confirm & Complete M-Pesa" :
             payment === "cash" ? `Complete Cash Sale (${formatMoney(total, currency)})` :
             `Confirm & Complete Card Sale`}
          </Button>
        </div>
      </aside>

      {/* Modal - Cash Tender Calculator */}
      {showTenderModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Banknote className="h-5 w-5 text-primary" />
                Cash Tendered
              </h2>
              <button onClick={() => setShowTenderModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-muted/50 rounded-xl p-4 text-center border border-border/40">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Total Due</div>
                <div className="text-3xl font-extrabold text-foreground mt-1">{formatMoney(total, currency)}</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amountTendered" className="text-sm font-medium">Amount Received</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">{currency}</span>
                  <Input
                    id="amountTendered"
                    className="pl-14 text-2xl font-bold h-14 bg-background border-2 border-primary/20 focus:border-primary"
                    placeholder="0.00"
                    type="number"
                    step="0.01"
                    value={amountTendered}
                    onChange={e => setAmountTendered(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button type="button" variant="outline" className="h-11 font-semibold cursor-pointer col-span-2 text-primary border-primary/20 hover:bg-primary/5" onClick={handleExactCash}>
                  Exact Cash ({formatMoney(total, currency)})
                </Button>
                <Button type="button" variant="outline" className="h-11 font-semibold cursor-pointer text-destructive hover:bg-destructive/5 border-destructive/20" onClick={() => setAmountTendered("")}>
                  Clear
                </Button>
                <Button type="button" variant="outline" className="h-11 font-semibold cursor-pointer" onClick={() => handleQuickCash(50)}>
                  +50
                </Button>
                <Button type="button" variant="outline" className="h-11 font-semibold cursor-pointer" onClick={() => handleQuickCash(100)}>
                  +100
                </Button>
                <Button type="button" variant="outline" className="h-11 font-semibold cursor-pointer" onClick={() => handleQuickCash(200)}>
                  +200
                </Button>
                <Button type="button" variant="outline" className="h-11 font-semibold cursor-pointer" onClick={() => handleQuickCash(500)}>
                  +500
                </Button>
                <Button type="button" variant="outline" className="h-11 font-semibold cursor-pointer" onClick={() => handleQuickCash(1000)}>
                  +1000
                </Button>
                <Button type="button" variant="outline" className="h-11 font-semibold cursor-pointer" onClick={() => handleQuickCash(2000)}>
                  +2000
                </Button>
              </div>

              <div className="p-4 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-muted-foreground text-sm">
                    {parsedTendered >= total ? "Change Due:" : "Balance Due (Outstanding):"}
                  </span>
                  <span className={`text-2xl font-bold ${parsedTendered >= total ? "text-green-500" : "text-destructive font-semibold"}`}>
                    {formatMoney(Math.abs(parsedTendered - total), currency)}
                  </span>
                </div>
                {parsedTendered < total && parsedTendered > 0 && (
                  <p className="text-[10px] text-destructive font-medium text-center">
                    Note: Customer underpayment will be recorded as an outstanding balance.
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 cursor-pointer font-medium"
                  onClick={() => setShowTenderModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!isValidTender || processing}
                  className="flex-1 h-12 gradient-violet text-white border-0 cursor-pointer font-medium"
                  onClick={() => performCheckout({ cashReceived: parsedTendered })}
                >
                  {processing ? "Processing..." : "Complete & Print"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal - M-Pesa Confirmation */}
      {showMpesaModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-emerald-500 animate-pulse" />
                M-Pesa Payment
              </h2>
              <button onClick={() => setShowMpesaModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-emerald-500/10 rounded-xl p-4 text-center border border-emerald-500/20">
                <div className="text-xs uppercase tracking-wider text-emerald-700 font-semibold">Total Amount Due</div>
                <div className="text-3xl font-extrabold text-emerald-600 mt-1">{formatMoney(total, currency)}</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mpesaTxCode" className="text-sm font-medium">Transaction Code</Label>
                <Input
                  id="mpesaTxCode"
                  className="text-lg font-bold h-12 uppercase tracking-widest bg-background border-2 border-emerald-500/20 focus:border-emerald-500"
                  placeholder="e.g. SBY789XYZ"
                  value={mpesaTxCode}
                  onChange={e => setMpesaTxCode(e.target.value)}
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">
                  Confirm that the client has sent the funds to your M-Pesa Till/Paybill number before proceeding.
                </p>
              </div>

              <label className="flex items-start gap-2 py-1 cursor-pointer select-none text-xs text-muted-foreground">
                <input 
                  type="checkbox" 
                  className="rounded border-emerald-500/30 text-emerald-600 focus:ring-emerald-500 h-4 w-4 mt-0.5 cursor-pointer"
                  checked={mpesaConfirmed} 
                  onChange={e => setMpesaConfirmed(e.target.checked)} 
                />
                <span>I confirm that M-Pesa payment has been received on the device</span>
              </label>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 cursor-pointer font-medium"
                  onClick={() => setShowMpesaModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!mpesaTxCode.trim() || !mpesaConfirmed || processing}
                  className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white border-0 cursor-pointer font-medium"
                  onClick={() => performCheckout({ mpesaTxCode })}
                >
                  {processing ? "Processing..." : "Confirm & Print"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Card Confirmation */}
      {showCardModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-500" />
                Card Payment
              </h2>
              <button onClick={() => setShowCardModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-500/10 rounded-xl p-4 text-center border border-blue-500/20">
                <div className="text-xs uppercase tracking-wider text-blue-700 font-semibold">Total Amount Due</div>
                <div className="text-3xl font-extrabold text-blue-600 mt-1">{formatMoney(total, currency)}</div>
              </div>

              <div className="glass border-amber-500/30 bg-amber-500/10 rounded-xl p-4 flex flex-col gap-2">
                <div className="text-sm font-semibold text-amber-500">Integration Notice</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Card terminal integration is <span className="font-semibold text-amber-600">not available at the moment</span>. Please swipe or insert the client's card manually on your physical POS merchant terminal, verify that it was approved, and confirm offline below.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 cursor-pointer font-medium"
                  onClick={() => setShowCardModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={processing}
                  className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white border-0 cursor-pointer font-medium"
                  onClick={() => performCheckout()}
                >
                  {processing ? "Processing..." : "Confirm & Print"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Transaction Complete Receipt Preview */}
      {showReceiptModal && lastSaleDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 relative max-h-[95vh] flex flex-col my-4">
            <div className="flex flex-col items-center text-center mb-4 shrink-0">
              <div className="h-12 w-12 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center mb-3">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-bold">Transaction Completed</h2>
              <p className="text-xs text-muted-foreground mt-1">Sale reference: #{lastSaleDetails.id.substring(0, 8).toUpperCase()}</p>
            </div>

            {/* Virtual Paper Receipt */}
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="bg-[#FAF9F5] text-slate-800 p-5 rounded-xl border border-amber-100 shadow-inner font-mono text-xs max-w-sm mx-auto my-2">
                {business?.logo_url && (
                  <img src={business.logo_url} alt="Logo" className="max-w-[70px] h-auto mx-auto mb-2 filter grayscale" />
                )}
                <h3 className="text-center font-bold text-sm uppercase tracking-wider">{business?.business_name || "ZPos Retail"}</h3>
                {business?.description && <p className="text-center text-[10px] text-slate-500 leading-tight mb-2">{business.description}</p>}
                
                <div className="border-t border-dashed border-slate-300 my-2"></div>
                
                {(() => {
                  const previewPaymentLower = lastSaleDetails.paymentMethod.toLowerCase();
                  const previewMpesaMatch = previewPaymentLower.match(/ref:\s*([a-z0-9]+)/i);
                  const previewMpesaRef = previewMpesaMatch ? previewMpesaMatch[1].toUpperCase() : null;
                  const previewIsCard = previewPaymentLower.includes("card");
                  return (
                    <>
                      <div className="space-y-0.5">
                        <div><b>Receipt:</b> #{lastSaleDetails.id.substring(0, 8).toUpperCase()}</div>
                        <div><b>Date:</b> {new Date(lastSaleDetails.created_at).toLocaleString()}</div>
                        <div><b>Cashier:</b> {lastSaleDetails.cashierName}</div>
                        <div><b>Payment:</b> {previewIsCard ? "CARD (DETAILS N/A)" : lastSaleDetails.paymentMethod.toUpperCase()}</div>
                        {previewMpesaRef && <div><b>M-Pesa Ref:</b> {previewMpesaRef}</div>}
                      </div>
                      
                      <div className="border-t border-dashed border-slate-300 my-2"></div>
                      
                      <div className="space-y-1.5">
                        <div className="font-bold border-b border-slate-200 pb-0.5">ITEMS</div>
                        {lastSaleDetails.items.map((item, idx) => (
                          <div key={idx}>
                            <div className="flex justify-between">
                              <span>{item.qty}x {item.name}</span>
                              <span>{formatMoney(item.qty * item.price, currency)}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 pl-3">
                              {item.qty} x {formatMoney(item.price, currency)}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="border-t border-dashed border-slate-300 my-2"></div>
                      
                      <div className="space-y-0.5">
                        <div className="flex justify-between">
                          <span>Subtotal</span>
                          <span>{formatMoney(lastSaleDetails.subtotal, currency)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tax ({(taxRate * 100).toFixed(0)}%)</span>
                          <span>{formatMoney(lastSaleDetails.tax, currency)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-sm pt-1">
                          <span>Total</span>
                          <span>{formatMoney(lastSaleDetails.total, currency)}</span>
                        </div>
                        {lastSaleDetails.amountTendered !== undefined && (
                          <>
                            <div className="flex justify-between text-slate-600 mt-2">
                              <span>Cash Tendered</span>
                              <span>{formatMoney(lastSaleDetails.amountTendered, currency)}</span>
                            </div>
                            {lastSaleDetails.changeDue !== undefined && lastSaleDetails.changeDue >= 0 ? (
                              <div className="flex justify-between font-semibold text-slate-700">
                                <span>Change Due</span>
                                <span>{formatMoney(lastSaleDetails.changeDue, currency)}</span>
                              </div>
                            ) : (
                              <div className="flex justify-between font-semibold text-destructive">
                                <span>Outstanding Balance</span>
                                <span>{formatMoney(Math.abs(lastSaleDetails.changeDue || 0), currency)}</span>
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

            <div className="flex gap-3 mt-4 shrink-0">
              <Button
                variant="outline"
                className="flex-1 h-11 cursor-pointer font-medium"
                onClick={printReceipt}
              >
                Print Receipt
              </Button>
              <Button
                className="flex-1 h-11 gradient-violet text-white border-0 cursor-pointer font-medium"
                onClick={() => {
                  setShowReceiptModal(false);
                  setLastSaleDetails(null);
                }}
              >
                New Sale
              </Button>
            </div>
          </div>
        </div>
      )}
      <BarcodeScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanResult={handleScanResult}
        facingMode={facingMode}
        setFacingMode={setFacingMode}
        torchOn={torchOn}
        setTorchOn={setTorchOn}
        continuousScan={continuousScan}
        setContinuousScan={setContinuousScan}
        title="POS Barcode Scanner"
      />
    </div>
  );
}
