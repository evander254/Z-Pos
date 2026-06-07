import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AuthShell } from "./auth.login";

export const Route = createFileRoute("/auth/reset-password")({ component: Reset });

function Reset() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [checkingLink, setCheckingLink] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRecoverySession() {
      const url = new URL(window.location.href);
      const urlError =
        url.searchParams.get("error_description") ||
        url.hash.match(/error_description=([^&]+)/)?.[1];
      if (urlError) {
        toast.error(decodeURIComponent(urlError.replace(/\+/g, " ")));
      }

      const code = url.searchParams.get("code");
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }

      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      setEmail(data.session?.user.email ?? null);
      setHasRecoverySession(Boolean(data.session));
      setCheckingLink(false);
    }

    loadRecoverySession();
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setEmail(session?.user.email ?? null);
        setHasRecoverySession(Boolean(session));
        setCheckingLink(false);
      }
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextPassword = password;
    if (!hasRecoverySession || !email)
      return toast.error("Open the reset link from your email before setting a new password.");
    if (nextPassword.length < 6) return toast.error("Password must be at least 6 characters.");
    if (nextPassword !== confirmPassword) return toast.error("Passwords do not match.");

    setLoading(true);
    const currentSession = await supabase.auth.getSession();
    const samePasswordCheck = await supabase.auth.signInWithPassword({
      email,
      password: nextPassword,
    });
    if (!samePasswordCheck.error) {
      const session = currentSession.data.session;
      if (session) {
        await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
      }
      setLoading(false);
      return toast.error("New password cannot be the same as your previous password.");
    }

    const { error } = await supabase.auth.updateUser({ password: nextPassword });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. Sign in with your new password.");
    nav({ to: "/auth/login" });
  }

  if (checkingLink) {
    return (
      <AuthShell
        title="Checking reset link"
        subtitle="Please wait while we verify your password reset link."
      />
    );
  }

  if (!hasRecoverySession) {
    return (
      <AuthShell
        title="Reset link required"
        subtitle="Open the link from your email, or request a new password reset link."
      >
        <Button asChild className="w-full h-11 gradient-violet text-white border-0">
          <Link to="/auth/forgot-password">Request a new reset link</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password" subtitle="Choose a password you have not used before.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label>New password</Label>
          <Input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Confirm new password</Label>
          <Input
            type="password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1"
          />
        </div>
        <Button disabled={loading} className="w-full h-11 gradient-violet text-white border-0">
          {loading ? "Saving..." : "Update password"}
        </Button>
      </form>
    </AuthShell>
  );
}
