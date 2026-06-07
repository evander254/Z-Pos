import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { OfflineModeProvider } from "@/lib/offline-mode";
import { Toaster } from "@/components/ui/sonner";
import faviconPng from "@/assests/favicon-96x96.png?url";
import appleTouchIcon from "@/assests/apple-touch-icon.png?url";
import siteManifest from "@/assests/site.webmanifest?url";
import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

const INSTALL_PROMPT_DISMISSED_KEY = "zpos-install-prompt-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 grid-bg">
      <div className="max-w-md text-center glass rounded-2xl p-10">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md gradient-violet px-5 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center glass rounded-2xl p-10">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md gradient-violet px-4 py-2 text-sm font-medium text-white"
          >
            Try again
          </button>
          <a href="/" className="rounded-md border border-border px-4 py-2 text-sm">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ZPos — Smart POS for African Businesses" },
      {
        name: "description",
        content:
          "Multi-tenant smart POS and business management for supermarkets, restaurants, salons, pharmacies and more — built for Kenya and Africa.",
      },
      { name: "author", content: "ZPos" },
      { name: "apple-mobile-web-app-title", content: "Z-POS" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { property: "og:title", content: "ZPos — Smart POS for African Businesses" },
      {
        property: "og:description",
        content: "Run your shop, restaurant, salon or pharmacy with a beautiful, modern POS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: faviconPng, sizes: "96x96" },
      { rel: "shortcut icon", type: "image/png", href: faviconPng },
      { rel: "apple-touch-icon", sizes: "180x180", href: appleTouchIcon },
      { rel: "manifest", href: siteManifest },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function isRunningAsInstalledApp() {
  if (typeof window === "undefined") return false;
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    standaloneNavigator.standalone === true
  );
}

function InstallAppPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (isRunningAsInstalledApp()) return;
    if (localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY) === "true") return;

    const showFallbackPrompt = window.setTimeout(() => setVisible(true), 3000);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      window.clearTimeout(showFallbackPrompt);
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const onAppInstalled = () => {
      localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, "true");
      setVisible(false);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.clearTimeout(showFallbackPrompt);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) {
      setShowHelp(true);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, "true");
      setVisible(false);
    }
    setInstallPrompt(null);
  }

  function dismissPrompt() {
    localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-16 z-[95] mx-auto max-w-md rounded-2xl border border-border/70 bg-background/95 p-4 text-foreground shadow-2xl backdrop-blur md:left-6 md:right-auto md:mx-0">
      <button
        type="button"
        onClick={dismissPrompt}
        className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Dismiss install prompt"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex gap-3 pr-8">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-violet text-white shadow-sm">
          <Download className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold">Install Z-POS</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Add Z-POS to your desktop or home screen and launch it as a fullscreen web app.
          </p>
        </div>
      </div>
      {showHelp ? (
        <div className="mt-3 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
          Use your browser menu, then choose{" "}
          <span className="font-semibold text-foreground">Install app</span> or{" "}
          <span className="font-semibold text-foreground">Add to Home Screen</span>.
        </div>
      ) : null}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={installApp}
          className="inline-flex flex-1 items-center justify-center rounded-md gradient-violet px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {installPrompt ? "Install app" : "Show install steps"}
        </button>
        <button
          type="button"
          onClick={dismissPrompt}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <OfflineModeProvider>
            <Outlet />
            <InstallAppPrompt />
            <div className="fixed bottom-3 right-3 z-[90] rounded-full border border-border/60 bg-background/85 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground shadow-sm backdrop-blur">
              Powered by Z-Pos
            </div>
            <Toaster richColors position="top-right" />
          </OfflineModeProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
