import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { Plus, Package, Edit, Upload, Trash2, Image as ImageIcon, Camera, Zap, ZapOff, RefreshCw, X, ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { BarcodeScannerModal } from "@/components/barcode-scanner-modal";

export const Route = createFileRoute("/t/$slug/products")({ component: Products });

type Product = { 
  id: string; 
  name: string; 
  price: number; 
  stock_quantity: number; 
  low_stock_alert: number | null; 
  barcode: string | null; 
  sku: string | null;
  image_url: string | null;
};

function Products() {
  const { business } = useTenant();
  const [list, setList] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: "", price: "", stock_quantity: "0", low_stock_alert: "5", barcode: "", sku: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currency = business?.currency || "KES";

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
          (p) => p.barcode === scannedCode || p.sku === scannedCode
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

  async function load() {
    if (!business) return;
    const { data } = await supabase
      .from("products")
      .select("id,name,price,stock_quantity,low_stock_alert,barcode,sku,image_url")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false });
    setList((data || []) as Product[]);
  }

  useEffect(() => { 
    load(); 
    /* eslint-disable-next-line */ 
  }, [business]);

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
      setForm({ name: "", price: "", stock_quantity: "0", low_stock_alert: "5", barcode: "", sku: "" });
      setImageFile(null);
      setImagePreview(null);
    }
  }

  function openAddDialog() {
    setEditingProduct(null);
    setForm({ name: "", price: "", stock_quantity: "0", low_stock_alert: "5", barcode: "", sku: "" });
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
    });
    setImageFile(null);
    setImagePreview(p.image_url);
    setOpen(true);
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

          const { data: { publicUrl } } = supabase.storage
            .from("productts")
            .getPublicUrl(fileName);

          uploadedUrl = publicUrl;
        } else {
          // Keep existing image
          uploadedUrl = editingProduct?.image_url || null;
        }
      } else {
        // Image was cleared/deleted
        uploadedUrl = null;
      }

      const productPayload = {
        business_id: business.id,
        name: form.name,
        price: Number(form.price) || 0,
        stock_quantity: Number(form.stock_quantity) || 0,
        low_stock_alert: Number(form.low_stock_alert) || 0,
        barcode: form.barcode || null,
        sku: form.sku || null,
        image_url: uploadedUrl,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(productPayload)
          .eq("id", editingProduct.id);

        if (error) throw error;
        toast.success("Product updated");
      } else {
        const { error } = await supabase
          .from("products")
          .insert(productPayload);

        if (error) throw error;
        toast.success("Product added");
      }

      setOpen(false);
      setForm({ name: "", price: "", stock_quantity: "0", low_stock_alert: "5", barcode: "", sku: "" });
      setImageFile(null);
      setImagePreview(null);
      setEditingProduct(null);
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  }



  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">Manage your catalog and stock.</p>
        </div>
        <Button onClick={openAddDialog} className="gradient-violet text-white border-0 cursor-pointer">
          <Plus className="h-4 w-4 mr-1" /> New product
        </Button>
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
                      <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
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
                <Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Price ({currency})</Label>
                  <Input required type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
                </div>
                <div>
                  <Label>Stock</Label>
                  <Input type="number" value={form.stock_quantity} onChange={e => setForm({ ...form, stock_quantity: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Low stock alert</Label>
                  <Input type="number" value={form.low_stock_alert} onChange={e => setForm({ ...form, low_stock_alert: e.target.value })} />
                </div>
                <div>
                  <Label>SKU</Label>
                  <Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Barcode</Label>
                <div className="flex gap-2 mt-1">
                  <Input 
                    value={form.barcode} 
                    onChange={e => setForm({ ...form, barcode: e.target.value })}
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
              <Button type="submit" disabled={saving} className="w-full gradient-violet text-white border-0 cursor-pointer">
                {saving ? "Saving..." : editingProduct ? "Save Changes" : "Create Product"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {list.length === 0 ? (
        <div className="mt-10 glass rounded-2xl p-12 text-center">
          <Package className="h-10 w-10 text-muted-foreground mx-auto" />
          <div className="mt-3 font-semibold">No products yet</div>
          <p className="text-sm text-muted-foreground">Add your first product to start selling.</p>
        </div>
      ) : (
        <div className="mt-6 glass rounded-2xl overflow-hidden border border-border/60">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border bg-muted/20">
                <tr>
                  <th className="p-4">Product</th>
                  <th className="p-4">SKU / Barcode</th>
                  <th className="p-4">Stock</th>
                  <th className="p-4 text-right">Price</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map(p => {
                  const low = p.stock_quantity <= (p.low_stock_alert ?? 0);
                  return (
                    <tr key={p.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-medium flex items-center gap-3">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="h-10 w-10 rounded-lg object-cover border border-border shrink-0" />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center border border-border text-muted-foreground shrink-0">
                            <Package className="h-5 w-5" />
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-foreground">{p.name}</div>
                          {p.sku && <div className="text-[10px] text-muted-foreground md:hidden">{p.sku}</div>}
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground">{p.sku || p.barcode || "—"}</td>
                      <td className="p-4">
                        <span className={low ? "text-destructive font-medium bg-destructive/10 px-2 py-0.5 rounded-full text-xs" : ""}>
                          {p.stock_quantity}
                        </span>
                      </td>
                      <td className="p-4 text-right font-medium">{formatMoney(p.price, currency)}</td>
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
