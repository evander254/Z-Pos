import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Zap, ShieldCheck, Smartphone, BarChart3, ScanBarcode, CreditCard, Sun, Moon } from "lucide-react";
import { BUSINESS_TYPES, type BusinessTypeKey, BUSINESS_TYPE_MAP } from "@/lib/business-types";
import { useTheme } from "@/lib/theme-context";
import { useState } from "react";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const [activeIndustry, setActiveIndustry] = useState<BusinessTypeKey>("supermarket");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero activeIndustry={activeIndustry} />
      <Logos />
      <BusinessGrid activeIndustry={activeIndustry} setActiveIndustry={setActiveIndustry} />
      <Features />
      <WaveDivider className="bg-background" fill="fill-background" />
      <PreviewBlock />
      <WaveDivider className="rotate-180 bg-background" fill="fill-background" />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}

function Nav() {
  const { mode, setMode } = useTheme();
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-slate-100 dark:bg-zinc-950/70 dark:border-zinc-800 transition-colors duration-300">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg gradient-violet glow-violet" />
          <span className="font-semibold tracking-tight text-lg">ZPos</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#businesses" className="hover:text-foreground">Industries</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
        </nav>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMode(mode === "light" ? "dark" : "light")}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={`Switch to ${mode === "light" ? "dark" : "light"} mode`}
          >
            {mode === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <Link to="/auth/login" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
          <Link to="/auth/signup">
            <Button className="gradient-violet text-white border-0 hover:opacity-90">Get started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero({ activeIndustry }: { activeIndustry: BusinessTypeKey }) {
  return (
    <section className="relative overflow-hidden grid-bg animate-pattern pattern-dots">
      <div className="mx-auto max-w-7xl px-6 pt-20 pb-28 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Built for Kenya · M-Pesa ready
          </div>
          <h1 className="mt-6 text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]">
            The smart POS that <br />
            <span className="text-gradient">grows your business.</span>
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground">
            One platform for supermarkets, restaurants, pharmacies, salons and more.
            Choose your business type — get a workspace tailored to you in seconds.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth/signup">
              <Button size="lg" className="gradient-violet text-white border-0 hover:opacity-90 h-12 px-6">
                Start free trial <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline" className="h-12 px-6 border-border/60">See features</Button>
            </a>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">14-day trial · No credit card · Cancel anytime</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.7 }}
          className="mt-16 mx-auto max-w-5xl relative perspective-[1200px]">
          <motion.div 
            whileHover={{ rotateX: 5, rotateY: -5, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="glass rounded-3xl p-2 glow-violet transform-style-3d shadow-2xl relative"
          >
            <div className="rounded-2xl bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md p-6 md:p-10 border border-slate-200/50 dark:border-zinc-800/50 overflow-hidden relative">
              {/* Dynamic Industry Header */}
              <div className="flex items-center gap-4 mb-8">
                <div className="h-12 w-12 rounded-xl gradient-violet flex items-center justify-center text-white shadow-lg">
                  {BUSINESS_TYPE_MAP[activeIndustry] && (() => {
                    const Icon = BUSINESS_TYPE_MAP[activeIndustry].icon;
                    return <Icon className="h-6 w-6" />;
                  })()}
                </div>
                <div className="text-left">
                  <div className="text-xl font-bold">{BUSINESS_TYPE_MAP[activeIndustry]?.label || "Dashboard"} Workspace</div>
                  <div className="text-sm text-muted-foreground">{BUSINESS_TYPE_MAP[activeIndustry]?.tagline}</div>
                </div>
              </div>

              {/* Dynamic KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
                {[
                  { label: "Today's Revenue", value: "KES 184,250", delta: "+12.5%", color: "text-emerald-500" },
                  { label: "Active Orders", value: "42", delta: "Processing", color: "text-amber-500" },
                  { label: "System Status", value: "Online", delta: "All modules active", color: "text-blue-500" },
                ].map((k) => (
                  <div key={k.label} className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-xl p-5 text-left border border-slate-100 dark:border-zinc-800 shadow-sm transition-all hover:shadow-md">
                    <div className="text-xs text-muted-foreground font-medium">{k.label}</div>
                    <div className="mt-2 text-2xl font-bold tracking-tight">{k.value}</div>
                    <div className={`mt-1 text-xs font-semibold ${k.color}`}>{k.delta}</div>
                  </div>
                ))}
              </div>

              {/* Decorative dynamic elements */}
              <div className="mt-6 h-48 rounded-xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-200/20 dark:border-violet-500/10 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                <div className="text-violet-500/50 font-medium z-10 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" /> Live Activity Stream
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function Logos() {
  return (
    <div className="border-y border-border/40 py-8">
      <div className="mx-auto max-w-7xl px-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-muted-foreground text-sm">
        <span>Trusted by businesses across</span>
        {["Nairobi", "Mombasa", "Kisumu", "Eldoret", "Nakuru", "Thika"].map(c => (
          <span key={c} className="font-medium tracking-wide opacity-80">{c}</span>
        ))}
      </div>
    </div>
  );
}

function BusinessGrid({ activeIndustry, setActiveIndustry }: { activeIndustry: BusinessTypeKey, setActiveIndustry: (i: BusinessTypeKey) => void }) {
  return (
    <section id="businesses" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">Tailored for your industry</h2>
          <p className="mt-3 text-muted-foreground">Pick your business type during signup and we'll set up everything you need.</p>
        </div>
        <div className="mt-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {BUSINESS_TYPES.map((b, i) => {
            const isActive = activeIndustry === b.key;
            return (
              <motion.div key={b.key}
                onMouseEnter={() => setActiveIndustry(b.key)}
                onClick={() => setActiveIndustry(b.key)}
                initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: i * 0.03 }}
                className={`group relative glass rounded-2xl p-5 overflow-hidden border transition-all duration-300 min-h-[190px] flex flex-col justify-end cursor-pointer ${
                  isActive 
                    ? "border-violet-500 shadow-[0_0_20px_rgba(139,92,246,0.3)] -translate-y-2" 
                    : "border-border/60 hover:-translate-y-1 hover:border-violet-400/50"
                }`}>
                
                {/* Background Image */}
                <img 
                  src={b.imageUrl} 
                  alt={b.label}
                  className={`absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-700 ${isActive ? "scale-110" : "group-hover:scale-105"}`}
                />
                
                {/* Overlay Gradient */}
                <div className={`absolute inset-0 z-10 pointer-events-none transition-colors duration-300 ${isActive ? "bg-gradient-to-t from-violet-950/95 via-slate-900/60 to-transparent" : "bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-transparent"}`} />
                
                {/* Content */}
                <div className="relative z-10 flex flex-col h-full justify-between items-start w-full">
                  <div className={`h-10 w-10 rounded-lg backdrop-blur-md border flex items-center justify-center transition-colors duration-300 ${isActive ? "bg-violet-500/20 border-violet-400/50" : "bg-white/10 border-white/20"}`}>
                    <b.icon className={`h-5 w-5 transition-colors ${isActive ? "text-violet-200" : "text-white"}`} />
                  </div>
                  <div className="mt-4 w-full">
                    <div className={`font-bold text-base leading-snug transition-colors ${isActive ? "text-white" : "text-slate-100"}`}>{b.label}</div>
                    <div className="text-xs text-slate-300 mt-1 line-clamp-2">{b.tagline}</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: ScanBarcode, t: "Smart Checkout", d: "Barcode + camera scanning, holds, refunds, discounts and printable receipts.", color: "text-blue-500", bg: "bg-blue-500/10" },
    { icon: CreditCard, t: "M-Pesa, Card & Cash", d: "Accept every payment your customers use. Reconcile instantly.", color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { icon: BarChart3, t: "Real-time analytics", d: "Sales heatmaps, best sellers, profit estimates and employee performance.", color: "text-fuchsia-500", bg: "bg-fuchsia-500/10" },
    { icon: Smartphone, t: "Mobile-first POS", d: "Run your shop from any phone, tablet or touchscreen device.", color: "text-amber-500", bg: "bg-amber-500/10" },
    { icon: ShieldCheck, t: "Tenant-isolated", d: "Row-level security and per-business workspaces keep your data yours.", color: "text-rose-500", bg: "bg-rose-500/10" },
    { icon: Zap, t: "AI assistant", d: "Predict low stock, get smart sales insights and business recommendations.", color: "text-violet-500", bg: "bg-violet-500/10" },
  ];
  return (
    <section id="features" className="py-24 grid-bg">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">Everything you need to run the shop</h2>
          <p className="mt-3 text-muted-foreground">A premium POS plus inventory, employees, customers and analytics — all in one place.</p>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((f) => (
            <div key={f.t} className="group perspective-1000 h-[200px]">
              <div className="relative w-full h-full transition-transform duration-700 transform-style-3d flip-card-inner">
                {/* Front */}
                <div className="absolute inset-0 backface-hidden glass rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-sm">
                  <div className={`h-16 w-16 rounded-full flex items-center justify-center ${f.bg} mb-4`}>
                    <f.icon className={`h-8 w-8 ${f.color}`} />
                  </div>
                  <div className="font-semibold text-lg">{f.t}</div>
                </div>
                {/* Back */}
                <div className="absolute inset-0 backface-hidden rotate-y-180 glass rounded-2xl p-6 flex flex-col justify-center border-violet-200/50 dark:border-violet-500/30 shadow-xl bg-violet-50/80 dark:bg-violet-950/40 backdrop-blur-md">
                  <div className="font-semibold text-lg mb-2 text-violet-700 dark:text-violet-400">{f.t}</div>
                  <div className="text-sm text-muted-foreground leading-relaxed">{f.d}</div>
                  <div className="mt-4 text-xs font-bold text-violet-600 dark:text-violet-300 uppercase tracking-wider flex items-center gap-1">
                    Explore feature <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PreviewBlock() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold">A POS that feels like an app, not a spreadsheet.</h2>
          <p className="mt-4 text-muted-foreground text-lg">Touchscreen-optimised checkout, gorgeous dashboards and dark mode by default. Designed to look great on the till, on the manager's tablet and on the owner's phone.</p>
          <ul className="mt-8 space-y-4 text-base">
            {["Camera barcode scanning", "USB scanners supported", "Offline cart with sync", "Keyboard shortcuts for cashiers", "Multi-language ready"].map(t => (
              <li key={t} className="flex items-center gap-3">
                <div className="flex-shrink-0 h-6 w-6 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 font-bold" strokeWidth={3} />
                </div>
                <span className="font-medium">{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="glass rounded-3xl p-2 glow-violet shadow-2xl relative perspective-[1000px]">
          <div className="rounded-2xl bg-slate-50 dark:bg-zinc-950 p-6 border border-border/60 overflow-hidden transform-style-3d hover:rotate-y-[-2deg] hover:rotate-x-[2deg] transition-transform duration-500">
            {/* Retail Till Mockup Header */}
            <div className="flex justify-between items-center mb-4">
              <div className="font-semibold text-lg">Current Order</div>
              <div className="px-2 py-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-xs font-bold rounded">TILL-04</div>
            </div>
            
            {/* Product Grid Mockup */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { name: "Avocado", price: "45", img: "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&q=80&w=200", stock: 12 },
                { name: "Coffee Beans", price: "850", img: "https://images.unsplash.com/photo-1559525839-b184a4d698c7?auto=format&fit=crop&q=80&w=200", stock: 5 },
                { name: "Milk 1L", price: "120", img: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=200", stock: 24 },
                { name: "Artisan Bread", price: "200", img: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=200", stock: 8 },
                { name: "Tomatoes", price: "30", img: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=200", stock: 45 },
                { name: "Honey 500g", price: "600", img: "https://images.unsplash.com/photo-1587049352847-4d4b12736b51?auto=format&fit=crop&q=80&w=200", stock: 2 },
              ].map((item, i) => (
                <div key={i} className="aspect-square rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex flex-col p-2 hover:border-violet-400 cursor-pointer transition-colors shadow-sm relative overflow-hidden group">
                  <div className="absolute top-1 right-1 bg-white/90 dark:bg-black/90 backdrop-blur-sm text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-10">{item.stock} left</div>
                  <div className="h-1/2 w-full rounded-md overflow-hidden mb-1 relative">
                    <img src={item.img} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  </div>
                  <div className="text-[10px] sm:text-xs font-medium leading-tight truncate mt-auto">{item.name}</div>
                  <div className="text-[10px] sm:text-xs font-bold text-violet-600 dark:text-violet-400">KES {item.price}</div>
                </div>
              ))}
            </div>
            
            {/* Mockup Checkout Area */}
            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm text-muted-foreground">Subtotal</div>
                <div className="text-sm font-medium">KES 1,845</div>
              </div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">Tax (16%)</div>
                <div className="text-sm font-medium">KES 295</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-base font-bold">Total</div>
                <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">KES 2,140</div>
              </div>
            </div>
            <button className="mt-4 w-full h-14 rounded-xl gradient-violet text-white font-bold text-lg shadow-lg hover:shadow-xl hover:opacity-95 transition-all flex items-center justify-center gap-2">
              <CreditCard className="h-5 w-5" /> Pay with M-Pesa
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

const PLANS = [
  { name: "Starter", price: "KES 0", per: "/14-day trial", desc: "Try every feature, no card needed.", features: ["1 business", "Up to 100 products", "1 cashier", "Email support"] },
  { name: "Business", price: "KES 1,999", per: "/month", desc: "For growing shops & restaurants.", features: ["Unlimited products", "5 staff", "M-Pesa integration", "Analytics", "Priority support"], featured: true },
  { name: "Enterprise", price: "Custom", per: "", desc: "Multi-branch & custom integrations.", features: ["Unlimited staff", "Multi-branch", "Custom reports", "Dedicated CSM"] },
];

function Pricing() {
  return (
    <section id="pricing" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">Simple pricing for every business</h2>
          <p className="mt-3 text-muted-foreground">Start free. Upgrade when you're ready.</p>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-5 md:gap-8 items-center max-w-5xl mx-auto">
          {PLANS.map(p => (
            <div key={p.name} className={`relative rounded-2xl p-8 transition-transform ${p.featured ? "glass md:scale-105 border-violet-500/50 shadow-[0_0_30px_rgba(139,92,246,0.15)] bg-gradient-to-b from-violet-500/5 to-transparent z-10" : "glass"}`}>
              {p.featured && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <span className="bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">Most Popular</span>
                </div>
              )}
              <div className="text-sm font-semibold text-violet-500 uppercase tracking-wider">{p.name}</div>
              <div className="mt-4 flex items-baseline gap-1">
                <div className="text-4xl font-bold">{p.price}</div>
                <div className="text-sm text-muted-foreground font-medium">{p.per}</div>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">{p.desc}</div>
              <div className="my-6 h-px w-full bg-border/60" />
              <ul className="space-y-3 text-sm">
                {p.features.map(f => (
                  <li key={f} className="flex items-center gap-3">
                    <div className="flex-shrink-0 h-5 w-5 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
                      <Check className="h-3 w-3 text-violet-600 dark:text-violet-400 font-bold" strokeWidth={3} />
                    </div>
                    <span className="font-medium text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/auth/signup">
                <Button className={`mt-8 w-full h-12 font-semibold ${p.featured ? "gradient-violet text-white border-0 shadow-lg hover:opacity-90 hover:shadow-xl transition-all" : "border-2"}`} variant={p.featured ? "default" : "outline"}>
                  Get started
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const qs = [
    { q: "Does ZPos work offline?", a: "Yes — checkout queues locally and syncs when you're back online." },
    { q: "Can I accept M-Pesa?", a: "Yes, M-Pesa is built in and reconciles with your daily sales automatically." },
    { q: "Do I need a barcode scanner?", a: "No — use your phone camera, or plug in any USB scanner." },
    { q: "Can I switch business type later?", a: "Yes, you can upgrade modules from your dashboard settings any time." },
  ];
  return (
    <section id="faq" className="py-24 grid-bg">
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center">Frequently asked questions</h2>
        <div className="mt-10 space-y-3">
          {qs.map(({ q, a }) => (
            <details key={q} className="glass rounded-xl p-5">
              <summary className="cursor-pointer font-medium">{q}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="glass glow-violet rounded-3xl p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold">Ready to modernise your shop?</h2>
          <p className="mt-3 text-muted-foreground">Set up your custom POS in under 2 minutes.</p>
          <Link to="/auth/signup">
            <Button size="lg" className="mt-6 gradient-violet text-white border-0 hover:opacity-90 h-12 px-8">
              Start your free trial <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/40 py-10">
      <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md gradient-violet" />
          <span>© {new Date().getFullYear()} ZPos. Made for Africa.</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <Link to="/auth/login" className="hover:text-foreground">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}

function WaveDivider({ className = "", fill = "fill-background" }: { className?: string, fill?: string }) {
  return (
    <div className={`w-full overflow-hidden leading-[0] ${className}`}>
      <svg className="relative block w-[calc(100%+1.3px)] h-[40px] md:h-[60px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
        <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" className={fill}></path>
      </svg>
    </div>
  );
}
