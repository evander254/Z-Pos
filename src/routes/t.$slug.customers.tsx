import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { useBusinessRealtime } from "@/lib/use-business-realtime";
import { Plus, Users, Search, Star, Wallet, Mail, Phone, UserPlus, BadgeCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/t/$slug/customers")({ component: Customers });

type Customer = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  loyalty_points: number | null;
  credit_balance?: number | null;
  created_at?: string | null;
};

function Customers() {
  const { business, role } = useTenant();
  const [list, setList] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ full_name: "", phone: "", email: "" });
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupCustomer, setLookupCustomer] = useState<Customer | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [redeemPoints, setRedeemPoints] = useState("");

  async function load() {
    if (!business) return;
    const { data, error } = await supabase
      .from("customers")
      .select("id,full_name,phone,email,loyalty_points,credit_balance,created_at")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setList((data || []) as Customer[]);
  }

  useEffect(() => {
    load();
  }, [business]);

  useBusinessRealtime(business?.id, ["customers", "sales", "credit_ledger"], load);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!business) return;
    const { error } = await supabase
      .from("customers")
      .insert({ business_id: business.id, ...form });
    if (error) return toast.error(error.message);
    toast.success("Customer added");
    setOpen(false);
    setForm({ full_name: "", phone: "", email: "" });
    load();
  }

  const currency = business?.currency || "KES";
  const pointValue = 1;
  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter(
      (c) =>
        !q ||
        (c.full_name || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q),
    );
  }, [list, search]);

  const totalCredit = list.reduce((sum, c) => sum + Number(c.credit_balance || 0), 0);
  const totalLoyalty = list.reduce((sum, c) => sum + Number(c.loyalty_points || 0), 0);
  const contactable = list.filter((c) => c.phone || c.email).length;

  if (!business) return null;

  async function lookupCustomerByPhone(e?: React.FormEvent) {
    e?.preventDefault();
    if (!business) return;

    const phone = lookupPhone.replace(/\D/g, "");
    if (!phone) {
      toast.error("Enter the customer's phone number first");
      return;
    }

    setLookupLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("id,full_name,phone,email,loyalty_points,credit_balance,created_at")
      .eq("business_id", business.id)
      .ilike("phone", `%${phone}%`)
      .limit(1)
      .maybeSingle();

    setLookupLoading(false);
    setRedeemPoints("");

    if (error) {
      toast.error(error.message);
      return;
    }

    if (!data) {
      setLookupCustomer(null);
      toast.error("No customer found with that phone number");
      return;
    }

    setLookupCustomer(data as Customer);
  }

  async function redeemCustomerPoints() {
    if (!lookupCustomer) return;

    const available = Number(lookupCustomer.loyalty_points || 0);
    const points = Math.floor(Number(redeemPoints || 0));

    if (points <= 0) {
      toast.error("Enter points to redeem");
      return;
    }

    if (points > available) {
      toast.error("Customer does not have enough points");
      return;
    }

    const nextPoints = available - points;
    const { error } = await supabase
      .from("customers")
      .update({ loyalty_points: nextPoints })
      .eq("id", lookupCustomer.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setLookupCustomer({ ...lookupCustomer, loyalty_points: nextPoints });
    setRedeemPoints("");
    toast.success(`Redeemed ${points} points worth ${formatMoney(points * pointValue, currency)}`);
  }

  if (role === "cashier") {
    const points = Number(lookupCustomer?.loyalty_points || 0);
    const pointsWorth = points * pointValue;
    const redeemValue = Math.floor(Number(redeemPoints || 0)) * pointValue;

    return (
      <div className="w-full p-4 md:p-8 space-y-6">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 md:p-8 shadow-sm">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary/20 via-emerald-500/10 to-transparent" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <BadgeCheck className="h-3.5 w-3.5" /> Customer points lookup
            </div>
            <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">
              Redeem Loyalty Points
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter the customer phone number to view their details and redeem points. Default
              value: 1 point = {formatMoney(pointValue, currency)}.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <form onSubmit={lookupCustomerByPhone} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 h-11 bg-background"
                value={lookupPhone}
                onChange={(e) => setLookupPhone(e.target.value)}
                placeholder="Enter customer phone number"
              />
            </div>
            <Button type="submit" disabled={lookupLoading} className="h-11">
              {lookupLoading ? "Searching..." : "Find customer"}
            </Button>
          </form>
        </div>

        {lookupCustomer && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Customer</div>
                  <div className="mt-1 text-2xl font-bold">
                    {lookupCustomer.full_name || "Unnamed customer"}
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                    <div className="inline-flex items-center gap-2">
                      <Phone className="h-4 w-4" /> {lookupCustomer.phone || "No phone"}
                    </div>
                    {lookupCustomer.email && (
                      <div className="inline-flex items-center gap-2 ml-0 sm:ml-4">
                        <Mail className="h-4 w-4" /> {lookupCustomer.email}
                      </div>
                    )}
                  </div>
                </div>
                <Star className="h-8 w-8 text-amber-500" />
              </div>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/30 p-4">
                  <div className="text-xs text-muted-foreground">Available points</div>
                  <div className="mt-1 text-3xl font-bold">{points.toLocaleString()}</div>
                </div>
                <div className="rounded-xl bg-muted/30 p-4">
                  <div className="text-xs text-muted-foreground">Points worth</div>
                  <div className="mt-1 text-3xl font-bold">
                    {formatMoney(pointsWorth, currency)}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
              <div className="font-semibold">Redeem points</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Subtract points after applying the discount at checkout.
              </p>
              <div className="mt-4 space-y-3">
                <Input
                  type="number"
                  min="0"
                  max={points}
                  value={redeemPoints}
                  onChange={(e) => setRedeemPoints(e.target.value)}
                  placeholder="Points to redeem"
                />
                <div className="text-sm text-muted-foreground">
                  Discount value:{" "}
                  <span className="font-semibold text-foreground">
                    {formatMoney(redeemValue, currency)}
                  </span>
                </div>
                <Button
                  className="w-full"
                  onClick={redeemCustomerPoints}
                  disabled={!redeemPoints || Number(redeemPoints) <= 0 || points <= 0}
                >
                  Redeem points
                </Button>
              </div>
            </div>
          </div>
        )}
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
              <Users className="h-3.5 w-3.5" /> Customer relationship hub
            </div>
            <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">Customers</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Build loyalty, track credit exposure, and keep customer contacts market-ready.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-violet text-white border-0 h-11">
                <Plus className="h-4 w-4 mr-1" /> New customer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add customer</DialogTitle>
              </DialogHeader>
              <form onSubmit={create} className="space-y-3">
                <div>
                  <Label>Full name</Label>
                  <Input
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full gradient-violet text-white border-0">
                  Create
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: "Total customers",
            value: String(list.length),
            helper: `${filteredList.length} visible`,
            icon: Users,
            tone: "from-primary/25 to-primary/5",
          },
          {
            label: "Loyalty points",
            value: totalLoyalty.toLocaleString(),
            helper: "Total points issued",
            icon: Star,
            tone: "from-amber-500/25 to-amber-500/5",
          },
          {
            label: "Credit exposure",
            value: formatMoney(totalCredit, currency),
            helper: "Outstanding customer credit",
            icon: Wallet,
            tone: "from-rose-500/25 to-rose-500/5",
          },
          {
            label: "Reachable",
            value: `${contactable}/${list.length}`,
            helper: "Have phone or email",
            icon: Phone,
            tone: "from-emerald-500/25 to-emerald-500/5",
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border border-border/50 bg-gradient-to-br ${card.tone} p-5 shadow-sm`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{card.label}</span>
              <card.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-4 text-2xl font-bold truncate">{card.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{card.helper}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="font-semibold">Customer directory</h2>
            <p className="text-xs text-muted-foreground">
              Search contacts, loyalty points, and credit balances.
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-11 bg-background"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {filteredList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <UserPlus className="h-10 w-10 text-muted-foreground mx-auto" />
            <div className="mt-3 font-semibold">No customers found</div>
            <p className="text-sm text-muted-foreground mt-1">
              Add a customer or adjust your search.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border bg-muted/20">
                <tr>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4 text-right">Loyalty</th>
                  <th className="p-4 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/20"
                  >
                    <td className="p-4 font-medium">{c.full_name || "Unnamed customer"}</td>
                    <td className="p-4 text-muted-foreground">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {c.phone || "No phone"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {c.email || "No email"}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-right font-semibold">
                      {Number(c.loyalty_points || 0).toLocaleString()}
                    </td>
                    <td className="p-4 text-right font-bold">
                      {formatMoney(Number(c.credit_balance || 0), currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
