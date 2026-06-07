import { Link } from "@tanstack/react-router";
import zposLogo from "@/assests/zposlogo.png";

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className="border-t border-border/40 bg-background/80 backdrop-blur-sm">
      <div
        className={`mx-auto flex max-w-7xl flex-col gap-6 px-6 ${compact ? "py-6" : "py-10"} md:flex-row md:items-center md:justify-between`}
      >
        <div className="max-w-md">
          <Link to="/" className="inline-flex items-center">
            <img
              src={zposLogo}
              alt="ZPos logo"
              className="h-10 w-auto max-w-[140px] object-contain"
            />
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">
            Smart POS, inventory, staff, and reporting tools for modern African businesses.
          </p>
        </div>
        <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-6">
          <a href="/#features" className="hover:text-foreground">
            Features
          </a>
          <a href="/#pricing" className="hover:text-foreground">
            Pricing
          </a>
          <Link to="/auth/login" className="hover:text-foreground">
            Sign in
          </Link>
          <Link to="/auth/signup" className="hover:text-foreground">
            Start free
          </Link>
        </div>
        <div className="text-xs text-muted-foreground md:text-right">
          <div>© {new Date().getFullYear()} ZPos. All rights reserved.</div>
          <div className="mt-1">Built for reliable retail operations.</div>
        </div>
      </div>
    </footer>
  );
}
