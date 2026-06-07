import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Award,
  Banknote,
  Bot,
  Clock,
  Download,
  Gauge,
  MapPin,
  Percent,
  Plus,
  Receipt,
  ShoppingBasket,
  Store,
  TrendingUp,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useBusinessRealtime } from "@/lib/use-business-realtime";

export const Route = createFileRoute("/t/$slug/insights")({ component: InsightsDashboard });

type SaleItem = {
  sale_id: string | null;
  quantity: number | null;
  unit_price: number | null;
  subtotal: number | null;
  product_id: string | null;
  product_name: string | null;
};

type Sale = {
  id: string;
  total_amount: number | null;
  subtotal: number | null;
  tax_amount: number | null;
  discount_amount: number | null;
  status: string | null;
  created_at: string | null;
  store_id: string | null;
  customer_id: string | null;
  cashier_id: string | null;
  cashier_name: string | null;
  payment_method: string | null;
  sale_items?: SaleItem[];
};

type Product = {
  id: string;
  name: string;
  price: number | null;
  cost_price: number | null;
  stock_quantity: number | null;
  low_stock_alert: number | null;
  active: boolean | null;
};

type PurchaseOrder = {
  id: string;
};

type PurchaseOrderItem = {
  product_id: string | null;
  quantity: number | null;
  unit_cost: number | null;
};

type StoreOption = {
  id: string;
  name: string;
  location: string | null;
  location_city: string | null;
  location_county: string | null;
  active: boolean | null;
};

type Customer = {
  id: string;
  full_name: string | null;
  loyalty_points: number | null;
  credit_balance: number | null;
  created_at: string | null;
};

type Employee = {
  id: string;
  user_id: string | null;
  username: string | null;
  email: string | null;
  role: string | null;
  active: boolean | null;
  store_id: string | null;
  profiles: {
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
  } | null;
};

type BusinessGoal = {
  id: string;
  label: string;
  metric: string;
  target_amount: number;
  period: string;
  created_at: string | null;
};

type MarketInsight = {
  id: string;
  title: string;
  category: string;
  notes: string | null;
  impact_level: string;
  created_at: string | null;
};

type StoreMetric = {
  id: string;
  name: string;
  sales: number;
  profit: number;
  customers: number;
  transactions: number;
  growth: number;
};

type ProductMetric = {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
  profit: number;
  stock: number;
  lowStockAlert: number;
};

type EmployeeMetric = {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: string | null;
  storeId: string | null;
  phone: string | null;
  email: string | null;
  sales: number;
  transactions: number;
  averageSale: number;
  refunds: number;
  discounts: number;
};

type HeatmapRow = { day: string; hours: number[]; counts: number[] };

const timeLabels = ["8am", "10am", "12pm", "2pm", "4pm", "6pm", "8pm"];
const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type InsightTab =
  | "overview"
  | "sales"
  | "stores"
  | "inventory"
  | "customers"
  | "team"
  | "finance"
  | "forecasts";

const insightTabs: { key: InsightTab; label: string; icon: typeof Gauge }[] = [
  { key: "overview", label: "Overview", icon: Gauge },
  { key: "sales", label: "Sales", icon: TrendingUp },
  { key: "stores", label: "Stores", icon: Store },
  { key: "inventory", label: "Inventory", icon: ShoppingBasket },
  { key: "customers", label: "Customers", icon: Users },
  { key: "team", label: "Team", icon: Award },
  { key: "finance", label: "Finance", icon: Banknote },
  { key: "forecasts", label: "Forecasts", icon: Bot },
];

function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeek(date = new Date()) {
  const next = startOfDay(date);
  next.setDate(next.getDate() - ((next.getDay() + 6) % 7));
  return next;
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function asNumber(value: number | null | undefined) {
  return Number(value || 0);
}

function saleRevenue(sale: Sale) {
  return asNumber(sale.total_amount);
}

function saleProfit(sale: Sale, productCostById: Map<string, number>) {
  const taxProfit = asNumber(sale.tax_amount);
  if (taxProfit > 0) return taxProfit;
  return saleRevenue(sale) - saleCost(sale, productCostById);
}

function saleCostOfGoods(sale: Sale, productCostById: Map<string, number>) {
  const taxProfit = asNumber(sale.tax_amount);
  if (taxProfit > 0) return Math.max(0, saleRevenue(sale) - taxProfit);
  return saleCost(sale, productCostById);
}

function saleItemSellingPrice(sale: Sale, item: SaleItem) {
  const quantity = asNumber(item.quantity);
  const itemSubtotal = asNumber(item.subtotal) || asNumber(item.unit_price) * quantity;
  const saleSubtotal = asNumber(sale.subtotal);
  const saleTotal = saleRevenue(sale);

  if (saleSubtotal > 0 && saleTotal > 0 && saleTotal !== saleSubtotal) {
    return itemSubtotal * (saleTotal / saleSubtotal);
  }

  return itemSubtotal;
}

function isCompletedSale(sale: Sale) {
  const status = String(sale.status || "completed").toLowerCase();
  return !["cancelled", "canceled", "refunded", "returned", "void"].includes(status);
}

function isRefundedSale(sale: Sale) {
  return ["refunded", "returned", "void"].includes(String(sale.status || "").toLowerCase());
}

function isUuidLike(value: string | null | undefined) {
  return Boolean(
    value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
  );
}

function readableName(...values: (string | null | undefined)[]) {
  return values.find((value) => value && !isUuidLike(value)) || null;
}

function saleCost(sale: Sale, productCostById: Map<string, number>) {
  return (sale.sale_items || []).reduce((sum, item) => {
    const quantity = asNumber(item.quantity);
    const cost = item.product_id ? productCostById.get(item.product_id) || 0 : 0;
    return sum + cost * quantity;
  }, 0);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value)}%`;
}

function formatSignedPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${value >= 0 ? "+" : ""}${Math.round(value)}%`;
}

function formatDays(days: number) {
  if (!Number.isFinite(days)) return "N/A";
  if (days < 0.1) return "today";
  return `${days.toFixed(1)} days`;
}

function calculateHeatmap(sales: Sale[]): HeatmapRow[] {
  const counts = dayLabels.map(() => timeLabels.map(() => 0));
  let maxCount = 0;

  sales.forEach((sale) => {
    if (!sale.created_at) return;
    const date = new Date(sale.created_at);
    const dayIndex = (date.getDay() + 6) % 7;
    const bucketIndex = Math.floor((date.getHours() - 8) / 2);
    if (bucketIndex < 0 || bucketIndex >= timeLabels.length) return;
    counts[dayIndex][bucketIndex] += 1;
    maxCount = Math.max(maxCount, counts[dayIndex][bucketIndex]);
  });

  return dayLabels.map((day, index) => ({
    day,
    counts: counts[index],
    hours: counts[index].map((count) => (maxCount > 0 ? Math.round((count / maxCount) * 100) : 0)),
  }));
}

function getTrend(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof TrendingUp;
  tone?: "primary" | "emerald" | "amber" | "rose" | "sky";
}) {
  const tones = {
    primary: "from-primary to-accent",
    emerald: "from-emerald-500 to-teal-500",
    amber: "from-amber-500 to-orange-500",
    rose: "from-rose-500 to-red-500",
    sky: "from-sky-500 to-blue-500",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${tones[tone]}`}
        >
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
    </motion.div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5"
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </motion.section>
  );
}

function InsightsDashboard() {
  const { business } = useTenant();
  const [loading, setLoading] = useState(true);
  const [selectedStoreId, setSelectedStoreId] = useState("all");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [realtimeTick, setRealtimeTick] = useState(0);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierCostByProduct, setSupplierCostByProduct] = useState<Record<string, number>>({});
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [goals, setGoals] = useState<BusinessGoal[]>([]);
  const [marketInsights, setMarketInsights] = useState<MarketInsight[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<InsightTab>("overview");
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [goalForm, setGoalForm] = useState({
    label: "Monthly Sales Goal",
    metric: "sales",
    target_amount: "5000000",
    period: "monthly",
  });
  const [marketForm, setMarketForm] = useState({
    title: "",
    category: "competitor_pricing",
    impact_level: "medium",
    notes: "",
  });

  useEffect(() => {
    async function loadInsights() {
      if (!business) return;
      setLoading(true);

      try {
        const salesQuery = supabase
          .from("sales")
          .select(
            "id,total_amount,subtotal,tax_amount,discount_amount,status,created_at,store_id,customer_id,cashier_id,cashier_name,payment_method",
          )
          .eq("business_id", business.id)
          .order("created_at", { ascending: false })
          .limit(2500);

        const [
          salesResult,
          productsResult,
          storesResult,
          customersResult,
          employeesResult,
          goalsResult,
          marketResult,
        ] = await Promise.all([
          salesQuery,
          supabase
            .from("products")
            .select("id,name,price,cost_price,stock_quantity,low_stock_alert,active")
            .eq("business_id", business.id)
            .order("name"),
          supabase
            .from("stores")
            .select("id,name,location,location_city,location_county,active")
            .eq("business_id", business.id)
            .order("name"),
          supabase
            .from("customers")
            .select("id,full_name,loyalty_points,credit_balance,created_at")
            .eq("business_id", business.id)
            .order("created_at", { ascending: false })
            .limit(1000),
          supabase
            .from("employees")
            .select(
              "id,user_id,username,email,role,active,store_id,profiles(full_name,phone,avatar_url)",
            )
            .eq("business_id", business.id)
            .order("username"),
          supabase
            .from("business_insight_goals")
            .select("id,label,metric,target_amount,period,created_at")
            .eq("business_id", business.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("market_insights")
            .select("id,title,category,notes,impact_level,created_at")
            .eq("business_id", business.id)
            .order("created_at", { ascending: false })
            .limit(8),
        ]);

        if (salesResult.error) throw salesResult.error;
        if (productsResult.error) throw productsResult.error;
        if (storesResult.error) throw storesResult.error;
        if (customersResult.error) throw customersResult.error;
        if (employeesResult.error) throw employeesResult.error;
        if (goalsResult.error) {
          console.warn("Business insight goals unavailable:", goalsResult.error.message);
        }
        if (marketResult.error) {
          console.warn("Market insights unavailable:", marketResult.error.message);
        }

        const loadedSales = (salesResult.data || []) as Sale[];
        const saleIds = loadedSales.map((sale) => sale.id);
        let salesWithItems = loadedSales;

        if (saleIds.length > 0) {
          const { data: saleItemsData, error: saleItemsError } = await supabase
            .from("sale_items")
            .select("sale_id,quantity,unit_price,subtotal,product_id,product_name")
            .in("sale_id", saleIds);
          if (saleItemsError) throw saleItemsError;

          const itemsBySaleId = new Map<string, SaleItem[]>();
          ((saleItemsData || []) as SaleItem[]).forEach((item) => {
            if (!item.sale_id) return;
            const items = itemsBySaleId.get(item.sale_id) || [];
            items.push(item);
            itemsBySaleId.set(item.sale_id, items);
          });

          salesWithItems = loadedSales.map((sale) => ({
            ...sale,
            sale_items: itemsBySaleId.get(sale.id) || [],
          }));
        }

        const supplierCosts: Record<string, number> = {};
        const { data: purchaseOrdersData, error: purchaseOrdersError } = await supabase
          .from("purchase_orders")
          .select("id")
          .eq("business_id", business.id)
          .limit(1000);

        if (purchaseOrdersError) {
          console.warn("Supplier purchase costs unavailable:", purchaseOrdersError.message);
        } else {
          const purchaseOrderIds = ((purchaseOrdersData || []) as PurchaseOrder[]).map(
            (order) => order.id,
          );

          if (purchaseOrderIds.length > 0) {
            const { data: purchaseItemsData, error: purchaseItemsError } = await supabase
              .from("purchase_order_items")
              .select("product_id,quantity,unit_cost")
              .in("po_id", purchaseOrderIds);

            if (purchaseItemsError) {
              console.warn("Supplier purchase item costs unavailable:", purchaseItemsError.message);
            } else {
              const costTotals = new Map<string, { totalCost: number; quantity: number }>();
              ((purchaseItemsData || []) as PurchaseOrderItem[]).forEach((item) => {
                if (!item.product_id) return;
                const quantity = Math.max(1, asNumber(item.quantity));
                const unitCost = asNumber(item.unit_cost);
                if (unitCost <= 0) return;
                const current = costTotals.get(item.product_id) || { totalCost: 0, quantity: 0 };
                current.totalCost += unitCost * quantity;
                current.quantity += quantity;
                costTotals.set(item.product_id, current);
              });

              costTotals.forEach((value, productId) => {
                if (value.quantity > 0) supplierCosts[productId] = value.totalCost / value.quantity;
              });
            }
          }
        }

        setSales(salesWithItems);
        setProducts((productsResult.data || []) as Product[]);
        setSupplierCostByProduct(supplierCosts);
        setStores((storesResult.data || []) as StoreOption[]);
        setCustomers((customersResult.data || []) as Customer[]);
        setEmployees((employeesResult.data || []) as Employee[]);
        setGoals((goalsResult.error ? [] : goalsResult.data || []) as BusinessGoal[]);
        setMarketInsights((marketResult.error ? [] : marketResult.data || []) as MarketInsight[]);
        setLastUpdated(new Date());
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to load business insights");
      } finally {
        setLoading(false);
      }
    }

    loadInsights();
  }, [business, selectedStoreId, realtimeTick]);

  useBusinessRealtime(
    business?.id,
    [
      "sales",
      "products",
      "stores",
      "customers",
      "employees",
      "business_insight_goals",
      "market_insights",
    ],
    () => {
      setRealtimeTick((tick) => tick + 1);
    },
  );

  if (!business) return null;

  const currency = business.currency || "KES";
  const scopedSales =
    selectedStoreId === "all" ? sales : sales.filter((sale) => sale.store_id === selectedStoreId);
  const businessCompletedSales = sales.filter(isCompletedSale);
  const completedSales = scopedSales.filter(isCompletedSale);
  const refundedSales = scopedSales.filter(isRefundedSale);
  const businessRefundedSales = sales.filter(isRefundedSale);
  const productCostById = new Map(
    products.map((product) => [
      product.id,
      supplierCostByProduct[product.id] ?? asNumber(product.cost_price),
    ]),
  );
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const thisMonthSales = completedSales.filter(
    (sale) => sale.created_at && new Date(sale.created_at) >= monthStart,
  );
  const previousMonthSales = completedSales.filter(
    (sale) =>
      sale.created_at &&
      new Date(sale.created_at) >= previousMonthStart &&
      new Date(sale.created_at) <= previousMonthEnd,
  );
  const todaySales = completedSales.filter(
    (sale) => sale.created_at && new Date(sale.created_at) >= todayStart,
  );
  const weekSales = completedSales.filter(
    (sale) => sale.created_at && new Date(sale.created_at) >= weekStart,
  );
  const revenue = completedSales.reduce((sum, sale) => sum + saleRevenue(sale), 0);
  const costOfGoods = completedSales.reduce(
    (sum, sale) => sum + saleCostOfGoods(sale, productCostById),
    0,
  );
  const grossProfit = completedSales.reduce(
    (sum, sale) => sum + saleProfit(sale, productCostById),
    0,
  );
  const netProfit = grossProfit;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const inventoryValue = products.reduce(
    (sum, product) => sum + asNumber(product.stock_quantity) * asNumber(product.cost_price),
    0,
  );
  const transactionCount = completedSales.length;
  const averageOrderValue = transactionCount > 0 ? revenue / transactionCount : 0;
  const uniqueCustomers = new Set(completedSales.map((sale) => sale.customer_id).filter(Boolean))
    .size;
  const repeatCustomerIds = new Set<string>();
  const customerSaleCounts = new Map<string, number>();
  completedSales.forEach((sale) => {
    if (!sale.customer_id) return;
    const count = (customerSaleCounts.get(sale.customer_id) || 0) + 1;
    customerSaleCounts.set(sale.customer_id, count);
    if (count > 1) repeatCustomerIds.add(sale.customer_id);
  });
  const repeatRevenue = completedSales
    .filter((sale) => sale.customer_id && repeatCustomerIds.has(sale.customer_id))
    .reduce((sum, sale) => sum + saleRevenue(sale), 0);
  const newCustomers = customers.filter(
    (customer) => customer.created_at && new Date(customer.created_at) >= monthStart,
  ).length;
  const outstandingDebt = customers.reduce(
    (sum, customer) => sum + Math.max(0, asNumber(customer.credit_balance)),
    0,
  );

  const storeMetrics: StoreMetric[] = stores
    .map((store) => {
      const storeSales = completedSales.filter((sale) => sale.store_id === store.id);
      const previousStoreSales = previousMonthSales.filter((sale) => sale.store_id === store.id);
      const salesTotal = storeSales.reduce((sum, sale) => sum + saleRevenue(sale), 0);
      const previousTotal = previousStoreSales.reduce((sum, sale) => sum + saleRevenue(sale), 0);
      return {
        id: store.id,
        name: store.name,
        sales: salesTotal,
        profit: storeSales.reduce((sum, sale) => sum + saleProfit(sale, productCostById), 0),
        customers: new Set(storeSales.map((sale) => sale.customer_id).filter(Boolean)).size,
        transactions: storeSales.length,
        growth: getTrend(salesTotal, previousTotal),
      };
    })
    .sort((a, b) => b.sales - a.sales);

  const productMetricsMap = new Map<string, ProductMetric>();
  products.forEach((product) =>
    productMetricsMap.set(product.id, {
      id: product.id,
      name: product.name,
      quantity: 0,
      revenue: 0,
      profit: 0,
      stock: asNumber(product.stock_quantity),
      lowStockAlert: asNumber(product.low_stock_alert) || 5,
    }),
  );
  completedSales.forEach((sale) => {
    (sale.sale_items || []).forEach((item) => {
      const id = item.product_id || item.product_name || "unknown";
      const existing = productMetricsMap.get(id) || {
        id,
        name: item.product_name || "Unknown product",
        quantity: 0,
        revenue: 0,
        profit: 0,
        stock: 0,
        lowStockAlert: 5,
      };
      const quantity = asNumber(item.quantity);
      const itemSubtotal = asNumber(item.subtotal) || asNumber(item.unit_price) * quantity;
      const itemRevenue = saleItemSellingPrice(sale, item);
      const cost = item.product_id ? productCostById.get(item.product_id) || 0 : 0;
      const saleSubtotal = asNumber(sale.subtotal);
      const taxProfit = asNumber(sale.tax_amount);
      const itemProfit =
        taxProfit > 0 && saleSubtotal > 0
          ? itemSubtotal * (taxProfit / saleSubtotal)
          : itemRevenue - cost * quantity;
      existing.quantity += quantity;
      existing.revenue += itemRevenue;
      existing.profit += itemProfit;
      productMetricsMap.set(id, existing);
    });
  });
  const productMetrics = [...productMetricsMap.values()];
  const topProducts = productMetrics
    .filter((product) => product.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
  const profitableProducts = productMetrics
    .filter((product) => product.profit > 0)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);
  const slowMovingProducts = productMetrics
    .filter((product) => product.stock > 0 && product.quantity <= 1)
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 5);
  const deadStock = productMetrics
    .filter((product) => product.stock > 0 && product.quantity === 0)
    .slice(0, 5);
  const lowStockItems = productMetrics
    .filter((product) => product.stock <= product.lowStockAlert)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 6);

  const employeeMatchesSale = (employee: Employee, sale: Sale) => {
    const employeeIds = [employee.user_id, employee.id].filter(Boolean);
    if (sale.cashier_id && employeeIds.includes(sale.cashier_id)) return true;

    const employeeNames = [
      employee.profiles?.full_name,
      employee.username,
      employee.email,
      employee.user_id,
      employee.id,
    ]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase());
    const cashierName = String(sale.cashier_name || "")
      .trim()
      .toLowerCase();
    const paymentCashierName =
      String(sale.payment_method || "")
        .split("::")
        .pop()
        ?.trim()
        .toLowerCase() || "";

    return employeeNames.includes(cashierName) || employeeNames.includes(paymentCashierName);
  };

  const findEmployeeForSale = (sale: Sale) =>
    employees.find((employee) => employeeMatchesSale(employee, sale));

  const cashierNameFromSale = (sale: Sale) => {
    const paymentCashierName =
      String(sale.payment_method || "")
        .split("::")
        .pop()
        ?.trim() || null;
    return readableName(sale.cashier_name, paymentCashierName, sale.cashier_id) || "Cashier";
  };

  const employeeMetrics: EmployeeMetric[] = employees
    .map((employee) => {
      const employeeSales = businessCompletedSales.filter((sale) =>
        employeeMatchesSale(employee, sale),
      );
      const salesTotal = employeeSales.reduce((sum, sale) => sum + saleRevenue(sale), 0);
      return {
        id: employee.id,
        name:
          readableName(employee.profiles?.full_name, employee.username, employee.email) ||
          "Unnamed employee",
        avatarUrl: employee.profiles?.avatar_url || null,
        role: employee.role,
        storeId: employee.store_id,
        phone: employee.profiles?.phone || null,
        email: employee.email,
        sales: salesTotal,
        transactions: employeeSales.length,
        averageSale: employeeSales.length > 0 ? salesTotal / employeeSales.length : 0,
        refunds: businessRefundedSales.filter((sale) => employeeMatchesSale(employee, sale)).length,
        discounts: employeeSales.reduce((sum, sale) => sum + asNumber(sale.discount_amount), 0),
      };
    })
    .sort((a, b) => b.sales - a.sales);

  const cashierMetricMap = new Map<string, EmployeeMetric>();
  businessCompletedSales.forEach((sale) => {
    const matchedEmployee = findEmployeeForSale(sale);
    const key =
      matchedEmployee?.id || sale.cashier_id || sale.cashier_name || sale.payment_method || sale.id;
    const existing = cashierMetricMap.get(key) || {
      id: matchedEmployee?.id || `cashier:${key}`,
      name:
        (matchedEmployee &&
          readableName(
            matchedEmployee.profiles?.full_name,
            matchedEmployee.username,
            matchedEmployee.email,
          )) ||
        cashierNameFromSale(sale),
      avatarUrl: matchedEmployee?.profiles?.avatar_url || null,
      role: matchedEmployee?.role || "cashier",
      storeId: matchedEmployee?.store_id || sale.store_id,
      phone: matchedEmployee?.profiles?.phone || null,
      email: matchedEmployee?.email || null,
      sales: 0,
      transactions: 0,
      averageSale: 0,
      refunds: 0,
      discounts: 0,
    };

    existing.sales += saleRevenue(sale);
    existing.transactions += 1;
    existing.discounts += asNumber(sale.discount_amount);
    existing.averageSale = existing.transactions > 0 ? existing.sales / existing.transactions : 0;
    cashierMetricMap.set(key, existing);
  });
  businessRefundedSales.forEach((sale) => {
    const matchedEmployee = findEmployeeForSale(sale);
    const key =
      matchedEmployee?.id || sale.cashier_id || sale.cashier_name || sale.payment_method || sale.id;
    const existing = cashierMetricMap.get(key);
    if (existing) existing.refunds += 1;
  });
  const cashierMetrics = [...cashierMetricMap.values()].sort((a, b) => b.sales - a.sales);

  const hourlySales = timeLabels.map((label, index) => {
    const startHour = 8 + index * 2;
    return {
      label,
      value: completedSales
        .filter(
          (sale) =>
            sale.created_at &&
            new Date(sale.created_at).getHours() >= startHour &&
            new Date(sale.created_at).getHours() < startHour + 2,
        )
        .reduce((sum, sale) => sum + saleRevenue(sale), 0),
    };
  });
  const dailySales = dayLabels.map((day, index) => ({
    day,
    value: completedSales
      .filter((sale) => sale.created_at && (new Date(sale.created_at).getDay() + 6) % 7 === index)
      .reduce((sum, sale) => sum + saleRevenue(sale), 0),
  }));
  const heatmapData = calculateHeatmap(completedSales);
  const bestDay = dailySales.sort((a, b) => b.value - a.value)[0];
  const busiestHour = hourlySales.sort((a, b) => b.value - a.value)[0];
  const paymentTotals = completedSales.reduce<Record<string, number>>((totals, sale) => {
    const key = (sale.payment_method || "Unknown").toLowerCase();
    totals[key] = (totals[key] || 0) + saleRevenue(sale);
    return totals;
  }, {});
  const bestStore = storeMetrics[0];
  const worstStore = storeMetrics[storeMetrics.length - 1];
  const fastestGrowingStore = [...storeMetrics].sort((a, b) => b.growth - a.growth)[0];
  const topProduct = topProducts[0];
  const topEmployee = cashierMetrics[0] || employeeMetrics[0];
  const selectedEmployee = [...cashierMetrics, ...employeeMetrics].find(
    (employee) => employee.id === selectedEmployeeId,
  );
  const selectedEmployeeStore = selectedEmployee?.storeId
    ? stores.find((store) => store.id === selectedEmployee.storeId)
    : null;
  const salesForecast = thisMonthSales.reduce((sum, sale) => sum + saleRevenue(sale), 0) * 1.18;
  const aiInsights = [
    `Sales are ${formatSignedPercent(
      getTrend(
        thisMonthSales.reduce((sum, sale) => sum + saleRevenue(sale), 0),
        previousMonthSales.reduce((sum, sale) => sum + saleRevenue(sale), 0),
      ),
    )} versus last month.`,
    lowStockItems[0]
      ? `${lowStockItems[0].name} may run out soon with ${lowStockItems[0].stock} units left.`
      : "No urgent stockout risk detected from current stock levels.",
    fastestGrowingStore
      ? `${fastestGrowingStore.name} has the highest growth rate at ${formatSignedPercent(fastestGrowingStore.growth)}.`
      : "Add branches to unlock multi-store growth insights.",
    cashierMetrics.find((employee) => employee.refunds > 2)
      ? `${cashierMetrics.find((employee) => employee.refunds > 2)?.name} has unusually high refund activity.`
      : "No unusual cashier refund activity detected.",
  ];
  const summarySections = [
    {
      title: "Executive Summary",
      points: [
        `Today revenue is ${formatMoney(
          todaySales.reduce((sum, sale) => sum + saleRevenue(sale), 0),
          currency,
        )} from ${todaySales.length} transactions.`,
        `This month revenue is ${formatMoney(
          thisMonthSales.reduce((sum, sale) => sum + saleRevenue(sale), 0),
          currency,
        )}, with estimated net profit of ${formatMoney(netProfit, currency)} and gross margin of ${formatPercent(grossMargin)}.`,
        `Average order value is ${formatMoney(averageOrderValue, currency)} across ${transactionCount} completed transactions.`,
      ],
    },
    {
      title: "Sales Recommendations",
      points: [
        bestDay
          ? `${bestDay.day} is currently the strongest sales day. Plan staffing and promotions around that pattern.`
          : "More sales history is needed to identify the strongest sales day.",
        busiestHour
          ? `${busiestHour.label} is the busiest sales window. Keep cashiers and fast-moving stock ready before this period.`
          : "More transaction history is needed to identify the busiest hour.",
        topProduct
          ? `${topProduct.name} is the top product with ${formatMoney(topProduct.revenue, currency)} in tracked revenue. Keep it visible and well-stocked.`
          : "No top product has emerged yet. Continue tracking product-level sales.",
      ],
    },
    {
      title: "Store Recommendations",
      points: [
        bestStore
          ? `${bestStore.name} is the best performing branch with ${formatMoney(bestStore.sales, currency)} in sales.`
          : "Add stores or branch sales to unlock branch recommendations.",
        worstStore && bestStore && worstStore.id !== bestStore.id
          ? `${worstStore.name} needs attention. Review stock availability, staffing, and local demand.`
          : "No underperforming branch is clearly visible yet.",
        fastestGrowingStore
          ? `${fastestGrowingStore.name} has the strongest growth at ${formatSignedPercent(fastestGrowingStore.growth)}.`
          : "Branch growth will appear after there is comparable historical data.",
      ],
    },
    {
      title: "Inventory Recommendations",
      points: [
        `Current inventory value is ${formatMoney(inventoryValue, currency)}.`,
        lowStockItems.length
          ? `${lowStockItems.length} products are at or below reorder level. Prioritize ${lowStockItems
              .slice(0, 3)
              .map((item) => item.name)
              .join(", ")}.`
          : "No urgent low-stock alerts are currently detected.",
        deadStock.length
          ? `${deadStock.length} products appear to be dead stock. Consider discounts, bundles, or transfers.`
          : "No dead stock is visible in the current tracked sales window.",
      ],
    },
    {
      title: "Customer and Team Recommendations",
      points: [
        `${newCustomers} new customers were added this month, and ${repeatCustomerIds.size} customers are repeat buyers.`,
        `${formatPercent(revenue > 0 ? (repeatRevenue / revenue) * 100 : 0)} of revenue comes from repeat customers. Use loyalty offers to protect this revenue base.`,
        topEmployee
          ? `${topEmployee.name} is the top employee with ${formatMoney(topEmployee.sales, currency)} in sales from ${topEmployee.transactions} transactions.`
          : "No employee performance leader is available yet.",
      ],
    },
    {
      title: "Finance and Forecasts",
      points: [
        `Outstanding customer debt is ${formatMoney(outstandingDebt, currency)}. Follow up on overdue balances to protect cash flow.`,
        `Taxes collected in the selected scope are ${formatMoney(
          completedSales.reduce((sum, sale) => sum + asNumber(sale.tax_amount), 0),
          currency,
        )}.`,
        `Projected next month sales are approximately ${formatMoney(salesForecast, currency)} based on current trend assumptions.`,
      ],
    },
    {
      title: "AI Action List",
      points: aiInsights,
    },
  ];

  async function addGoal() {
    if (!business || !goalForm.label.trim()) return;
    const targetAmount = Number(goalForm.target_amount);
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      toast.error("Enter a valid goal target");
      return;
    }
    const { error } = await supabase.from("business_insight_goals").insert({
      business_id: business.id,
      label: goalForm.label.trim(),
      metric: goalForm.metric,
      target_amount: targetAmount,
      period: goalForm.period,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Business goal added");
      setRealtimeTick((tick) => tick + 1);
    }
  }

  async function addMarketInsight() {
    if (!business || !marketForm.title.trim()) return;
    const { error } = await supabase.from("market_insights").insert({
      business_id: business.id,
      title: marketForm.title.trim(),
      category: marketForm.category,
      impact_level: marketForm.impact_level,
      notes: marketForm.notes.trim() || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Market insight saved");
      setMarketForm({
        title: "",
        category: "competitor_pricing",
        impact_level: "medium",
        notes: "",
      });
      setRealtimeTick((tick) => tick + 1);
    }
  }

  function goalProgress(goal: BusinessGoal) {
    const current =
      goal.metric === "profit"
        ? netProfit
        : goal.metric === "customers"
          ? uniqueCustomers
          : goal.metric === "stores"
            ? stores.length
            : thisMonthSales.reduce((sum, sale) => sum + saleRevenue(sale), 0);
    return {
      current,
      percent: Math.min(100, goal.target_amount > 0 ? (current / goal.target_amount) * 100 : 0),
    };
  }

  function downloadReport() {
    const rows = [
      `${business.business_name} Business Insights Report`,
      `Generated: ${new Date().toLocaleString()}`,
      `Scope: ${selectedStoreId === "all" ? "All stores" : stores.find((store) => store.id === selectedStoreId)?.name || "Selected store"}`,
      "",
      "Executive Overview",
      `Sales today: ${formatMoney(
        todaySales.reduce((sum, sale) => sum + saleRevenue(sale), 0),
        currency,
      )}`,
      `Sales this week: ${formatMoney(
        weekSales.reduce((sum, sale) => sum + saleRevenue(sale), 0),
        currency,
      )}`,
      `Sales this month: ${formatMoney(
        thisMonthSales.reduce((sum, sale) => sum + saleRevenue(sale), 0),
        currency,
      )}`,
      `Net profit: ${formatMoney(netProfit, currency)}`,
      `Gross margin: ${formatPercent(grossMargin)}`,
      `Transactions: ${transactionCount}`,
      `Customers served: ${uniqueCustomers}`,
      "",
      "Branch Ranking",
      ...storeMetrics.map(
        (store, index) =>
          `${index + 1}. ${store.name} | Sales ${formatMoney(store.sales, currency)} | Profit ${formatMoney(store.profit, currency)} | Customers ${store.customers} | Transactions ${store.transactions}`,
      ),
      "",
      "AI Insights",
      ...aiInsights,
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${business.slug}-business-insights.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const barMax = Math.max(...hourlySales.map((item) => item.value), 1);

  return (
    <div className="w-full space-y-6 p-6 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Gauge className="h-3.5 w-3.5" /> CEO Dashboard
          </div>
          <h1 className="mt-3 text-3xl font-bold">Business Insights</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Decision-making dashboard for sales, profits, stores, stock, customers, employees,
            loyalty, forecasts, and market signals.
          </p>
          {lastUpdated && (
            <p className="mt-1 text-xs text-muted-foreground">
              Updated from database at {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
          <label className="relative flex items-center">
            <Store className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
            <select
              value={selectedStoreId}
              onChange={(event) => setSelectedStoreId(event.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm sm:w-56"
            >
              <option value="all">All stores</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                  {store.active === false ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowAiSummary(true)}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            <Bot className="mr-2 h-4 w-4" /> AI Summary
          </Button>
          <Button onClick={downloadReport} disabled={loading} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" /> Download Report
          </Button>
        </div>
      </div>

      <div className="-mx-6 overflow-x-auto px-6 md:mx-0 md:px-0">
        <div className="flex min-w-max gap-2 rounded-2xl border border-border/60 bg-background/60 p-2 shadow-sm backdrop-blur">
          {insightTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "overview" && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Revenue Today"
              value={formatMoney(
                todaySales.reduce((sum, sale) => sum + saleRevenue(sale), 0),
                currency,
              )}
              hint={`${todaySales.length} transactions`}
              icon={Banknote}
              tone="emerald"
            />
            <StatCard
              label="Profit Today"
              value={formatMoney(
                todaySales.reduce((sum, sale) => sum + saleProfit(sale, productCostById), 0),
                currency,
              )}
              hint="Based on tax/profit issued"
              icon={TrendingUp}
            />
            <StatCard
              label="Best Store"
              value={bestStore?.name || "No store data"}
              hint={bestStore ? formatMoney(bestStore.sales, currency) : "Add stores to compare"}
              icon={Store}
              tone="sky"
            />
            <StatCard
              label="Inventory Alerts"
              value={`${lowStockItems.length}`}
              hint={lowStockItems[0]?.name || "No low-stock alerts"}
              icon={AlertTriangle}
              tone={lowStockItems.length ? "rose" : "emerald"}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Top Product"
              value={topProduct?.name || "No sales yet"}
              hint={
                topProduct
                  ? formatMoney(topProduct.revenue, currency)
                  : "Start selling to rank products"
              }
              icon={ShoppingBasket}
              tone="amber"
            />
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              disabled={!topEmployee}
              onClick={() => topEmployee && setSelectedEmployeeId(topEmployee.id)}
              className="glass rounded-2xl p-4 text-left transition hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {topEmployee?.avatarUrl ? (
                    <img
                      src={topEmployee.avatarUrl}
                      alt={topEmployee.name}
                      className="h-11 w-11 shrink-0 rounded-xl border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-sm font-bold text-primary">
                      {(topEmployee?.name || "E").substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">Top Employee</p>
                    <p className="mt-1 truncate text-lg font-bold">
                      {topEmployee?.name || "No employee sales"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {topEmployee
                        ? formatMoney(topEmployee.sales, currency)
                        : "Sales will appear here"}
                    </p>
                  </div>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
                  <Award className="h-4 w-4 text-white" />
                </div>
              </div>
            </motion.button>
            <StatCard
              label="Worst Store"
              value={worstStore?.name || "No store data"}
              hint={worstStore ? formatMoney(worstStore.sales, currency) : "Add stores to compare"}
              icon={Store}
              tone="rose"
            />
            <StatCard
              label="AI Recommendation"
              value={aiInsights[0]}
              hint="Auto-generated from current trends"
              icon={Bot}
              tone="sky"
            />
          </div>

          <Section
            title="Executive Overview"
            description="Key metrics across the selected branch scope."
          >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                [
                  "Sales today",
                  formatMoney(
                    todaySales.reduce((sum, sale) => sum + saleRevenue(sale), 0),
                    currency,
                  ),
                ],
                [
                  "This week",
                  formatMoney(
                    weekSales.reduce((sum, sale) => sum + saleRevenue(sale), 0),
                    currency,
                  ),
                ],
                [
                  "This month",
                  formatMoney(
                    thisMonthSales.reduce((sum, sale) => sum + saleRevenue(sale), 0),
                    currency,
                  ),
                ],
                ["Net profit", formatMoney(netProfit, currency)],
                ["Gross margin", formatPercent(grossMargin)],
                ["Transactions", transactionCount.toLocaleString()],
                ["Average order", formatMoney(averageOrderValue, currency)],
                ["Customers served", uniqueCustomers.toLocaleString()],
                ["Refunds/returns", refundedSales.length.toLocaleString()],
                ["Inventory value", formatMoney(inventoryValue, currency)],
                ["Gross profit", formatMoney(grossProfit, currency)],
                ["Outstanding debt", formatMoney(outstandingDebt, currency)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-border/60 bg-background/50 p-3"
                >
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </Section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Section
              title="Revenue Trend"
              description="Hourly revenue movement for quick direction."
            >
              <div className="space-y-3">
                {hourlySales.map((item) => (
                  <div
                    key={item.label}
                    className="grid grid-cols-[44px_1fr_88px] items-center gap-3 text-sm"
                  >
                    <span className="text-muted-foreground">{item.label}</span>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(4, (item.value / barMax) * 100)}%` }}
                      />
                    </div>
                    <span className="text-right text-xs font-semibold">
                      {formatMoney(item.value, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Store Leaderboard" description="Top branches by selected sales scope.">
              <div className="space-y-2">
                {storeMetrics.slice(0, 5).map((store, index) => (
                  <div
                    key={store.id}
                    className="flex items-center justify-between rounded-xl border border-border/60 p-3 text-sm"
                  >
                    <span className="font-medium">
                      {index + 1}. {store.name}
                    </span>
                    <b>{formatMoney(store.sales, currency)}</b>
                  </div>
                ))}
                {storeMetrics.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Add stores to see branch rankings.
                  </p>
                )}
              </div>
            </Section>

            <Section title="AI Insights" description="Auto-generated observations to act on.">
              <div className="space-y-2">
                {aiInsights.map((insight) => (
                  <div
                    key={insight}
                    className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm"
                  >
                    {insight}
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </>
      )}

      {(activeTab === "stores" || activeTab === "sales") && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {activeTab === "stores" && (
            <Section
              title="Multi-Store Performance Comparison"
              description="Compare stores side by side and identify attention areas."
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2">Store</th>
                      <th>Sales</th>
                      <th>Profit</th>
                      <th>Customers</th>
                      <th>Transactions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeMetrics.map((store) => (
                      <tr key={store.id} className="border-b border-border/50">
                        <td className="py-3 font-medium">{store.name}</td>
                        <td>{formatMoney(store.sales, currency)}</td>
                        <td>{formatMoney(store.profit, currency)}</td>
                        <td>{store.customers}</td>
                        <td>{store.transactions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-emerald-500/10 p-3">
                  Best performing: <b>{bestStore?.name || "N/A"}</b>
                </div>
                <div className="rounded-lg bg-rose-500/10 p-3">
                  Needs attention: <b>{worstStore?.name || "N/A"}</b>
                </div>
                <div className="rounded-lg bg-sky-500/10 p-3">
                  Fastest growing: <b>{fastestGrowingStore?.name || "N/A"}</b>
                </div>
                <div className="rounded-lg bg-amber-500/10 p-3">
                  Lowest transactions:{" "}
                  <b>
                    {[...storeMetrics].sort((a, b) => a.transactions - b.transactions)[0]?.name ||
                      "N/A"}
                  </b>
                </div>
              </div>
            </Section>
          )}

          {activeTab === "sales" && (
            <Section
              title="Sales Analytics"
              description="Hourly, daily, weekly, monthly, and yearly growth signals."
            >
              <div className="space-y-3">
                {hourlySales.map((item) => (
                  <div
                    key={item.label}
                    className="grid grid-cols-[48px_1fr_96px] items-center gap-3 text-sm"
                  >
                    <span className="text-muted-foreground">{item.label}</span>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(4, (item.value / barMax) * 100)}%` }}
                      />
                    </div>
                    <span className="text-right font-medium">
                      {formatMoney(item.value, currency)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg border border-border/60 p-3">
                  Best day
                  <br />
                  <b>{bestDay?.day || "N/A"}</b>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  Busiest hour
                  <br />
                  <b>{busiestHour?.label || "N/A"}</b>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  Month growth
                  <br />
                  <b>
                    {formatSignedPercent(
                      getTrend(
                        thisMonthSales.reduce((sum, sale) => sum + saleRevenue(sale), 0),
                        previousMonthSales.reduce((sum, sale) => sum + saleRevenue(sale), 0),
                      ),
                    )}
                  </b>
                </div>
              </div>
            </Section>
          )}
        </div>
      )}

      {(activeTab === "sales" || activeTab === "finance" || activeTab === "inventory") && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {activeTab === "sales" && (
            <Section
              title="Product Performance"
              description="Top sellers, most profitable products, slow movers, and dead stock."
            >
              <div className="space-y-3">
                {topProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3"
                  >
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.quantity} sold</p>
                    </div>
                    <b>{formatMoney(product.revenue, currency)}</b>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {topProducts[0]
                  ? `${topProducts[0].name} generated ${formatMoney(topProducts[0].revenue, currency)} in tracked sales.`
                  : "No product sales yet."}
              </p>
            </Section>
          )}
          {activeTab === "finance" && (
            <Section
              title="Profitability Analysis"
              description="Revenue, COGS, gross profit, net profit, and profit by product."
            >
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Revenue</span>
                  <b>{formatMoney(revenue, currency)}</b>
                </div>
                <div className="flex justify-between">
                  <span>Cost of goods sold</span>
                  <b>{formatMoney(costOfGoods, currency)}</b>
                </div>
                <div className="flex justify-between">
                  <span>Gross profit</span>
                  <b>{formatMoney(grossProfit, currency)}</b>
                </div>
                <div className="flex justify-between">
                  <span>Net profit</span>
                  <b>{formatMoney(netProfit, currency)}</b>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {profitableProducts.slice(0, 3).map((product) => (
                  <div key={product.id} className="rounded-lg bg-background/50 p-2 text-xs">
                    {product.name} contributed <b>{formatMoney(product.profit, currency)}</b>{" "}
                    profit.
                  </div>
                ))}
              </div>
            </Section>
          )}
          {activeTab === "inventory" && (
            <Section
              title="Inventory Intelligence"
              description="Fast movers, slow movers, alerts, and transfer recommendations."
            >
              <div className="space-y-2">
                {lowStockItems.length ? (
                  lowStockItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
                    >
                      <b>{item.name}</b>
                      <br />
                      <span className="text-xs text-muted-foreground">
                        Stock {item.stock}, reorder alert {item.lowStockAlert}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No low-stock products.</p>
                )}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Slow-moving: {slowMovingProducts.map((item) => item.name).join(", ") || "None"}.
                Dead stock: {deadStock.map((item) => item.name).join(", ") || "None"}.
              </p>
            </Section>
          )}
        </div>
      )}

      {(activeTab === "customers" || activeTab === "team") && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {activeTab === "customers" && (
            <Section
              title="Customer Insights"
              description="New, returning, lifetime value, loyalty, and spending habits."
            >
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div className="rounded-xl border border-border/60 p-3">
                  <UserRound className="mb-2 h-4 w-4" />
                  New customers
                  <br />
                  <b>{newCustomers}</b>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <Users className="mb-2 h-4 w-4" />
                  Returning
                  <br />
                  <b>{repeatCustomerIds.size}</b>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <Receipt className="mb-2 h-4 w-4" />
                  CLV avg
                  <br />
                  <b>
                    {formatMoney(uniqueCustomers > 0 ? revenue / uniqueCustomers : 0, currency)}
                  </b>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <Percent className="mb-2 h-4 w-4" />
                  Repeat revenue
                  <br />
                  <b>{formatPercent(revenue > 0 ? (repeatRevenue / revenue) * 100 : 0)}</b>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {formatPercent(revenue > 0 ? (repeatRevenue / revenue) * 100 : 0)} of revenue comes
                from repeat customers.
              </p>
            </Section>
          )}

          {activeTab === "team" && (
            <Section
              title="Employee Performance"
              description="Cashier and salesperson productivity."
            >
              <div className="space-y-2">
                {cashierMetrics.slice(0, 5).map((employee) => (
                  <div
                    key={employee.id}
                    className="grid grid-cols-4 gap-2 rounded-lg border border-border/60 p-3 text-sm"
                  >
                    <b className="col-span-4 md:col-span-1">{employee.name}</b>
                    <span>Sales {formatMoney(employee.sales, currency)}</span>
                    <span>Tx {employee.transactions}</span>
                    <span>Avg {formatMoney(employee.averageSale, currency)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {topEmployee
                  ? `${topEmployee.name} generated ${formatMoney(topEmployee.sales, currency)} in tracked sales.`
                  : "No employee sales found."}
              </p>
            </Section>
          )}
        </div>
      )}

      {(activeTab === "finance" || activeTab === "customers") && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {activeTab === "finance" && (
            <Section
              title="Financial Health Dashboard"
              description="Cash, M-Pesa, bank, credit, expenses, taxes, and debt."
            >
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                {Object.entries({
                  cash: paymentTotals.cash || 0,
                  "m-pesa": paymentTotals["m-pesa"] || paymentTotals.mpesa || 0,
                  bank: paymentTotals.bank || 0,
                  credit: paymentTotals.credit || 0,
                  tax: completedSales.reduce((sum, sale) => sum + asNumber(sale.tax_amount), 0),
                  debt: outstandingDebt,
                }).map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-border/60 p-3 capitalize">
                    <span className="text-muted-foreground">{label}</span>
                    <br />
                    <b>{formatMoney(value, currency)}</b>
                  </div>
                ))}
              </div>
            </Section>
          )}
          {activeTab === "customers" && (
            <Section
              title="Loyalty & Rewards Analytics"
              description="Points earned, redemption readiness, active members, and loyalty contribution."
            >
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div className="rounded-xl border border-border/60 p-3">
                  Points earned
                  <br />
                  <b>
                    {customers
                      .reduce((sum, customer) => sum + asNumber(customer.loyalty_points), 0)
                      .toLocaleString()}
                  </b>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  Active members
                  <br />
                  <b>
                    {customers.filter((customer) => asNumber(customer.loyalty_points) > 0).length}
                  </b>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  Redemption rate
                  <br />
                  <b>Track soon</b>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  Contribution
                  <br />
                  <b>{formatPercent(revenue > 0 ? (repeatRevenue / revenue) * 100 : 0)}</b>
                </div>
              </div>
            </Section>
          )}
        </div>
      )}

      {(activeTab === "forecasts" || activeTab === "stores") && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {activeTab === "forecasts" && (
            <Section
              title="Forecasting & Predictions"
              description="Historical trends projected into next week and next month."
            >
              <div className="space-y-3 text-sm">
                <div className="rounded-xl bg-primary/10 p-3">
                  Expected next month sales: <b>{formatMoney(salesForecast, currency)}</b>
                </div>
                <div className="rounded-xl bg-amber-500/10 p-3">
                  Inventory requirement: <b>{lowStockItems.length} urgent items</b>
                </div>
                <div className="rounded-xl bg-emerald-500/10 p-3">
                  Cash flow forecast: <b>{formatMoney(netProfit * 1.18, currency)}</b>
                </div>
              </div>
            </Section>
          )}
          {activeTab === "stores" && (
            <Section
              title="Geographic Insights"
              description="Sales by region and expansion opportunities."
            >
              <div className="space-y-2">
                {stores.map((store) => (
                  <div
                    key={store.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 p-3 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {store.location_county || store.location_city || store.location || store.name}
                    </span>
                    <b>
                      {formatMoney(
                        storeMetrics.find((metric) => metric.id === store.id)?.sales || 0,
                        currency,
                      )}
                    </b>
                  </div>
                ))}
              </div>
            </Section>
          )}
          {activeTab === "forecasts" && (
            <Section
              title="AI-Powered Insights"
              description="Automatic observations from live business data."
            >
              <div className="space-y-2">
                {aiInsights.map((insight) => (
                  <div
                    key={insight}
                    className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-sm"
                  >
                    {insight}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {activeTab === "forecasts" && (
        <Section
          title="Business Goals Tracking"
          description="Set owner targets and monitor progress."
        >
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto_auto]">
            <input
              value={goalForm.label}
              onChange={(event) => setGoalForm({ ...goalForm, label: event.target.value })}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              placeholder="Monthly Sales Goal"
            />
            <select
              value={goalForm.metric}
              onChange={(event) => setGoalForm({ ...goalForm, metric: event.target.value })}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="sales">Sales</option>
              <option value="profit">Profit</option>
              <option value="customers">Customers</option>
              <option value="stores">Stores</option>
            </select>
            <input
              value={goalForm.target_amount}
              onChange={(event) => setGoalForm({ ...goalForm, target_amount: event.target.value })}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              placeholder="Target"
            />
            <select
              value={goalForm.period}
              onChange={(event) => setGoalForm({ ...goalForm, period: event.target.value })}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="yearly">Yearly</option>
            </select>
            <Button onClick={addGoal}>
              <Plus className="mr-2 h-4 w-4" /> Add Goal
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {goals.map((goal) => {
              const progress = goalProgress(goal);
              return (
                <div key={goal.id} className="rounded-xl border border-border/60 p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <b>{goal.label}</b>
                    <span>
                      {formatMoney(progress.current, currency)} /{" "}
                      {formatMoney(goal.target_amount, currency)}
                    </span>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Math.round(progress.percent)}% complete
                  </p>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {activeTab === "forecasts" && (
        <Section
          title="Competitor & Market Insights"
          description="Manually track competitor pricing, market trends, supplier price changes, and demand shifts."
        >
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <input
              value={marketForm.title}
              onChange={(event) => setMarketForm({ ...marketForm, title: event.target.value })}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              placeholder="Example: Competitor reduced maize flour price"
            />
            <select
              value={marketForm.category}
              onChange={(event) => setMarketForm({ ...marketForm, category: event.target.value })}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="competitor_pricing">Competitor pricing</option>
              <option value="market_trend">Market trend</option>
              <option value="supplier_price">Supplier price</option>
              <option value="demand_shift">Demand fluctuation</option>
            </select>
            <Button onClick={addMarketInsight}>
              <Plus className="mr-2 h-4 w-4" /> Save Insight
            </Button>
          </div>
          <textarea
            value={marketForm.notes}
            onChange={(event) => setMarketForm({ ...marketForm, notes: event.target.value })}
            className="mt-3 min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Notes, prices, supplier names, or action required"
          />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {marketInsights.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <b>{item.title}</b>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs capitalize">
                    {item.impact_level}
                  </span>
                </div>
                <p className="mt-1 text-xs capitalize text-muted-foreground">
                  {item.category.replaceAll("_", " ")}
                </p>
                {item.notes && <p className="mt-2 text-sm text-muted-foreground">{item.notes}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {activeTab === "sales" && (
        <Section
          title="Peak Hours Heatmap"
          description="Busiest hours based on transaction volume."
        >
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="mb-1 grid grid-cols-8 gap-1">
                <div />
                {timeLabels.map((time) => (
                  <div key={time} className="text-center text-xs text-muted-foreground">
                    {time}
                  </div>
                ))}
              </div>
              {heatmapData.map((row) => (
                <div key={row.day} className="mb-1 grid grid-cols-8 items-center gap-1">
                  <div className="text-xs font-medium text-muted-foreground">{row.day}</div>
                  {row.hours.map((intensity, index) => (
                    <div
                      key={`${row.day}-${timeLabels[index]}`}
                      className="flex h-10 items-center justify-center rounded-md border border-border/5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `color-mix(in srgb, var(--theme-primary) ${intensity}%, transparent)`,
                        opacity: intensity === 0 ? 0.2 : Math.min(1, intensity / 100 + 0.1),
                        color: intensity > 60 ? "white" : "inherit",
                      }}
                      title={`${row.day} ${timeLabels[index]}: ${row.counts[index]} transactions`}
                    >
                      {intensity > 70 ? "High" : intensity > 40 ? "Med" : ""}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {showAiSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-border bg-background p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <Bot className="h-3.5 w-3.5" /> AI Business Summary
                </div>
                <h3 className="mt-3 text-2xl font-bold">Insights and Recommendations</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Generated from live database records for sales, stores, products, customers,
                  employees, inventory, goals, and market insights.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAiSummary(false)}
                className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close AI summary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm">
              <div className="font-semibold text-primary">Database source</div>
              <div className="mt-2 grid gap-2 text-muted-foreground md:grid-cols-3">
                <span>
                  Scope:{" "}
                  {selectedStoreId === "all"
                    ? "All stores"
                    : stores.find((store) => store.id === selectedStoreId)?.name ||
                      "Selected store"}
                </span>
                <span>
                  Last DB refresh: {lastUpdated ? lastUpdated.toLocaleString() : "Loading"}
                </span>
                <span>
                  Records: {completedSales.length} sales, {products.length} products,{" "}
                  {customers.length} customers
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-border/60 p-4">
                <p className="text-xs text-muted-foreground">Revenue Today</p>
                <p className="mt-1 text-xl font-bold">
                  {formatMoney(
                    todaySales.reduce((sum, sale) => sum + saleRevenue(sale), 0),
                    currency,
                  )}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 p-4">
                <p className="text-xs text-muted-foreground">Net Profit</p>
                <p className="mt-1 text-xl font-bold">{formatMoney(netProfit, currency)}</p>
              </div>
              <div className="rounded-2xl border border-border/60 p-4">
                <p className="text-xs text-muted-foreground">Next Month Forecast</p>
                <p className="mt-1 text-xl font-bold">{formatMoney(salesForecast, currency)}</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {summarySections.map((section) => (
                <div key={section.title} className="rounded-2xl border border-border/60 p-4">
                  <h4 className="font-semibold">{section.title}</h4>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {section.points.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl bg-primary/10 p-4 text-sm text-primary">
              Recommended next step: address low-stock items first, review underperforming branches,
              and protect repeat-customer revenue with loyalty offers.
            </div>
          </motion.div>
        </div>
      )}

      {selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-xl rounded-3xl border border-border bg-background p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                {selectedEmployee.avatarUrl ? (
                  <img
                    src={selectedEmployee.avatarUrl}
                    alt={selectedEmployee.name}
                    className="h-16 w-16 shrink-0 rounded-2xl border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-lg font-bold text-primary">
                    {selectedEmployee.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    Employee Details
                  </p>
                  <h3 className="truncate text-2xl font-bold">{selectedEmployee.name}</h3>
                  <p className="mt-1 text-sm capitalize text-muted-foreground">
                    {selectedEmployee.role || "Staff member"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmployeeId(null)}
                className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close employee details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">Sales Amount</p>
                <p className="mt-1 font-bold">{formatMoney(selectedEmployee.sales, currency)}</p>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">Transactions</p>
                <p className="mt-1 font-bold">{selectedEmployee.transactions}</p>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">Average Sale</p>
                <p className="mt-1 font-bold">
                  {formatMoney(selectedEmployee.averageSale, currency)}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">Refunds</p>
                <p className="mt-1 font-bold">{selectedEmployee.refunds}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-border/60 p-4">
                <div className="mb-3 flex items-center gap-2 font-semibold">
                  <Store className="h-4 w-4 text-primary" /> Stores Assigned
                </div>
                <div className="rounded-xl bg-muted/50 p-3 text-sm">
                  <p className="font-medium">
                    {selectedEmployeeStore?.name || "Headquarters / all stores"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedEmployeeStore
                      ? selectedEmployeeStore.location_county ||
                        selectedEmployeeStore.location_city ||
                        selectedEmployeeStore.location ||
                        "Assigned branch"
                      : "No single branch assignment found"}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 p-4">
                <div className="mb-3 flex items-center gap-2 font-semibold">
                  <UserRound className="h-4 w-4 text-primary" /> Contact
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{selectedEmployee.email || "No email on file"}</p>
                  <p>{selectedEmployee.phone || "No phone on file"}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-primary/10 p-4 text-sm text-primary">
              {selectedEmployee.name} has generated {formatMoney(selectedEmployee.sales, currency)}{" "}
              from {selectedEmployee.transactions} completed transactions in the selected insights
              scope.
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
