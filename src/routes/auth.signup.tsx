import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AuthShell, Divider } from "./auth.login";

export const Route = createFileRoute("/auth/signup")({ component: Signup });

function Signup() {
  const nav = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/onboarding`, data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — check your email if confirmation is required");
    nav({ to: "/onboarding" });
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/onboarding" });
    if (result.error) toast.error(result.error.message);
  }

  return <AuthShell title="Create your workspace" subtitle="14 days free. No credit card required.">
    <Button onClick={google} variant="outline" className="w-full h-11">Continue with Google</Button>
    <Divider />
    <form onSubmit={onSubmit} className="space-y-4">
      <div><Label>Full name</Label><Input required value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1" /></div>
      <div><Label>Email</Label><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1" /></div>
      <div><Label>Password</Label><Input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="mt-1" /></div>
      <Button disabled={loading} className="w-full h-11 gradient-violet text-white border-0">{loading ? "Creating..." : "Create account"}</Button>
    </form>
    <p className="text-sm text-center text-muted-foreground mt-6">
      Already have an account? <Link to="/auth/login" className="text-foreground hover:underline">Sign in</Link>
    </p>
  </AuthShell>;
}
