import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BUSINESS_TYPES, type BusinessTypeKey } from "@/lib/business-types";
import { getShopSubdomainUrl } from "@/lib/subdomain-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteFooter } from "@/components/site-footer";
import { toast } from "sonner";
import { slugify } from "@/lib/format";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import zposLogo from "@/assests/zposlogo.png";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

const CURRENCIES = ["KES", "USD", "UGX", "TZS", "RWF", "NGN", "ZAR", "EUR", "GBP"];

function Onboarding() {
  const { user, loading, setMockSession } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<BusinessTypeKey | null>(null);
  const [otherBusinessType, setOtherBusinessType] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [inventoryMode, setInventoryMode] = useState("products");
  const [saving, setSaving] = useState(false);
  const previewSlug = slug || slugify(name);
  const workspaceUrl = getShopSubdomainUrl(previewSlug);

  const clearInvalidMockSession = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("zpos-mock-user");
      localStorage.removeItem("zpos-mock-employee");
      localStorage.removeItem("zpos-employee-login-session-id");
    }
    setMockSession?.(null);
  }, [setMockSession]);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth/login" });
    if (!loading && user && !isUuid(user.id)) {
      clearInvalidMockSession();
      toast.error("Cleared a stale staff session. Please continue with the owner account.");
    }
  }, [clearInvalidMockSession, loading, user, nav]);
  useEffect(() => {
    if (!user) return;
    if (!isUuid(user.id)) return;
    (async () => {
      const { data } = await supabase
        .from("businesses")
        .select("slug")
        .eq("owner_id", user.id)
        .limit(1)
        .maybeSingle();
      if (data?.slug) window.location.href = `${getShopSubdomainUrl(data.slug)}/auth/login`;
    })();
  }, [user, nav]);

  async function finish() {
    if (!user || !type) return;
    if (!isUuid(user.id)) {
      clearInvalidMockSession();
      toast.error("Cleared a stale staff session. Please try again with the owner account.");
      return;
    }
    if (type === "other" && !otherBusinessType.trim()) {
      toast.error("Please tell us your business type.");
      setStep(0);
      return;
    }
    const baseSlug = slug || slugify(name);
    if (!baseSlug) {
      toast.error("Please enter a valid business name or workspace URL.");
      setStep(1);
      return;
    }

    const trialStartedAt = new Date();
    const trialEndsAt = new Date(trialStartedAt);
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    setSaving(true);
    let createdBusiness: { id: string; slug: string } | null = null;
    let lastErrorMessage = "Failed to create workspace";

    for (const candidateSlug of buildSlugCandidates(baseSlug)) {
      const { error, data } = await supabase
        .from("businesses")
        .insert({
          owner_id: user.id,
          business_name: name,
          slug: candidateSlug,
          business_type: type,
          inventory_mode: inventoryMode,
          currency,
          description: type === "other" ? otherBusinessType.trim() : null,
          subscription_plan: "trial",
          subscription_status: "trialing",
          trial_started_at: trialStartedAt.toISOString(),
          trial_ends_at: trialEndsAt.toISOString(),
        })
        .select("id, slug")
        .single();

      if (!error && data) {
        createdBusiness = data;
        break;
      }

      lastErrorMessage = error?.message || lastErrorMessage;
      if (!isDuplicateSlugError(error)) break;
    }

    if (!createdBusiness) {
      setSaving(false);
      toast.error(lastErrorMessage);
      return;
    }

    await supabase
      .from("employees")
      .insert({ business_id: createdBusiness.id, user_id: user.id, role: "owner" });
    setSaving(false);
    toast.success("Workspace ready!");
    window.location.href = `${getShopSubdomainUrl(createdBusiness.slug)}/auth/login`;
  }

  const steps = ["Business type", "Business details", "Review"];

  return (
    <div className="min-h-screen grid-bg flex flex-col">
      <header className="px-6 h-16 flex items-center justify-between border-b border-border/40">
        <Link to="/" className="flex items-center gap-2">
          <img
            src={zposLogo}
            alt="ZPos logo"
            className="h-10 w-auto max-w-[140px] object-contain"
          />
        </Link>
        <div className="text-sm text-muted-foreground">
          Step {step + 1} of {steps.length}
        </div>
      </header>
      <div className="flex-1 flex items-start justify-center p-6">
        <div className="w-full max-w-4xl">
          <div className="flex items-center gap-2 mb-8">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-xs ${i <= step ? "gradient-violet text-white" : "bg-muted text-muted-foreground"}`}
                >
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <div
                  className={`text-sm ${i === step ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {s}
                </div>
                {i < steps.length - 1 && <div className="h-px flex-1 bg-border ml-2" />}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {step === 0 && (
                <div className="glass rounded-2xl p-6">
                  <h2 className="text-2xl font-bold">What kind of business do you run?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We'll set up the POS, inventory and reports tailored for you.
                  </p>
                  <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3">
                    {BUSINESS_TYPES.map((b, index) => (
                      <motion.button
                        key={b.key}
                        onClick={() => setType(b.key)}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: index * 0.035,
                          type: "spring",
                          stiffness: 260,
                          damping: 24,
                        }}
                        whileHover={{ y: -6, scale: 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        className={`group relative text-left rounded-xl h-40 p-4 overflow-hidden border transition-all duration-300 hover:-translate-y-1 flex flex-col justify-end ${
                          type === b.key
                            ? "border-primary ring-2 ring-primary shadow-[0_0_28px_rgba(124,58,237,0.55)]"
                            : "border-border/60 hover:border-primary/50 hover:shadow-xl"
                        }`}
                      >
                        {/* Background Image */}
                        <img
                          src={b.imageUrl}
                          alt={b.label}
                          className={`absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-700 group-hover:scale-110 ${
                            type === b.key ? "scale-110 saturate-125" : "scale-100"
                          }`}
                        />

                        {/* Overlay Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-transparent z-10 pointer-events-none" />
                        <div
                          className={`absolute inset-0 z-10 pointer-events-none transition-opacity duration-300 ${
                            type === b.key ? "opacity-100 bg-primary/20" : "opacity-0 bg-primary/10"
                          }`}
                        />
                        {type === b.key && (
                          <motion.div
                            initial={{ scale: 0, rotate: -30 }}
                            animate={{ scale: 1, rotate: 0 }}
                            className="absolute right-3 top-3 z-20 h-7 w-7 rounded-full bg-white text-primary shadow-lg flex items-center justify-center"
                          >
                            <Check className="h-4 w-4" />
                          </motion.div>
                        )}

                        {/* Content */}
                        <div className="relative z-10 flex flex-col h-full justify-between items-start w-full">
                          <div className="h-9 w-9 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                            <b.icon className="h-5 w-5 text-white" />
                          </div>
                          <div className="mt-4 w-full">
                            <div className="font-bold text-white text-sm leading-snug">
                              {b.label}
                            </div>
                            <div className="text-[11px] text-slate-200 mt-0.5 line-clamp-1">
                              {b.tagline}
                            </div>
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                  <AnimatePresence>
                    {type === "other" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -8 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -8 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/10 p-4">
                          <Label>What type of business or service do you offer?</Label>
                          <Input
                            className="mt-2"
                            placeholder="e.g. Bookshop, clinic, repair service, photography studio"
                            value={otherBusinessType}
                            onChange={(e) => setOtherBusinessType(e.target.value)}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
              {step === 1 && (
                <div className="glass rounded-2xl p-6 max-w-2xl">
                  <h2 className="text-2xl font-bold">Tell us about your business</h2>
                  <div className="mt-6 space-y-4">
                    <div>
                      <Label>Business name</Label>
                      <Input
                        className="mt-1"
                        placeholder="e.g. Greenmart Supermarket"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (!slug) setSlug(slugify(e.target.value));
                        }}
                      />
                    </div>
                    <div>
                      <Label>Workspace URL</Label>
                      <div className="mt-1 flex items-center rounded-md border border-border bg-input/30">
                        <Input
                          className="border-0 bg-transparent"
                          value={slug}
                          onChange={(e) => setSlug(slugify(e.target.value))}
                          placeholder="greenmart"
                        />
                        <span className="px-3 text-sm text-muted-foreground">.zpos.com</span>
                      </div>
                      <p className="mt-2 break-all text-xs text-muted-foreground">
                        Your team will login at {workspaceUrl || "your-shop.zpos.com"}.
                      </p>
                    </div>
                    <div>
                      <Label>Currency</Label>
                      <select
                        className="mt-1 w-full h-10 rounded-md border border-border bg-input/30 px-3 text-sm"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c} className="bg-background">
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>What do you offer?</Label>
                      <select
                        className="mt-1 w-full h-10 rounded-md border border-border bg-input/30 px-3 text-sm"
                        value={inventoryMode}
                        onChange={(e) => setInventoryMode(e.target.value)}
                      >
                        <option value="products" className="bg-background">
                          Products only (Requires stock tracking)
                        </option>
                        <option value="services" className="bg-background">
                          Services only (No stock tracking)
                        </option>
                        <option value="both" className="bg-background">
                          Both Products and Services
                        </option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
              {step === 2 && type && (
                <div className="glass rounded-2xl p-6 max-w-2xl">
                  <h2 className="text-2xl font-bold">You're all set</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Review and create your workspace.
                  </p>
                  <div className="mt-6 space-y-3 text-sm">
                    <Row label="Business" value={name} />
                    <Row
                      label="Industry"
                      value={
                        type === "other"
                          ? otherBusinessType
                          : BUSINESS_TYPES.find((b) => b.key === type)?.label || ""
                      }
                    />
                    <Row label="Workspace" value={workspaceUrl} />
                    <Row label="Currency" value={currency} />
                    <Row
                      label="Inventory"
                      value={
                        inventoryMode === "products"
                          ? "Products"
                          : inventoryMode === "services"
                            ? "Services"
                            : "Products & Services"
                      }
                    />
                  </div>
                  <div className="mt-6 glass rounded-xl p-4">
                    <div className="text-xs uppercase text-muted-foreground">
                      Modules we'll enable
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {BUSINESS_TYPES.find((b) => b.key === type)?.modules.map((m) => (
                        <span
                          key={m}
                          className="text-xs rounded-full px-3 py-1 bg-primary/15 text-foreground"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            {step < 2 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={
                  (step === 0 && (!type || (type === "other" && !otherBusinessType.trim()))) ||
                  (step === 1 && !name)
                }
                className="gradient-violet text-white border-0"
              >
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={finish}
                disabled={saving}
                className="gradient-violet text-white border-0"
              >
                {saving ? "Creating..." : "Create workspace"}{" "}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
      <SiteFooter compact />
    </div>
  );
}

function isUuid(value?: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || "");
}

function isDuplicateSlugError(error: { code?: string; message?: string } | null) {
  return error?.code === "23505" || error?.message?.includes("businesses_slug_key");
}

function buildSlugCandidates(baseSlug: string) {
  const cleanBase = slugify(baseSlug).slice(0, 54);
  const candidates = [cleanBase];

  for (let index = 0; index < 5; index += 1) {
    const suffix = Math.random().toString(36).slice(2, 8);
    candidates.push(`${cleanBase}-${suffix}`.slice(0, 63));
  }

  return candidates;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/40 pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
