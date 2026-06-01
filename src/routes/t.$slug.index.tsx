import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { formatMoney } from "@/lib/format";
import { BUSINESS_TYPE_MAP } from "@/lib/business-types";
import { Receipt, TrendingUp, Package, AlertTriangle, ScanBarcode, Plus } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/t/$slug/")({ component: Dashboard });

function Dashboard() {
  const { slug } = Route.useParams();
  const { business } = useTenant();
  const [stats, setStats] = useState({ today: 0, count: 0, products: 0, lowStock: 0 });
  const [series, setSeries] = useState<{ day: string; total: number }[]>([]);

  useEffect(() => {
    if (!business) return;
    (async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6); weekStart.setHours(0, 0, 0, 0);

      const [{ data: salesToday }, { data: weekSales }, { count: prodCount }, { data: lowStock }] = await Promise.all([
        supabase.from("sales").select("total_amount").eq("business_id", business.id).gte("created_at", today.toISOString()),
        supabase.from("sales").select("total_amount, created_at").eq("business_id", business.id).gte("created_at", weekStart.toISOString()),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("business_id", business.id),
        supabase.from("products").select("id, stock_quantity, low_stock_alert").eq("business_id", business.id),
      ]);

      const todayTotal = (salesToday || []).reduce((a, s) => a + Number(s.total_amount || 0), 0);
      const low = (lowStock || []).filter(p => (p.stock_quantity ?? 0) <= (p.low_stock_alert ?? 0)).length;

      const byDay: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        byDay[d.toISOString().slice(5, 10)] = 0;
      }
      (weekSales || []).forEach(s => {
        if (!s.created_at) return;
        const k = new Date(s.created_at).toISOString().slice(5, 10);
        if (k in byDay) byDay[k] += Number(s.total_amount || 0);
      });

      setStats({ today: todayTotal, count: (salesToday || []).length, products: prodCount || 0, lowStock: low });
      setSeries(Object.entries(byDay).map(([day, total]) => ({ day, total })));
    })();
  }, [business]);

  if (!business) return null;
  const def = BUSINESS_TYPE_MAP[business.business_type as keyof typeof BUSINESS_TYPE_MAP];
  const currency = business.currency || "KES";

  const cards = [
    { label: "Today's Sales", value: formatMoney(stats.today, currency), icon: TrendingUp, color: "from-primary to-accent" },
    { label: "Transactions", value: String(stats.count), icon: Receipt, color: "from-accent to-primary" },
    { label: "Products", value: String(stats.products), icon: Package, color: "from-primary to-chart-3" },
    { label: "Low stock", value: String(stats.lowStock), icon: AlertTriangle, color: "from-destructive to-accent" },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground">{def?.label}</div>
          <h1 className="text-3xl font-bold mt-1">Welcome back 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">Here's how {business.business_name} is doing today.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/t/$slug/products" params={{ slug }} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent/10"><Plus className="h-4 w-4" /> Add product</Link>
          <Link to="/t/$slug/pos" params={{ slug }} className="inline-flex items-center gap-2 rounded-lg gradient-violet text-white px-4 py-2 text-sm"><ScanBarcode className="h-4 w-4" /> Open POS</Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">{c.label}</div>
              <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${c.color} flex items-center justify-center`}>
                <c.icon className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-semibold">{c.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Sales this week</div>
              <div className="text-xs text-muted-foreground">Last 7 days</div>
            </div>
          </div>
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                <XAxis dataKey="day" stroke="oklch(0.72 0.03 280)" fontSize={12} />
                <YAxis stroke="oklch(0.72 0.03 280)" fontSize={12} />
                <Tooltip contentStyle={{ background: "oklch(0.22 0.06 285)", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: 12 }} />
                <Line type="monotone" dataKey="total" stroke="oklch(0.74 0.16 300)" strokeWidth={3} dot={{ r: 4, fill: "oklch(0.62 0.22 285)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="text-sm font-medium">Your enabled modules</div>
          <div className="text-xs text-muted-foreground">Based on {def?.label}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {def?.modules.map(m => (
              <span key={m} className="text-xs rounded-full px-3 py-1 bg-primary/15">{m}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
