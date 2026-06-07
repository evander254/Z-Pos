import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  Download,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/format";
import { useTenant } from "@/lib/tenant-context";
import { useBusinessRealtime } from "@/lib/use-business-realtime";

export const Route = createFileRoute("/t/$slug/purchase-orders")({ component: PurchaseOrders });

type Supplier = {
  id: string;
  supplier_name: string | null;
  phone: string | null;
  email: string | null;
};

type PurchaseOrder = {
  id: string;
  supplier_id: string | null;
  supplier_name?: string | null;
  supplier_contact?: string | null;
  store_id: string | null;
  notes?: string | null;
  items_snapshot?: POItemSnapshot[] | null;
  status: string | null;
  total_amount: number | null;
  created_at: string | null;
  received_at: string | null;
};

type POItemSnapshot = {
  name: string;
  quantity: number;
  unit_cost: number;
};

type PurchaseOrderItem = {
  id?: string;
  po_id: string | null;
  product_id: string | null;
  product_name: string | null;
  quantity: number;
  unit_cost: number;
  created_at: string | null;
};

type Product = {
  id: string;
  name: string;
  stock_quantity: number | null;
  low_stock_alert: number | null;
  cost_price: number | null;
};

type StoreOption = {
  id: string;
  name: string;
  active: boolean | null;
  inventory_mode: string | null;
};

type StoreInventoryRow = {
  product_id: string;
  store_id: string;
  stock_quantity: number;
  low_stock_alert: number | null;
};

type POItemInput = {
  id: string;
  productId: string | null;
  name: string;
  quantity: string;
  unitCost: string;
};

type RestockRecommendation = {
  product: Product;
  reason: string;
  suggestedQty: number;
  stock: number;
  lowStockAlert: number;
  priority: "Zero stock" | "Low stock";
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message || "Unexpected error");
  }
  if (typeof error === "string") return error;
  return "Unexpected error";
}

function isMissingColumnError(error: unknown, column: string) {
  if (!error || typeof error !== "object") return false;
  const row = error as { code?: string; message?: string };
  return row.code === "42703" && (row.message || "").includes(column);
}

function poNumber(id: string) {
  return `PO-${id.split("-")[0].toUpperCase()}`;
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildSimplePdf(lines: string[]) {
  const pageLines = lines.slice(0, 42);
  const content = ["BT", "/F1 11 Tf", "50 790 Td"];
  pageLines.forEach((line, index) => {
    if (index > 0) content.push("0 -18 Td");
    content.push(`(${escapePdfText(line)}) Tj`);
  });
  content.push("ET");

  const stream = content.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function getSnapshotItems(value: unknown): POItemSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item as Partial<POItemSnapshot>;
      return {
        name: String(row.name || "").trim(),
        quantity: Number(row.quantity || 0),
        unit_cost: Number(row.unit_cost || 0),
      };
    })
    .filter((item) => item.name || item.quantity > 0);
}

function PurchaseOrders() {
  const { business } = useTenant();
  const currency = business?.currency || "KES";
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [orderItems, setOrderItems] = useState<PurchaseOrderItem[]>([]);
  const [poStoreColumnReady, setPoStoreColumnReady] = useState(true);
  const [search, setSearch] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [manualSupplierName, setManualSupplierName] = useState("");
  const [manualSupplierContact, setManualSupplierContact] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<POItemInput[]>([
    { id: crypto.randomUUID(), productId: null, name: "", quantity: "1", unitCost: "0" },
  ]);
  const [creating, setCreating] = useState(false);

  const selectedSupplier = suppliers.find((supplier) => supplier.id === supplierId) || null;
  const selectedStore = stores.find((store) => store.id === selectedStoreId) || null;
  const itemTotal = (item: POItemInput) =>
    Math.max(0, Number(item.quantity || 0)) * Math.max(0, Number(item.unitCost || 0));
  const poTotal = items.reduce((total, item) => total + itemTotal(item), 0);

  const filteredProducts = useMemo(() => {
    return products;
  }, [products]);

  const restockRecommendations = useMemo<RestockRecommendation[]>(() => {
    return products
      .map((product) => {
        const stock = Number(product.stock_quantity || 0);
        const hasLowStockLimit =
          product.low_stock_alert !== null && product.low_stock_alert !== undefined;
        const lowStockAlert = hasLowStockLimit ? Math.max(1, Number(product.low_stock_alert)) : 0;
        const isZeroStock = stock <= 0;
        const isLowStock = hasLowStockLimit && stock > 0 && stock <= lowStockAlert;

        if (!isZeroStock && !isLowStock) return null;

        const targetStock = Math.max(lowStockAlert * 2, lowStockAlert + 1, 1);
        return {
          product,
          stock,
          lowStockAlert,
          priority: isZeroStock ? "Zero stock" : "Low stock",
          suggestedQty: Math.max(1, Math.ceil(targetStock - stock)),
          reason: isZeroStock
            ? `Stock is zero. Reorder to restore availability.`
            : `Stock is ${stock}, at or below the low-stock limit of ${lowStockAlert}.`,
        } satisfies RestockRecommendation;
      })
      .filter((item): item is RestockRecommendation => Boolean(item))
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority === "Zero stock" ? -1 : 1;
        return a.stock - b.stock;
      })
      .slice(0, 6);
  }, [products]);

  const itemsByPo = useMemo(() => {
    return orderItems.reduce<Record<string, PurchaseOrderItem[]>>((acc, item) => {
      if (!item.po_id) return acc;
      acc[item.po_id] = [...(acc[item.po_id] || []), item];
      return acc;
    }, {});
  }, [orderItems]);

  const getDisplayItems = useCallback(
    (order: PurchaseOrder): POItemSnapshot[] => {
      const snapshotItems = getSnapshotItems(order.items_snapshot);
      if (snapshotItems.length > 0) return snapshotItems;
      return (itemsByPo[order.id] || []).map((item, index) => ({
        name: item.product_name?.trim() || `Stored PO item ${index + 1}`,
        quantity: Number(item.quantity || 0),
        unit_cost: Number(item.unit_cost || 0),
      }));
    },
    [itemsByPo],
  );

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((order) => {
      const itemNames = getDisplayItems(order)
        .map((item) => item.name)
        .join(" ");
      return [poNumber(order.id), order.supplier_name || "", order.status || "", itemNames]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [orders, search, getDisplayItems]);

  const currentOrders = filteredOrders.filter((order) => order.status === "pending");
  const completedOrders = filteredOrders.filter((order) => order.status !== "pending");
  const recentCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentOrders = completedOrders.filter((order) => {
    const time = order.created_at ? new Date(order.created_at).getTime() : 0;
    return time >= recentCutoff;
  });
  const pastOrders = completedOrders.filter((order) => {
    const time = order.created_at ? new Date(order.created_at).getTime() : 0;
    return time < recentCutoff;
  });

  async function loadData() {
    if (!business) return;
    setLoading(true);
    try {
      const { data: supplierRows, error: supplierError } = await supabase
        .from("suppliers")
        .select("id,supplier_name,phone,email")
        .eq("business_id", business.id)
        .order("supplier_name", { ascending: true });
      if (supplierError) throw supplierError;

      const { data: storeRows, error: storeError } = await supabase
        .from("stores")
        .select("id,name,active,inventory_mode")
        .eq("business_id", business.id)
        .order("name", { ascending: true });
      if (storeError) throw storeError;

      const storeList = (storeRows || []) as StoreOption[];
      setStores(storeList);
      const effectiveStoreId = selectedStoreId || storeList[0]?.id || "";
      if (!selectedStoreId && effectiveStoreId) setSelectedStoreId(effectiveStoreId);

      if (!effectiveStoreId) {
        setProducts([]);
        setOrders([]);
        setOrderItems([]);
        return;
      }

      const supplierList = (supplierRows || []) as Supplier[];
      setSuppliers(supplierList);
      const supplierNames = new Map(
        supplierList.map((supplier) => [supplier.id, supplier.supplier_name]),
      );
      const supplierContacts = new Map(
        supplierList.map((supplier) => [supplier.id, supplier.phone || supplier.email || ""]),
      );

      const { data: productRows, error: productError } = await supabase
        .from("products")
        .select("id,name,stock_quantity,low_stock_alert,cost_price")
        .eq("business_id", business.id)
        .eq("active", true)
        .order("name", { ascending: true });
      if (productError) throw productError;

      const { data: storeInventoryRows, error: storeInventoryError } = await (supabase as any)
        .from("store_inventory")
        .select("product_id,store_id,stock_quantity,low_stock_alert")
        .eq("business_id", business.id)
        .eq("store_id", effectiveStoreId);
      if (storeInventoryError) throw storeInventoryError;

      const storeInventory = (storeInventoryRows || []) as StoreInventoryRow[];
      const storeInventoryByProduct = new Map(
        storeInventory.map((row) => [row.product_id, row]),
      );
      setProducts(
        ((productRows || []) as Product[])
          .filter((product) => storeInventoryByProduct.has(product.id))
          .map((product) => {
            const allocation = storeInventoryByProduct.get(product.id);
            return {
              ...product,
              stock_quantity: allocation?.stock_quantity ?? 0,
              low_stock_alert: allocation?.low_stock_alert ?? product.low_stock_alert,
            };
          }),
      );

      let { data: poRows, error: poError } = await supabase
        .from("purchase_orders")
        .select(
          "id,supplier_id,supplier_name,supplier_contact,store_id,notes,items_snapshot,status,total_amount,created_at,received_at",
        )
        .eq("business_id", business.id)
        .eq("store_id", effectiveStoreId)
        .order("created_at", { ascending: false });

      if (isMissingColumnError(poError, "store_id")) {
        setPoStoreColumnReady(false);
        setOrders([]);
        setOrderItems([]);
        toast.error(
          "Purchase orders need the store_id database migration before store-based POs can work.",
        );
        return;
      }

      setPoStoreColumnReady(true);

      if (poError?.code === "42703") {
        const fallback = await supabase
          .from("purchase_orders")
          .select("id,supplier_id,store_id,status,total_amount,created_at")
          .eq("business_id", business.id)
          .eq("store_id", effectiveStoreId)
          .order("created_at", { ascending: false });
        poRows = (fallback.data || []).map((row) => ({
          ...row,
          store_id: row.store_id || effectiveStoreId,
          received_at: null,
          supplier_name: null,
          supplier_contact: null,
          notes: null,
          items_snapshot: [],
        }));
        poError = fallback.error;
      }

      if (poError) throw poError;

      const formattedOrders = (poRows || []).map((order) => ({
        ...order,
        supplier_name:
          order.supplier_name ||
          (order.supplier_id
            ? supplierNames.get(order.supplier_id) || "Unknown supplier"
            : "Manual supplier"),
        supplier_contact:
          order.supplier_contact ||
          (order.supplier_id ? supplierContacts.get(order.supplier_id) || null : null),
        items_snapshot: getSnapshotItems(order.items_snapshot),
      })) as PurchaseOrder[];
      setOrders(formattedOrders);

      if (formattedOrders.length === 0) {
        setOrderItems([]);
        return;
      }

      let { data: itemRows, error: itemError } = await supabase
        .from("purchase_order_items")
        .select("id,po_id,product_id,product_name,quantity,unit_cost,created_at")
        .in(
          "po_id",
          formattedOrders.map((order) => order.id),
        );

      if (itemError?.message?.includes("product_name") || itemError?.code === "42703") {
        const fallback = await supabase
          .from("purchase_order_items")
          .select("id,po_id,product_id,quantity,unit_cost,created_at")
          .in(
            "po_id",
            formattedOrders.map((order) => order.id),
          );
        itemRows = (fallback.data || []).map((row) => ({ ...row, product_name: null }));
        itemError = fallback.error;
      }

      if (itemError) throw itemError;
      setOrderItems((itemRows || []) as PurchaseOrderItem[]);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business, selectedStoreId]);

  useBusinessRealtime(business?.id, ["purchase_orders", "suppliers", "products", "stores"], loadData);

  function handleStoreChange(storeId: string) {
    setSelectedStoreId(storeId);
    setSelectedProductId("");
    setItems([
      { id: crypto.randomUUID(), productId: null, name: "", quantity: "1", unitCost: "0" },
    ]);
  }

  function updateItem(id: string, key: keyof Omit<POItemInput, "id">, value: string) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
    );
  }

  function addItem() {
    setItems((current) => [
      ...current,
      { id: crypto.randomUUID(), productId: null, name: "", quantity: "1", unitCost: "0" },
    ]);
  }

  function addInventoryItem(product: Product, quantity?: number) {
    const qty = Math.max(1, quantity || 1);
    setItems((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        productId: product.id,
        name: product.name,
        quantity: String(qty),
        unitCost: String(Number(product.cost_price || 0)),
      },
    ]);
    setSelectedProductId("");
  }

  function addSelectedProduct() {
    const product = products.find((item) => item.id === selectedProductId);
    if (!product) return;
    addInventoryItem(product);
  }

  function removeItem(id: string) {
    setItems((current) =>
      current.length === 1 ? current : current.filter((item) => item.id !== id),
    );
  }

  async function createPurchaseOrder() {
    if (!business) return;
    const validItems = items
      .map((item) => ({
        ...item,
        name: item.name.trim(),
        productId: item.productId,
        quantityNumber: Number(item.quantity || 0),
        unitCostNumber: Number(item.unitCost || 0),
      }))
      .filter((item) => item.name && item.quantityNumber > 0);

    if (!selectedSupplier && !manualSupplierName.trim()) {
      toast.error("Select a supplier or enter a manual supplier name.");
      return;
    }
    if (!selectedStoreId) {
      toast.error("Select the store this purchase order is for.");
      return;
    }
    if (!poStoreColumnReady) {
      toast.error("Apply the purchase_orders.store_id migration before creating store POs.");
      return;
    }
    if (validItems.length === 0) {
      toast.error("Add at least one PO item with a name and quantity.");
      return;
    }

    setCreating(true);
    try {
      const supplierName = selectedSupplier?.supplier_name || manualSupplierName.trim();
      const supplierContact =
        selectedSupplier?.phone || selectedSupplier?.email || manualSupplierContact.trim();
      const itemsSnapshot = validItems.map((item) => ({
        name: item.name,
        quantity: item.quantityNumber,
        unit_cost: item.unitCostNumber,
      }));

      let { data: po, error: poError } = await supabase
        .from("purchase_orders")
        .insert({
          business_id: business.id,
          store_id: selectedStoreId,
          supplier_id: selectedSupplier?.id || null,
          supplier_name: supplierName,
          supplier_contact: supplierContact || null,
          notes: notes.trim() || null,
          items_snapshot: itemsSnapshot,
          total_amount: poTotal,
          status: "pending",
        })
        .select("id")
        .single();

      if (isMissingColumnError(poError, "store_id")) {
        setPoStoreColumnReady(false);
        throw new Error("Apply the purchase_orders.store_id migration before creating store POs.");
      }

      if (poError?.code === "42703") {
        const fallback = await supabase
          .from("purchase_orders")
          .insert({
            business_id: business.id,
            store_id: selectedStoreId,
            supplier_id: selectedSupplier?.id || null,
            total_amount: poTotal,
            status: "pending",
          })
          .select("id")
          .single();
        po = fallback.data;
        poError = fallback.error;
      }
      if (poError || !po) throw poError || new Error("Failed to create purchase order.");

      const itemRows = validItems.map((item) => ({
        po_id: po.id,
        product_id: item.productId,
        product_name: item.name,
        quantity: item.quantityNumber,
        unit_cost: item.unitCostNumber,
      }));

      let { error: itemError } = await supabase.from("purchase_order_items").insert(itemRows);
      if (itemError?.message?.includes("product_name") || itemError?.code === "42703") {
        const fallbackRows = itemRows.map(({ product_name, ...item }) => item);
        const fallback = await supabase.from("purchase_order_items").insert(fallbackRows);
        itemError = fallback.error;
      }
      if (itemError) throw itemError;

      toast.success("Purchase order created");
      setSupplierId("");
      setManualSupplierName("");
      setManualSupplierContact("");
      setNotes("");
      setItems([
        { id: crypto.randomUUID(), productId: null, name: "", quantity: "1", unitCost: "0" },
      ]);
      loadData();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  async function receiveIntoStoreInventory(order: PurchaseOrder) {
    if (!business || !order.store_id) return;

    const inventoryItems = (itemsByPo[order.id] || []).filter(
      (item) => item.product_id && Number(item.quantity || 0) > 0,
    );
    if (inventoryItems.length === 0) return;

    for (const item of inventoryItems) {
      const productId = item.product_id;
      if (!productId) continue;

      const quantityReceived = Number(item.quantity || 0);
      const product = products.find((row) => row.id === productId);
      const { data: allocationRows, error: allocationError } = await (supabase as any)
        .from("store_inventory")
        .select("stock_quantity,low_stock_alert")
        .eq("business_id", business.id)
        .eq("store_id", order.store_id)
        .eq("product_id", productId);

      if (allocationError) throw allocationError;

      const allocation = (allocationRows || [])[0] as StoreInventoryRow | undefined;
      const nextStoreStock = Number(allocation?.stock_quantity || 0) + quantityReceived;

      const { error: inventoryError } = await (supabase as any).from("store_inventory").upsert(
        {
          business_id: business.id,
          store_id: order.store_id,
          product_id: productId,
          stock_quantity: nextStoreStock,
          low_stock_alert: allocation?.low_stock_alert ?? product?.low_stock_alert ?? 5,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id,product_id" },
      );

      if (inventoryError) throw inventoryError;

      if (product) {
        const { data: productRows, error: productLoadError } = await supabase
          .from("products")
          .select("stock_quantity")
          .eq("id", productId);

        if (productLoadError) throw productLoadError;

        const currentBusinessStock = Number(productRows?.[0]?.stock_quantity || 0);
        const { error: productError } = await supabase
          .from("products")
          .update({ stock_quantity: currentBusinessStock + quantityReceived })
          .eq("id", productId);

        if (productError) throw productError;
      }
    }
  }

  async function markReceived(order: PurchaseOrder) {
    try {
      await receiveIntoStoreInventory(order);

      let { error } = await supabase
        .from("purchase_orders")
        .update({ status: "received", received_at: new Date().toISOString() })
        .eq("id", order.id);

      if (error?.message?.includes("received_at") || error?.code === "42703") {
        const fallback = await supabase
          .from("purchase_orders")
          .update({ status: "received" })
          .eq("id", order.id);
        error = fallback.error;
      }
      if (error) throw error;
      toast.success("Purchase order received into store inventory");
      loadData();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  }

  function getPurchaseOrderPdf(order: PurchaseOrder) {
    const lines = getDisplayItems(order);
    const storeName = stores.find((store) => store.id === order.store_id)?.name;
    const pdfLines = [
      business?.business_name || "ZPos",
      "Purchase Order",
      `PO: ${poNumber(order.id)}`,
      ...(storeName ? [`Store: ${storeName}`] : []),
      `Date: ${order.created_at ? new Date(order.created_at).toLocaleDateString() : new Date().toLocaleDateString()}`,
      `Supplier: ${order.supplier_name || "Unknown supplier"}`,
      ...(order.supplier_contact ? [`Contact: ${order.supplier_contact}`] : []),
      "",
      "Items",
      ...lines.map(
        (item) =>
          `${item.name} - ${item.quantity} x ${formatMoney(item.unit_cost, currency)} = ${formatMoney(item.quantity * item.unit_cost, currency)}`,
      ),
      "",
      `Grand Total: ${formatMoney(Number(order.total_amount || 0), currency)}`,
      ...(order.notes ? ["", `Notes: ${order.notes}`] : []),
    ];
    return buildSimplePdf(pdfLines);
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function downloadPurchaseOrder(order: PurchaseOrder) {
    downloadBlob(getPurchaseOrderPdf(order), `${poNumber(order.id)}.pdf`);
  }

  async function whatsappPurchaseOrder(order: PurchaseOrder) {
    const lines = getDisplayItems(order);
    const storeName = stores.find((store) => store.id === order.store_id)?.name;
    const itemLines = lines
      .map((item) => `- ${item.name}: ${item.quantity} x ${formatMoney(item.unit_cost, currency)}`)
      .join("\n");
    const text = `Hello ${order.supplier_name || "Supplier"},\n\nPlease find Purchase Order ${poNumber(order.id)} from ${business?.business_name || "ZPos"}${storeName ? ` for ${storeName}` : ""}.\n\n${itemLines}\n\nTotal: ${formatMoney(Number(order.total_amount || 0), currency)}${order.notes ? `\n\nNotes: ${order.notes}` : ""}`;
    const file = new File([getPurchaseOrderPdf(order)], `${poNumber(order.id)}.pdf`, {
      type: "application/pdf",
    });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: poNumber(order.id), text, files: [file] });
      return;
    }

    downloadBlob(file, `${poNumber(order.id)}.pdf`);
    toast.info(
      "PDF downloaded. Attach it in WhatsApp if your browser cannot share files directly.",
    );
    const phone = (order.supplier_contact || "").replace(/\D/g, "");
    const fallbackText = `${text}\n\nThe PDF has been downloaded from ZPos. Please attach it to this WhatsApp chat.`;
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(fallbackText)}`
      : `https://wa.me/?text=${encodeURIComponent(fallbackText)}`;
    window.open(url, "_blank");
  }

  function OrderList({
    title,
    helper,
    orders: list,
  }: {
    title: string;
    helper: string;
    orders: PurchaseOrder[];
  }) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground">{helper}</p>
          </div>
          <span className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-bold">
            {list.length}
          </span>
        </div>
        <div className="space-y-3">
          {list.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground text-center">
              No purchase orders in this group.
            </div>
          ) : (
            list.map((order) => {
              const lines = getDisplayItems(order);
              const storeName = stores.find((store) => store.id === order.store_id)?.name;
              return (
                <div
                  key={order.id}
                  className="rounded-xl border border-border/60 bg-background/50 p-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" /> {poNumber(order.id)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {order.supplier_name || "Unknown supplier"} ·{" "}
                        {order.created_at
                          ? new Date(order.created_at).toLocaleDateString()
                          : "Unknown date"}
                      </div>
                      {storeName && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Store: {storeName}
                        </div>
                      )}
                      {order.supplier_contact && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Supplier contact: {order.supplier_contact}
                        </div>
                      )}
                    </div>
                    <div className="sm:text-right">
                      <div className="font-bold">
                        {formatMoney(Number(order.total_amount || 0), currency)}
                      </div>
                      <div
                        className={`mt-1 text-[10px] font-bold uppercase tracking-wider ${order.status === "pending" ? "text-amber-500" : "text-emerald-500"}`}
                      >
                        {order.status || "unknown"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-border/50 pt-3 space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Stored PO details
                    </div>
                    {lines.length === 0 ? (
                      <div className="text-xs text-muted-foreground">No line items recorded.</div>
                    ) : (
                      lines.map((item, index) => (
                        <div
                          key={`${order.id}-${item.name}-${index}`}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="truncate font-medium">{item.name}</span>
                          <span className="text-muted-foreground whitespace-nowrap">
                            {item.quantity} x {formatMoney(Number(item.unit_cost || 0), currency)}
                          </span>
                        </div>
                      ))
                    )}
                    {order.notes && (
                      <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Notes:</span> {order.notes}
                      </div>
                    )}
                  </div>
                  {order.status === "pending" && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => downloadPurchaseOrder(order)}
                      >
                        <Download className="h-4 w-4" /> Download PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => whatsappPurchaseOrder(order)}
                      >
                        <Share2 className="h-4 w-4" /> WhatsApp Supplier
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => markReceived(order)}
                      >
                        <Check className="h-4 w-4" /> Mark received
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  if (!business) return null;

  return (
    <div className="w-full p-4 md:p-8 space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 md:p-8 shadow-sm">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary/20 via-amber-500/10 to-transparent" />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Truck className="h-3.5 w-3.5" /> Supplier procurement
            </div>
            <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">Purchase orders</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
              View, create, and receive supplier POs for one store at a time.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              value={selectedStoreId}
              onChange={(e) => handleStoreChange(e.target.value)}
            >
              {stores.length === 0 ? (
                <option value="">No stores found</option>
              ) : (
                stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))
              )}
            </select>
            <Button variant="outline" className="gap-2" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <Clock className="h-5 w-5 text-amber-500" />
          <div className="mt-3 text-2xl font-bold">{currentOrders.length}</div>
          <div className="text-xs text-muted-foreground">Current pending POs</div>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <Check className="h-5 w-5 text-emerald-500" />
          <div className="mt-3 text-2xl font-bold">{recentOrders.length}</div>
          <div className="text-xs text-muted-foreground">Recent completed POs</div>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <FileText className="h-5 w-5 text-primary" />
          <div className="mt-3 text-2xl font-bold">
            {formatMoney(
              currentOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
              currency,
            )}
          </div>
          <div className="text-xs text-muted-foreground">Open PO value</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_24rem] gap-6">
        <div className="space-y-6">
          {!poStoreColumnReady && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300 flex gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              Apply `supabase/migrations/20260605000002_add_store_to_purchase_orders.sql` to
              enable store-based purchase orders.
            </div>
          )}
          <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 h-11"
                placeholder="Search PO number, supplier, status, or item"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading purchase orders...
            </div>
          ) : (
            <>
              <OrderList
                title="Current purchase orders"
                helper="Pending POs waiting to be received."
                orders={currentOrders}
              />
              <OrderList
                title="Recent purchase orders"
                helper="Completed POs from the last 30 days."
                orders={recentOrders}
              />
              <OrderList
                title="Past purchase orders"
                helper="Older completed purchase order history."
                orders={pastOrders}
              />
            </>
          )}
        </div>

        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm h-fit sticky top-20">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Create custom PO</h2>
          </div>
          <div className="space-y-4">
            <div>
              <Label>Store</Label>
              <select
                className="mt-1 w-full h-10 rounded-md border border-border bg-input/30 px-3 text-sm"
                value={selectedStoreId}
                onChange={(e) => handleStoreChange(e.target.value)}
              >
                {stores.length === 0 ? (
                  <option value="">Create a store first</option>
                ) : (
                  stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))
                )}
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                This PO and received stock will be tracked for this store only.
              </p>
            </div>
            <div>
              <Label>Supplier</Label>
              <select
                className="mt-1 w-full h-10 rounded-md border border-border bg-input/30 px-3 text-sm"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">Manual supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplier_name || "Unnamed supplier"}
                  </option>
                ))}
              </select>
            </div>
            {!selectedSupplier && (
              <div className="grid gap-2">
                <Input
                  placeholder="Manual supplier name"
                  value={manualSupplierName}
                  onChange={(e) => setManualSupplierName(e.target.value)}
                />
                <Input
                  placeholder="Supplier phone or WhatsApp"
                  value={manualSupplierContact}
                  onChange={(e) => setManualSupplierContact(e.target.value)}
                />
              </div>
            )}
            {selectedSupplier && (
              <div className="rounded-xl bg-muted/20 p-3 text-xs text-muted-foreground">
                Sending to {selectedSupplier.supplier_name || "selected supplier"}
                {selectedSupplier.phone ? ` · ${selectedSupplier.phone}` : ""}
              </div>
            )}

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-primary">
                  Recommended restock
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Based on zero-stock and low-stock inventory for {selectedStore?.name || "the selected store"}.
                </p>
              </div>
              {restockRecommendations.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground text-center">
                  No restock recommendations right now.
                </div>
              ) : (
                <div className="space-y-2">
                  {restockRecommendations.map((recommendation) => (
                    <div
                      key={recommendation.product.id}
                      className="rounded-lg border border-border/60 bg-background/80 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">
                            {recommendation.product.name}
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {recommendation.reason}
                          </div>
                          <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                            {recommendation.priority}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold">
                            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                              Stock {recommendation.stock}
                            </span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                              Limit {recommendation.lowStockAlert}
                            </span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 shrink-0"
                          onClick={() =>
                            addInventoryItem(recommendation.product, recommendation.suggestedQty)
                          }
                        >
                          Add {recommendation.suggestedQty}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-2">
              <Label>Add existing inventory item</Label>
              <div className="flex gap-2">
                <select
                  className="w-full h-10 rounded-md border border-border bg-input/30 px-3 text-sm"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                >
                  <option value="">Select product...</option>
                  {filteredProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} · store stock {product.stock_quantity || 0}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addSelectedProduct}
                  disabled={!selectedProductId}
                >
                  Add
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Choose from this store's inventory, or manually type a non-inventory item below.
              </p>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Item {index + 1}
                    </span>
                    {item.productId ? (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        Inventory item
                      </span>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Item name"
                    value={item.name}
                    onChange={(e) => updateItem(item.id, "name", e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Unit cost"
                      value={item.unitCost}
                      onChange={(e) => updateItem(item.id, "unitCost", e.target.value)}
                    />
                  </div>
                  <div className="text-right text-xs font-semibold text-muted-foreground">
                    {formatMoney(itemTotal(item), currency)}
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full gap-2" onClick={addItem}>
                <Plus className="h-4 w-4" /> Add another item
              </Button>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                className="mt-1 resize-none"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional delivery or payment notes"
              />
            </div>
            {suppliers.length === 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400 flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" /> Add saved suppliers in Supplier
                management, or continue with manual supplier details.
              </div>
            )}
            {stores.length === 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400 flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" /> Create a store before making
                store-based purchase orders.
              </div>
            )}
            {!poStoreColumnReady && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400 flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" /> Database migration required:
                purchase_orders.store_id is missing.
              </div>
            )}
            <div className="border-t border-border/50 pt-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">Grand total</span>
                <span className="text-xl font-bold">{formatMoney(poTotal, currency)}</span>
              </div>
              <Button
                className="w-full gradient-violet text-white border-0"
                disabled={creating || poTotal <= 0 || !selectedStoreId || !poStoreColumnReady}
                onClick={createPurchaseOrder}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create purchase order
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
