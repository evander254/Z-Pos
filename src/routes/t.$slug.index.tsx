import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useTenant } from "@/lib/tenant-context";
import { formatMoney } from "@/lib/format";
import { BUSINESS_TYPE_MAP } from "@/lib/business-types";
import { getEmployeeStoreContextFn } from "@/lib/employee-actions";
import { useBusinessRealtime } from "@/lib/use-business-realtime";
import {
  Receipt,
  TrendingUp,
  Package,
  AlertTriangle,
  ScanBarcode,
  Plus,
  Users,
  Clock,
  Store,
  Wallet,
  ShoppingCart,
  ArrowUpRight,
  Boxes,
  Truck,
  ShieldCheck,
} from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/t/$slug/")({ component: Dashboard });

type CashierEmployee = {
  id?: string | null;
  user_id?: string | null;
  work_account_number?: string | null;
  username?: string | null;
  store_id?: string | null;
  stores?: { name?: string | null } | null;
  store?: { name?: string | null } | null;
  store_name?: string | null;
  profiles?: { full_name?: string | null } | null;
};

type DashboardSale = {
  total_amount: number | null;
  created_at: string | null;
  cashier_id: string | null;
  cashier_name: string | null;
  payment_method: string | null;
  customer_id: string | null;
};

type TimeFormat = "12" | "24";

const DASHBOARD_TIME_FORMAT_KEY = "zpos-dashboard-time-format";

const dashboardPanelClass =
  "rounded-2xl border border-border/60 bg-card/95 p-5 shadow-[0_14px_45px_rgba(15,23,42,0.06)] dark:shadow-none";
const dashboardPillClass =
  "inline-flex items-center gap-2 rounded-lg border border-border bg-background/80 px-4 py-2.5 text-xs font-semibold shadow-sm backdrop-blur";
const dashboardContentClass = "w-full max-w-none space-y-6";
const dashboardMetricGridClass = "grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-4";
const dashboardSectionGridClass =
  "grid grid-cols-[repeat(auto-fit,minmax(min(100%,24rem),1fr))] gap-4";

function getOrdinalDay(day: number) {
  if (day > 3 && day < 21) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function formatDashboardDateTime(date: Date, timeFormat: TimeFormat) {
  const day = getOrdinalDay(date.getDate());
  const month = date.toLocaleDateString(undefined, { month: "long" });
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: timeFormat === "12",
  });
  return `${day} ${month} ${date.getFullYear()} ${time}`;
}

function getCashierName(employee: unknown, fallback: string) {
  const cashier = employee as CashierEmployee | null;
  return cashier?.profiles?.full_name || cashier?.username || fallback;
}

function getEmployeeStoreId(employee: unknown) {
  return (employee as CashierEmployee | null)?.store_id || null;
}

function getEmployeeStoreName(employee: unknown) {
  const cashier = employee as CashierEmployee | null;
  return cashier?.stores?.name || cashier?.store?.name || cashier?.store_name || null;
}

function Dashboard() {
  const { slug } = Route.useParams();
  const { business, role, employee } = useTenant();
  const { user } = useAuth();
  const [stats, setStats] = useState({
    today: 0,
    yesterday: 0,
    count: 0,
    products: 0,
    lowStock: 0,
    outOfStock: 0,
    customers: 0,
    employees: 0,
    stores: 0,
    pendingPOs: 0,
    inventoryValue: 0,
    weekTotal: 0,
    weekCount: 0,
    avgSale: 0,
  });
  const [series, setSeries] = useState<{ day: string; total: number }[]>([]);
  const [lowStockItems, setLowStockItems] = useState<
    { id: string; name: string; stock: number; alert: number }[]
  >([]);
  const [topProducts, setTopProducts] = useState<
    { name: string; salesCount: number; quantity: number; total: number }[]
  >([]);
  const [cashierStats, setCashierStats] = useState({
    weekTotal: 0,
    weekCount: 0,
    todayTotal: 0,
    todayCount: 0,
    avgSale: 0,
    customers: 0,
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeFormat, setTimeFormat] = useState<TimeFormat>(() => {
    if (typeof window === "undefined") return "12";
    return localStorage.getItem(DASHBOARD_TIME_FORMAT_KEY) === "24" ? "24" : "12";
  });
  const [assignedStore, setAssignedStore] = useState<string>("Unassigned store");
  const [realtimeTick, setRealtimeTick] = useState(0);

  function updateTimeFormat(value: TimeFormat) {
    setTimeFormat(value);
    localStorage.setItem(DASHBOARD_TIME_FORMAT_KEY, value);
  }

  useEffect(() => {
    if (!business) return;
    (async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);

      const [
        { data: salesToday },
        { data: salesYesterday },
        { data: weekSales },
        { data: productRows },
        { count: customerCount },
        { count: employeeCount },
        { count: storeCount },
        { count: pendingPOCount },
      ] = await Promise.all([
        supabase
          .from("sales")
          .select("id,total_amount")
          .eq("business_id", business.id)
          .gte("created_at", today.toISOString()),
        supabase
          .from("sales")
          .select("total_amount")
          .eq("business_id", business.id)
          .gte("created_at", yesterday.toISOString())
          .lt("created_at", today.toISOString()),
        supabase
          .from("sales")
          .select("id,total_amount, created_at")
          .eq("business_id", business.id)
          .gte("created_at", weekStart.toISOString()),
        supabase
          .from("products")
          .select("id,name,price,stock_quantity,low_stock_alert")
          .eq("business_id", business.id)
          .eq("active", true),
        supabase
          .from("customers")
          .select("id", { count: "exact", head: true })
          .eq("business_id", business.id),
        supabase
          .from("employees")
          .select("id", { count: "exact", head: true })
          .eq("business_id", business.id)
          .eq("active", true),
        supabase
          .from("stores")
          .select("id", { count: "exact", head: true })
          .eq("business_id", business.id)
          .eq("active", true),
        supabase
          .from("purchase_orders")
          .select("id", { count: "exact", head: true })
          .eq("business_id", business.id)
          .eq("status", "pending"),
      ]);

      const todayTotal = (salesToday || []).reduce((a, s) => a + Number(s.total_amount || 0), 0);
      const yesterdayTotal = (salesYesterday || []).reduce(
        (a, s) => a + Number(s.total_amount || 0),
        0,
      );
      const products = productRows || [];
      const lowRows = products
        .filter((p) => (p.stock_quantity ?? 0) <= (p.low_stock_alert ?? 0))
        .sort((a, b) => Number(a.stock_quantity || 0) - Number(b.stock_quantity || 0));
      const outOfStock = products.filter((p) => Number(p.stock_quantity || 0) <= 0).length;
      const inventoryValue = products.reduce(
        (sum, p) => sum + Number(p.price || 0) * Number(p.stock_quantity || 0),
        0,
      );
      const weekTotal = (weekSales || []).reduce((a, s) => a + Number(s.total_amount || 0), 0);

      const byDay: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        byDay[d.toLocaleDateString(undefined, { month: "short", day: "numeric" })] = 0;
      }
      (weekSales || []).forEach((s) => {
        if (!s.created_at) return;
        const k = new Date(s.created_at).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
        if (k in byDay) byDay[k] += Number(s.total_amount || 0);
      });

      const saleIds = (weekSales || []).map((s) => s.id);
      if (saleIds.length > 0) {
        const { data: items } = await supabase
          .from("sale_items")
          .select("product_name,quantity,subtotal")
          .in("sale_id", saleIds);

        const byProduct: Record<
          string,
          { name: string; salesCount: number; quantity: number; total: number }
        > = {};
        (items || []).forEach((item) => {
          const name = item.product_name || "Unknown item";
          if (!byProduct[name]) byProduct[name] = { name, salesCount: 0, quantity: 0, total: 0 };
          byProduct[name].salesCount += 1;
          byProduct[name].quantity += Number(item.quantity || 0);
          byProduct[name].total += Number(item.subtotal || 0);
        });
        setTopProducts(
          Object.values(byProduct)
            .sort((a, b) => b.salesCount - a.salesCount || b.quantity - a.quantity)
            .slice(0, 5),
        );
      } else {
        setTopProducts([]);
      }

      setStats({
        today: todayTotal,
        yesterday: yesterdayTotal,
        count: (salesToday || []).length,
        products: products.length,
        lowStock: lowRows.length,
        outOfStock,
        customers: customerCount || 0,
        employees: employeeCount || 0,
        stores: storeCount || 0,
        pendingPOs: pendingPOCount || 0,
        inventoryValue,
        weekTotal,
        weekCount: (weekSales || []).length,
        avgSale: (salesToday || []).length ? todayTotal / (salesToday || []).length : 0,
      });
      setLowStockItems(
        lowRows.slice(0, 5).map((p) => ({
          id: p.id,
          name: p.name,
          stock: Number(p.stock_quantity || 0),
          alert: Number(p.low_stock_alert || 0),
        })),
      );
      setSeries(Object.entries(byDay).map(([day, total]) => ({ day, total })));
    })();
  }, [business, realtimeTick]);

  useEffect(() => {
    if (!business || role !== "cashier") return;
    (async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);
      const cashierName = getCashierName(employee, user?.email || "Staff");

      const { data: weekSales } = await supabase
        .from("sales")
        .select("total_amount, created_at, cashier_id, cashier_name, payment_method, customer_id")
        .eq("business_id", business.id)
        .gte("created_at", weekStart.toISOString())
        .order("created_at", { ascending: true });

      const mine = ((weekSales || []) as DashboardSale[]).filter(
        (sale) =>
          sale.cashier_id === user?.id ||
          sale.cashier_name === cashierName ||
          String(sale.payment_method || "").includes(`::${cashierName}`),
      );
      const todayMine = mine.filter((s) => s.created_at && new Date(s.created_at) >= today);
      const weekTotal = mine.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
      const todayTotal = todayMine.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
      const uniqueCustomers = new Set(mine.map((s) => s.customer_id).filter(Boolean)).size;

      const byDay: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        byDay[d.toISOString().slice(5, 10)] = 0;
      }
      mine.forEach((s) => {
        if (!s.created_at) return;
        const key = new Date(s.created_at).toISOString().slice(5, 10);
        if (key in byDay) byDay[key] += Number(s.total_amount || 0);
      });

      setCashierStats({
        weekTotal,
        weekCount: mine.length,
        todayTotal,
        todayCount: todayMine.length,
        avgSale: mine.length ? weekTotal / mine.length : 0,
        customers: uniqueCustomers,
      });
      setSeries(Object.entries(byDay).map(([day, total]) => ({ day, total })));
    })();
  }, [business, role, employee, user, realtimeTick]);

  useBusinessRealtime(
    business?.id,
    ["sales", "products", "customers", "employees", "stores", "purchase_orders"],
    () => setRealtimeTick((tick) => tick + 1),
  );

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!business || role !== "cashier") return;
    const storeId = getEmployeeStoreId(employee);
    (async () => {
      const cashier = employee as CashierEmployee | null;
      const context = await getEmployeeStoreContextFn({
        data: {
          businessId: business.id,
          employeeId: cashier?.id,
          userId: cashier?.user_id,
          storeId,
          workAccountNumber: cashier?.work_account_number,
        },
      });
      if (context.store_name) {
        setAssignedStore(context.store_name);
        return;
      }

      if (!storeId) {
        setAssignedStore("Unassigned store");
        return;
      }

      const { data } = await supabase
        .from("stores")
        .select("id,name")
        .eq("business_id", business.id);
      const store = (data || []).find((row) => row.id === storeId);
      setAssignedStore(store?.name || "Store name unavailable");
    })();
  }, [business, role, employee]);

  if (!business) return null;
  const def = BUSINESS_TYPE_MAP[business.business_type as keyof typeof BUSINESS_TYPE_MAP];
  const currency = business.currency || "KES";
  const formattedCurrentTime = formatDashboardDateTime(currentTime, timeFormat);

  if (role === "cashier") {
    const cashierName = getCashierName(employee, user?.email || "Cashier");
    const cashierCards = [
      {
        label: "Today's Sales",
        value: formatMoney(cashierStats.todayTotal, currency),
        icon: TrendingUp,
        tone: "text-primary bg-primary/10",
      },
      {
        label: "Today's Transactions",
        value: String(cashierStats.todayCount),
        icon: Receipt,
        tone: "text-emerald-600 bg-emerald-500/10",
      },
      {
        label: "Weekly Sales",
        value: formatMoney(cashierStats.weekTotal, currency),
        icon: Clock,
        tone: "text-blue-600 bg-blue-500/10",
      },
      {
        label: "Customers Served",
        value: String(cashierStats.customers),
        icon: Users,
        tone: "text-amber-600 bg-amber-500/10",
      },
    ];

    return (
      <div className="min-h-full bg-[radial-gradient(circle_at_top_right,var(--theme-accent),transparent_32%)] p-4 md:p-6 xl:p-8">
      <div className={dashboardContentClass}>
        <div className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-card/95 p-6 md:p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:shadow-none">
          <img
            src={def?.imageUrl}
            alt={def?.label || "Business"}
            className="absolute inset-y-0 right-0 hidden h-full w-1/2 object-cover opacity-20 mix-blend-multiply dark:mix-blend-normal dark:opacity-25 md:block"
          />
          <div className="absolute inset-y-0 right-0 w-full bg-gradient-to-l from-primary/15 via-card/90 to-card md:w-2/3" />
          <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <ScanBarcode className="h-3.5 w-3.5" /> Cashier workspace
              </div>
              <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">
                Welcome, {cashierName}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Track your weekly sales, open POS, and check customers before checkout.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-3 py-1 font-semibold">
                  <Clock className="h-3.5 w-3.5 text-primary" /> {formattedCurrentTime}
                </span>
                <label className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 font-semibold">
                  Time
                  <select
                    value={timeFormat}
                    onChange={(event) => updateTimeFormat(event.target.value as TimeFormat)}
                    className="bg-transparent text-xs font-semibold outline-none"
                    aria-label="Time format"
                  >
                    <option value="12">12hr</option>
                    <option value="24">24hr</option>
                  </select>
                </label>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-3 py-1 font-semibold">
                  <Store className="h-3.5 w-3.5 text-primary" /> Assigned store: {assignedStore}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/t/$slug/customers"
                params={{ slug }}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background/80 px-4 py-2 text-sm font-medium hover:bg-accent/40"
              >
                <Users className="h-4 w-4" /> Customers
              </Link>
              <Link
                to="/t/$slug/pos"
                params={{ slug }}
                search={{ storeId: undefined }}
                className="inline-flex items-center gap-2 rounded-lg gradient-violet text-white px-4 py-2 text-sm"
              >
                <ScanBarcode className="h-4 w-4" /> Open POS
              </Link>
            </div>
          </div>
        </div>

        <div className={dashboardMetricGridClass}>
          {cashierCards.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={dashboardPanelClass}
            >
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">{c.label}</div>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${c.tone}`}>
                  <c.icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 font-serif text-2xl font-semibold">{c.value}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
          <div className={dashboardPanelClass}>
            <div className="text-sm font-medium">Your sales this week</div>
            <div className="text-xs text-muted-foreground">
              Last 7 days assigned to your cashier account.
            </div>
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      color: "var(--foreground)",
                    }}
                    formatter={(value: number) => formatMoney(Number(value), currency)}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="var(--primary)"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "var(--primary)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className={dashboardPanelClass}>
            <div className="text-sm font-medium">Shift summary</div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Assigned store</span>
                <span className="font-semibold text-right">{assignedStore}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Average sale</span>
                <span className="font-semibold">{formatMoney(cashierStats.avgSale, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Weekly receipts</span>
                <span className="font-semibold">{cashierStats.weekCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Linked customers</span>
                <span className="font-semibold">{cashierStats.customers}</span>
              </div>
            </div>
            <Link
              to="/t/$slug/pos"
              params={{ slug }}
              search={{ storeId: undefined }}
              className="mt-5 w-full inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground h-11 text-sm font-medium"
            >
              Start selling
            </Link>
          </div>
        </div>
      </div>
      </div>
    );
  }

  const growth =
    stats.yesterday > 0
      ? ((stats.today - stats.yesterday) / stats.yesterday) * 100
      : stats.today > 0
        ? 100
        : 0;
  const cards = [
    {
      label: "Today's revenue",
      value: formatMoney(stats.today, currency),
      helper: `${growth >= 0 ? "+" : ""}${growth.toFixed(0)}% vs yesterday`,
      icon: TrendingUp,
      tone: "text-primary bg-primary/10",
    },
    {
      label: "Receipts today",
      value: String(stats.count),
      helper: `${formatMoney(stats.avgSale, currency)} average basket`,
      icon: Receipt,
      tone: "text-primary bg-primary/10",
    },
    {
      label: "Inventory value",
      value: formatMoney(stats.inventoryValue, currency),
      helper: `${stats.products} active products`,
      icon: Boxes,
      tone: "text-emerald-600 bg-emerald-500/10",
    },
    {
      label: "Stock risk",
      value: String(stats.lowStock),
      helper: `${stats.outOfStock} out of stock`,
      icon: AlertTriangle,
      tone: "text-destructive bg-destructive/10",
    },
  ];

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_right,var(--theme-accent),transparent_30%)] p-4 md:p-8">
    <div className="w-full space-y-6">
      <div className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-card/95 p-6 md:p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:shadow-none">
        <img
          src={def?.imageUrl}
          alt={def?.label || "Business"}
          className="absolute inset-y-0 right-0 hidden h-full w-1/2 object-cover opacity-20 mix-blend-multiply dark:mix-blend-normal dark:opacity-25 lg:block"
        />
        <div className="absolute inset-y-0 right-0 w-full bg-gradient-to-l from-primary/15 via-card/90 to-card lg:w-2/3" />
        <div className="absolute -right-10 top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Owner command center ·{" "}
              {def?.label || "Retail"}
            </div>
            <h1 className="mt-4 font-serif text-4xl md:text-6xl font-bold tracking-tight">
              {business.business_name}
            </h1>
            <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-2xl">
              Live sales, stock exposure, customer growth, staff footprint, and restock pressure in
              one realistic operating view.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <span className={dashboardPillClass}>
                <Clock className="h-3.5 w-3.5 text-primary" /> {formattedCurrentTime}
              </span>
              <label className={dashboardPillClass}>
                Time
                <select
                  value={timeFormat}
                  onChange={(event) => updateTimeFormat(event.target.value as TimeFormat)}
                  className="bg-transparent text-xs font-semibold outline-none"
                  aria-label="Time format"
                >
                  <option value="12">12hr</option>
                  <option value="24">24hr</option>
                </select>
              </label>
              <span className={dashboardPillClass}>
                <Store className="h-3.5 w-3.5 text-primary" /> {stats.stores || 1} active store
                {stats.stores === 1 ? "" : "s"}
              </span>
              <span className={dashboardPillClass}>
                <Users className="h-3.5 w-3.5 text-primary" /> {stats.employees} active staff
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/t/$slug/insights"
              params={{ slug }}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background/80 px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-accent/40"
            >
              <ArrowUpRight className="h-4 w-4" /> Insights
            </Link>
            <Link
              to="/t/$slug/products"
              params={{ slug }}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background/80 px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-accent/40"
            >
              <Plus className="h-4 w-4" /> Add product
            </Link>
            <Link
              to="/t/$slug/pos"
              params={{ slug }}
              search={{ storeId: undefined }}
              className="inline-flex items-center gap-2 rounded-lg gradient-violet px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm"
            >
              <ScanBarcode className="h-4 w-4" /> Open POS
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={dashboardPanelClass}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">{c.label}</div>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${c.tone}`}>
                <c.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 truncate font-serif text-2xl font-semibold">{c.value}</div>
            <div
              className={`mt-1 text-xs ${c.label === "Stock risk" ? "text-destructive" : "text-muted-foreground"}`}
            >
              {c.helper}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className={`lg:col-span-2 ${dashboardPanelClass}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-serif text-lg font-semibold">Revenue pulse</div>
              <div className="text-xs text-muted-foreground">
                Last 7 days · {formatMoney(stats.weekTotal, currency)} across {stats.weekCount}{" "}
                receipts
              </div>
            </div>
          </div>
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--foreground)",
                  }}
                  formatter={(value: number) => formatMoney(Number(value), currency)}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="var(--primary)"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "var(--primary)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={dashboardPanelClass}>
          <div className="font-serif text-lg font-semibold">Operating posture</div>
          <div className="text-xs text-muted-foreground">
            Critical business signals from live records.
          </div>
          <div className="mt-5 space-y-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Wallet className="h-4 w-4 text-primary" /> Customers
              </span>
              <span className="font-semibold">{stats.customers}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Truck className="h-4 w-4 text-primary" /> Pending POs
              </span>
              <span className="font-semibold">{stats.pendingPOs}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <ShoppingCart className="h-4 w-4 text-primary" /> Weekly average
              </span>
              <span className="font-semibold">
                {formatMoney(stats.weekCount ? stats.weekTotal / stats.weekCount : 0, currency)}
              </span>
            </div>
          </div>
          <Link
            to="/t/$slug/suppliers"
            params={{ slug }}
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg border border-border bg-primary/5 text-sm font-medium text-primary hover:bg-primary/10"
          >
            Review procurement
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className={dashboardPanelClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Stock watchlist</div>
              <div className="text-xs text-muted-foreground">Items at or below alert level.</div>
            </div>
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="mt-4 space-y-3">
            {lowStockItems.length > 0 ? (
              lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2 text-sm"
                >
                  <span className="font-medium truncate">{item.name}</span>
                  <span className="text-xs font-semibold text-destructive">
                    {item.stock} / {item.alert}
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No low-stock products right now.
              </div>
            )}
          </div>
        </div>

        <div className={dashboardPanelClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Top movers</div>
              <div className="text-xs text-muted-foreground">
                Products with the most sales this week.
              </div>
            </div>
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-4 space-y-3">
            {topProducts.length > 0 ? (
              topProducts.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.salesCount} sales · {item.quantity} units
                    </div>
                  </div>
                  <span className="text-xs font-semibold">{formatMoney(item.total, currency)}</span>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No product movement recorded this week.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
