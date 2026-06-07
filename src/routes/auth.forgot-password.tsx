import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AuthShell } from "./auth.login";

export const Route = createFileRoute("/auth/forgot-password")({ component: Forgot });

function Forgot() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const resetUrl = new URL("/auth/reset-password", window.location.origin);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: resetUrl.toString(),
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Reset link sent. Check your email to set a new password.");
  }
  return (
    <AuthShell title="Reset password" subtitle="We'll send a reset link to your email.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1"
          />
        </div>
        <Button disabled={loading} className="w-full h-11 gradient-violet text-white border-0">
          {loading ? "Sending..." : "Send reset link"}
        </Button>
      </form>
      <p className="text-sm text-center text-muted-foreground mt-6">
        <Link to="/auth/login" className="hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
