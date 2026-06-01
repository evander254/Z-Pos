import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AuthShell } from "./auth.login";

export const Route = createFileRoute("/auth/reset-password")({ component: Reset });

function Reset() {
  const nav = useNavigate();
  const [password, setPassword] = useState(""); const [loading, setLoading] = useState(false);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated"); nav({ to: "/onboarding" });
  }
  return <AuthShell title="Set a new password">
    <form onSubmit={onSubmit} className="space-y-4">
      <div><Label>New password</Label><Input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="mt-1" /></div>
      <Button disabled={loading} className="w-full h-11 gradient-violet text-white border-0">{loading ? "Saving..." : "Update password"}</Button>
    </form>
  </AuthShell>;
}
