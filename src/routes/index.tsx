import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Zap, ShieldCheck, Smartphone, BarChart3, ScanBarcode, CreditCard, Sun, Moon } from "lucide-react";
import { BUSINESS_TYPES } from "@/lib/business-types";
import { useTheme } from "@/lib/theme-context";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <Logos />
      <BusinessGrid />
      <Features />
      <PreviewBlock />
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
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/60 border-b border-border/60">
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

function Hero() {
  return (
    <section className="relative overflow-hidden grid-bg">
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
          className="mt-16 mx-auto max-w-5xl">
          <div className="glass rounded-3xl p-2 glow-violet">
            <div className="rounded-2xl bg-background/70 p-6 md:p-10 border border-border/60">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: "Today's Sales", value: "KES 184,250", delta: "+12%" },
                  { label: "Transactions", value: "247", delta: "+8%" },
                  { label: "Best Seller", value: "Coca-Cola 500ml", delta: "84 units" },
                ].map((k) => (
                  <div key={k.label} className="glass rounded-xl p-5 text-left">
                    <div className="text-xs text-muted-foreground">{k.label}</div>
                    <div className="mt-2 text-2xl font-semibold">{k.value}</div>
                    <div className="mt-1 text-xs text-accent">{k.delta}</div>
                  </div>
                ))}
              </div>
              <div className="mt-6 h-32 rounded-xl gradient-violet opacity-90" />
            </div>
          </div>
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

function BusinessGrid() {
  return (
    <section id="businesses" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">Tailored for your industry</h2>
          <p className="mt-3 text-muted-foreground">Pick your business type during signup and we'll set up everything you need.</p>
        </div>
        <div className="mt-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {BUSINESS_TYPES.map((b, i) => (
            <motion.div key={b.key}
              initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.03 }}
              className="group relative glass rounded-2xl p-5 overflow-hidden border border-border/60 hover:-translate-y-1 hover:border-primary/60 transition-all duration-300 min-h-[190px] flex flex-col justify-end">
              
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
                <div className="h-10 w-10 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                  <b.icon className="h-5 w-5 text-white" />
                </div>
                <div className="mt-4 w-full">
                  <div className="font-bold text-white text-base leading-snug">{b.label}</div>
                  <div className="text-xs text-slate-200 mt-1 line-clamp-2">{b.tagline}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: ScanBarcode, t: "Smart Checkout", d: "Barcode + camera scanning, holds, refunds, discounts and printable receipts." },
    { icon: CreditCard, t: "M-Pesa, Card & Cash", d: "Accept every payment your customers use. Reconcile instantly." },
    { icon: BarChart3, t: "Real-time analytics", d: "Sales heatmaps, best sellers, profit estimates and employee performance." },
    { icon: Smartphone, t: "Mobile-first POS", d: "Run your shop from any phone, tablet or touchscreen device." },
    { icon: ShieldCheck, t: "Tenant-isolated", d: "Row-level security and per-business workspaces keep your data yours." },
    { icon: Zap, t: "AI assistant", d: "Predict low stock, get smart sales insights and business recommendations." },
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
            <div key={f.t} className="glass rounded-2xl p-6">
              <f.icon className="h-6 w-6 text-accent" />
              <div className="mt-4 font-semibold">{f.t}</div>
              <div className="mt-1 text-sm text-muted-foreground">{f.d}</div>
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
          <p className="mt-4 text-muted-foreground">Touchscreen-optimised checkout, gorgeous dashboards and dark mode by default. Designed to look great on the till, on the manager's tablet and on the owner's phone.</p>
          <ul className="mt-6 space-y-3 text-sm">
            {["Camera barcode scanning", "USB scanners supported", "Offline cart with sync", "Keyboard shortcuts for cashiers", "Multi-language ready"].map(t => (
              <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 text-accent" /> {t}</li>
            ))}
          </ul>
        </div>
        <div className="glass rounded-3xl p-2 glow-violet">
          <div className="rounded-2xl bg-background/70 p-6 border border-border/60">
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-muted/60 flex items-end p-3 hover:bg-muted">
                  <div className="text-xs">Item {i + 1}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Cart total</div>
              <div className="text-xl font-semibold">KES 1,250</div>
            </div>
            <button className="mt-4 w-full h-12 rounded-xl gradient-violet text-white font-medium">Pay with M-Pesa</button>
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
        <div className="mt-12 grid md:grid-cols-3 gap-5">
          {PLANS.map(p => (
            <div key={p.name} className={`rounded-2xl p-6 ${p.featured ? "glass glow-violet border-primary/40" : "glass"}`}>
              <div className="text-sm text-muted-foreground">{p.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <div className="text-3xl font-bold">{p.price}</div>
                <div className="text-sm text-muted-foreground">{p.per}</div>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">{p.desc}</div>
              <ul className="mt-5 space-y-2 text-sm">
                {p.features.map(f => (
                  <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-accent" /> {f}</li>
                ))}
              </ul>
              <Link to="/auth/signup">
                <Button className={`mt-6 w-full ${p.featured ? "gradient-violet text-white border-0" : ""}`} variant={p.featured ? "default" : "outline"}>
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
