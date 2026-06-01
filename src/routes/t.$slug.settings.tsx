import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Building2, Image as ImageIcon, Palette, Coins, 
  Percent, Upload, Trash2, Save, Loader2 
} from "lucide-react";

export const Route = createFileRoute("/t/$slug/settings")({ component: Settings });

const PRESET_COLORS = [
  { hex: "#7c3aed", name: "Violet" },
  { hex: "#2563eb", name: "Blue" },
  { hex: "#059669", name: "Emerald" },
  { hex: "#d97706", name: "Amber" },
  { hex: "#e11d48", name: "Rose" },
  { hex: "#6366f1", name: "Indigo" },
];

function Settings() {
  const { business, refresh } = useTenant();
  const [form, setForm] = useState({ 
    business_name: "", 
    description: "",
    currency: "KES", 
    tax_rate: 16, 
    theme_color: "#6366f1",
    receipt_type: "standard"
  });
  
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!business) return;
    setForm({
      business_name: business.business_name || "",
      description: business.description || "",
      currency: business.currency || "KES",
      tax_rate: Number(business.tax_rate ?? 16),
      theme_color: business.theme_color || "#6366f1",
      receipt_type: business.receipt_type || "standard",
    });
    setLogoPreview(business.logo_url || null);
    setLogoFile(null);
  }, [business]);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    setLogoFile(null);
    setLogoPreview(null);
  }

  async function save() {
    if (!business) return;
    setSaving(true);

    try {
      let uploadedUrl = business.logo_url;

      // Logo upload handling
      if (logoPreview === null) {
        uploadedUrl = null; // Removed
      } else if (logoFile) {
        // Try creating businesslogos bucket
        try {
          await supabase.storage.createBucket("businesslogos", { public: true });
        } catch (_) {
          // ignore
        }

        const fileExt = logoFile.name.split(".").pop();
        const fileName = `${business.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("businesslogos")
          .upload(fileName, logoFile, { upsert: true });

        if (uploadError) {
          throw new Error("Logo upload failed: " + uploadError.message);
        }

        const { data: { publicUrl } } = supabase.storage
          .from("businesslogos")
          .getPublicUrl(fileName);

        uploadedUrl = publicUrl;
      }

      const payload = {
        business_name: form.business_name,
        description: form.description,
        currency: form.currency,
        tax_rate: form.tax_rate,
        theme_color: form.theme_color,
        logo_url: uploadedUrl,
        receipt_type: form.receipt_type,
      };

      const { error } = await supabase
        .from("businesses")
        .update(payload)
        .eq("id", business.id);

      if (error) throw error;
      
      toast.success("Settings saved successfully");
      await refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" /> Settings
        </h1>
        <p className="text-sm text-muted-foreground">Manage your business profile, localization, and brand identity.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: General Profile Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              Business Profile
            </h3>
            <hr className="border-border/60" />
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="business_name">Business Name</Label>
                <Input 
                  id="business_name"
                  className="mt-1" 
                  value={form.business_name} 
                  onChange={e => setForm({ ...form, business_name: e.target.value })} 
                  placeholder="e.g. Greenmart Supermarket"
                />
              </div>

              <div>
                <Label htmlFor="description">Business Description</Label>
                <Textarea 
                  id="description"
                  className="mt-1 min-h-[120px]" 
                  value={form.description} 
                  onChange={e => setForm({ ...form, description: e.target.value })} 
                  placeholder="Provide a brief summary of your business (displayed on invoices, checkout receipts, etc.)"
                />
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              Localization & Finance
            </h3>
            <hr className="border-border/60" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Input 
                  id="currency"
                  className="mt-1" 
                  value={form.currency} 
                  onChange={e => setForm({ ...form, currency: e.target.value })} 
                  placeholder="KES, USD, UGX, etc."
                />
              </div>
              <div>
                <Label htmlFor="tax_rate">Default Tax Rate (%)</Label>
                <Input 
                  id="tax_rate"
                  type="number" 
                  step="0.01" 
                  className="mt-1" 
                  value={form.tax_rate} 
                  onChange={e => setForm({ ...form, tax_rate: Number(e.target.value) })} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Branding (Logo & Colors) */}
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6 space-y-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              Branding & Layout
            </h3>
            <hr className="border-border/60" />

            {/* Logo Upload Section */}
            <div className="space-y-3">
              <Label>Business Logo</Label>
              <div className="flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-4 bg-muted/20">
                {logoPreview ? (
                  <div className="relative h-24 w-24 rounded-lg overflow-hidden border border-border group mb-3 bg-white flex items-center justify-center">
                    <img src={logoPreview} alt="Logo preview" className="h-full w-full object-contain" />
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                      title="Remove logo"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <div className="h-24 w-24 rounded-lg bg-muted border border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground mb-3">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
                
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-secondary text-secondary-foreground text-xs font-medium cursor-pointer hover:bg-secondary/80 transition-colors">
                  <Upload className="h-3.5 w-3.5" />
                  {logoPreview ? "Change Logo" : "Upload Logo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                </label>
                <p className="text-[10px] text-muted-foreground mt-2 text-center">PNG, JPG up to 5MB. Stored in businesslogos.</p>
              </div>
            </div>

            {/* Color Scheme Picker */}
            <div className="space-y-3">
              <Label>Brand Color Scheme</Label>
              
              {/* Presets */}
              <div className="grid grid-cols-6 gap-2">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setForm({ ...form, theme_color: c.hex })}
                    className={`h-8 w-8 rounded-full border transition-all relative flex items-center justify-center cursor-pointer ${
                      form.theme_color.toLowerCase() === c.hex.toLowerCase() 
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110" 
                        : "border-border hover:scale-105"
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {form.theme_color.toLowerCase() === c.hex.toLowerCase() && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </button>
                ))}
              </div>

              {/* Custom Picker */}
              <div className="pt-2">
                <Label className="text-xs text-muted-foreground">Custom Color</Label>
                <div className="mt-1 flex items-center gap-2">
                  <div className="relative h-10 w-10 rounded-lg overflow-hidden border border-border cursor-pointer flex items-center justify-center bg-muted shrink-0">
                    <Input
                      type="color"
                      className="absolute inset-0 h-full w-full p-0 border-0 cursor-pointer opacity-0"
                      value={form.theme_color}
                      onChange={e => setForm({ ...form, theme_color: e.target.value })}
                    />
                    <Palette className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Input
                    type="text"
                    className="font-mono text-sm uppercase"
                    value={form.theme_color}
                    onChange={e => setForm({ ...form, theme_color: e.target.value })}
                    placeholder="#FFFFFF"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button 
          onClick={save} 
          disabled={saving} 
          className="gradient-violet text-white border-0 px-6 py-2 flex items-center gap-2 cursor-pointer shadow-md hover:shadow-lg transition-all"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving Changes...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
