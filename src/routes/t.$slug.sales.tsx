import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { formatMoney } from "@/lib/format";
import { listMockEmployeesFn } from "@/lib/employee-actions";
import {
  Search,
  Calendar,
  Printer,
  X,
  Eye,
  Filter,
  RefreshCw,
  Smartphone,
  Banknote,
  CreditCard,
  Receipt,
  User,
  Loader2,
  TrendingUp,
  Wallet,
  CheckCircle2,
  BarChart3,
  SlidersHorizontal,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { generateReceiptHTML } from "@/lib/receipt-templates";
import { useBusinessRealtime } from "@/lib/use-business-realtime";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/t/$slug/sales")({ component: Sales });

type SaleItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  products?: {
    category_id: string | null;
    categories?: {
      id: string;
      name: string;
    } | null;
  } | null;
};

type Category = {
  id: string;
  name: string;
};

type EmployeeRow = {
  user_id: string | null;
  username: string | null;
  profiles?: { full_name: string | null } | null;
};

type StoreRow = {
  id: string;
  name: string;
  active: boolean | null;
};

type MockEmployeeRow = {
  user_id?: string | null;
  username?: string | null;
  profiles?: { full_name?: string | null } | null;
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
  store_id: string | null;
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [employeeMap, setEmployeeMap] = useState<Record<string, string>>({});

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [selectedStore, setSelectedStore] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedPayment, setSelectedPayment] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [dateRange, setDateRange] = useState("30");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

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
        .select(
          "*, sale_items(*, products(category_id, categories(id,name))), profiles:cashier_id(full_name)",
        )
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

      (dbEmployees as EmployeeRow[] | null)?.forEach((emp) => {
        const name = emp.profiles?.full_name || emp.username;
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
          (mockResult.employees as MockEmployeeRow[]).forEach((emp) => {
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
      loadedSales.forEach((s) => {
        let name = s.cashier_name || s.profiles?.full_name;
        if (s.payment_method?.includes("::")) {
          name = s.payment_method.split("::")[1];
        }
        if (name) names.add(name);
      });

      setEmployeeMap(empMap);
      setEmployees(Array.from(names));

      const { data: categoryData, error: categoryError } = await supabase
        .from("categories")
        .select("id,name")
        .eq("business_id", business.id)
        .order("name");

      if (categoryError) throw categoryError;
      setCategories((categoryData || []) as Category[]);

      const { data: storeData, error: storeError } = await supabase
        .from("stores")
        .select("id,name,active")
        .eq("business_id", business.id)
        .order("name");

      if (storeError) throw storeError;
      setStores((storeData || []) as StoreRow[]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [business]);

  useBusinessRealtime(business?.id, ["sales", "customers", "products", "employees", "stores"], loadData);

  const parsedSales = useMemo(() => {
    return sales.map((s) => {
      let method = s.payment_method;
      let cashierName =
        s.cashier_name ||
        s.profiles?.full_name ||
        (s.cashier_id ? employeeMap[s.cashier_id] : null) ||
        "Staff";

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
            const matchOutstanding = method.match(
              /Tendered:\s*([\d.]+),\s*Outstanding:\s*([\d.]+)/i,
            );
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
        changeDue: changeDue ?? undefined,
      };
    });
  }, [sales, employeeMap]);

  const storeNameById = useMemo(() => {
    return Object.fromEntries(stores.map((store) => [store.id, store.name]));
  }, [stores]);

  function normalizePaymentMethod(method: string) {
    const cleanMethod = method.split("::")[0].toLowerCase();
    if (cleanMethod.includes("mpesa") || cleanMethod.includes("m-pesa")) return "mpesa";
    if (cleanMethod.includes("cash")) return "cash";
    if (cleanMethod.includes("card")) return "card";
    return cleanMethod || "other";
  }

  function getDateWindow() {
    if (dateRange === "custom") {
      const start = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
      const end = toDate ? new Date(`${toDate}T23:59:59`) : null;
      return { start, end };
    }

    if (dateRange === "all") return { start: null, end: null };

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (Number(dateRange) - 1));
    return { start, end: null };
  }

  const paymentOptions = useMemo(() => {
    const methods = new Set(parsedSales.map((s) => normalizePaymentMethod(s.displayPaymentMethod)));
    return Array.from(methods).filter(Boolean).sort();
  }, [parsedSales]);

  const statusOptions = useMemo(() => {
    const statuses = new Set(parsedSales.map((s) => s.status).filter(Boolean));
    return Array.from(statuses).sort();
  }, [parsedSales]);

  // Client-side search and filtering
  const filteredSales = useMemo(() => {
    const { start, end } = getDateWindow();

    return parsedSales.filter((s) => {
      // Search matches short ID or full ID
      const shortId = s.id.substring(0, 8).toUpperCase();
      const itemText = (s.sale_items || []).map((item) => item.product_name).join(" ");
      const matchesSearch =
        searchQuery.trim() === "" ||
        s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shortId.includes(searchQuery.toUpperCase()) ||
        s.displayCashierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        itemText.toLowerCase().includes(searchQuery.toLowerCase());

      // Filter matches cashier profile full name or compound cashier name
      const matchesEmployee =
        selectedEmployee === "all" || s.displayCashierName === selectedEmployee;

      const matchesStore = selectedStore === "all" || s.store_id === selectedStore;

      const matchesCategory =
        selectedCategory === "all" ||
        (selectedCategory === "uncategorized"
          ? (s.sale_items || []).some((item) => !item.products?.category_id)
          : (s.sale_items || []).some((item) => item.products?.category_id === selectedCategory));

      const matchesPayment =
        selectedPayment === "all" ||
        normalizePaymentMethod(s.displayPaymentMethod) === selectedPayment;

      const matchesStatus = selectedStatus === "all" || s.status === selectedStatus;

      const saleDate = new Date(s.created_at);
      const matchesDate = (!start || saleDate >= start) && (!end || saleDate <= end);

      return (
        matchesSearch &&
        matchesEmployee &&
        matchesStore &&
        matchesCategory &&
        matchesPayment &&
        matchesStatus &&
        matchesDate
      );
    });
  }, [
    parsedSales,
    searchQuery,
    selectedEmployee,
    selectedStore,
    selectedCategory,
    selectedPayment,
    selectedStatus,
    dateRange,
    fromDate,
    toDate,
  ]);

  const dashboardStats = useMemo(() => {
    const total = filteredSales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
    const tax = filteredSales.reduce((sum, sale) => sum + Number(sale.tax_amount || 0), 0);
    const average = filteredSales.length ? total / filteredSales.length : 0;
    const cashierTotals = filteredSales.reduce<Record<string, number>>((acc, sale) => {
      acc[sale.displayCashierName] =
        (acc[sale.displayCashierName] || 0) + Number(sale.total_amount || 0);
      return acc;
    }, {});
    const topCashier = Object.entries(cashierTotals).sort((a, b) => b[1] - a[1])[0];

    return { total, tax, average, count: filteredSales.length, topCashier };
  }, [filteredSales]);

  const dailySales = useMemo(() => {
    const totals = filteredSales.reduce<
      Record<string, { day: string; sales: number; transactions: number }>
    >((acc, sale) => {
      const day = new Date(sale.created_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      if (!acc[day]) acc[day] = { day, sales: 0, transactions: 0 };
      acc[day].sales += Number(sale.total_amount || 0);
      acc[day].transactions += 1;
      return acc;
    }, {});

    return Object.values(totals).slice(-10);
  }, [filteredSales]);

  const paymentBreakdown = useMemo(() => {
    const totals = filteredSales.reduce<
      Record<string, { method: string; total: number; count: number }>
    >((acc, sale) => {
      const method = normalizePaymentMethod(sale.displayPaymentMethod);
      const label =
        method === "mpesa" ? "M-Pesa" : method.charAt(0).toUpperCase() + method.slice(1);
      if (!acc[method]) acc[method] = { method: label, total: 0, count: 0 };
      acc[method].total += Number(sale.total_amount || 0);
      acc[method].count += 1;
      return acc;
    }, {});

    return Object.values(totals).sort((a, b) => b.total - a.total);
  }, [filteredSales]);

  function resetFilters() {
    setSearchQuery("");
    setSelectedEmployee("all");
    setSelectedStore("all");
    setSelectedCategory("all");
    setSelectedPayment("all");
    setSelectedStatus("all");
    setDateRange("30");
    setFromDate("");
    setToDate("");
  }

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

  function printReceipt(sale: MappedSale) {
    if (!business) return;

    const printWindow = window.open("", "_blank", "width=600,height=600");
    if (!printWindow) {
      toast.error("Popup blocker prevented printing. Please allow popups for this site.");
      return;
    }

    const htmlContent = generateReceiptHTML(sale, business, business.receipt_type || undefined);

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }

  return (
    <div className="w-full p-4 md:p-8 space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-card p-6 md:p-8 shadow-sm">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary/20 via-accent/10 to-transparent" />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <BarChart3 className="h-3.5 w-3.5" /> Sales command center
            </div>
            <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">Sales Dashboard</h1>
            <p className="mt-2 text-sm md:text-base text-muted-foreground">
              Monitor revenue, transaction flow, payment mix, and receipt activity from one
              professional workspace.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={loadData}
            disabled={loading}
            className="cursor-pointer gap-2 h-11 shrink-0 bg-background/80 backdrop-blur"
          >
            <RefreshCw className={`h-4 w-4 ${loading && "animate-spin"}`} />
            Refresh data
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: "Revenue",
            value: formatMoney(dashboardStats.total, currency),
            helper: `${dashboardStats.count} transactions`,
            icon: TrendingUp,
            tone: "from-primary/25 to-primary/5",
          },
          {
            label: "Average sale",
            value: formatMoney(dashboardStats.average, currency),
            helper: "Per transaction",
            icon: Wallet,
            tone: "from-emerald-500/25 to-emerald-500/5",
          },
          {
            label: "Tax collected",
            value: formatMoney(dashboardStats.tax, currency),
            helper: "Based on filtered sales",
            icon: CheckCircle2,
            tone: "from-blue-500/25 to-blue-500/5",
          },
          {
            label: "Top cashier",
            value: dashboardStats.topCashier?.[0] || "No data",
            helper: dashboardStats.topCashier
              ? formatMoney(dashboardStats.topCashier[1], currency)
              : "Adjust filters",
            icon: User,
            tone: "from-amber-500/25 to-amber-500/5",
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border border-border/50 bg-gradient-to-br ${card.tone} p-5 shadow-sm`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">{card.label}</div>
              <div className="h-10 w-10 rounded-xl bg-background/70 border border-border/50 flex items-center justify-center">
                <card.icon className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="mt-4 text-2xl font-bold truncate">{card.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{card.helper}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/50 bg-card p-4 md:p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">Filters</h2>
            <p className="text-xs text-muted-foreground">
              Refine the dashboard and transaction list instantly.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-8 gap-3">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-11 bg-background"
              placeholder="Search receipt, cashier, or product"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <select
              className="h-11 w-full pl-9 pr-8 rounded-md border border-border bg-background text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="1">Today</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="all">All time</option>
              <option value="custom">Custom dates</option>
            </select>
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <select
              className="h-11 w-full pl-9 pr-8 rounded-md border border-border bg-background text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
            >
              <option value="all">All cashiers</option>
              {employees.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <select
              className="h-11 w-full pl-9 pr-8 rounded-md border border-border bg-background text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
            >
              <option value="all">All stores</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                  {store.active === false ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </div>

          <select
            className="h-11 w-full px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All categories</option>
            <option value="uncategorized">Uncategorized</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <select
            className="h-11 w-full px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            value={selectedPayment}
            onChange={(e) => setSelectedPayment(e.target.value)}
          >
            <option value="all">All payments</option>
            {paymentOptions.map((method) => (
              <option key={method} value={method}>
                {method === "mpesa" ? "M-Pesa" : method.charAt(0).toUpperCase() + method.slice(1)}
              </option>
            ))}
          </select>

          <select
            className="h-11 w-full px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        {dateRange === "custom" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 max-w-xl">
            <Input
              type="date"
              className="h-11 bg-background"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <Input
              type="date"
              className="h-11 bg-background"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-xs text-muted-foreground">
          <span>
            Showing {filteredSales.length} of {parsedSales.length} loaded receipts
          </span>
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 cursor-pointer">
            Reset filters
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="h-72 flex flex-col items-center justify-center text-muted-foreground gap-2 rounded-2xl border border-border/50 bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span>Loading sales records...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-semibold">Sales trend</h2>
                  <p className="text-xs text-muted-foreground">
                    Daily revenue from the current filters.
                  </p>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={dailySales}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="day"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(value: number) => formatMoney(Number(value), currency)}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="sales"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      fill="url(#salesGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
              <h2 className="font-semibold">Payment mix</h2>
              <p className="text-xs text-muted-foreground">Revenue grouped by payment method.</p>
              <div className="h-48 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={paymentBreakdown}
                    layout="vertical"
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="method"
                      type="category"
                      width={64}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(value: number) => formatMoney(Number(value), currency)}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 12,
                      }}
                    />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-3">
                {paymentBreakdown.map((method) => (
                  <div
                    key={method.method}
                    className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      {getPaymentIcon(method.method)}
                      <span>{method.method}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        {formatMoney(method.total, currency)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {method.count} receipts
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {filteredSales.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center max-w-xl mx-auto border border-border/40">
              <Receipt className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No sales found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Try adjusting your search, date range, store, payment, status, or cashier filters.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden border border-border/50 bg-card shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-5 border-b border-border/50">
                <div>
                  <h2 className="font-semibold">Transactions</h2>
                  <p className="text-xs text-muted-foreground">
                    Open any receipt for details or quick printing.
                  </p>
                </div>
                <span className="text-xs rounded-full bg-primary/10 text-primary px-3 py-1 font-semibold">
                  {filteredSales.length} receipts
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border bg-muted/20">
                    <tr>
                      <th className="p-4 font-semibold">Receipt</th>
                      <th className="p-4 font-semibold">Date & Time</th>
                      <th className="p-4 font-semibold">Cashier</th>
                      <th className="p-4 font-semibold">Store</th>
                      <th className="p-4 font-semibold">Payment</th>
                      <th className="p-4 font-semibold">Status</th>
                      <th className="p-4 font-semibold text-right">Total</th>
                      <th className="p-4 font-semibold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((s) => {
                      const receiptNo = s.id.substring(0, 8).toUpperCase();
                      return (
                        <tr
                          key={s.id}
                          onClick={() => setSelectedSale(s)}
                          className="border-b border-border/30 last:border-0 hover:bg-muted/25 cursor-pointer transition-colors"
                        >
                          <td className="p-4">
                            <div className="font-mono font-bold text-foreground">#{receiptNo}</div>
                            <div className="text-xs text-muted-foreground">
                              {s.sale_items?.length || 0} items
                            </div>
                          </td>
                          <td className="p-4 text-muted-foreground whitespace-nowrap">
                            {new Date(s.created_at).toLocaleString()}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="font-medium text-foreground">
                                {s.displayCashierName}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Store className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span>{s.store_id ? storeNameById[s.store_id] || "Unknown store" : "No store"}</span>
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
                          <td className="p-4 text-right font-bold text-foreground whitespace-nowrap">
                            {formatMoney(s.total_amount, currency)}
                          </td>
                          <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
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
        </>
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
                  <img
                    src={business.logo_url}
                    alt="Logo"
                    className="max-w-[70px] h-auto mx-auto mb-2 filter grayscale"
                  />
                )}
                <h3 className="text-center font-bold text-sm uppercase tracking-wider">
                  {business?.business_name || "ZPos Retail"}
                </h3>
                {business?.description && (
                  <p className="text-center text-[10px] text-slate-500 leading-tight mb-2">
                    {business.description}
                  </p>
                )}

                <div className="border-t border-dashed border-slate-300 my-2"></div>

                {(() => {
                  const previewPaymentLower = selectedSale.displayPaymentMethod.toLowerCase();
                  const previewMpesaMatch = previewPaymentLower.match(/ref:\s*([a-z0-9]+)/i);
                  const previewMpesaRef = previewMpesaMatch
                    ? previewMpesaMatch[1].toUpperCase()
                    : null;
                  const previewIsCard = previewPaymentLower.includes("card");
                  return (
                    <>
                      <div className="space-y-0.5">
                        <div>
                          <b>Receipt:</b> #{selectedSale.id.substring(0, 8).toUpperCase()}
                        </div>
                        <div>
                          <b>Date:</b> {new Date(selectedSale.created_at).toLocaleString()}
                        </div>
                        <div>
                          <b>Cashier:</b> {selectedSale.displayCashierName}
                        </div>
                        <div>
                          <b>Store:</b>{" "}
                          {selectedSale.store_id
                            ? storeNameById[selectedSale.store_id] || "Unknown store"
                            : "No store"}
                        </div>
                        <div>
                          <b>Payment:</b>{" "}
                          {previewIsCard
                            ? "CARD (DETAILS N/A)"
                            : selectedSale.displayPaymentMethod.toUpperCase()}
                        </div>
                        {previewMpesaRef && (
                          <div>
                            <b>M-Pesa Ref:</b> {previewMpesaRef}
                          </div>
                        )}
                      </div>

                      <div className="border-t border-dashed border-slate-300 my-2"></div>

                      <div className="space-y-1.5">
                        <div className="font-bold border-b border-slate-200 pb-0.5">ITEMS</div>
                        {selectedSale.sale_items && selectedSale.sale_items.length > 0 ? (
                          selectedSale.sale_items.map((item, idx) => (
                            <div key={item.id || idx}>
                              <div className="flex justify-between">
                                <span>
                                  {item.quantity}x {item.product_name}
                                </span>
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
                          <span>
                            Tax ($
                            {(
                              (selectedSale.tax_amount && selectedSale.subtotal
                                ? selectedSale.tax_amount / selectedSale.subtotal
                                : taxRate) * 100
                            ).toFixed(0)}
                            %)
                          </span>
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
                                <span>
                                  {formatMoney(Math.abs(selectedSale.changeDue || 0), currency)}
                                </span>
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
                  Thank you for shopping with us!
                  <br />
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
