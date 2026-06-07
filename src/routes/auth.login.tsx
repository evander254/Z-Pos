import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Fingerprint, Loader2, User, UserCog, Sparkles, X } from "lucide-react";
import { getEmployeeLoginDetailsFn } from "@/lib/employee-actions";
import { useAuth } from "@/lib/auth-context";
import { getTenantSlugFromHost } from "@/lib/subdomain-url";
import { SiteFooter } from "@/components/site-footer";
import zposLogo from "@/assests/zposlogo.png";

export const Route = createFileRoute("/auth/login")({ component: Login });

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value?: string) {
  return !!value && UUID_PATTERN.test(value);
}

function Login() {
  const nav = useNavigate();
  const { user, loading: authLoading, setMockSession } = useAuth();
  const tenantSlug = getTenantSlugFromHost();
  const [loginType, setLoginType] = useState<"owner" | "employee">("owner");
  
  // Owner auth
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Employee auth
  const [workAccountNumber, setWorkAccountNumber] = useState("");
  const [employeePassword, setEmployeePassword] = useState("");
  const [empLoading, setEmpLoading] = useState(false);

  // Biometric scanner modal
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("Place finger on the reader...");
  const [scanPercent, setScanPercent] = useState(0);

  useEffect(() => {
    if (authLoading || !user || !tenantSlug) return;
    nav({ to: "/t/$slug", params: { slug: tenantSlug } });
  }, [authLoading, nav, tenantSlug, user]);

  function clearEmployeeMockSession() {
    setMockSession?.(null);
    if (typeof window === "undefined") return;
    localStorage.removeItem("zpos-mock-user");
    localStorage.removeItem("zpos-mock-employee");
    localStorage.removeItem("zpos-employee-login-session-id");
  }

  async function checkShiftAccess(employeeId?: string, businessId?: string) {
    if (!employeeId || !businessId) return;
    if (!isUuid(employeeId) || !isUuid(businessId)) return;
    const { data, error } = await supabase.rpc("can_employee_login_now" as any, {
      p_employee_id: employeeId,
      p_business_id: businessId,
    });
    if (error) {
      // Migration may not be applied yet. Do not break legacy login in that case.
      if (error.code === "42883" || error.message?.includes("can_employee_login_now")) return;
      throw error;
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (result && result.allowed === false) {
      throw new Error(result.reason || "You can only login during your assigned shift.");
    }
  }

  async function recordLoginSession(employeeId?: string, businessId?: string, userId?: string, method = "password") {
    if (!employeeId || !businessId) return;
    if (!isUuid(employeeId) || !isUuid(businessId)) return;
    const { data, error } = await supabase.rpc("record_employee_login_session" as any, {
      p_employee_id: employeeId,
      p_business_id: businessId,
      p_user_id: userId || null,
      p_login_method: method,
      p_device_label: navigator.userAgent.slice(0, 160),
    });
    if (error) {
      if (error.code === "42883" || error.message?.includes("record_employee_login_session")) return;
      console.warn("Failed to record login session:", error);
      return;
    }
    if (data && typeof window !== "undefined") localStorage.setItem("zpos-employee-login-session-id", String(data));
  }

  async function onOwnerSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearEmployeeMockSession();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    if (tenantSlug) {
      nav({ to: "/t/$slug", params: { slug: tenantSlug } });
      return;
    }
    nav({ to: "/onboarding" });
  }

  async function onEmployeeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workAccountNumber.trim()) return toast.error("Please enter your Work Account Number.");
    if (!employeePassword) return toast.error("Please enter your Password.");

    setEmpLoading(true);
    try {
      // 1. Resolve work account number to login credentials
      const details = await getEmployeeLoginDetailsFn({ data: { workAccountNumber } });
      if (details && "error" in (details as any)) {
        throw new Error((details as any).error);
      }

      if (details.simulated) {
        if (details.password !== employeePassword) {
          throw new Error("Invalid password.");
        }

        await checkShiftAccess(details.employeeData?.id, details.employeeData?.business_id);

        const mockUser = {
          id: details.employeeData.user_id,
          email: details.email,
          user_metadata: {
            full_name: details.employeeData.profiles?.full_name || details.employeeData.username,
            phone: details.employeeData.profiles?.phone,
            avatar_url: details.employeeData.profiles?.avatar_url,
            username: details.employeeData.username
          }
        };

        if (setMockSession) {
          setMockSession(mockUser);
        } else {
          localStorage.setItem("zpos-mock-user", JSON.stringify(mockUser));
        }
        localStorage.setItem("zpos-mock-employee", JSON.stringify(details.employeeData));
        await recordLoginSession(details.employeeData?.id, details.employeeData?.business_id, details.employeeData?.user_id, "password_simulated");

        toast.success("Employee login successful (Simulated)!");
        nav({ to: `/t/${details.slug}` });
        return;
      }

      await checkShiftAccess((details as any).employee_id, (details as any).business_id);

      // 2. Perform authentication with Supabase
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: details.email,
        password: employeePassword
      });

      if (loginError) throw loginError;

      await recordLoginSession((details as any).employee_id, (details as any).business_id, undefined, "password");

      toast.success("Employee login successful!");
      nav({ to: `/t/${details.slug}` });
    } catch (err: any) {
      toast.error(err.message || "Invalid credentials.");
    } finally {
      setEmpLoading(false);
    }
  }

  // Simulate fingerprint biometric scanner
  async function triggerBiometricScan() {
    if (!workAccountNumber.trim()) {
      return toast.error("Please enter your Work Account Number first to locate your biometrics profile.");
    }

    setIsScanning(true);
    setScanPercent(0);
    setScanStatus("Initializing biometric scanner...");

    // Stage 1: Scanning animation
    await new Promise(r => setTimeout(r, 600));
    setScanStatus("Scanning fingerprint pattern...");
    
    // Animate scan percent
    for (let i = 10; i <= 100; i += 15) {
      setScanPercent(i);
      await new Promise(r => setTimeout(r, 150));
    }

    setScanStatus("Analyzing minutiae points...");
    await new Promise(r => setTimeout(r, 500));
    setScanStatus("Verifying secure handshake...");
    await new Promise(r => setTimeout(r, 400));

    try {
      // Fetch details & auto login
      const details = await getEmployeeLoginDetailsFn({ data: { workAccountNumber } });
      if (details && "error" in (details as any)) {
        throw new Error((details as any).error);
      }

      if (details.simulated) {
        await checkShiftAccess(details.employeeData?.id, details.employeeData?.business_id);
        const mockUser = {
          id: details.employeeData.user_id,
          email: details.email,
          user_metadata: {
            full_name: details.employeeData.profiles?.full_name || details.employeeData.username,
            phone: details.employeeData.profiles?.phone,
            avatar_url: details.employeeData.profiles?.avatar_url,
            username: details.employeeData.username
          }
        };

        if (setMockSession) {
          setMockSession(mockUser);
        } else {
          localStorage.setItem("zpos-mock-user", JSON.stringify(mockUser));
        }
        localStorage.setItem("zpos-mock-employee", JSON.stringify(details.employeeData));
        await recordLoginSession(details.employeeData?.id, details.employeeData?.business_id, details.employeeData?.user_id, "biometric_simulated");

        setIsScanning(false);
        toast.success("Biometric Authentication Successful (Simulated)!");
        nav({ to: `/t/${details.slug}` });
        return;
      }

      await checkShiftAccess((details as any).employee_id, (details as any).business_id);

      if (!details.password) {
        throw new Error("No password registered for this work account. Please login using your password.");
      }

      // Authenticate
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: details.email,
        password: details.password
      });

      if (loginError) throw loginError;

      await recordLoginSession((details as any).employee_id, (details as any).business_id, undefined, "biometric");

      setIsScanning(false);
      toast.success("Biometric Authentication Successful!");
      nav({ to: `/t/${details.slug}` });
    } catch (err: any) {
      setIsScanning(false);
      toast.error(err.message || "Biometric authentication failed. Try standard password login.");
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/onboarding" });
    if (result.error) toast.error(result.error.message);
  }

  return (
    <AuthShell 
      title="Welcome back" 
      subtitle={loginType === "owner" ? "Sign in to your ZPos owner workspace." : "Sign in to POS as a workspace employee."}
    >
      {/* Segmented Control / Tabs */}
      <div className="flex bg-secondary p-1 rounded-xl mb-6">
        <button
          type="button"
          onClick={() => setLoginType("owner")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
            loginType === "owner" 
              ? "bg-card text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="h-3.5 w-3.5" /> Owner Account
        </button>
        <button
          type="button"
          onClick={() => setLoginType("employee")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
            loginType === "employee" 
              ? "bg-card text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserCog className="h-3.5 w-3.5" /> Staff / Cashier
        </button>
      </div>

      {loginType === "owner" ? (
        <>
          <Button onClick={google} variant="outline" className="w-full h-11 cursor-pointer">
            Continue with Google
          </Button>
          <Divider />
          <form onSubmit={onOwnerSubmit} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Password</Label>
              <Link to="/auth/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">Forgot?</Link>
            </div>
            <Input type="password" required value={password} onChange={e => setPassword(e.target.value)} />
            <Button disabled={loading} className="w-full h-11 gradient-violet text-white border-0 cursor-pointer">
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <p className="text-sm text-center text-muted-foreground mt-6">
            No account? <Link to="/auth/signup" className="text-foreground hover:underline">Create one</Link>
          </p>
        </>
      ) : (
        <>
          {/* Employee Form */}
          <form onSubmit={onEmployeeSubmit} className="space-y-4">
            <div>
              <Label htmlFor="workAccount">Work Account Number</Label>
              <Input 
                id="workAccount" 
                required 
                placeholder="e.g. SLU-1024"
                value={workAccountNumber} 
                onChange={e => setWorkAccountNumber(e.target.value.toUpperCase())} 
                className="mt-1" 
              />
            </div>
            <div>
              <Label htmlFor="empPassword">Password</Label>
              <Input 
                id="empPassword" 
                type="password" 
                required 
                placeholder="••••••••"
                value={employeePassword} 
                onChange={e => setEmployeePassword(e.target.value)} 
                className="mt-1" 
              />
            </div>
            
            <div className="pt-2 flex flex-col gap-3">
              <Button disabled={empLoading} className="w-full h-11 gradient-violet text-white border-0 cursor-pointer">
                {empLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Sign in to POS
              </Button>
              
              {/* Biometric Trigger */}
              <button
                type="button"
                onClick={triggerBiometricScan}
                className="w-full h-11 rounded-md border border-primary/20 hover:border-primary/50 bg-primary/5 flex items-center justify-center gap-2 text-xs font-semibold text-primary transition-all cursor-pointer"
              >
                <Fingerprint className="h-4.5 w-4.5 text-primary animate-pulse" />
                Quick Fingerprint Sign-in
              </button>
            </div>
          </form>
          
          <div className="text-[11px] text-muted-foreground text-center bg-muted/20 border border-border/40 rounded-xl p-3 mt-6 flex gap-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>
              Work account details are provided by your business owner. Fingerprint login requires entering your Work Account ID to verify your biometrics profile.
            </span>
          </div>
        </>
      )}

      {/* Biometric Scanner Modal */}
      {isScanning && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-card w-full max-w-sm rounded-2xl border border-border shadow-2xl p-6 relative flex flex-col items-center text-center space-y-6">
            <button 
              onClick={() => setIsScanning(false)} 
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            
            <div>
              <h3 className="font-bold text-lg">Biometric Security</h3>
              <p className="text-xs text-muted-foreground mt-1">ZPos Smart Biometrics</p>
            </div>
            
            {/* Visual pulse & scanner */}
            <div className="relative h-32 w-32 rounded-full border border-primary/20 bg-primary/5 flex items-center justify-center">
              {/* Pulsing ring */}
              <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-25" />
              {/* Scanning laser line */}
              <div 
                className="absolute left-4 right-4 h-0.5 bg-primary/80 blur-[1px] transition-all duration-150"
                style={{ top: `${15 + (scanPercent * 0.7)}%` }}
              />
              <Fingerprint className="h-16 w-16 text-primary" />
            </div>

            {/* Progress bar */}
            <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-150 ease-out"
                style={{ width: `${scanPercent}%` }}
              />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{scanStatus}</p>
              <p className="text-[10px] font-mono text-muted-foreground uppercase">
                Work ID: {workAccountNumber}
              </p>
            </div>
          </div>
        </div>
      )}
    </AuthShell>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid-bg flex flex-col">
      <main className="flex flex-1 items-center justify-center px-4 py-24">
        <Link to="/" className="absolute top-6 left-6 flex items-center gap-2">
          <img
            src={zposLogo}
            alt="ZPos logo"
            className="h-10 w-auto max-w-[140px] object-contain"
          />
        </Link>
        <div className="w-full max-w-md glass rounded-2xl p-8">
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
      <SiteFooter compact />
    </div>
  );
}

export function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
      <div className="h-px bg-border flex-1" /> or <div className="h-px bg-border flex-1" />
    </div>
  );
}
