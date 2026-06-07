import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { PACKAGE_LIMITS, getBusinessPlan, type PackagePlan } from "@/lib/package-limits";

export const Route = createFileRoute("/t/$slug/package")({ component: PackagePage });

function PackagePage() {
  const { business, role, refresh } = useTenant();
  const nav = useNavigate();
  const { slug } = Route.useParams();
  const [savingPlan, setSavingPlan] = useState<PackagePlan | null>(null);

  if (!business) return null;

  if (role !== "owner") {
    nav({ to: "/t/$slug", params: { slug } });
    return null;
  }

  const currentPlan = getBusinessPlan(business);
  const currentLimits = PACKAGE_LIMITS[currentPlan];
  const trialEndsAt = business.trial_ends_at ? new Date(business.trial_ends_at) : null;

  async function changePackage(plan: PackagePlan) {
    if (!business) return;
    setSavingPlan(plan);
    try {
      const trialStartedAt = business.trial_started_at
        ? new Date(business.trial_started_at)
        : new Date();
      const fallbackTrialEnd = new Date(trialStartedAt);
      fallbackTrialEnd.setDate(fallbackTrialEnd.getDate() + 14);
      const trialEndsAt = business.trial_ends_at
        ? new Date(business.trial_ends_at)
        : fallbackTrialEnd;

      const { error } = await supabase
        .from("businesses")
        .update({
          subscription_plan: plan,
          subscription_status: plan === "trial" ? "trialing" : "active",
          trial_started_at: trialStartedAt.toISOString(),
          trial_ends_at: trialEndsAt.toISOString(),
        })
        .eq("id", business.id);

      if (error) throw error;
      toast.success(`Package updated to ${PACKAGE_LIMITS[plan].name}`);
      await refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update package");
    } finally {
      setSavingPlan(null);
    }
  }

  return (
    <div className="w-full space-y-6 p-4 md:p-8">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 shadow-sm md:p-8">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary/20 via-violet-500/10 to-transparent" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <CreditCard className="h-3.5 w-3.5" /> Package management
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            {currentLimits.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {currentPlan === "trial" && trialEndsAt
              ? `Your trial expires on ${trialEndsAt.toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}.`
              : `Your package is active with ${currentLimits.support}.`}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(PACKAGE_LIMITS) as PackagePlan[]).map((plan) => {
          const limits = PACKAGE_LIMITS[plan];
          return (
            <div
              key={plan}
              className={`rounded-2xl border p-5 shadow-sm ${currentPlan === plan ? "border-primary bg-primary/5" : "border-border/60 bg-card"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-lg font-semibold">{limits.name}</div>
                {currentPlan === plan && <CheckCircle2 className="h-5 w-5 text-primary" />}
              </div>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>{limits.maxBusinesses === null ? "Unlimited businesses" : "1 business"}</li>
                <li>
                  {limits.maxProducts === null
                    ? "Unlimited products"
                    : `Up to ${limits.maxProducts} products`}
                </li>
                <li>{limits.maxStaff === null ? "Unlimited staff" : `${limits.maxStaff} staff`}</li>
                <li>{limits.mpesa ? "M-Pesa integration" : "Cash/card payments"}</li>
                <li>{limits.analytics ? "Analytics" : "Basic dashboard"}</li>
                <li>{limits.support}</li>
              </ul>
              <Button
                type="button"
                variant={currentPlan === plan ? "outline" : "default"}
                disabled={currentPlan === plan || savingPlan !== null}
                onClick={() => changePackage(plan)}
                className={`mt-5 w-full ${currentPlan === plan ? "" : "gradient-violet border-0 text-white"}`}
              >
                {savingPlan === plan
                  ? "Updating..."
                  : currentPlan === plan
                    ? "Current package"
                    : "Upgrade package"}
              </Button>
            </div>
          );
        })}
      </div>

      {savingPlan && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-4 text-sm shadow-2xl">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> Updating package...
          </div>
        </div>
      )}
    </div>
  );
}
