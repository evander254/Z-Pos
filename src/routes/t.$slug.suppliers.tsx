import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useTenant } from "@/lib/tenant-context";
import { supabase } from "@/integrations/supabase/client";
import {
  Truck,
  Plus,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Loader2,
  Check,
  Info,
  Download,
  Share2,
  Activity,
  Clock,
  TrendingUp,
  Search,
  RefreshCw,
  PackageCheck,
  AlertTriangle,
  Wallet,
  CalendarDays,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { formatMoney } from "@/lib/format";
import { useBusinessRealtime } from "@/lib/use-business-realtime";

export const Route = createFileRoute("/t/$slug/suppliers")({ component: SuppliersDashboard });

type Supplier = {
  id: string;
  name: string;
  contact: string;
  days: string[];
  providedItems: string;
  activeOrders: number;
  orders?: PurchaseOrder[];
};

type PurchaseOrder = {
  id: string;
  supplier_id?: string | null;
  supplier_name?: string | null;
  status: string | null;
  total_amount: number | null;
  created_at: string | null;
  received_at?: string | null;
};

type PurchaseOrderItem = {
  id?: string;
  po_id: string | null;
  product_id: string | null;
  product_name?: string | null;
  quantity: number;
  unit_cost: number;
  created_at: string | null;
};

type Product = {
  id: string;
  name: string;
  costPrice: number;
  stock: number;
  lowStockAlert: number;
};

type POItemInput = {
  id: string;
  productId: string | null;
  name: string;
  quantity: number;
  unitCost: number;
  currentStock?: number;
  lowStockAlert?: number;
};

type GeneratedPO = {
  poNumber: string;
  date: string;
  supplier: string;
  supplierContact: string;
  items: POItemInput[];
  total: number;
};

type PastOrder = {
  id: string;
  date: string;
  total: number;
  status: string;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getRecentMonthKeys(count: number) {
  const months: { key: string; name: string }[] = [];
  const date = new Date();
  date.setDate(1);

  for (let i = count - 1; i >= 0; i -= 1) {
    const month = new Date(date.getFullYear(), date.getMonth() - i, 1);
    months.push({
      key: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`,
      name: month.toLocaleString("default", { month: "short" }),
    });
  }

  return months;
}

function getMonthKey(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

function SuppliersDashboard() {
  const { business } = useTenant();
  const [loading, setLoading] = useState(true);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // PO Generator State
  const [poSupplierId, setPoSupplierId] = useState<string>("");
  const [manualSupplierName, setManualSupplierName] = useState("");
  const [manualSupplierContact, setManualSupplierContact] = useState("");
  const [poItems, setPoItems] = useState<POItemInput[]>([]);
  const [generatingPo, setGeneratingPo] = useState(false);
  const [lastGeneratedPo, setLastGeneratedPo] = useState<GeneratedPO | null>(null);
  const [customItem, setCustomItem] = useState({ name: "", quantity: "1", unitCost: "0" });

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
  const [poHistory, setPoHistory] = useState<PurchaseOrder[]>([]);
  const [poItemHistory, setPoItemHistory] = useState<PurchaseOrderItem[]>([]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [deliveryDayFilter, setDeliveryDayFilter] = useState("all");

  const currency = business?.currency || "KES";

  useEffect(() => {
    if (business) {
      loadData();
    }
  }, [business]);

  useBusinessRealtime(business?.id, ["suppliers", "purchase_orders", "products"], loadData);

  async function loadData() {
    if (!business) return;
    setLoading(true);

    try {
      let { data: sups, error: supsError } = await supabase
        .from("suppliers")
        .select(
          `
          id,
          supplier_name,
          phone,
          email,
          delivery_days,
          provided_items,
          purchase_orders ( id, status, total_amount, created_at, received_at )
        `,
        )
        .eq("business_id", business.id);

      if (supsError?.message?.includes("received_at") || supsError?.code === "42703") {
        const fallback = await supabase
          .from("suppliers")
          .select(
            `
            id,
            supplier_name,
            phone,
            email,
            delivery_days,
            provided_items,
            purchase_orders ( id, status, total_amount, created_at )
          `,
          )
          .eq("business_id", business.id);

        sups = (fallback.data || []).map((supplier) => ({
          ...supplier,
          purchase_orders: (supplier.purchase_orders || []).map((po) => ({
            ...po,
            received_at: null,
          })),
        }));
        supsError = fallback.error;
      }

      if (supsError) throw supsError;

      let allPOs: PurchaseOrder[] = [];

      const formattedSuppliers = (sups || []).map((s) => {
        const activeCount = s.purchase_orders?.filter((po) => po.status === "pending").length || 0;
        let daysArray: string[] = [];
        try {
          if (s.delivery_days) daysArray = JSON.parse(s.delivery_days);
        } catch {
          daysArray = s.delivery_days ? s.delivery_days.split(",").map((d) => d.trim()) : [];
        }

        if (s.purchase_orders) {
          allPOs = [
            ...allPOs,
            ...s.purchase_orders.map((po) => ({ ...po, supplier_name: s.supplier_name })),
          ];
        }

        return {
          id: s.id,
          name: s.supplier_name || "Unknown",
          contact: s.phone || s.email || "No contact",
          days: daysArray,
          providedItems: s.provided_items || "",
          activeOrders: activeCount,
          orders: s.purchase_orders,
        };
      });

      setSuppliers(formattedSuppliers);
      setPoHistory(allPOs);

      if (allPOs.length > 0) {
        const { data: poItems, error: poItemsError } = await supabase
          .from("purchase_order_items")
          .select("po_id,product_id,product_name,quantity,unit_cost,created_at")
          .in(
            "po_id",
            allPOs.map((po) => po.id),
          );

        if (poItemsError) throw poItemsError;
        setPoItemHistory((poItems || []) as PurchaseOrderItem[]);
      } else {
        setPoItemHistory([]);
      }

      const { data: allProds, error: allProdsError } = await supabase
        .from("products")
        .select("id, name, cost_price, stock_quantity, low_stock_alert")
        .eq("business_id", business.id);

      if (allProdsError) throw allProdsError;

      const formattedProds = (allProds || []).map((p) => ({
        id: p.id,
        name: p.name,
        costPrice: p.cost_price || 0,
        stock: p.stock_quantity || 0,
        lowStockAlert: p.low_stock_alert || 5,
      }));

      setProducts(formattedProds);
    } catch (e: unknown) {
      toast.error("Failed to load data: " + getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  const lowStockProducts = useMemo(() => {
    return products
      .filter((p) => p.stock <= p.lowStockAlert)
      .sort((a, b) => a.stock - a.lowStockAlert - (b.stock - b.lowStockAlert));
  }, [products]);

  // Smart PO items are based on low stock only, not supplier-product linking.
  useEffect(() => {
    setPoItems((currentItems) => {
      const customItems = currentItems.filter((item) => !item.productId);
      return [
        ...lowStockProducts.map((p) => ({
          id: p.id,
          productId: p.id,
          name: p.name,
          quantity: Math.max(1, p.lowStockAlert * 2 - p.stock),
          unitCost: p.costPrice,
          currentStock: p.stock,
          lowStockAlert: p.lowStockAlert,
        })),
        ...customItems,
      ];
    });
  }, [lowStockProducts]);

  function updatePoItem(id: string, field: "quantity" | "unitCost", value: number) {
    setPoItems((items) => items.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }

  function removePoItem(id: string) {
    setPoItems((items) => items.filter((i) => i.id !== id));
  }

  function addCustomPoItem() {
    const name = customItem.name.trim();
    if (!name) {
      toast.error("Enter an item name first.");
      return;
    }

    setPoItems((items) => [
      ...items,
      {
        id: `custom-${Date.now()}`,
        productId: null,
        name,
        quantity: Math.max(1, Number(customItem.quantity) || 1),
        unitCost: Math.max(0, Number(customItem.unitCost) || 0),
      },
    ]);
    setCustomItem({ name: "", quantity: "1", unitCost: "0" });
  }

  const poTotal = poItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

  async function handleAddSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!business || !newSupplier.name.trim()) return;

    setAddingSupplier(true);
    try {
      const daysStr = JSON.stringify(Array.from(selectedDays));

      if (editingSupplierId) {
        const { error } = await supabase
          .from("suppliers")
          .update({
            supplier_name: newSupplier.name,
            phone: newSupplier.contact,
            delivery_days: daysStr,
            provided_items: newSupplier.providedItems,
          })
          .eq("id", editingSupplierId);
        if (error) throw error;
        toast.success("Supplier updated successfully");
      } else {
        const { error } = await supabase.from("suppliers").insert({
          business_id: business.id,
          supplier_name: newSupplier.name,
          phone: newSupplier.contact,
          delivery_days: daysStr,
          provided_items: newSupplier.providedItems,
        });
        if (error) throw error;
        toast.success("Supplier added successfully");
      }

      setIsAddSupplierOpen(false);
      setNewSupplier({ name: "", contact: "", providedItems: "" });
      setSelectedDays(new Set());
      setEditingSupplierId(null);
      loadData();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e));
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
    if (!business || poTotal === 0) return;

    const selectedSupplier = suppliers.find((s) => s.id === poSupplierId);
    const recipientName = selectedSupplier?.name || manualSupplierName.trim();
    const recipientContact = selectedSupplier?.contact || manualSupplierContact.trim();

    if (!recipientName) {
      toast.error("Select a supplier or enter a manual supplier name.");
      return;
    }

    setGeneratingPo(true);
    try {
      const validItems = poItems.filter((i) => i.quantity > 0);
      if (validItems.length === 0)
        throw new Error("Please enter quantities for at least one product.");

      const { data: po, error: poError } = await supabase
        .from("purchase_orders")
        .insert({
          business_id: business.id,
          supplier_id: selectedSupplier?.id || null,
          total_amount: poTotal,
          status: "pending",
        })
        .select()
        .single();

      if (poError || !po) throw poError || new Error("Failed to create PO");

      const poItemsData = validItems.map((item) => ({
        po_id: po.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_cost: item.unitCost,
        product_name: item.name,
      }));

      let { error: itemsError } = await supabase.from("purchase_order_items").insert(poItemsData);
      if (itemsError?.message?.includes("product_name") || itemsError?.code === "42703") {
        const fallbackItems = poItemsData.map(({ product_name, ...item }) => item);
        const fallback = await supabase.from("purchase_order_items").insert(fallbackItems);
        itemsError = fallback.error;
      }
      if (itemsError) throw itemsError;

      const generatedData = {
        poNumber: po.id.split("-")[0].toUpperCase(),
        date: new Date().toLocaleDateString(),
        supplier: recipientName,
        supplierContact: recipientContact,
        items: validItems,
        total: poTotal,
      };

      setLastGeneratedPo(generatedData);
      toast.success(`Purchase Order generated successfully!`);
      loadData();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e));
    } finally {
      setGeneratingPo(false);
    }
  }

  async function markPoReceived(poId: string) {
    try {
      if (!business) return;

      const { data: po, error: poError } = await supabase
        .from("purchase_orders")
        .select("id,status")
        .eq("id", poId)
        .single();

      if (poError) throw poError;
      if (po?.status !== "pending") {
        toast.info("This purchase order has already been received.");
        return;
      }

      const { data: poItems, error: poItemsError } = await supabase
        .from("purchase_order_items")
        .select("id,po_id,product_id,product_name,quantity,unit_cost,created_at")
        .eq("po_id", poId);

      if (poItemsError) throw poItemsError;

      const receivedItems = (poItems || []) as PurchaseOrderItem[];
      if (receivedItems.length === 0) {
        throw new Error("This purchase order has no items to receive.");
      }

      for (const item of receivedItems) {
        const quantity = Number(item.quantity || 0);
        if (quantity <= 0) continue;

        let productId = item.product_id;

        if (productId) {
          const { data: product, error: productError } = await supabase
            .from("products")
            .select("id,stock_quantity")
            .eq("id", productId)
            .single();

          if (productError) throw productError;

          const { error: updateProductError } = await supabase
            .from("products")
            .update({
              stock_quantity: Number(product.stock_quantity || 0) + quantity,
              cost_price: Number(item.unit_cost || 0),
            })
            .eq("id", productId);

          if (updateProductError) throw updateProductError;
        } else {
          const productName = item.product_name?.trim() || `PO-${poId.substring(0, 8)} item`;
          const { data: createdProduct, error: createProductError } = await supabase
            .from("products")
            .insert({
              business_id: business.id,
              name: productName,
              price: Number(item.unit_cost || 0),
              cost_price: Number(item.unit_cost || 0),
              stock_quantity: quantity,
              low_stock_alert: 5,
              active: true,
              description: `Created automatically from purchase order ${poId.substring(0, 8).toUpperCase()}. Edit product details later.`,
            })
            .select("id")
            .single();

          if (createProductError) throw createProductError;
          productId = createdProduct.id;

          if (item.id) {
            const { error: linkItemError } = await supabase
              .from("purchase_order_items")
              .update({ product_id: productId })
              .eq("id", item.id);

            if (linkItemError) throw linkItemError;
          }
        }

        const { error: logError } = await supabase.from("inventory_logs").insert({
          business_id: business.id,
          product_id: productId,
          change_type: "purchase_order_received",
          quantity,
          notes: `Received PO ${poId.substring(0, 8).toUpperCase()}`,
        });

        if (logError) throw logError;
      }

      let { error } = await supabase
        .from("purchase_orders")
        .update({ status: "received", received_at: new Date().toISOString() })
        .eq("id", poId);

      if (error?.message?.includes("received_at") || error?.code === "42703") {
        const fallback = await supabase
          .from("purchase_orders")
          .update({ status: "received" })
          .eq("id", poId);
        error = fallback.error;
      }

      if (error) throw error;
      toast.success("Purchase order marked as received");
      loadData();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e));
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
            ${lastGeneratedPo.items
              .map(
                (i: POItemInput) => `
              <tr>
                <td>${i.name}</td>
                <td>${i.quantity}</td>
                <td>${currency} ${i.unitCost.toFixed(2)}</td>
                <td>${currency} ${(i.quantity * i.unitCost).toFixed(2)}</td>
              </tr>
            `,
              )
              .join("")}
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

    const supplierContact =
      lastGeneratedPo.supplierContact ||
      suppliers.find((s) => s.name === lastGeneratedPo.supplier)?.contact ||
      "";
    const itemLines = lastGeneratedPo.items
      .map((i: POItemInput) => `- ${i.name}: ${i.quantity} x ${formatMoney(i.unitCost, currency)}`)
      .join("\n");
    const text = `Hello ${lastGeneratedPo.supplier},\n\nPlease find our Purchase Order ${lastGeneratedPo.poNumber} for restocking.\n\n${itemLines}\n\nTotal Amount: ${formatMoney(lastGeneratedPo.total, currency)}\n\nPlease download/print the PDF copy from ZPos if needed.\n\nBest,\n${business?.business_name}`;

    if (navigator.share) {
      navigator
        .share({
          title: `Purchase Order ${lastGeneratedPo.poNumber}`,
          text: text,
        })
        .catch(console.error);
    } else {
      // Fallback to WhatsApp
      const phone = supplierContact.replace(/\D/g, "");
      const waUrl = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(waUrl, "_blank");
    }
  }

  // Analytics Data Prep
  const monthlyData = useMemo(() => {
    const months = getRecentMonthKeys(4);
    const counts = new Map(months.map((month) => [month.key, 0]));

    poHistory.forEach((po) => {
      const key = getMonthKey(po.created_at);
      if (!key || !counts.has(key)) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return months.map((month) => ({ name: month.name, orders: counts.get(month.key) || 0 }));
  }, [poHistory]);

  const volatilityData = useMemo(() => {
    const months = getRecentMonthKeys(4);
    const monthTotals = new Map(months.map((month) => [month.key, { totalCost: 0, quantity: 0 }]));
    const poCreatedAtById = new Map(poHistory.map((po) => [po.id, po.created_at]));

    poItemHistory.forEach((item) => {
      const key = getMonthKey(poCreatedAtById.get(item.po_id || "") || item.created_at);
      if (!key || !monthTotals.has(key)) return;

      const month = monthTotals.get(key)!;
      month.totalCost += Number(item.unit_cost || 0) * Number(item.quantity || 0);
      month.quantity += Number(item.quantity || 0);
    });

    return months.map((month) => {
      const totals = monthTotals.get(month.key)!;
      const averageUnitCost = totals.quantity > 0 ? totals.totalCost / totals.quantity : 0;
      return { month: month.name, averageUnitCost, orderedUnits: totals.quantity };
    });
  }, [poHistory, poItemHistory]);

  const hasVolatilityData = volatilityData.some((item) => item.orderedUnits > 0);

  const leadTime = useMemo(() => {
    const fulfilledOrders = poHistory.filter((po) => {
      if (!po.created_at || !po.received_at) return false;
      return po.status !== "pending";
    });

    if (fulfilledOrders.length === 0) return null;

    const totalDays = fulfilledOrders.reduce((sum, po) => {
      const created = new Date(po.created_at!).getTime();
      const received = new Date(po.received_at!).getTime();
      if (Number.isNaN(created) || Number.isNaN(received) || received < created) return sum;
      return sum + (received - created) / (1000 * 60 * 60 * 24);
    }, 0);

    return totalDays / fulfilledOrders.length;
  }, [poHistory]);

  const filteredSuppliers = useMemo(() => {
    const query = supplierSearch.trim().toLowerCase();

    return suppliers.filter((s) => {
      const matchesSearch =
        !query ||
        s.name.toLowerCase().includes(query) ||
        s.contact.toLowerCase().includes(query) ||
        s.providedItems.toLowerCase().includes(query);

      const matchesDay = deliveryDayFilter === "all" || s.days.includes(deliveryDayFilter);

      return matchesSearch && matchesDay;
    });
  }, [suppliers, supplierSearch, deliveryDayFilter]);

  const supplierPerformance = useMemo(() => {
    return suppliers
      .map((s) => {
        const orderValue = (s.orders || []).reduce(
          (sum: number, po) => sum + Number(po.total_amount || 0),
          0,
        );
        const completedOrders = (s.orders || []).filter((po) => po.status !== "pending").length;
        const reliability = Math.min(
          98,
          70 + Math.min(20, s.days.length * 4) + Math.min(8, completedOrders * 2),
        );

        return {
          ...s,
          orderValue,
          reliability,
        };
      })
      .sort((a, b) => b.orderValue - a.orderValue || b.reliability - a.reliability);
  }, [suppliers]);

  const procurementStats = useMemo(() => {
    const pendingOrders = poHistory.filter((po) => po.status === "pending");
    const pendingValue = pendingOrders.reduce((sum, po) => sum + Number(po.total_amount || 0), 0);
    const suppliersWithSchedule = suppliers.filter((s) => s.days.length > 0).length;
    const scheduleCoverage = suppliers.length
      ? Math.round((suppliersWithSchedule / suppliers.length) * 100)
      : 0;

    return {
      pendingOrders: pendingOrders.length,
      pendingValue,
      scheduleCoverage,
      lowStockCount: lowStockProducts.length,
    };
  }, [poHistory, suppliers, lowStockProducts]);

  const recommendedSupplier = supplierPerformance[0];

  if (!business) return null;

  return (
    <div className="w-full p-4 md:p-8 space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 md:p-8 shadow-sm">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary/20 via-emerald-500/10 to-transparent" />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Truck className="h-3.5 w-3.5" /> Supplier operations hub
            </div>
            <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">
              Suppliers & Procurement
            </h1>
            <p className="mt-2 text-sm md:text-base text-muted-foreground">
              Manage vendor relationships, restock faster, monitor PO performance, and spot
              procurement risks before they affect sales.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={loadData}
              disabled={loading}
              className="gap-2 h-11 bg-background/80 backdrop-blur cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Dialog
              open={isAddSupplierOpen}
              onOpenChange={(open) => {
                setIsAddSupplierOpen(open);
                if (!open) {
                  setNewSupplier({ name: "", contact: "", providedItems: "" });
                  setSelectedDays(new Set());
                  setEditingSupplierId(null);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button className="gradient-violet gap-2 h-11">
                  <Plus className="h-4 w-4" /> Add Supplier
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingSupplierId ? "Edit Supplier" : "Add New Supplier"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddSupplier} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Supplier Name</Label>
                    <Input
                      required
                      value={newSupplier.name}
                      onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                      placeholder="e.g. Fresh Farms"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Info (WhatsApp ready)</Label>
                    <Input
                      value={newSupplier.contact}
                      onChange={(e) => setNewSupplier({ ...newSupplier, contact: e.target.value })}
                      placeholder="+254 700 000 000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Delivery Days</Label>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {WEEKDAYS.map((day) => (
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
                      onChange={(e) =>
                        setNewSupplier({ ...newSupplier, providedItems: e.target.value })
                      }
                      placeholder="e.g. Fresh Produce, Dairy, Beverages"
                      className="resize-none"
                      rows={3}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full gradient-violet mt-2"
                    disabled={addingSupplier}
                  >
                    {addingSupplier ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Save Supplier"
                    )}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: "Active suppliers",
            value: String(suppliers.length),
            helper: `${filteredSuppliers.length} visible after filters`,
            icon: Truck,
            tone: "from-primary/25 to-primary/5",
          },
          {
            label: "Pending PO value",
            value: formatMoney(procurementStats.pendingValue, currency),
            helper: `${procurementStats.pendingOrders} open purchase orders`,
            icon: Wallet,
            tone: "from-amber-500/25 to-amber-500/5",
          },
          {
            label: "Supplier directory",
            value: String(suppliers.length),
            helper: "Available supplier contacts for POs",
            icon: PackageCheck,
            tone: "from-emerald-500/25 to-emerald-500/5",
          },
          {
            label: "Restock alerts",
            value: String(procurementStats.lowStockCount),
            helper: "Low-stock items need action",
            icon: AlertTriangle,
            tone: "from-rose-500/25 to-rose-500/5",
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Info className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-semibold">Performance suggestions</h2>
              <p className="text-xs text-muted-foreground">
                Recommended actions to improve supplier and inventory performance.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Restock priority
              </div>
              <div className="mt-2 text-lg font-bold">
                {lowStockProducts[0]?.name || "Stock healthy"}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {lowStockProducts[0]
                  ? `${lowStockProducts.length} low-stock products need supplier follow-up.`
                  : "No low-stock products currently detected."}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Best supplier focus
              </div>
              <div className="mt-2 text-lg font-bold">{recommendedSupplier?.name || "No data"}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {recommendedSupplier
                  ? `${formatMoney(recommendedSupplier.orderValue, currency)} ordered, ${recommendedSupplier.reliability}% contact score.`
                  : "Add suppliers or enter one manually when creating a PO."}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Schedule coverage
              </div>
              <div className="mt-2 text-lg font-bold">{procurementStats.scheduleCoverage}%</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Add delivery days to every supplier to improve ordering discipline.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Next supplier actions</h2>
          </div>
          <div className="space-y-3">
            {supplierPerformance.slice(0, 3).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatMoney(s.orderValue, currency)} ordered
                  </div>
                </div>
                <span className="text-xs font-bold rounded-full bg-primary/10 text-primary px-2 py-1">
                  {s.reliability}%
                </span>
              </div>
            ))}
            {supplierPerformance.length === 0 && (
              <div className="text-sm text-muted-foreground">
                Add suppliers to see recommended actions.
              </div>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="directory" className="w-full">
        <TabsList className="mb-6 h-12 bg-muted/50 p-1">
          <TabsTrigger value="directory" className="h-10 px-6 rounded-md">
            Directory & Restock
          </TabsTrigger>
          <TabsTrigger value="analytics" className="h-10 px-6 rounded-md">
            Supplier Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="mt-0 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Supplier Directory Panel */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-5 lg:col-span-2 shadow-sm border border-border/60"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Truck className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="font-medium">Supplier Directory</div>
                  <div className="text-xs text-muted-foreground">
                    Search vendors, review contacts, and open detailed supplier profiles.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9 h-11 bg-background"
                    placeholder="Search supplier, contact, or category"
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                  />
                </div>
                <Select value={deliveryDayFilter} onValueChange={setDeliveryDayFilter}>
                  <SelectTrigger className="h-11 bg-background">
                    <SelectValue placeholder="Delivery day" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All delivery days</SelectItem>
                    {WEEKDAYS.map((day) => (
                      <SelectItem key={day} value={day}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-xl border border-border bg-background/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Supplier Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Delivery Schedule</TableHead>
                      <TableHead>Performance</TableHead>
                      <TableHead className="text-right">Pending POs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      [1, 2, 3].map((i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <div className="h-4 w-24 bg-muted animate-pulse rounded"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-4 w-32 bg-muted animate-pulse rounded"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-4 w-20 bg-muted animate-pulse rounded"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-4 w-24 bg-muted animate-pulse rounded"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-4 w-8 bg-muted animate-pulse rounded ml-auto"></div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : filteredSuppliers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No suppliers match your filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSuppliers.map((s) => {
                        const score = supplierPerformance.find((item) => item.id === s.id);
                        return (
                          <Sheet key={s.id}>
                            <SheetTrigger asChild>
                              <TableRow className="cursor-pointer group hover:bg-primary/5 transition-colors">
                                <TableCell>
                                  <div className="font-medium group-hover:text-primary transition-colors">
                                    {s.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatMoney(score?.orderValue || 0, currency)} ordered
                                  </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground">{s.contact}</TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {s.days.length > 0 ? (
                                      s.days.map((d) => (
                                        <span
                                          key={d}
                                          className="text-[10px] bg-muted text-foreground px-1.5 py-0.5 rounded"
                                        >
                                          {d}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-muted-foreground text-xs">-</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-primary"
                                        style={{ width: `${score?.reliability || 0}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-semibold">
                                      {score?.reliability || 0}%
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-muted-foreground mt-1">
                                    {formatMoney(score?.orderValue || 0, currency)} ordered
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
                                    document.dispatchEvent(
                                      new KeyboardEvent("keydown", { key: "Escape" }),
                                    );
                                  }}
                                >
                                  Create PO
                                </Button>
                                <Button
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => {
                                    document.dispatchEvent(
                                      new KeyboardEvent("keydown", { key: "Escape" }),
                                    );
                                    openEditSupplier(s);
                                  }}
                                >
                                  Edit Details
                                </Button>
                              </div>
                              <div className="py-6 space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-muted/40 p-4 rounded-xl border border-border">
                                    <div className="text-xs text-muted-foreground mb-1">
                                      Contact
                                    </div>
                                    <div className="font-medium">{s.contact}</div>
                                  </div>
                                  <div className="bg-muted/40 p-4 rounded-xl border border-border">
                                    <div className="text-xs text-muted-foreground mb-1">
                                      Delivery Days
                                    </div>
                                    <div className="font-medium">
                                      {s.days.join(", ") || "Unscheduled"}
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                    Provided Items / Categories
                                  </h4>
                                  <div className="bg-muted/30 p-4 rounded-xl border border-border text-sm whitespace-pre-wrap">
                                    {s.providedItems || (
                                      <span className="italic text-muted-foreground">
                                        No specific items listed.
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                    Order History Ledger
                                  </h4>
                                  {s.activeOrders === 0 && !s.orders?.length ? (
                                    <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-xl">
                                      No previous orders for this supplier.
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      {(s.orders || []).map((order) => (
                                        <div
                                          key={order.id}
                                          className="flex items-center justify-between p-3 border border-border rounded-lg bg-background"
                                        >
                                          <div>
                                            <div className="font-semibold text-sm">
                                              PO-{order.id.split("-")[0].toUpperCase()}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              {order.created_at
                                                ? new Date(order.created_at).toLocaleDateString()
                                                : "Unknown date"}
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <div className="font-bold">
                                              {formatMoney(
                                                Number(order.total_amount || 0),
                                                currency,
                                              )}
                                            </div>
                                            <div
                                              className={`text-[10px] font-semibold uppercase tracking-wider ${order.status === "pending" ? "text-orange-500" : "text-emerald-500"}`}
                                            >
                                              {order.status}
                                            </div>
                                            {order.status === "pending" && (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="mt-2 h-7 text-[11px]"
                                                onClick={() => markPoReceived(order.id)}
                                              >
                                                Mark received
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </SheetContent>
                          </Sheet>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </motion.div>

            {/* Smart PO Generator Panel */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-2xl flex flex-col max-h-[800px] shadow-sm border border-border/60 overflow-hidden"
            >
              <div className="p-5 border-b border-border bg-muted/20">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  <div className="font-medium">Smart PO Generator</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Low-stock items are suggested automatically. Choose a supplier contact or enter
                    one manually.
                  </p>
                </div>

                <Label className="text-xs text-muted-foreground mb-1 block">
                  Supplier to Reach
                </Label>
                <Select value={poSupplierId} onValueChange={setPoSupplierId}>
                  <SelectTrigger className="bg-background border-border shadow-sm h-10">
                    <SelectValue placeholder="Choose saved supplier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-1 gap-2 mt-3">
                  <Input
                    className="h-10 bg-background"
                    placeholder="Manual supplier name"
                    value={manualSupplierName}
                    onChange={(e) => setManualSupplierName(e.target.value)}
                    disabled={!!poSupplierId}
                  />
                  <Input
                    className="h-10 bg-background"
                    placeholder="Manual WhatsApp number"
                    value={manualSupplierContact}
                    onChange={(e) => setManualSupplierContact(e.target.value)}
                    disabled={!!poSupplierId}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/5">
                {poItems.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-12 px-4 border border-dashed rounded-xl border-border mx-2">
                    No low-stock items detected. Add a custom item below to create a manual PO.
                  </div>
                ) : (
                  poItems.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border bg-background shadow-sm transition-all ${item.quantity > 0 ? "border-emerald-500/40 ring-1 ring-emerald-500/10" : "border-border/60"}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-semibold text-sm line-clamp-1">{item.name}</div>
                          {item.productId && (
                            <div className="text-[11px] text-muted-foreground">
                              Stock {item.currentStock} / alert {item.lowStockAlert}
                            </div>
                          )}
                        </div>
                        <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm whitespace-nowrap ml-2">
                          {formatMoney(item.quantity * item.unitCost, currency)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Qty to Order
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            className="h-8 text-xs font-medium"
                            value={item.quantity || ""}
                            onChange={(e) =>
                              updatePoItem(item.id, "quantity", parseInt(e.target.value) || 0)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Unit Cost
                          </Label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              {currency}
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              className="h-8 text-xs font-medium pl-10"
                              value={item.unitCost || ""}
                              onChange={(e) =>
                                updatePoItem(item.id, "unitCost", parseFloat(e.target.value) || 0)
                              }
                            />
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-3 h-8 text-xs text-muted-foreground"
                        onClick={() => removePoItem(item.id)}
                      >
                        Remove item
                      </Button>
                    </div>
                  ))
                )}
                <div className="rounded-xl border border-dashed border-border bg-background p-3 space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Add custom PO item
                  </div>
                  <Input
                    placeholder="Item name"
                    value={customItem.name}
                    onChange={(e) => setCustomItem({ ...customItem, name: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={customItem.quantity}
                      onChange={(e) => setCustomItem({ ...customItem, quantity: e.target.value })}
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Unit cost"
                      value={customItem.unitCost}
                      onChange={(e) => setCustomItem({ ...customItem, unitCost: e.target.value })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={addCustomPoItem}
                  >
                    Add Item
                  </Button>
                </div>
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
                    <Button
                      className="h-11 font-medium gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={sharePO}
                    >
                      <Share2 className="h-4 w-4" /> WhatsApp Supplier
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all"
                    disabled={
                      poTotal === 0 || generatingPo || (!poSupplierId && !manualSupplierName.trim())
                    }
                    onClick={generatePO}
                  >
                    {generatingPo ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      "Generate & Finalize PO"
                    )}
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
                  <p className="text-xs text-muted-foreground">
                    Monthly volume of purchase orders placed.
                  </p>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="currentColor"
                      className="opacity-10"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      cursor={{ fill: "rgba(0,0,0,0.05)" }}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #eee" }}
                    />
                    <Bar
                      dataKey="orders"
                      fill="currentColor"
                      className="text-blue-500 dark:text-blue-400"
                      radius={[4, 4, 0, 0]}
                      barSize={40}
                    />
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
                <div className="text-3xl font-bold">
                  {leadTime === null ? "Not tracked" : `${leadTime.toFixed(1)} Days`}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {leadTime === null
                    ? "No received PO timestamps are available yet."
                    : "Average fulfillment speed from PO generation to inventory receipt."}
                </p>
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
                  {hasVolatilityData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={volatilityData}>
                        <XAxis dataKey="month" hide />
                        <RechartsTooltip
                          contentStyle={{ fontSize: "12px" }}
                          formatter={(value) => formatMoney(Number(value), currency)}
                        />
                        <Line
                          type="monotone"
                          dataKey="averageUnitCost"
                          stroke="#f43f5e"
                          strokeWidth={3}
                          dot={{ r: 4, fill: "#f43f5e" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground px-4">
                      No purchase order item costs recorded yet.
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Average unit-cost changes from purchase order items over 4 months
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="font-semibold">Supplier performance leaderboard</h3>
                <p className="text-xs text-muted-foreground">
                  Ranked by order value, saved contact details, reliability, and open purchase
                  orders.
                </p>
              </div>
              <span className="text-xs rounded-full bg-primary/10 text-primary px-3 py-1 font-semibold">
                {supplierPerformance.length} suppliers tracked
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {supplierPerformance.slice(0, 6).map((s) => (
                <div key={s.id} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatMoney(s.orderValue, currency)} ordered
                      </div>
                    </div>
                    <span
                      className={`text-xs font-bold rounded-full px-2 py-1 ${s.activeOrders > 0 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"}`}
                    >
                      {s.activeOrders > 0 ? `${s.activeOrders} open POs` : "Available"}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Reliability</span>
                      <span>{s.reliability}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-background overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${s.reliability}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">PO value</span>
                    <span className="font-bold">{formatMoney(s.orderValue, currency)}</span>
                  </div>
                </div>
              ))}
              {supplierPerformance.length === 0 && (
                <div className="md:col-span-2 xl:col-span-3 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  Supplier performance will appear after adding suppliers and generating purchase
                  orders.
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
