import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { formatLimit, getPackageLimits } from "@/lib/package-limits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import {
  Plus,
  Package,
  Edit,
  Upload,
  Trash2,
  Image as ImageIcon,
  Camera,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Store,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { BarcodeScannerModal } from "@/components/barcode-scanner-modal";
import { saveStorePosCatalogSnapshotFn } from "@/lib/employee-actions";

export const Route = createFileRoute("/t/$slug/products/$storeId")({ component: Products });

type Product = {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  low_stock_alert: number | null;
  barcode: string | null;
  sku: string | null;
  image_url: string | null;
  category_id: string | null;
  category_name?: string | null;
};

type Category = {
  id: string;
  name: string;
};

type StoreOption = {
  id: string;
  name: string;
  active: boolean | null;
  inventory_mode?: string | null;
};

type StoreInventoryRow = {
  product_id: string;
  store_id: string;
  stock_quantity: number;
  low_stock_alert: number | null;
};

type StoreInventoryUpsert = {
  business_id: string;
  store_id: string;
  product_id: string;
  stock_quantity: number;
  low_stock_alert: number | null;
  updated_at: string;
};

type SupabaseQueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type StoreInventoryQuery<T> = PromiseLike<SupabaseQueryResult<T>> & {
  eq(column: string, value: string): StoreInventoryQuery<T>;
};

type StoreInventoryClient = {
  from(table: "store_inventory"): {
    select(columns: string): StoreInventoryQuery<StoreInventoryRow[]>;
    upsert(
      payload: StoreInventoryUpsert,
      options: { onConflict: string },
    ): PromiseLike<SupabaseQueryResult<null>>;
  };
};

type StoreService = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number | null;
  active: boolean | null;
};

type StoreServicePayload = {
  business_id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number | null;
  active: boolean;
  updated_at: string;
};

type StoreServiceQuery<T> = PromiseLike<SupabaseQueryResult<T>> & {
  eq(column: string, value: string | boolean): StoreServiceQuery<T>;
  order(column: string, options?: { ascending?: boolean }): StoreServiceQuery<T>;
};

type StoreServicesClient = {
  from(table: "store_services"): {
    select(columns: string): StoreServiceQuery<StoreService[]>;
    insert(payload: StoreServicePayload): {
      select(columns: string): {
        single(): PromiseLike<SupabaseQueryResult<StoreService>>;
      };
    };
    update(payload: Partial<StoreServicePayload>): {
      eq(column: string, value: string): PromiseLike<SupabaseQueryResult<null>>;
    };
  };
};

type ProductRow = Product & {
  categories?: { name: string | null } | null;
};

function getStorePosCatalogCacheKey(businessId: string, storeId: string) {
  return `zpos-store-pos-catalog:${businessId}:${storeId}`;
}

const emptyProductForm = {
  name: "",
  price: "",
  stock_quantity: "0",
  low_stock_alert: "5",
  barcode: "",
  sku: "",
  category_id: "",
};

const emptyServiceForm = {
  name: "",
  description: "",
  price: "",
  duration_minutes: "",
  active: true,
};

function Products() {
  const { business } = useTenant();
  const [list, setList] = useState<Product[]>([]);
  const [services, setServices] = useState<StoreService[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const { storeId } = Route.useParams();
  const selectedStoreId = storeId;
  const [storeStockDrafts, setStoreStockDrafts] = useState<Record<string, string>>({});
  const [savingStoreStockId, setSavingStoreStockId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingService, setEditingService] = useState<StoreService | null>(null);
  const [form, setForm] = useState(emptyProductForm);
  const [serviceForm, setServiceForm] = useState(emptyServiceForm);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currency = business?.currency || "KES";
  const packageLimits = getPackageLimits(business);

  const openRef = useRef(open);
  const listRef = useRef(list);

  useEffect(() => {
    openRef.current = open;
    listRef.current = list;
  }, [open, list]);

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
      if (openRef.current) {
        setForm((prev) => ({ ...prev, barcode: scannedCode }));
        toast.success(`Scanned barcode: ${scannedCode}`);
      } else {
        const existing = listRef.current.find(
          (p) => p.barcode === scannedCode || p.sku === scannedCode,
        );
        if (existing) {
          toast.info(`Product found: ${existing.name}`, {
            description: `Stock: ${existing.stock_quantity} | Price: ${formatMoney(existing.price, currency)}`,
            duration: 5000,
          });
          openEditDialog(existing);
        } else {
          toast.success(`New barcode scanned: ${scannedCode}. Opening registration.`);
          openAddDialog();
          setForm((prev) => ({ ...prev, barcode: scannedCode }));
        }
      }
    },
    continuous: false,
  });

  const load = useCallback(async () => {
    if (!business) return;
    const [
      { data: productData, error: productError },
      { data: categoryData, error: categoryError },
      { data: storeData, error: storeError },
      { data: storeInventoryData, error: storeInventoryError },
      { data: serviceData, error: serviceError },
    ] = await Promise.all([
      supabase
        .from("products")
        .select(
          "id,name,price,stock_quantity,low_stock_alert,barcode,sku,image_url,category_id,categories(name)",
        )
        .eq("business_id", business.id)
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("id,name").eq("business_id", business.id).order("name"),
      supabase.from("stores").select("id,name,active,inventory_mode").eq("business_id", business.id).order("name"),
      (supabase as unknown as StoreInventoryClient)
        .from("store_inventory")
        .select("product_id,store_id,stock_quantity,low_stock_alert")
        .eq("business_id", business.id)
        .eq("store_id", selectedStoreId),
      (supabase as unknown as StoreServicesClient)
        .from("store_services")
        .select("id,name,description,price,duration_minutes,active")
        .eq("business_id", business.id)
        .eq("store_id", selectedStoreId)
        .order("name"),
    ]);

    if (productError) toast.error(productError.message);
    if (categoryError) toast.error(categoryError.message);
    if (storeError) toast.error(storeError.message);
    if (storeInventoryError) toast.error(storeInventoryError.message);
    if (serviceError) toast.error(serviceError.message);

    setCategories((categoryData || []) as Category[]);
    setStores((storeData || []) as StoreOption[]);
    const drafts: Record<string, string> = {};
    const storeInventoryRows = (storeInventoryData || []) as StoreInventoryRow[];
    const storeProductIds = new Set(storeInventoryRows.map((row) => row.product_id));
    const inventoryByProduct = new Map(storeInventoryRows.map((row) => [row.product_id, row]));
    const storeProducts = ((productData || []) as ProductRow[])
      .filter((p) => storeProductIds.has(p.id))
      .map((p) => {
        const allocation = inventoryByProduct.get(p.id);
        return {
          ...p,
          stock_quantity: allocation?.stock_quantity ?? p.stock_quantity ?? 0,
          low_stock_alert: allocation?.low_stock_alert ?? p.low_stock_alert ?? null,
          category_name: p.categories?.name || null,
        };
      }) as Product[];
    storeInventoryRows.forEach((row) => {
      drafts[`${row.store_id}:${row.product_id}`] = String(row.stock_quantity ?? 0);
    });
    setStoreStockDrafts(drafts);
    setList(storeProducts);
    setServices((serviceData || []) as StoreService[]);

    if (typeof window !== "undefined") {
      const currentStore = ((storeData || []) as StoreOption[]).find((store) => store.id === selectedStoreId);
      const activeServices = ((serviceData || []) as StoreService[]).filter(
        (service) => service.active !== false,
      );
      localStorage.setItem(
        getStorePosCatalogCacheKey(business.id, selectedStoreId),
        JSON.stringify({
          store: currentStore || null,
          products: storeProducts,
          services: activeServices,
          categories: categoryData || [],
          savedAt: new Date().toISOString(),
        }),
      );

      saveStorePosCatalogSnapshotFn({
        data: {
          businessId: business.id,
          storeId: selectedStoreId,
          store: currentStore || null,
          products: storeProducts,
          services: activeServices,
          categories: categoryData || [],
        },
      }).catch((error) => console.warn("Failed to save POS catalog snapshot", error));
    }
  }, [business, selectedStoreId]);

  useEffect(() => {
    load();
    if (!business) return;
    let reloadTimer: number | null = null;
    const scheduleLoad = () => {
      if (reloadTimer) window.clearTimeout(reloadTimer);
      reloadTimer = window.setTimeout(() => load(), 250);
    };

    const channel = supabase
      .channel(`inventory-${business.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `business_id=eq.${business.id}`,
        },
        scheduleLoad,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "categories",
          filter: `business_id=eq.${business.id}`,
        },
        scheduleLoad,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "store_inventory",
          filter: `store_id=eq.${selectedStoreId}`,
        },
        scheduleLoad,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "store_services",
          filter: `store_id=eq.${selectedStoreId}`,
        },
        scheduleLoad,
      )
      .subscribe();

    return () => {
      if (reloadTimer) window.clearTimeout(reloadTimer);
      supabase.removeChannel(channel);
    };
  }, [business, load, selectedStoreId]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setEditingProduct(null);
      setForm(emptyProductForm);
      setNewCategoryName("");
      setImageFile(null);
      setImagePreview(null);
    }
  }

  function handleServiceOpenChange(isOpen: boolean) {
    setServiceOpen(isOpen);
    if (!isOpen) {
      setEditingService(null);
      setServiceForm(emptyServiceForm);
    }
  }

  function openAddServiceDialog() {
    setEditingService(null);
    setServiceForm(emptyServiceForm);
    setServiceOpen(true);
  }

  function openEditServiceDialog(service: StoreService) {
    setEditingService(service);
    setServiceForm({
      name: service.name,
      description: service.description || "",
      price: String(service.price),
      duration_minutes: service.duration_minutes === null ? "" : String(service.duration_minutes),
      active: service.active !== false,
    });
    setServiceOpen(true);
  }

  async function saveService(e: React.FormEvent) {
    e.preventDefault();
    if (!business) return;
    setSaving(true);

    try {
      const payload: StoreServicePayload = {
        business_id: business.id,
        store_id: selectedStoreId,
        name: serviceForm.name.trim(),
        description: serviceForm.description.trim() || null,
        price: Number(serviceForm.price) || 0,
        duration_minutes: serviceForm.duration_minutes
          ? Number(serviceForm.duration_minutes) || null
          : null,
        active: serviceForm.active,
        updated_at: new Date().toISOString(),
      };

      if (!payload.name) throw new Error("Service name is required");

      if (editingService) {
        const { error } = await (supabase as unknown as StoreServicesClient)
          .from("store_services")
          .update(payload)
          .eq("id", editingService.id);

        if (error) throw error;
        toast.success("Service updated");
      } else {
        const { error } = await (supabase as unknown as StoreServicesClient)
          .from("store_services")
          .insert(payload)
          .select("id,name,description,price,duration_minutes,active")
          .single();

        if (error) throw error;
        toast.success("Service added");
      }

      setServiceOpen(false);
      setEditingService(null);
      setServiceForm(emptyServiceForm);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save service");
    } finally {
      setSaving(false);
    }
  }

  function openAddDialog() {
    if (packageLimits.maxProducts !== null && list.length >= packageLimits.maxProducts) {
      toast.error(
        `${packageLimits.name} allows up to ${formatLimit(packageLimits.maxProducts)} products. Upgrade to Business for unlimited products.`,
      );
      return;
    }
    setEditingProduct(null);
    setForm(emptyProductForm);
    setNewCategoryName("");
    setImageFile(null);
    setImagePreview(null);
    setOpen(true);
  }

  function openEditDialog(p: Product) {
    setEditingProduct(p);
    setForm({
      name: p.name,
      price: String(p.price),
      stock_quantity: String(p.stock_quantity),
      low_stock_alert: String(p.low_stock_alert ?? 5),
      barcode: p.barcode || "",
      sku: p.sku || "",
      category_id: p.category_id || "",
    });
    setNewCategoryName("");
    setImageFile(null);
    setImagePreview(p.image_url);
    setOpen(true);
  }

  async function getOrCreateCategoryId() {
    if (!business) return form.category_id || null;

    const name = newCategoryName.trim();
    if (!name) return form.category_id || null;

    const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;

    const { data, error } = await supabase
      .from("categories")
      .insert({ business_id: business.id, name })
      .select("id,name")
      .single();

    if (error) throw error;

    const category = data as Category;
    setCategories((prev) => [...prev, category].sort((a, b) => a.name.localeCompare(b.name)));
    return category.id;
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!business) return;
    setSaving(true);

    try {
      let uploadedUrl = null;

      if (imagePreview) {
        if (imageFile) {
          // Attempt to create bucket if it doesn't exist (fails silently if exists)
          try {
            await supabase.storage.createBucket("productts", { public: true });
          } catch (_) {
            // ignore
          }

          const fileExt = imageFile.name.split(".").pop();
          const fileName = `${business.id}/${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("productts")
            .upload(fileName, imageFile, { upsert: true });

          if (uploadError) {
            toast.error("Failed to upload image: " + uploadError.message);
            setSaving(false);
            return;
          }

          const {
            data: { publicUrl },
          } = supabase.storage.from("productts").getPublicUrl(fileName);

          uploadedUrl = publicUrl;
        } else {
          // Keep existing image
          uploadedUrl = editingProduct?.image_url || null;
        }
      } else {
        // Image was cleared/deleted
        uploadedUrl = null;
      }

      const categoryId = await getOrCreateCategoryId();

      if (
        !editingProduct &&
        packageLimits.maxProducts !== null &&
        list.length >= packageLimits.maxProducts
      ) {
        throw new Error(
          `${packageLimits.name} allows up to ${formatLimit(packageLimits.maxProducts)} products. Upgrade to Business for unlimited products.`,
        );
      }

      const productPayload = {
        business_id: business.id,
        name: form.name,
        price: Number(form.price) || 0,
        stock_quantity: Number(form.stock_quantity) || 0,
        low_stock_alert: Number(form.low_stock_alert) || 0,
        barcode: form.barcode || null,
        sku: form.sku || null,
        category_id: categoryId,
        image_url: uploadedUrl,
        active: true,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(productPayload)
          .eq("id", editingProduct.id);

        if (error) throw error;
        toast.success("Product updated");
      } else {
        const { data, error } = await supabase
          .from("products")
          .insert(productPayload)
          .select("id")
          .single();

        if (error) throw error;

        const { error: storeInventoryError } = await (supabase as unknown as StoreInventoryClient)
          .from("store_inventory")
          .upsert(
            {
              business_id: business.id,
              store_id: selectedStoreId,
              product_id: data.id,
              stock_quantity: Number(form.stock_quantity) || 0,
              low_stock_alert: Number(form.low_stock_alert) || 0,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "store_id,product_id" },
          );

        if (storeInventoryError) throw storeInventoryError;
        toast.success("Product added");
      }

      setOpen(false);
      setForm(emptyProductForm);
      setNewCategoryName("");
      setImageFile(null);
      setImagePreview(null);
      setEditingProduct(null);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setSaving(false);
    }
  }

  async function createCategory() {
    if (!business) return;
    const name = newCategoryName.trim();
    if (!name) return;

    const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setForm((prev) => ({ ...prev, category_id: existing.id }));
      setNewCategoryName("");
      return;
    }

    const { data, error } = await supabase
      .from("categories")
      .insert({ business_id: business.id, name })
      .select("id,name")
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    const category = data as Category;
    setCategories((prev) => [...prev, category].sort((a, b) => a.name.localeCompare(b.name)));
    setForm((prev) => ({ ...prev, category_id: category.id }));
    setNewCategoryName("");
    toast.success("Category added");
  }

  function getStoreStock(product: Product) {
    if (selectedStoreId === "all") return product.stock_quantity;
    const draft = storeStockDrafts[`${selectedStoreId}:${product.id}`];
    return draft === undefined ? 0 : Number(draft) || 0;
  }

  async function saveStoreStock(product: Product) {
    if (!business || selectedStoreId === "all") return;
    setSavingStoreStockId(product.id);
    try {
      const stockQuantity = Number(storeStockDrafts[`${selectedStoreId}:${product.id}`] || 0);
      const { error } = await (supabase as unknown as StoreInventoryClient).from("store_inventory").upsert(
        {
          business_id: business.id,
          store_id: selectedStoreId,
          product_id: product.id,
          stock_quantity: stockQuantity,
          low_stock_alert: product.low_stock_alert,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id,product_id" },
      );

      if (error) throw error;
      toast.success(`${product.name} stock updated for selected store`);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update store stock");
    } finally {
      setSavingStoreStockId(null);
    }
  }

  const inventoryStats = useMemo(() => {
    const totalProducts = list.length;
    const lowStock = list.filter((p) => getStoreStock(p) <= (p.low_stock_alert ?? 0)).length;
    const outOfStock = list.filter((p) => getStoreStock(p) <= 0).length;
    const inventoryValue = list.reduce(
      (sum, p) => sum + Number(p.price || 0) * Number(getStoreStock(p) || 0),
      0,
    );
    return { totalProducts, lowStock, outOfStock, inventoryValue };
  }, [list, selectedStoreId, storeStockDrafts]);

  const filteredList = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return list.filter((p) => {
      const stock = getStoreStock(p);
      const low = stock <= (p.low_stock_alert ?? 0);
      const matchesSearch =
        !query ||
        p.name.toLowerCase().includes(query) ||
        (p.sku || "").toLowerCase().includes(query) ||
        (p.barcode || "").toLowerCase().includes(query);
      const matchesCategory =
        categoryFilter === "all" ||
        (categoryFilter === "uncategorized" ? !p.category_id : p.category_id === categoryFilter);
      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "low" ? low && stock > 0 : stockFilter === "out" ? stock <= 0 : !low);
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [list, searchQuery, categoryFilter, stockFilter, selectedStoreId, storeStockDrafts]);

  const filteredServices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return services.filter((service) => {
      return (
        !query ||
        service.name.toLowerCase().includes(query) ||
        (service.description || "").toLowerCase().includes(query)
      );
    });
  }, [services, searchQuery]);

  const serviceStats = useMemo(() => {
    const activeServices = services.filter((service) => service.active !== false).length;
    const averagePrice = services.length
      ? services.reduce((sum, service) => sum + Number(service.price || 0), 0) / services.length
      : 0;
    return { activeServices, averagePrice };
  }, [services]);

  const currentStore = stores.find((s) => s.id === selectedStoreId);
  const currentMode = currentStore?.inventory_mode || "products";

  const isServiceOnly = currentMode === "services";
  const supportsServices = currentMode === "services" || currentMode === "both";
  const supportsProducts = currentMode === "products" || currentMode === "both";

  return (
    <div className="w-full p-6 md:p-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {currentStore
              ? `${isServiceOnly ? "Services" : "Inventory"}: ${currentStore.name}`
              : "Inventory"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage {isServiceOnly ? "services" : "products and stock"} for this specific store.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/t/$slug/products" params={{ slug: business?.slug || '' }}>
            <Button variant="ghost" className="cursor-pointer text-muted-foreground">
              ← Back to Stores
            </Button>
          </Link>
          <Button variant="outline" onClick={load} className="cursor-pointer">
            Refresh inventory
          </Button>
          {supportsProducts && (
            <Button
              onClick={openAddDialog}
              disabled={stores.length === 0}
              className="gradient-violet text-white border-0 cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-1" /> New product
            </Button>
          )}
          {supportsServices && (
            <Button
              onClick={openAddServiceDialog}
              disabled={stores.length === 0}
              className="gradient-violet text-white border-0 cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-1" /> New service
            </Button>
          )}
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingProduct ? "Edit Product" : "Add Product"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={saveProduct} className="space-y-4 mt-2">
              <div>
                <Label>Product Image</Label>
                <div className="mt-1.5 flex items-center gap-4">
                  {imagePreview ? (
                    <div className="relative h-16 w-16 rounded-lg overflow-hidden border border-border">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview(null);
                        }}
                        className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                        title="Remove image"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-muted border border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-secondary text-secondary-foreground text-xs font-medium cursor-pointer hover:bg-secondary/80 transition-colors">
                      <Upload className="h-3.5 w-3.5" />
                      {imagePreview ? "Change Image" : "Upload Image"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </label>
                    <p className="text-[10px] text-muted-foreground mt-1">PNG, JPG up to 5MB</p>
                  </div>
                </div>
              </div>

              <div>
                <Label>Name</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Product category</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                >
                  <option value="">Uncategorized</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Or type a new category"
                  />
                  <Button type="button" variant="outline" onClick={createCategory}>
                    Add
                  </Button>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Select a saved category or type a new one. New categories are saved to the
                  database when you create the product.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Price ({currency})</Label>
                  <Input
                    required
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                </div>
                {!isServiceOnly && (
                  <div>
                    <Label>Stock</Label>
                    <Input
                      type="number"
                      value={form.stock_quantity}
                      onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {!isServiceOnly && (
                  <div>
                    <Label>Low stock alert</Label>
                    <Input
                      type="number"
                      value={form.low_stock_alert}
                      onChange={(e) => setForm({ ...form, low_stock_alert: e.target.value })}
                    />
                  </div>
                )}
                <div>
                  <Label>SKU</Label>
                  <Input
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Barcode</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    placeholder="Scan or enter barcode"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowScanner(true)}
                    className="px-3 border border-primary/20 hover:border-primary/80 cursor-pointer transition-colors shrink-0"
                    title="Scan barcode with camera"
                  >
                    <Camera className="h-4 w-4 text-primary" />
                  </Button>
                </div>
              </div>
              <Button
                type="submit"
                disabled={saving}
                className="w-full gradient-violet text-white border-0 cursor-pointer"
              >
                {saving ? "Saving..." : editingProduct ? "Save Changes" : "Create Product"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog open={serviceOpen} onOpenChange={handleServiceOpenChange}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingService ? "Edit Service" : "Add Service"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={saveService} className="space-y-4 mt-2">
              <div>
                <Label>Service name</Label>
                <Input
                  required
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  placeholder="e.g. Haircut, phone repair, consultation"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={serviceForm.description}
                  onChange={(e) =>
                    setServiceForm({ ...serviceForm, description: e.target.value })
                  }
                  placeholder="Short details for staff and customers"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Price ({currency})</Label>
                  <Input
                    required
                    type="number"
                    step="0.01"
                    value={serviceForm.price}
                    onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Duration (minutes)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={serviceForm.duration_minutes}
                    onChange={(e) =>
                      setServiceForm({ ...serviceForm, duration_minutes: e.target.value })
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={serviceForm.active}
                  onChange={(e) => setServiceForm({ ...serviceForm, active: e.target.checked })}
                />
                Active service
              </label>
              <Button
                type="submit"
                disabled={saving}
                className="w-full gradient-violet text-white border-0 cursor-pointer"
              >
                {saving ? "Saving..." : editingService ? "Save Changes" : "Create Service"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
        {[
          ...(supportsProducts
            ? [
                {
                  label: "Products",
                  value: String(inventoryStats.totalProducts),
                  helper: "Total inventory items",
                  icon: Package,
                },
                {
                  label: "Inventory value",
                  value: formatMoney(inventoryStats.inventoryValue, currency),
                  helper: "Retail value on hand",
                  icon: Layers,
                },
                {
                  label: "Low stock",
                  value: String(inventoryStats.lowStock),
                  helper: "At or below alert level",
                  icon: AlertTriangle,
                },
                {
                  label: "In stock",
                  value: String(
                    Math.max(0, inventoryStats.totalProducts - inventoryStats.outOfStock),
                  ),
                  helper: `${inventoryStats.outOfStock} out of stock`,
                  icon: CheckCircle2,
                },
              ]
            : []),
          ...(supportsServices
            ? [
                {
                  label: "Services",
                  value: String(services.length),
                  helper: "Listed for this store",
                  icon: Briefcase,
                },
                {
                  label: "Active services",
                  value: String(serviceStats.activeServices),
                  helper: "Available to sell",
                  icon: CheckCircle2,
                },
                {
                  label: "Avg. service price",
                  value: formatMoney(serviceStats.averagePrice, currency),
                  helper: "Across listed services",
                  icon: Layers,
                },
              ]
            : []),
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">{card.label}</div>
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <card.icon className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 text-2xl font-bold truncate">{card.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{card.helper}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-11 bg-background"
              placeholder={isServiceOnly ? "Search service or description" : "Search product, SKU, or barcode"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {supportsProducts && (
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <select
                className="h-11 w-full pl-9 pr-8 rounded-md border border-border bg-background text-sm"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All categories</option>
                <option value="uncategorized">Uncategorized</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {supportsProducts && (
            <select
              className="h-11 w-full px-3 rounded-md border border-border bg-background text-sm"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
            >
              <option value="all">All stock</option>
              <option value="healthy">Healthy stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
          )}
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          {isServiceOnly
            ? `Showing ${filteredServices.length} of ${services.length} services`
            : `Showing ${filteredList.length} of ${list.length} products`}
          for the selected store
        </div>
      </div>

      {stores.length > 0 && supportsServices && (
        <div className="mt-6 glass rounded-2xl overflow-hidden border border-border/60">
          <div className="border-b border-border bg-muted/20 p-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">Store services</div>
              <div className="text-xs text-muted-foreground">
                Services offered specifically by {currentStore?.name || "this store"}.
              </div>
            </div>
            <Button
              type="button"
              onClick={openAddServiceDialog}
              className="gradient-violet text-white border-0 cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-1" /> Add service
            </Button>
          </div>
          {services.length === 0 ? (
            <div className="p-12 text-center">
              <Briefcase className="h-10 w-10 text-muted-foreground mx-auto" />
              <div className="mt-3 font-semibold">No services yet</div>
              <p className="text-sm text-muted-foreground">
                Add the services this store offers to customers.
              </p>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="p-12 text-center">
              <Briefcase className="h-10 w-10 text-muted-foreground mx-auto" />
              <div className="mt-3 font-semibold">No services match your search</div>
              <p className="text-sm text-muted-foreground">Try changing the search term.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border bg-muted/20">
                  <tr>
                    <th className="p-4">Service</th>
                    <th className="p-4">Duration</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Price</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.map((service) => (
                    <tr
                      key={service.id}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-4">
                        <div className="font-semibold text-foreground">{service.name}</div>
                        {service.description && (
                          <div className="mt-1 text-xs text-muted-foreground max-w-lg">
                            {service.description}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {service.duration_minutes ? `${service.duration_minutes} min` : "Not set"}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            service.active === false
                              ? "bg-muted text-muted-foreground"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {service.active === false ? "Inactive" : "Active"}
                        </span>
                      </td>
                      <td className="p-4 text-right font-medium">
                        {formatMoney(service.price, currency)}
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditServiceDialog(service)}
                          className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                          title="Edit service"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {stores.length === 0 ? (
        <div className="mt-10 glass rounded-2xl p-12 text-center">
          <Store className="h-10 w-10 text-primary mx-auto mb-3" />
          <div className="text-xl font-bold">No Stores Found</div>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            You need to create at least one store before you can add inventory or services.
            Each shop or branch requires its own setup.
          </p>
          <Link to="/t/$slug/stores" params={{ slug: business?.slug || '' }}>
            <Button className="mt-6 gradient-violet text-white border-0">
              <Plus className="h-4 w-4 mr-1" /> Create a Store
            </Button>
          </Link>
        </div>
      ) : !supportsProducts ? null : list.length === 0 ? (
        <div className="mt-10 glass rounded-2xl p-12 text-center">
          <Package className="h-10 w-10 text-muted-foreground mx-auto" />
          <div className="mt-3 font-semibold">No products yet</div>
          <p className="text-sm text-muted-foreground">Add your first product to start selling.</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="mt-6 glass rounded-2xl p-12 text-center">
          <Package className="h-10 w-10 text-muted-foreground mx-auto" />
          <div className="mt-3 font-semibold">No products match your filters</div>
          <p className="text-sm text-muted-foreground">
            Try changing the search, category, or stock filter.
          </p>
        </div>
      ) : (
        <div className="mt-6 glass rounded-2xl overflow-hidden border border-border/60">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border bg-muted/20">
                <tr>
                  <th className="p-4">Product</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">SKU / Barcode</th>
                  {!isServiceOnly && (
                    <th className="p-4">
                      Store stock
                    </th>
                  )}
                  <th className="p-4 text-right">Price</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((p) => {
                  const stock = getStoreStock(p);
                  const low = stock <= (p.low_stock_alert ?? 0);
                  const stockKey = `${selectedStoreId}:${p.id}`;
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-4 font-medium flex items-center gap-3">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="h-10 w-10 rounded-lg object-cover border border-border shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center border border-border text-muted-foreground shrink-0">
                            <Package className="h-5 w-5" />
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-foreground">{p.name}</div>
                          {p.sku && (
                            <div className="text-[10px] text-muted-foreground md:hidden">
                              {p.sku}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {p.category_name || "Uncategorized"}
                      </td>
                      <td className="p-4 text-muted-foreground">{p.sku || p.barcode || "—"}</td>
                      {!isServiceOnly && (
                        <td className="p-4">
                          <div className="flex min-w-40 items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              value={storeStockDrafts[stockKey] ?? "0"}
                              onChange={(event) =>
                                setStoreStockDrafts((prev) => ({
                                  ...prev,
                                  [stockKey]: event.target.value,
                                }))
                              }
                              className={`h-9 w-24 ${low ? "border-destructive text-destructive" : ""}`}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                                disabled={savingStoreStockId === p.id}
                                onClick={() => saveStoreStock(p)}
                              >
                                Save
                              </Button>
                            </div>
                        </td>
                      )}
                      <td className="p-4 text-right font-medium">
                        {formatMoney(p.price, currency)}
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(p)}
                          className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                          title="Edit product"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
        title="Product Barcode Scanner"
      />
    </div>
  );
}
