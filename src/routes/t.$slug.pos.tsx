import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useTenant } from "@/lib/tenant-context";
import { useOfflineMode } from "@/lib/offline-mode";
import { queueOfflineSale } from "@/lib/offline-sales";
import { getPackageLimits } from "@/lib/package-limits";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import {
  Plus,
  Minus,
  Trash2,
  ScanBarcode,
  Search,
  CreditCard,
  Smartphone,
  Banknote,
  Package,
  X,
  CheckCircle2,
  Camera,
  Zap,
  ZapOff,
  RefreshCw,
  Briefcase,
  Store as StoreIcon,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { BarcodeScannerModal } from "@/components/barcode-scanner-modal";
import { generateReceiptHTML } from "@/lib/receipt-templates";
import { useBusinessRealtime } from "@/lib/use-business-realtime";
import {
  getEmployeeStoreContextFn,
  getStorePosCatalogFn,
  listBusinessPosStoresFn,
  saveStorePosCatalogSnapshotFn,
} from "@/lib/employee-actions";

export const Route = createFileRoute("/t/$slug/pos")({
  validateSearch: (search: Record<string, unknown>) => ({
    storeId: typeof search.storeId === "string" ? search.storeId : undefined,
  }),
  component: POS,
});

type Product = {
  id: string;
  source_id?: string;
  item_type?: "product" | "service";
  name: string;
  price: number;
  stock_quantity: number;
  barcode: string | null;
  sku?: string | null;
  image_url: string | null;
  category_id: string | null;
  category_name?: string | null;
};
type CartItem = Product & { qty: number };
type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  loyalty_points: number | null;
};
type Category = { id: string; name: string };
type ProductRow = Product & { categories?: { name: string | null } | null };
type StoreInventoryRow = {
  product_id: string;
  stock_quantity: number;
  low_stock_alert: number | null;
};
type StoreServiceRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  active: boolean | null;
};
type PosStore = {
  id: string;
  name: string;
  active?: boolean | null;
  inventory_mode?: string | null;
};
type PosEmployee = {
  id?: string | null;
  user_id?: string | null;
  role?: string | null;
  username?: string | null;
  store_id?: string | null;
  store_name?: string | null;
  work_account_number?: string | null;
  profiles?: { full_name?: string | null } | null;
};

function getStorePosCatalogCacheKey(businessId: string, storeId: string) {
  return `zpos-store-pos-catalog:${businessId}:${storeId}`;
}

function readCachedStorePosCatalog(businessId: string, storeId: string) {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(getStorePosCatalogCacheKey(businessId, storeId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      store?: { id: string; name?: string | null; inventory_mode?: string | null } | null;
      products?: ProductRow[];
      services?: StoreServiceRow[];
      categories?: Category[];
    };
  } catch (error) {
    console.warn("Failed to read cached store POS catalog", error);
    return null;
  }
}

type SalePayload = Record<string, string | number | null>;
type SaleInsertResult = {
  data: { id: string; created_at?: string | null } | null;
  error: { message?: string; code?: string } | null;
};
type SalesInsertTable = {
  insert: (payload: SalePayload) => {
    select: () => { single: () => Promise<SaleInsertResult> };
  };
};

type LastSaleDetails = {
  id: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: string;
  cashierName: string;
  amountTendered?: number;
  changeDue?: number;
  items: { name: string; qty: number; price: number }[];
  created_at: string;
  customerName?: string;
  initialPoints?: number;
  pointsAwarded?: number;
};

function POS() {
  const { slug } = Route.useParams();
  const { storeId: selectedStoreId } = Route.useSearch();
  const nav = useNavigate();
  const { business, employee, role } = useTenant();
  const { user } = useAuth();
  const offlineMode = useOfflineMode();
  const packageLimits = getPackageLimits(business);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [saleStartedAt, setSaleStartedAt] = useState<string | null>(null);
  const [payment, setPayment] = useState<"cash" | "mpesa" | "card">("cash");
  const [processing, setProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [resolvedStoreId, setResolvedStoreId] = useState<string | null>(null);
  const [assignedStoreName, setAssignedStoreName] = useState<string | null>(null);
  const [availableStores, setAvailableStores] = useState<PosStore[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);

  // Cash Tender and Receipt States
  const [showTenderModal, setShowTenderModal] = useState(false);
  const [amountTendered, setAmountTendered] = useState("");
  const [showMpesaModal, setShowMpesaModal] = useState(false);
  const [mpesaTxCode, setMpesaTxCode] = useState("");
  const [mpesaConfirmed, setMpesaConfirmed] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastSaleDetails, setLastSaleDetails] = useState<LastSaleDetails | null>(null);

  // Customer & Loyalty States
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCustomerPrompt, setShowCustomerPrompt] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [promptCompleted, setPromptCompleted] = useState(false);
  const [redeemPoints, setRedeemPoints] = useState(0);

  // Camera Barcode Scanner integration handled via hook

  const itemsPerPage = 50;
  const currency = business?.currency || "KES";
  const taxRate = Number(business?.tax_rate ?? 16) / 100;
  const currentEmployee = employee as PosEmployee | null;
  const assignedStoreId = currentEmployee?.store_id || null;
  const assignedEffectiveStoreId = resolvedStoreId || assignedStoreId;
  const restrictedStoreId = role !== "owner" ? assignedEffectiveStoreId : null;
  const effectiveStoreId = restrictedStoreId || selectedStoreId || null;
  const canChangeStore = !restrictedStoreId;
  const requiresStoreScope = true;
  const cartStorageKey =
    business && user
      ? `zpos-active-sale:${business.id}:${user.id}:${effectiveStoreId || "all"}`
      : null;
  const hydratedCartKeyRef = useRef<string | null>(null);
  const cashierName =
    currentEmployee?.profiles?.full_name ||
    user?.user_metadata?.full_name ||
    currentEmployee?.username ||
    user?.email ||
    "Staff";

  useEffect(() => {
    if (!business || !currentEmployee) return;
    getEmployeeStoreContextFn({
      data: {
        businessId: business.id,
        employeeId: (currentEmployee as any).id,
        userId: (currentEmployee as any).user_id,
        storeId: assignedStoreId,
        workAccountNumber: (currentEmployee as any).work_account_number,
      },
    })
      .then((context) => {
        setResolvedStoreId(context.store_id || assignedStoreId || null);
        setAssignedStoreName(context.store_name || null);
      })
      .catch(() => {
        setResolvedStoreId(assignedStoreId || null);
      });
  }, [business, currentEmployee, assignedStoreId]);

  useEffect(() => {
    if (!restrictedStoreId || selectedStoreId === restrictedStoreId) return;
    nav({ to: `/t/${slug}/pos`, search: { storeId: restrictedStoreId } as any, replace: true });
  }, [restrictedStoreId, selectedStoreId, nav, slug]);

  useEffect(() => {
    if (!business) return;
    let mounted = true;

    async function loadAvailableStores() {
      setLoadingStores(true);
      try {
        const query = supabase
          .from("stores")
          .select("id,name,active,inventory_mode")
          .eq("business_id", business!.id)
          .order("name");

        const { data, error } = await query;
        if (error) throw error;
        let stores = ((data || []) as PosStore[]).filter((store) => store.active !== false);

        if (stores.length === 0) {
          const serverStores = await listBusinessPosStoresFn({
            data: { businessId: business!.id },
          });
          stores = ((serverStores.stores || []) as PosStore[]).filter(
            (store) => store.active !== false,
          );
        }

        if (mounted) {
          setAvailableStores(restrictedStoreId ? stores.filter((store) => store.id === restrictedStoreId) : stores);
        }
      } catch {
        const serverStores = await listBusinessPosStoresFn({
          data: { businessId: business!.id },
        });
        const stores = ((serverStores.stores || []) as PosStore[]).filter(
          (store) => store.active !== false,
        );
        if (mounted) {
          setAvailableStores(restrictedStoreId ? stores.filter((store) => store.id === restrictedStoreId) : stores);
        }
      } finally {
        if (mounted) setLoadingStores(false);
      }
    }

    loadAvailableStores();
    return () => {
      mounted = false;
    };
  }, [business, restrictedStoreId]);

  useEffect(() => {
    if (!cartStorageKey || typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(cartStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as {
          cart?: CartItem[];
          saleStartedAt?: string | null;
          payment?: "cash" | "mpesa" | "card";
          amountTendered?: string;
          mpesaTxCode?: string;
          mpesaConfirmed?: boolean;
          selectedCustomer?: Customer | null;
          redeemPoints?: number;
          promptCompleted?: boolean;
        };

        setCart(parsed.cart || []);
        setSaleStartedAt(parsed.saleStartedAt || null);
        setPayment(
          parsed.payment === "mpesa" && !packageLimits.mpesa ? "cash" : parsed.payment || "cash",
        );
        setAmountTendered(parsed.amountTendered || "");
        setMpesaTxCode(parsed.mpesaTxCode || "");
        setMpesaConfirmed(Boolean(parsed.mpesaConfirmed));
        setSelectedCustomer(parsed.selectedCustomer || null);
        setRedeemPoints(Number(parsed.redeemPoints || 0));
        setPromptCompleted(Boolean(parsed.promptCompleted));
      }
    } catch (error) {
      console.warn("Failed to restore active POS sale:", error);
    } finally {
      hydratedCartKeyRef.current = cartStorageKey;
    }
  }, [cartStorageKey, packageLimits.mpesa]);

  useEffect(() => {
    if (!packageLimits.mpesa && payment === "mpesa") {
      setPayment("cash");
      setMpesaTxCode("");
      setMpesaConfirmed(false);
    }
  }, [packageLimits.mpesa, payment]);

  useEffect(() => {
    if (
      !cartStorageKey ||
      hydratedCartKeyRef.current !== cartStorageKey ||
      typeof window === "undefined"
    )
      return;

    const activeSale = {
      cart,
      saleStartedAt,
      payment,
      amountTendered,
      mpesaTxCode,
      mpesaConfirmed,
      selectedCustomer,
      redeemPoints,
      promptCompleted,
    };

    if (cart.length === 0 && !selectedCustomer && !amountTendered && !mpesaTxCode) {
      localStorage.removeItem(cartStorageKey);
      return;
    }

    localStorage.setItem(cartStorageKey, JSON.stringify(activeSale));
  }, [
    cart,
    saleStartedAt,
    payment,
    amountTendered,
    mpesaTxCode,
    mpesaConfirmed,
    selectedCustomer,
    redeemPoints,
    promptCompleted,
    cartStorageKey,
  ]);

  async function loadProducts() {
    if (!business) return;
    if (requiresStoreScope && !effectiveStoreId) {
      setProducts([]);
      setCategories([]);
      setAssignedStoreName(null);
      return;
    }

    try {
      const [{ data: categoryData }, { data: storeData }] = await Promise.all([
        supabase.from("categories").select("id, name").eq("business_id", business.id).order("name"),
        effectiveStoreId
          ? supabase
              .from("stores")
              .select("id,name,inventory_mode")
              .eq("business_id", business.id)
              .eq("id", effectiveStoreId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      setCategories((categoryData || []) as Category[]);
      setAssignedStoreName((storeData as { name?: string } | null)?.name || null);

      if (!effectiveStoreId) {
        const { data: productData } = await supabase
          .from("products")
          .select(
            "id, name, price, stock_quantity, barcode, sku, image_url, category_id, categories(name)",
          )
          .eq("business_id", business.id)
          .or("active.is.null,active.eq.true")
          .order("name");

        setProducts(
          ((productData || []) as ProductRow[]).map((product) => ({
            ...product,
            source_id: product.id,
            item_type: "product",
            category_name: product.categories?.name || null,
          })),
        );
        return;
      }

      const [productResult, inventoryResult, serviceResult] = await Promise.all([
        supabase
          .from("products")
          .select(
            "id, name, price, stock_quantity, barcode, sku, image_url, category_id, categories(name)",
          )
          .eq("business_id", business.id)
          .or("active.is.null,active.eq.true")
          .order("name"),
        (supabase as any)
          .from("store_inventory")
          .select("product_id,stock_quantity,low_stock_alert")
          .eq("business_id", business.id)
          .eq("store_id", effectiveStoreId),
        (supabase as any)
          .from("store_services")
          .select("id,name,description,price,active")
          .eq("business_id", business.id)
          .eq("store_id", effectiveStoreId)
          .or("active.is.null,active.eq.true")
          .order("name"),
      ]);

      const inventoryRows = (inventoryResult.data || []) as StoreInventoryRow[];
      const inventoryByProduct = new Map(inventoryRows.map((row) => [row.product_id, row]));
      const storeProducts = ((productResult.data || []) as ProductRow[])
        .filter((product) => inventoryByProduct.has(product.id))
        .map((product) => {
          const allocation = inventoryByProduct.get(product.id);
          return {
            ...product,
            source_id: product.id,
            item_type: "product" as const,
            stock_quantity: allocation?.stock_quantity ?? 0,
            category_name: product.categories?.name || null,
          };
        });

      const storeServices = ((serviceResult.data || []) as StoreServiceRow[]).map((service) => ({
        id: `service:${service.id}`,
        source_id: service.id,
        item_type: "service" as const,
        name: service.name,
        price: Number(service.price || 0),
        stock_quantity: 999999999,
        barcode: null,
        sku: null,
        image_url: null,
        category_id: null,
        category_name: "Services",
      }));

      const clientCatalog = [...storeProducts, ...storeServices];
      if (clientCatalog.length > 0) {
        setProducts(clientCatalog);
        saveStorePosCatalogSnapshotFn({
          data: {
            businessId: business.id,
            storeId: effectiveStoreId,
            store: storeData || null,
            products: storeProducts,
            services: storeServices.map((service) => ({
              id: service.source_id || service.id.replace("service:", ""),
              name: service.name,
              description: null,
              price: service.price,
              active: true,
            })),
            categories: categoryData || [],
          },
        }).catch((error) => console.warn("Failed to save POS catalog snapshot", error));
        return;
      }

      const serverCatalog = await getStorePosCatalogFn({
        data: { businessId: business.id, storeId: effectiveStoreId },
      });
      setAssignedStoreName(serverCatalog.store?.name || assignedStoreName);
      setCategories((serverCatalog.categories || []) as Category[]);

      const serverProducts = ((serverCatalog.products || []) as ProductRow[]).map((product) => ({
        ...product,
        source_id: product.id,
        item_type: "product" as const,
        category_name: product.categories?.name || null,
      }));
      const serverServices = ((serverCatalog.services || []) as StoreServiceRow[]).map((service) => ({
        id: `service:${service.id}`,
        source_id: service.id,
        item_type: "service" as const,
        name: service.name,
        price: Number(service.price || 0),
        stock_quantity: 999999999,
        barcode: null,
        sku: null,
        image_url: null,
        category_id: null,
        category_name: "Services",
      }));

      const serverItems = [...serverProducts, ...serverServices];
      if (serverItems.length > 0) {
        setProducts(serverItems);
        return;
      }

      const cachedCatalog = readCachedStorePosCatalog(business.id, effectiveStoreId);
      setAssignedStoreName(cachedCatalog?.store?.name || assignedStoreName);
      setCategories((cachedCatalog?.categories || categories) as Category[]);

      const cachedProducts = ((cachedCatalog?.products || []) as ProductRow[]).map((product) => ({
        ...product,
        source_id: product.source_id || product.id,
        item_type: "product" as const,
        category_name: product.category_name || product.categories?.name || null,
      }));
      const cachedServices = ((cachedCatalog?.services || []) as StoreServiceRow[]).map((service) => ({
        id: service.id.startsWith("service:") ? service.id : `service:${service.id}`,
        source_id: service.id.startsWith("service:") ? service.id.replace("service:", "") : service.id,
        item_type: "service" as const,
        name: service.name,
        price: Number(service.price || 0),
        stock_quantity: 999999999,
        barcode: null,
        sku: null,
        image_url: null,
        category_id: null,
        category_name: "Services",
      }));

      setProducts([...cachedProducts, ...cachedServices]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load POS catalog");
    }
  }

  function loadCustomers() {
    if (!business) return;
    supabase
      .from("customers")
      .select("id, full_name, phone, loyalty_points")
      .eq("business_id", business.id)
      .then(({ data }) => setCustomers((data || []) as Customer[]));
  }

  useEffect(() => {
    loadProducts();
    loadCustomers();
  }, [business, effectiveStoreId, requiresStoreScope]);

  useBusinessRealtime(business?.id, ["products", "categories", "customers", "stores", "store_inventory", "store_services"], () => {
    loadProducts();
    loadCustomers();
  });

  // Reset page when product filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory]);

  useEffect(() => {
    if (!selectedCustomer) {
      setRedeemPoints(0);
      return;
    }
    setRedeemPoints((points) => Math.min(points, selectedCustomer.loyalty_points || 0));
  }, [selectedCustomer]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.barcode || "").includes(q) ||
        (p.sku || "").toLowerCase().includes(q);
      const matchesCategory =
        selectedCategory === "all" ||
        (selectedCategory === "services" ? p.item_type === "service" : false) ||
        (selectedCategory === "uncategorized"
          ? !p.category_id && p.item_type !== "service"
          : p.category_id === selectedCategory);
      return matchesSearch && matchesCategory;
    });
  }, [search, selectedCategory, products]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage]);

  function add(p: Product) {
    if (p.item_type !== "service" && p.stock_quantity <= 0) {
      toast.warning(`${p.name} is out of stock`, {
        description: "Update inventory before selling this product.",
      });
      return;
    }

    setCart((c) => {
      if (c.length === 0) setSaleStartedAt(new Date().toISOString());
      const ex = c.find((i) => i.id === p.id);
      if (p.item_type !== "service" && ex && ex.qty >= p.stock_quantity) {
        toast.warning(`Only ${p.stock_quantity} ${p.name} in stock`);
        return c;
      }
      if (ex) return c.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...c, { ...p, qty: 1 }];
    });
  }
  function change(id: string, d: number) {
    setCart((c) => {
      const next = c
        .map((i) => {
          if (i.id !== id) return i;
          const nextQty = Math.max(0, i.qty + d);
          if (i.item_type !== "service" && nextQty > i.stock_quantity) {
            toast.warning(`Only ${i.stock_quantity} ${i.name} in stock`);
            return i;
          }
          return { ...i, qty: nextQty };
        })
        .filter((i) => i.qty > 0);
      if (next.length === 0) setSaleStartedAt(null);
      return next;
    });
  }
  function remove(id: string) {
    setCart((c) => {
      const next = c.filter((i) => i.id !== id);
      if (next.length === 0) setSaleStartedAt(null);
      return next;
    });
  }

  // Barcode Scanner Integration
  const productsRef = useRef<Product[]>([]);
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  function normalizeBarcode(code: string) {
    return code
      .trim()
      .replace(/[\r\n\t ]+/g, "")
      .toLowerCase();
  }

  function findProductByScannedCode(scannedCode: string) {
    const code = normalizeBarcode(scannedCode);
    if (!code) return null;

    return (
      productsRef.current.find(
        (p) =>
          normalizeBarcode(p.barcode || "") === code ||
          normalizeBarcode(p.sku || "") === code ||
          p.id.toLowerCase() === code,
      ) || null
    );
  }

  function handleValidatedProductScan(
    scannedCode: string,
    source: "camera" | "hardware" | "manual" = "hardware",
  ) {
    const product = findProductByScannedCode(scannedCode);

    if (!product) {
      toast.warning(`Barcode not registered: "${scannedCode}"`, {
        description: "Add this barcode to a product before selling it.",
        duration: 3500,
      });
      return false;
    }

    if (product.item_type !== "service" && product.stock_quantity <= 0) {
      toast.warning(`${product.name} is out of stock`, {
        description: "This registered barcode exists, but stock is zero.",
        duration: 3000,
      });
      return false;
    }

    add(product);
    toast.success(`Added: ${product.name} (${formatMoney(product.price, currency)})`, {
      description:
        source === "camera"
          ? "Camera scan verified in inventory."
          : "Scanner input verified in inventory.",
      duration: 2000,
    });
    return true;
  }

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
      handleValidatedProductScan(scannedCode, "hardware");
    },
    continuous: true,
    debounceMs: 300,
  });

  const subtotal = cart.reduce((a, i) => a + i.price * i.qty, 0);
  const maxRedeemablePoints = selectedCustomer
    ? Math.min(selectedCustomer.loyalty_points || 0, Math.floor(subtotal))
    : 0;
  const loyaltyDiscount = Math.min(redeemPoints, maxRedeemablePoints);
  const taxableSubtotal = Math.max(0, subtotal - loyaltyDiscount);
  const tax = taxableSubtotal * taxRate;
  const total = taxableSubtotal + tax;

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
    if (!promptCompleted) {
      setShowCustomerPrompt(true);
      return;
    }

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
    if (!effectiveStoreId) {
      toast.error("Select a store before completing a sale.");
      return;
    }
    setProcessing(true);

    const savedCart = [...cart];

    const cashierId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      user.id,
    )
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

    const pointsAwarded = Math.floor(total / 100);
    const initialPoints = selectedCustomer?.loyalty_points || 0;

    const saleCompletedAt = new Date().toISOString();
    const checkoutDurationSeconds = saleStartedAt
      ? Math.max(
          0,
          Math.round(
            (new Date(saleCompletedAt).getTime() - new Date(saleStartedAt).getTime()) / 1000,
          ),
        )
      : null;
    const salePayload: SalePayload = {
      business_id: business.id,
      store_id: effectiveStoreId || null,
      cashier_id: cashierId,
      cashier_name: cashierName,
      customer_id: selectedCustomer?.id || null,
      subtotal,
      tax_amount: tax,
      discount_amount: loyaltyDiscount,
      total_amount: total,
      payment_method: storedPaymentMethod,
      status: "completed",
      amount_tendered: payment === "cash" ? (options?.cashReceived ?? null) : null,
      change_due:
        payment === "cash" && options?.cashReceived !== undefined
          ? options.cashReceived - total
          : null,
      sale_started_at: saleStartedAt,
      sale_completed_at: saleCompletedAt,
      checkout_duration_seconds: checkoutDurationSeconds,
    };

    if (!offlineMode.online) {
      const offlineSaleId = `offline-${Date.now()}`;
      const queuedItems = savedCart.map((i) => ({
        product_id: i.item_type === "service" ? null : i.source_id || i.id,
        product_name: i.name,
        quantity: i.qty,
        unit_price: i.price,
        subtotal: i.price * i.qty,
      }));
      const nextCustomerPoints = Math.max(0, initialPoints - loyaltyDiscount) + pointsAwarded;

      queueOfflineSale({
        salePayload,
        items: queuedItems,
        stockAdjustments: savedCart
          .filter((i) => i.item_type !== "service")
          .map((i) => ({
            productId: i.source_id || i.id,
            nextStock: Math.max(0, i.stock_quantity - i.qty),
            quantity: i.qty,
            storeId: effectiveStoreId,
          })),
        customerUpdate: selectedCustomer
          ? { customerId: selectedCustomer.id, loyaltyPoints: nextCustomerPoints }
          : undefined,
      });

      setLastSaleDetails({
        id: offlineSaleId,
        subtotal,
        tax,
        discount: loyaltyDiscount,
        total,
        paymentMethod: displayPayment,
        cashierName,
        amountTendered: options?.cashReceived,
        changeDue: options?.cashReceived !== undefined ? options.cashReceived - total : undefined,
        items: savedCart.map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
        created_at: saleCompletedAt,
        customerName: selectedCustomer?.full_name || undefined,
        initialPoints: selectedCustomer ? initialPoints : undefined,
        pointsAwarded: selectedCustomer ? pointsAwarded : undefined,
      });

      toast.success(
        `Sale saved offline: ${formatMoney(total, currency)}. It will sync when online.`,
      );
      if (cartStorageKey && typeof window !== "undefined") localStorage.removeItem(cartStorageKey);
      setCart([]);
      setSaleStartedAt(null);
      setProcessing(false);
      setShowTenderModal(false);
      setShowMpesaModal(false);
      setShowCardModal(false);
      setMpesaTxCode("");
      setAmountTendered("");
      setMpesaConfirmed(false);
      setShowReceiptModal(true);
      setSelectedCustomer(null);
      setRedeemPoints(0);
      setPromptCompleted(false);
      setCustomerSearch("");
      return;
    }

    const salesTable = supabase.from("sales") as unknown as SalesInsertTable;
    let { data: sale, error } = await salesTable.insert(salePayload).select().single();

    if (
      error?.message?.includes("sale_started_at") ||
      error?.message?.includes("checkout_duration_seconds") ||
      error?.code === "42703"
    ) {
      delete salePayload.sale_started_at;
      delete salePayload.sale_completed_at;
      delete salePayload.checkout_duration_seconds;
      const retry = await salesTable.insert(salePayload).select().single();
      sale = retry.data;
      error = retry.error;
    }

    if (error || !sale) {
      setProcessing(false);
      toast.error(error?.message || "Failed to complete transaction");
      return;
    }

    const items = savedCart.map((i) => ({
      sale_id: sale.id,
      product_id: i.item_type === "service" ? null : i.source_id || i.id,
      product_name: i.name,
      quantity: i.qty,
      unit_price: i.price,
      subtotal: i.price * i.qty,
    }));
    await supabase.from("sale_items").insert(items);

    // decrement stock (best-effort, client-side)
    for (const i of savedCart) {
      if (i.item_type === "service") continue;
      const productId = i.source_id || i.id;

      if (effectiveStoreId) {
        await (supabase as any).from("store_inventory").upsert(
          {
            business_id: business.id,
            store_id: effectiveStoreId,
            product_id: productId,
            stock_quantity: Math.max(0, i.stock_quantity - i.qty),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "store_id,product_id" },
        );
      }

      await supabase
        .from("products")
        .select("stock_quantity")
        .eq("id", productId)
        .maybeSingle()
        .then(async ({ data }) => {
          await supabase
            .from("products")
            .update({
              stock_quantity: Math.max(0, Number(data?.stock_quantity || 0) - i.qty),
            })
            .eq("id", productId);
        });

      await supabase.from("inventory_logs").insert({
        business_id: business.id,
        product_id: productId,
        change_type: "sale",
        quantity: -i.qty,
        notes: effectiveStoreId ? `Sale ${sale.id} for store ${effectiveStoreId}` : `Sale ${sale.id}`,
      });
    }

    if (selectedCustomer) {
      await supabase
        .from("customers")
        .update({
          loyalty_points: Math.max(0, initialPoints - loyaltyDiscount) + pointsAwarded,
        })
        .eq("id", selectedCustomer.id);
    }

    const calculatedChange = options?.cashReceived !== undefined ? options.cashReceived - total : 0;
    setLastSaleDetails({
      id: sale.id,
      subtotal,
      tax,
      discount: loyaltyDiscount,
      total,
      paymentMethod: displayPayment,
      cashierName,
      amountTendered: options?.cashReceived,
      changeDue: options?.cashReceived !== undefined ? calculatedChange : undefined,
      items: savedCart.map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
      created_at: sale.created_at || new Date().toISOString(),
      customerName: selectedCustomer?.full_name || undefined,
      initialPoints: selectedCustomer ? initialPoints : undefined,
      pointsAwarded: selectedCustomer ? pointsAwarded : undefined,
    });

    toast.success(`Sale completed: ${formatMoney(total, currency)}`);
    if (cartStorageKey && typeof window !== "undefined") {
      localStorage.removeItem(cartStorageKey);
    }
    setCart([]);
    setSaleStartedAt(null);
    setProcessing(false);
    setShowTenderModal(false);
    setShowMpesaModal(false);
    setShowCardModal(false);
    setMpesaTxCode("");
    setAmountTendered("");
    setMpesaConfirmed(false);
    setShowReceiptModal(true);

    setSelectedCustomer(null);
    setRedeemPoints(0);
    setPromptCompleted(false);
    setCustomerSearch("");

    // refresh products and customers
    loadProducts();
    loadCustomers();
  }

  function printReceipt() {
    if (!lastSaleDetails || !business) return;

    const printWindow = window.open("", "_blank", "width=600,height=600");
    if (!printWindow) {
      toast.error("Popup blocker prevented printing. Please allow popups for this site.");
      return;
    }

    const htmlContent = generateReceiptHTML(
      lastSaleDetails,
      business,
      business.receipt_type || undefined,
    );

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }

  function openStorePos(storeId: string) {
    nav({ to: `/t/${slug}/pos`, search: { storeId } as any });
  }

  function closeStorePos() {
    if (!canChangeStore) return;
    setCart([]);
    setSaleStartedAt(null);
    nav({ to: `/t/${slug}/pos`, search: {} as any });
  }

  if (!effectiveStoreId) {
    return (
      <div className="min-h-[calc(100dvh-4rem)] md:min-h-screen p-4 md:p-8 bg-background">
        <div className="w-full space-y-6">
          <div className="rounded-3xl border border-border/70 bg-card p-5 md:p-7 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <StoreIcon className="h-3.5 w-3.5" />
                  Store POS
                </div>
                <h1 className="mt-3 text-2xl md:text-3xl font-bold tracking-tight">
                  {role === "cashier"
                    ? "Select a business store to manage POS"
                    : "Select a store to start selling"}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
                  Each POS opens with only the products and services assigned to that store.
                  {role === "cashier"
                    ? " Choose the branch you are serving now, then manage sales from that store POS."
                    : " Any active user associated with this business can operate a specific store POS."}
                </p>
              </div>
              <Button variant="outline" onClick={() => nav({ to: `/t/${slug}` })}>
                Back to dashboard
              </Button>
            </div>
          </div>

          {loadingStores ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Loading stores...
            </div>
          ) : availableStores.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <StoreIcon className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <div className="mt-3 font-semibold">No stores available</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Create an active store before opening POS.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {availableStores.map((store) => {
                const assigned = assignedStoreId === store.id || resolvedStoreId === store.id;
                const cardClass = assigned
                  ? "border-primary/60 ring-2 ring-primary/10"
                  : "border-border";
                const badgeClass = assigned
                  ? "bg-primary/10 text-primary"
                  : "bg-emerald-500/10 text-emerald-700";
                return (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => openStorePos(store.id)}
                    className={`group rounded-2xl border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md ${cardClass}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="rounded-xl bg-primary/10 p-3 text-primary">
                        <StoreIcon className="h-5 w-5" />
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badgeClass}`}
                      >
                        {assigned ? "Assigned" : "Available"}
                      </span>
                    </div>
                    <div className="mt-4 text-lg font-bold text-foreground">{store.name}</div>
                    <div className="mt-1 text-xs capitalize text-muted-foreground">
                      {store.inventory_mode || "products"} POS catalog
                    </div>
                    <div className="mt-5 text-sm font-semibold text-primary group-hover:underline">
                      {role === "cashier" ? "Manage store POS" : "Open store POS"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-4rem)] md:h-screen flex flex-col md:flex-row overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto p-3 pb-[52dvh] md:p-6 md:pb-6 min-w-0">
        <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-semibold text-primary">Active Store POS</div>
            <div className="text-sm font-bold">{assignedStoreName || "Selected store"}</div>
          </div>
              {canChangeStore && (
                <Button variant="outline" size="sm" onClick={closeStorePos} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Change store
                </Button>
              )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-12"
              placeholder="Search products, services, or scan barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const entered = search.trim();
                if (!entered) return;
                const exactProduct = findProductByScannedCode(entered);
                if (exactProduct) {
                  e.preventDefault();
                  handleValidatedProductScan(entered, "manual");
                  setSearch("");
                }
              }}
            />
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
        {requiresStoreScope && (
          <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            POS catalog scoped to {assignedStoreName || "your assigned store"}. Only that store's
            stock and services are available.
          </div>
        )}
        <div className="mt-3 rounded-2xl border border-border/60 bg-card/70 p-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <div className="text-xs font-semibold">Browse by category</div>
              <div className="text-[11px] text-muted-foreground">
                Use this when scanning or searching is not needed.
              </div>
            </div>
            <select
              className="h-9 rounded-md border border-border bg-background px-3 text-xs md:hidden"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All categories</option>
              <option value="services">Services</option>
              <option value="uncategorized">Uncategorized</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="hidden md:flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${selectedCategory === "all" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-muted"}`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory("uncategorized")}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${selectedCategory === "uncategorized" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-muted"}`}
            >
              Uncategorized
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory("services")}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${selectedCategory === "services" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-muted"}`}
            >
              Services
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${selectedCategory === category.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-muted"}`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
        {products.length === 0 ? (
          <div className="mt-12 glass rounded-2xl p-10 text-center">
            <div className="text-lg font-semibold">No products or services available</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Add stock or services to {assignedStoreName || "this store"} before selling.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex flex-col">
            <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3">
              {paginatedItems.map((p) => (
                <button
                  key={p.id}
                  onClick={() => add(p)}
                  className="text-left glass rounded-xl p-2 md:p-3 flex flex-col hover:border-primary/60 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <div className="aspect-square rounded-lg overflow-hidden border border-border/40 bg-muted/40 mb-2 md:mb-3 flex items-center justify-center shrink-0">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                    ) : p.item_type === "service" ? (
                        <Briefcase className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground/40" />
                      ) : (
                        <Package className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="text-xs md:text-sm font-semibold line-clamp-2 text-foreground min-h-[32px] md:min-h-[40px]">
                    {p.name}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                    {p.category_name || "Uncategorized"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {p.item_type === "service" ? "Service" : `Stock: ${p.stock_quantity}`}
                  </div>
                  <div className="mt-1 md:mt-2 text-xs md:text-base font-bold text-primary">
                    {formatMoney(p.price, currency)}
                  </div>
                </button>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between gap-4 p-4 border-t border-border bg-muted/10 rounded-xl">
                <div className="text-xs text-muted-foreground">
                  Showing {Math.min(filtered.length, (currentPage - 1) * itemsPerPage + 1)}-
                  {Math.min(filtered.length, currentPage * itemsPerPage)} of {filtered.length}{" "}
                  items
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
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
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
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

      <aside className="contents md:flex md:w-96 md:border-l md:border-border md:bg-card/40 md:flex-col md:min-h-0">
        <div className="hidden md:block p-5 border-b border-border">
          <div className="text-sm font-medium">Current sale</div>
          <div className="text-xs text-muted-foreground">
            {cart.length} item{cart.length !== 1 ? "s" : ""}
          </div>
          {selectedCustomer && (
            <div className="mt-3 flex flex-col gap-1 bg-violet-500/10 text-violet-700 dark:text-violet-400 p-2 rounded-lg border border-violet-500/20 text-xs">
              <div className="flex justify-between items-center font-semibold">
                <span>{selectedCustomer.full_name}</span>
                <button
                  onClick={() => {
                    setSelectedCustomer(null);
                    setPromptCompleted(false);
                    setRedeemPoints(0);
                  }}
                  className="hover:underline cursor-pointer"
                >
                  Remove
                </button>
              </div>
              <div>Loyalty Points: {selectedCustomer.loyalty_points || 0}</div>
            </div>
          )}
          <div className="mt-3 rounded-xl border border-border/60 bg-background/70 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold">Customer & Loyalty</div>
                <div className="text-[10px] text-muted-foreground">
                  Check points and redeem before payment.
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setShowCustomerPrompt(true)}
              >
                {selectedCustomer ? "Change" : "Find"}
              </Button>
            </div>
            {selectedCustomer ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-muted/40 p-2">
                    <div className="text-[10px] text-muted-foreground">Available points</div>
                    <div className="font-bold">{selectedCustomer.loyalty_points || 0}</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-2">
                    <div className="text-[10px] text-muted-foreground">Max redeem</div>
                    <div className="font-bold">{maxRedeemablePoints}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max={maxRedeemablePoints}
                    className="h-9 text-xs"
                    value={redeemPoints || ""}
                    onChange={(e) =>
                      setRedeemPoints(
                        Math.min(maxRedeemablePoints, Math.max(0, parseInt(e.target.value) || 0)),
                      )
                    }
                    placeholder="Points to redeem"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 text-xs"
                    onClick={() => setRedeemPoints(maxRedeemablePoints)}
                    disabled={maxRedeemablePoints === 0}
                  >
                    Max
                  </Button>
                </div>
                {loyaltyDiscount > 0 && (
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    Redeeming {loyaltyDiscount} points as {formatMoney(loyaltyDiscount, currency)}{" "}
                    discount.
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground">
                No customer selected. Checkout can continue as guest.
              </div>
            )}
          </div>
        </div>
        <div className="hidden md:block md:flex-1 md:overflow-y-auto p-3 space-y-2">
          {cart.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-10">
              Tap a product to add
            </div>
          )}
          {cart.map((i) => (
            <div key={i.id} className="glass rounded-lg p-3 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{i.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatMoney(i.price, currency)} each
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => change(i.id, -1)}
                  className="h-7 w-7 rounded-md border border-border flex items-center justify-center cursor-pointer"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-6 text-center text-sm">{i.qty}</span>
                <button
                  onClick={() => change(i.id, 1)}
                  className="h-7 w-7 rounded-md border border-border flex items-center justify-center cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <button
                onClick={() => remove(i.id)}
                className="text-muted-foreground hover:text-destructive cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="fixed bottom-0 left-0 right-0 z-40 max-h-[62dvh] overflow-y-auto overscroll-contain border-t border-border bg-card/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-2xl backdrop-blur space-y-2 md:static md:z-auto md:max-h-none md:overflow-visible md:bg-transparent md:p-5 md:shadow-none md:backdrop-blur-none md:space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground md:hidden">
            <span>
              Current sale · {cart.length} item{cart.length !== 1 ? "s" : ""}
            </span>
            {selectedCustomer && <span className="font-medium">{selectedCustomer.full_name}</span>}
          </div>
          <div className="md:hidden max-h-32 overflow-y-auto rounded-xl border border-border/60 bg-background/70 p-2 space-y-2">
            {cart.length === 0 ? (
              <div className="py-3 text-center text-xs text-muted-foreground">
                Tap a product to add
              </div>
            ) : (
              cart.map((i) => (
                <div key={i.id} className="flex items-center gap-2 rounded-lg bg-muted/30 p-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold">{i.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatMoney(i.price, currency)} each
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => change(i.id, -1)}
                      className="h-7 w-7 rounded-md border border-border flex items-center justify-center"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center text-xs font-semibold">{i.qty}</span>
                    <button
                      onClick={() => change(i.id, 1)}
                      className="h-7 w-7 rounded-md border border-border flex items-center justify-center"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => remove(i.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatMoney(subtotal, currency)}</span>
          </div>
          {loyaltyDiscount > 0 && (
            <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
              <span>Loyalty discount</span>
              <span>-{formatMoney(loyaltyDiscount, currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Tax ({(taxRate * 100).toFixed(0)}%)</span>
            <span>{formatMoney(tax, currency)}</span>
          </div>
          <div className="flex justify-between text-lg font-semibold">
            <span>Total</span>
            <span>{formatMoney(total, currency)}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { v: "mpesa" as const, l: "M-Pesa", I: Smartphone },
              { v: "cash" as const, l: "Cash", I: Banknote },
              { v: "card" as const, l: "Card", I: CreditCard },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => {
                  if (o.v === "mpesa" && !packageLimits.mpesa) {
                    toast.error(
                      "M-Pesa integration is available on Business and Enterprise packages.",
                    );
                    return;
                  }
                  setPayment(o.v);
                }}
                aria-disabled={o.v === "mpesa" && !packageLimits.mpesa}
                className={`rounded-lg border p-2 text-xs flex flex-col items-center gap-1 ${o.v === "mpesa" && !packageLimits.mpesa ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${payment === o.v ? "border-primary bg-primary/10" : "border-border"}`}
                title={
                  o.v === "mpesa" && !packageLimits.mpesa
                    ? "Upgrade to Business or Enterprise for M-Pesa"
                    : undefined
                }
              >
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
                    <Label
                      htmlFor="inlineMpesaTxCode"
                      className="text-[10px] text-muted-foreground"
                    >
                      Transaction Code
                    </Label>
                    <Input
                      id="inlineMpesaTxCode"
                      className="uppercase tracking-widest text-xs font-bold bg-background border-emerald-500/20 focus:border-emerald-500 h-9"
                      placeholder="e.g. SBY789XYZ"
                      value={mpesaTxCode}
                      onChange={(e) => setMpesaTxCode(e.target.value)}
                    />
                  </div>
                  <label className="flex items-start gap-2 py-1 cursor-pointer select-none text-[10px] text-muted-foreground">
                    <input
                      type="checkbox"
                      className="rounded border-emerald-500/30 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 mt-0.5 cursor-pointer"
                      checked={mpesaConfirmed}
                      onChange={(e) => setMpesaConfirmed(e.target.checked)}
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
                    Swipe or insert the card manually on your physical POS terminal. Click below to
                    confirm.
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
                      <Label
                        htmlFor="inlineAmountTendered"
                        className="text-[10px] text-muted-foreground"
                      >
                        Amount Received
                      </Label>
                      <button
                        type="button"
                        onClick={() => setShowTenderModal(true)}
                        className="text-[9px] text-primary hover:underline cursor-pointer"
                      >
                        Use Numpad
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                        {currency}
                      </span>
                      <Input
                        id="inlineAmountTendered"
                        className="pl-10 text-xs font-bold bg-background h-9"
                        placeholder="0.00"
                        type="number"
                        step="0.01"
                        value={amountTendered}
                        onChange={(e) => setAmountTendered(e.target.value)}
                      />
                    </div>
                  </div>
                  {amountTendered && (
                    <div className="space-y-1 text-[11px] border-t border-border/30 pt-2 mt-1">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Cash Balance:</span>
                        <span
                          className={`font-bold ${parsedTendered >= total ? "text-green-500" : "text-destructive"}`}
                        >
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
                    {[50, 100, 200, 500, 1000].map((inc) => (
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
            {processing
              ? "Processing..."
              : payment === "mpesa"
                ? "Confirm & Complete M-Pesa"
                : payment === "cash"
                  ? `Complete Cash Sale (${formatMoney(total, currency)})`
                  : `Confirm & Complete Card Sale`}
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
              <button
                onClick={() => setShowTenderModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-muted/50 rounded-xl p-4 text-center border border-border/40">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Total Due
                </div>
                <div className="text-3xl font-extrabold text-foreground mt-1">
                  {formatMoney(total, currency)}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amountTendered" className="text-sm font-medium">
                  Amount Received
                </Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">
                    {currency}
                  </span>
                  <Input
                    id="amountTendered"
                    className="pl-14 text-2xl font-bold h-14 bg-background border-2 border-primary/20 focus:border-primary"
                    placeholder="0.00"
                    type="number"
                    step="0.01"
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 font-semibold cursor-pointer col-span-2 text-primary border-primary/20 hover:bg-primary/5"
                  onClick={handleExactCash}
                >
                  Exact Cash ({formatMoney(total, currency)})
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 font-semibold cursor-pointer text-destructive hover:bg-destructive/5 border-destructive/20"
                  onClick={() => setAmountTendered("")}
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 font-semibold cursor-pointer"
                  onClick={() => handleQuickCash(50)}
                >
                  +50
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 font-semibold cursor-pointer"
                  onClick={() => handleQuickCash(100)}
                >
                  +100
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 font-semibold cursor-pointer"
                  onClick={() => handleQuickCash(200)}
                >
                  +200
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 font-semibold cursor-pointer"
                  onClick={() => handleQuickCash(500)}
                >
                  +500
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 font-semibold cursor-pointer"
                  onClick={() => handleQuickCash(1000)}
                >
                  +1000
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 font-semibold cursor-pointer"
                  onClick={() => handleQuickCash(2000)}
                >
                  +2000
                </Button>
              </div>

              <div className="p-4 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-muted-foreground text-sm">
                    {parsedTendered >= total ? "Change Due:" : "Balance Due (Outstanding):"}
                  </span>
                  <span
                    className={`text-2xl font-bold ${parsedTendered >= total ? "text-green-500" : "text-destructive font-semibold"}`}
                  >
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
              <button
                onClick={() => setShowMpesaModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-emerald-500/10 rounded-xl p-4 text-center border border-emerald-500/20">
                <div className="text-xs uppercase tracking-wider text-emerald-700 font-semibold">
                  Total Amount Due
                </div>
                <div className="text-3xl font-extrabold text-emerald-600 mt-1">
                  {formatMoney(total, currency)}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mpesaTxCode" className="text-sm font-medium">
                  Transaction Code
                </Label>
                <Input
                  id="mpesaTxCode"
                  className="text-lg font-bold h-12 uppercase tracking-widest bg-background border-2 border-emerald-500/20 focus:border-emerald-500"
                  placeholder="e.g. SBY789XYZ"
                  value={mpesaTxCode}
                  onChange={(e) => setMpesaTxCode(e.target.value)}
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">
                  Confirm that the client has sent the funds to your M-Pesa Till/Paybill number
                  before proceeding.
                </p>
              </div>

              <label className="flex items-start gap-2 py-1 cursor-pointer select-none text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="rounded border-emerald-500/30 text-emerald-600 focus:ring-emerald-500 h-4 w-4 mt-0.5 cursor-pointer"
                  checked={mpesaConfirmed}
                  onChange={(e) => setMpesaConfirmed(e.target.checked)}
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
              <button
                onClick={() => setShowCardModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-500/10 rounded-xl p-4 text-center border border-blue-500/20">
                <div className="text-xs uppercase tracking-wider text-blue-700 font-semibold">
                  Total Amount Due
                </div>
                <div className="text-3xl font-extrabold text-blue-600 mt-1">
                  {formatMoney(total, currency)}
                </div>
              </div>

              <div className="glass border-amber-500/30 bg-amber-500/10 rounded-xl p-4 flex flex-col gap-2">
                <div className="text-sm font-semibold text-amber-500">Integration Notice</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Card terminal integration is{" "}
                  <span className="font-semibold text-amber-600">not available at the moment</span>.
                  Please swipe or insert the client's card manually on your physical POS merchant
                  terminal, verify that it was approved, and confirm offline below.
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
              <p className="text-xs text-muted-foreground mt-1">
                Sale reference: #{lastSaleDetails.id.substring(0, 8).toUpperCase()}
              </p>
            </div>

            {/* Virtual Paper Receipt */}
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="bg-[#FAF9F5] text-slate-800 p-5 rounded-xl border border-amber-100 shadow-inner font-mono text-xs max-w-sm mx-auto my-2">
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
                  const previewPaymentLower = lastSaleDetails.paymentMethod.toLowerCase();
                  const previewMpesaMatch = previewPaymentLower.match(/ref:\s*([a-z0-9]+)/i);
                  const previewMpesaRef = previewMpesaMatch
                    ? previewMpesaMatch[1].toUpperCase()
                    : null;
                  const previewIsCard = previewPaymentLower.includes("card");
                  return (
                    <>
                      <div className="space-y-0.5">
                        <div>
                          <b>Receipt:</b> #{lastSaleDetails.id.substring(0, 8).toUpperCase()}
                        </div>
                        <div>
                          <b>Date:</b> {new Date(lastSaleDetails.created_at).toLocaleString()}
                        </div>
                        <div>
                          <b>Cashier:</b> {lastSaleDetails.cashierName}
                        </div>
                        <div>
                          <b>Payment:</b>{" "}
                          {previewIsCard
                            ? "CARD (DETAILS N/A)"
                            : lastSaleDetails.paymentMethod.toUpperCase()}
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
                        {lastSaleDetails.items.map((item, idx) => (
                          <div key={idx}>
                            <div className="flex justify-between">
                              <span>
                                {item.qty}x {item.name}
                              </span>
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
                        {lastSaleDetails.discount > 0 && (
                          <div className="flex justify-between text-emerald-700">
                            <span>Loyalty Discount</span>
                            <span>-{formatMoney(lastSaleDetails.discount, currency)}</span>
                          </div>
                        )}
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
                            {lastSaleDetails.changeDue !== undefined &&
                            lastSaleDetails.changeDue >= 0 ? (
                              <div className="flex justify-between font-semibold text-slate-700">
                                <span>Change Due</span>
                                <span>{formatMoney(lastSaleDetails.changeDue, currency)}</span>
                              </div>
                            ) : (
                              <div className="flex justify-between font-semibold text-destructive">
                                <span>Outstanding Balance</span>
                                <span>
                                  {formatMoney(Math.abs(lastSaleDetails.changeDue || 0), currency)}
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

      {/* Modal - Customer Prompt */}
      {showCustomerPrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Assign Customer</h2>
              <button
                onClick={() => setShowCustomerPrompt(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <Button
                variant="outline"
                className="w-full h-12 justify-center font-medium cursor-pointer"
                onClick={() => {
                  setSelectedCustomer(null);
                  setPromptCompleted(true);
                  setShowCustomerPrompt(false);
                  setTimeout(handleCharge, 0);
                }}
              >
                Checkout as Guest
              </Button>
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or Search Customer</span>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 h-12"
                  placeholder="Search by name or phone..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2 rounded-xl p-1">
                {customers.filter(
                  (c) =>
                    c.full_name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                    (c.phone && c.phone.includes(customerSearch)),
                ).length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-4 border border-border rounded-lg bg-muted/20">
                    No customers found
                  </div>
                ) : (
                  customers
                    .filter(
                      (c) =>
                        c.full_name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                        (c.phone && c.phone.includes(customerSearch)),
                    )
                    .map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setPromptCompleted(true);
                          setShowCustomerPrompt(false);
                          setTimeout(handleCharge, 0);
                        }}
                        className="w-full text-left p-3 rounded-lg bg-muted/30 hover:bg-muted border border-border transition-colors flex justify-between items-center cursor-pointer"
                      >
                        <div>
                          <div className="font-semibold text-sm">{c.full_name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {c.phone || "No phone"}
                          </div>
                        </div>
                        <div className="text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-500/10 px-2 py-1 rounded-md">
                          Pts: {c.loyalty_points || 0}
                        </div>
                      </button>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <BarcodeScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanResult={(code) => handleValidatedProductScan(code, "camera")}
        validateCode={(code) => {
          const product = findProductByScannedCode(code);
          if (!product) return { valid: false, message: `Barcode not registered: ${code}` };
          if (product.item_type !== "service" && product.stock_quantity <= 0)
            return { valid: false, message: `${product.name} is out of stock` };
          const existingQty = cart.find((item) => item.id === product.id)?.qty || 0;
          if (product.item_type !== "service" && existingQty >= product.stock_quantity)
            return { valid: false, message: `${product.name} stock limit reached` };
          return {
            valid: true,
            productName: product.name,
            stock: product.item_type === "service" ? undefined : product.stock_quantity - existingQty,
          };
        }}
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
