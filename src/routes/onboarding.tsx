import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BUSINESS_TYPES, type BusinessTypeKey } from "@/lib/business-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { slugify } from "@/lib/format";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

const CURRENCIES = ["KES", "USD", "UGX", "TZS", "RWF", "NGN", "ZAR", "EUR", "GBP"];

function Onboarding() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<BusinessTypeKey | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth/login" }); }, [loading, user, nav]);
  useEffect(() => { if (!user) return; (async () => {
    const { data } = await supabase.from("businesses").select("slug").eq("owner_id", user.id).limit(1).maybeSingle();
    if (data?.slug) nav({ to: "/t/$slug", params: { slug: data.slug } });
  })(); }, [user, nav]);

  async function finish() {
    if (!user || !type) return;
    setSaving(true);
    const finalSlug = slug || slugify(name);
    const { error, data } = await supabase.from("businesses").insert({
      owner_id: user.id, business_name: name, slug: finalSlug, business_type: type, currency,
    }).select().single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await supabase.from("employees").insert({ business_id: data!.id, user_id: user.id, role: "owner" });
    toast.success("Workspace ready!");
    nav({ to: "/t/$slug", params: { slug: finalSlug } });
  }

  const steps = ["Business type", "Business details", "Review"];

  return (
    <div className="min-h-screen grid-bg flex flex-col">
      <header className="px-6 h-16 flex items-center justify-between border-b border-border/40">
        <Link to="/" className="flex items-center gap-2"><div className="h-7 w-7 rounded-md gradient-violet" /><span className="font-semibold">ZPos</span></Link>
        <div className="text-sm text-muted-foreground">Step {step + 1} of {steps.length}</div>
      </header>
      <div className="flex-1 flex items-start justify-center p-6">
        <div className="w-full max-w-4xl">
          <div className="flex items-center gap-2 mb-8">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs ${i <= step ? "gradient-violet text-white" : "bg-muted text-muted-foreground"}`}>
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <div className={`text-sm ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{s}</div>
                {i < steps.length - 1 && <div className="h-px flex-1 bg-border ml-2" />}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              {step === 0 && (
                <div className="glass rounded-2xl p-6">
                  <h2 className="text-2xl font-bold">What kind of business do you run?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">We'll set up the POS, inventory and reports tailored for you.</p>
                  <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3">
                    {BUSINESS_TYPES.map(b => (
                      <button key={b.key} onClick={() => setType(b.key)}
                        className={`group relative text-left rounded-xl h-40 p-4 overflow-hidden border transition-all duration-300 hover:-translate-y-1 flex flex-col justify-end ${
                          type === b.key 
                            ? "border-primary ring-2 ring-primary shadow-[0_0_15px_rgba(124,58,237,0.4)] scale-[0.98]" 
                            : "border-border/60 hover:border-primary/50"
                        }`}>
                        
                        {/* Background Image */}
                        <img 
                          src={b.imageUrl} 
                          alt={b.label}
                          className="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-500 group-hover:scale-105"
                        />
                        
                        {/* Overlay Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-transparent z-10 pointer-events-none" />
                        
                        {/* Content */}
                        <div className="relative z-10 flex flex-col h-full justify-between items-start w-full">
                          <div className="h-9 w-9 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                            <b.icon className="h-5 w-5 text-white" />
                          </div>
                          <div className="mt-4 w-full">
                            <div className="font-bold text-white text-sm leading-snug">{b.label}</div>
                            <div className="text-[11px] text-slate-200 mt-0.5 line-clamp-1">{b.tagline}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {step === 1 && (
                <div className="glass rounded-2xl p-6 max-w-2xl">
                  <h2 className="text-2xl font-bold">Tell us about your business</h2>
                  <div className="mt-6 space-y-4">
                    <div>
                      <Label>Business name</Label>
                      <Input className="mt-1" placeholder="e.g. Greenmart Supermarket" value={name}
                        onChange={e => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }} />
                    </div>
                    <div>
                      <Label>Workspace URL</Label>
                      <div className="mt-1 flex items-center rounded-md border border-border bg-input/30">
                        <span className="px-3 text-sm text-muted-foreground">zpos.com/t/</span>
                        <Input className="border-0 bg-transparent" value={slug} onChange={e => setSlug(slugify(e.target.value))} placeholder="greenmart" />
                      </div>
                    </div>
                    <div>
                      <Label>Currency</Label>
                      <select className="mt-1 w-full h-10 rounded-md border border-border bg-input/30 px-3 text-sm" value={currency} onChange={e => setCurrency(e.target.value)}>
                        {CURRENCIES.map(c => <option key={c} value={c} className="bg-background">{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}
              {step === 2 && type && (
                <div className="glass rounded-2xl p-6 max-w-2xl">
                  <h2 className="text-2xl font-bold">You're all set</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Review and create your workspace.</p>
                  <div className="mt-6 space-y-3 text-sm">
                    <Row label="Business" value={name} />
                    <Row label="Industry" value={BUSINESS_TYPES.find(b => b.key === type)?.label || ""} />
                    <Row label="Workspace" value={`/t/${slug || slugify(name)}`} />
                    <Row label="Currency" value={currency} />
                  </div>
                  <div className="mt-6 glass rounded-xl p-4">
                    <div className="text-xs uppercase text-muted-foreground">Modules we'll enable</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {BUSINESS_TYPES.find(b => b.key === type)?.modules.map(m => (
                        <span key={m} className="text-xs rounded-full px-3 py-1 bg-primary/15 text-foreground">{m}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            {step < 2 ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={(step === 0 && !type) || (step === 1 && !name)}
                className="gradient-violet text-white border-0">Continue <ArrowRight className="h-4 w-4 ml-1" /></Button>
            ) : (
              <Button onClick={finish} disabled={saving} className="gradient-violet text-white border-0">
                {saving ? "Creating..." : "Create workspace"} <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/40 pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
