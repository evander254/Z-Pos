import type { Business } from "@/lib/tenant-context";

export type PackagePlan = "trial" | "business" | "enterprise";

export type PackageLimits = {
  plan: PackagePlan;
  name: string;
  maxBusinesses: number | null;
  maxProducts: number | null;
  maxStaff: number | null;
  mpesa: boolean;
  analytics: boolean;
  support: "Email support" | "Priority support" | "Dedicated CSM";
};

export const PACKAGE_LIMITS: Record<PackagePlan, PackageLimits> = {
  trial: {
    plan: "trial",
    name: "Starter trial",
    maxBusinesses: 1,
    maxProducts: 100,
    maxStaff: 1,
    mpesa: false,
    analytics: false,
    support: "Email support",
  },
  business: {
    plan: "business",
    name: "Business",
    maxBusinesses: null,
    maxProducts: null,
    maxStaff: 5,
    mpesa: true,
    analytics: true,
    support: "Priority support",
  },
  enterprise: {
    plan: "enterprise",
    name: "Enterprise",
    maxBusinesses: null,
    maxProducts: null,
    maxStaff: null,
    mpesa: true,
    analytics: true,
    support: "Dedicated CSM",
  },
};

export function getBusinessPlan(business: Pick<Business, "subscription_plan"> | null): PackagePlan {
  const plan = business?.subscription_plan;
  if (plan === "business" || plan === "enterprise") return plan;
  return "trial";
}

export function getPackageLimits(business: Pick<Business, "subscription_plan"> | null) {
  return PACKAGE_LIMITS[getBusinessPlan(business)];
}

export function formatLimit(limit: number | null) {
  return limit === null ? "Unlimited" : String(limit);
}
