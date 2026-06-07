import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { Receipt, CheckCircle2, Save, Image as ImageIcon, FileText, Smartphone, Printer, Palette } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/t/$slug/receipts")({ component: ReceiptsSettings });

const TEMPLATES = [
  { id: "standard", name: "Standard Thermal", desc: "Classic 80mm POS receipt layout." },
  { id: "compact", name: "Compact Thermal", desc: "Narrower 58mm layout with smaller fonts." },
  { id: "a4_invoice", name: "A4 Invoice", desc: "Full-page professional layout with letterhead." },
  { id: "a5_invoice", name: "A5 Invoice", desc: "Half-page version of the professional invoice." },
  { id: "email_only", name: "Email Only", desc: "Clean HTML layout optimized for email clients." },
  { id: "sms_only", name: "SMS Only", desc: "Responsive layout for minimal mobile viewing." },
  { id: "eco_minimal", name: "Eco Minimalist", desc: "Strips borders and backgrounds to save ink." },
  { id: "logo_heavy", name: "Branding Focus", desc: "Focuses prominently on your brand's logo." },
  { id: "gift_receipt", name: "Gift Receipt", desc: "Hides all prices and totals for easy returns." },
  { id: "qr_digital", name: "QR Digital", desc: "Prints a scannable QR code to a digital version." },
];

function ReceiptsSettings() {
  const { business } = useTenant();
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    receipt_type: "standard",
    logo_url: "",
    description: "",
  });

  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (business) {
      setForm({
        receipt_type: business.receipt_type || "standard",
        logo_url: business.logo_url || "",
        description: business.description || "",
      });
      setLogoPreview(business.logo_url || null);
    }
  }, [business]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!business) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("businesses")
        .update({
          receipt_type: form.receipt_type,
          logo_url: form.logo_url,
          description: form.description,
        })
        .eq("id", business.id);

      if (error) throw error;
      toast.success("Receipt settings saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setLogoPreview(result);
      setForm({ ...form, logo_url: result }); 
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setLogoPreview(null);
    setForm({ ...form, logo_url: "" });
  };

  if (!business) return null;

  return (
    <div className="w-full p-4 md:p-8 space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 md:p-8 shadow-sm">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary/20 via-amber-500/10 to-transparent" />
        <div className="relative flex flex-col md:flex-row justify-between md:items-end gap-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Receipt className="h-3.5 w-3.5" /> Brand receipt studio
            </div>
            <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">Receipt Templates</h1>
            <p className="mt-2 text-sm text-muted-foreground">Configure professional print, invoice, email, SMS, and brand-forward receipts.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="h-11 px-6 shadow-md gap-2 cursor-pointer">
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Templates", value: String(TEMPLATES.length), helper: "Available formats", icon: FileText, tone: "from-primary/25 to-primary/5" },
          { label: "Print ready", value: "6", helper: "Thermal and invoice layouts", icon: Printer, tone: "from-emerald-500/25 to-emerald-500/5" },
          { label: "Digital ready", value: "3", helper: "Email, SMS, and QR options", icon: Smartphone, tone: "from-blue-500/25 to-blue-500/5" },
          { label: "Branding", value: logoPreview ? "Logo set" : "No logo", helper: "Receipt identity status", icon: Palette, tone: "from-amber-500/25 to-amber-500/5" },
        ].map(card => (
          <div key={card.label} className={`rounded-2xl border border-border/50 bg-gradient-to-br ${card.tone} p-5 shadow-sm`}>
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{card.label}</span><card.icon className="h-5 w-5 text-primary" /></div>
            <div className="mt-4 text-2xl font-bold truncate">{card.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{card.helper}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Template Selection */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4">Choose a Template</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TEMPLATES.map((tpl) => {
                const isSelected = form.receipt_type === tpl.id;
                return (
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    key={tpl.id}
                    onClick={() => setForm({ ...form, receipt_type: tpl.id })}
                    className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected 
                        ? "border-primary bg-primary/5 shadow-md" 
                        : "border-border hover:border-primary/50 bg-card"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3 text-primary">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                    )}
                    <h4 className="font-bold text-base mb-1">{tpl.name}</h4>
                    <p className="text-sm text-muted-foreground">{tpl.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Receipt Details */}
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6 space-y-6">
            <h3 className="text-lg font-semibold">Receipt Details</h3>
            <hr className="border-border/60" />

            <div className="space-y-3">
              <Label>Receipt Logo</Label>
              <div className="flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-4 bg-muted/20">
                {logoPreview ? (
                  <div className="relative h-24 w-24 rounded-lg overflow-hidden border border-border group mb-3 bg-white flex items-center justify-center">
                    <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="h-24 w-24 rounded-lg bg-muted flex items-center justify-center mb-3">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                )}
                
                <Label htmlFor="receipt_logo" className="cursor-pointer">
                  <div className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 rounded-md inline-flex items-center justify-center text-sm font-medium transition-colors">
                    Upload Logo
                  </div>
                  <input
                    id="receipt_logo"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </Label>
                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                  Will be printed at the top of supported templates.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="description">Footer Description / Policy</Label>
              <Textarea 
                id="description"
                className="min-h-[120px]" 
                value={form.description} 
                onChange={e => setForm({ ...form, description: e.target.value })} 
                placeholder="e.g. Thanks for shopping with us! Returns accepted within 14 days with original receipt."
              />
              <p className="text-[11px] text-muted-foreground">
                This text will be printed at the bottom of the receipt.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
