import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { formatMoney } from "@/lib/format";
import { BookOpenCheck, MessageCircle, Banknote, Search, Plus, X, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/t/$slug/credit-ledger")({ component: CreditLedgerDashboard });

function CreditLedgerDashboard() {
  const { business } = useTenant();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  const [customers, setCustomers] = useState<any[]>([]);
  const [debtors, setDebtors] = useState<any[]>([]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"add" | "pay">("pay");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  async function loadData() {
    if (!business) return;
    setLoading(true);
    
    // Fetch all customers for the dropdown
    const { data: allCustomers, error: custErr } = await supabase
      .from("customers")
      .select("*")
      .eq("business_id", business.id)
      .order("full_name");
      
    if (!custErr && allCustomers) {
      setCustomers(allCustomers);
      // Filter debtors
      const withDebt = allCustomers.filter(c => (c.credit_balance || 0) > 0);
      
      // Also fetch last payment date from ledger
      const { data: ledgers } = await supabase
        .from("credit_ledger")
        .select("customer_id, created_at")
        .eq("business_id", business.id)
        .eq("transaction_type", "payment")
        .order("created_at", { ascending: false });
        
      const lastPayments = new Map();
      if (ledgers) {
        for (const l of ledgers) {
          if (!lastPayments.has(l.customer_id)) {
            lastPayments.set(l.customer_id, l.created_at);
          }
        }
      }
      
      const mappedDebtors = withDebt.map(d => ({
        ...d,
        lastPayment: lastPayments.get(d.id) || null
      }));
      
      setDebtors(mappedDebtors);
    }
    
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [business]);

  if (!business) return null;
  const currency = business.currency || "KES";

  const totalDebt = debtors.reduce((acc, d) => acc + (d.credit_balance || 0), 0);

  const handleWhatsAppReminder = (debtor: any) => {
    const name = debtor.full_name || "Customer";
    const balance = formatMoney(debtor.credit_balance || 0, currency);
    const message = `Hello ${name}, a friendly reminder from ${business.business_name} regarding your outstanding balance of ${balance}.`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${debtor.phone}?text=${encodedMessage}`, "_blank");
  };

  const filteredDebtors = debtors.filter(d => 
    (d.full_name || "").toLowerCase().includes(search.toLowerCase()) || 
    (d.phone || "").includes(search)
  );
  
  function openPayModal(customerId: string) {
    setSelectedCustomerId(customerId);
    setModalType("pay");
    setAmount("");
    setNotes("");
    setShowModal(true);
  }
  
  function openAddModal() {
    setSelectedCustomerId("");
    setModalType("add");
    setAmount("");
    setNotes("");
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!business || !selectedCustomerId || !amount) return;
    setProcessing(true);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid amount");
      setProcessing(false);
      return;
    }

    try {
      const customer = customers.find((c) => c.id === selectedCustomerId);
      if (!customer) throw new Error("Customer not found");

      const isPayment = modalType === "pay";
      const ledgerAmount = isPayment ? -numAmount : numAmount;
      const newBalance = (customer.credit_balance || 0) + ledgerAmount;

      if (newBalance < 0) {
        throw new Error("Payment cannot exceed outstanding balance");
      }

      // 1. Insert ledger entry
      const { error: ledgerError } = await supabase.from("credit_ledger").insert({
        business_id: business.id,
        customer_id: selectedCustomerId,
        amount: ledgerAmount,
        transaction_type: isPayment ? "payment" : "manual_adjustment",
        notes: notes || null
      });
      if (ledgerError) throw ledgerError;

      // 2. Update customer balance
      const { error: custError } = await supabase
        .from("customers")
        .update({ credit_balance: newBalance })
        .eq("id", selectedCustomerId);
      if (custError) throw custError;

      toast.success(isPayment ? "Payment recorded successfully" : "Credit added successfully");
      setShowModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpenCheck className="h-8 w-8 text-primary" /> Credit Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Track store credit and manage customer debt.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="glass rounded-xl px-4 py-3 flex items-center gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Total Outstanding</div>
              <div className="text-xl font-bold text-destructive">{formatMoney(totalDebt, currency)}</div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Banknote className="h-5 w-5 text-destructive" />
            </div>
          </div>
          <Button onClick={openAddModal} className="h-12 px-6 shadow-md cursor-pointer gap-2">
            <Plus className="h-4 w-4" /> Add Credit / Payment
          </Button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5">
        <div className="flex justify-between items-center mb-6">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search debtors..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background/50 border-border/50"
            />
          </div>
        </div>
        
        <div className="rounded-lg border border-border bg-background/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Last Payment</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right w-[250px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1, 2, 3].map(i => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded ml-auto"></div></TableCell>
                    <TableCell><div className="h-8 w-full bg-muted animate-pulse rounded"></div></TableCell>
                  </TableRow>
                ))
              ) : filteredDebtors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <BookOpenCheck className="h-8 w-8 text-muted-foreground/30" />
                      <div className="text-muted-foreground">No debtors found.</div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDebtors.map(d => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="font-medium">{d.full_name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{d.phone || "No phone"}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {d.lastPayment ? new Date(d.lastPayment).toLocaleDateString() : "Never"}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-destructive">
                      {formatMoney(d.credit_balance, currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {d.phone && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleWhatsAppReminder(d)}
                            className="gap-1.5 h-8 text-emerald-600 border-emerald-600/20 hover:bg-emerald-600/10 cursor-pointer"
                          >
                            <MessageCircle className="h-3.5 w-3.5" /> Reminder
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          className="gap-1.5 h-8 cursor-pointer"
                          onClick={() => openPayModal(d.id)}
                        >
                          <Banknote className="h-3.5 w-3.5" /> Pay
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </motion.div>

      {/* Modal: Record Credit/Payment */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 relative"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Banknote className="h-5 w-5 text-primary" />
                Record {modalType === "add" ? "Debt" : "Payment"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 mb-4">
                <Button 
                  type="button" 
                  variant={modalType === "pay" ? "default" : "outline"} 
                  onClick={() => setModalType("pay")}
                  className="cursor-pointer"
                >
                  Receive Payment
                </Button>
                <Button 
                  type="button" 
                  variant={modalType === "add" ? "destructive" : "outline"}
                  onClick={() => setModalType("add")}
                  className="cursor-pointer"
                >
                  Add Debt
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Customer</Label>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId} required>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">No customers found.</div>
                    ) : (
                      customers.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.full_name || "Unknown"} {c.phone ? `(${c.phone})` : ""}
                          {c.credit_balance > 0 && ` - Owes ${formatMoney(c.credit_balance, currency)}`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Amount ({currency})</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  required
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="text-lg font-bold h-12"
                />
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea 
                  placeholder={modalType === "pay" ? "e.g., Cash payment for last week's invoice" : "e.g., Store credit for items purchased"}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="resize-none"
                  rows={3}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowModal(false)}
                  className="flex-1 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={processing || !selectedCustomerId || !amount}
                  className={`flex-1 cursor-pointer ${modalType === "add" ? "bg-destructive hover:bg-destructive/90 text-white" : ""}`}
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {processing ? "Saving..." : modalType === "add" ? "Add Debt" : "Record Payment"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
