import {
  ShoppingCart,
  Cpu,
  Shirt,
  Pill,
  UtensilsCrossed,
  Coffee,
  Wrench,
  Sparkles,
  Wine,
  Boxes,
  Leaf,
  Scissors,
  Globe,
  Smartphone,
  Store,
  PanelsTopLeft,
  type LucideIcon,
} from "lucide-react";

export type BusinessTypeKey =
  | "supermarket"
  | "electronics"
  | "boutique"
  | "pharmacy"
  | "restaurant"
  | "cafe"
  | "hardware"
  | "cosmetics"
  | "liquor"
  | "wholesale"
  | "agrovet"
  | "salon"
  | "cyber"
  | "mpesa"
  | "minimart"
  | "other";

export interface BusinessTypeDef {
  key: BusinessTypeKey;
  label: string;
  icon: LucideIcon;
  tagline: string;
  modules: string[];
  imageUrl: string;
}

export const BUSINESS_TYPES: BusinessTypeDef[] = [
  {
    key: "supermarket",
    label: "Supermarket",
    icon: ShoppingCart,
    tagline: "Barcode-first checkout & inventory",
    modules: [
      "Barcode generation",
      "Shelf price labels",
      "Loyalty cards",
      "Basket analysis",
      "Buy 2 Get 1 promotions",
      "Branch stock transfers",
      "Supplier rebates",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&q=80&w=800",
  },
  {
    key: "electronics",
    label: "Electronics Shop",
    icon: Cpu,
    tagline: "Serial numbers & warranty tracking",
    modules: [
      "IMEI/Serial tracking",
      "Warranty management",
      "Repair tickets",
      "Trade-in devices",
      "Accessory bundling",
      "Device activation records",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&q=80&w=800",
  },
  {
    key: "boutique",
    label: "Boutique / Fashion",
    icon: Shirt,
    tagline: "Variants, sizes & seasons",
    modules: [
      "Color-size matrix",
      "Seasonal collections",
      "Fitting room tracking",
      "Fashion lookbooks",
      "Customer style profiles",
      "Return reasons analysis",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=800",
  },
  {
    key: "pharmacy",
    label: "Pharmacy",
    icon: Pill,
    tagline: "Expiry, batches & prescriptions",
    modules: [
      "Batch tracking",
      "Expiry alerts",
      "Prescription uploads",
      "Controlled medicine logs",
      "Drug interaction warnings",
      "Patient purchase history",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1576602976047-174e57a47881?auto=format&fit=crop&q=80&w=800",
  },
  {
    key: "restaurant",
    label: "Restaurant",
    icon: UtensilsCrossed,
    tagline: "Tables, kitchen & split bills",
    modules: [
      "Table reservations",
      "Kitchen display system",
      "Waiter accounts",
      "Split bills",
      "Combo meals",
      "Recipe costing",
      "Ingredient deduction",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=800",
  },
  {
    key: "cafe",
    label: "Café",
    icon: Coffee,
    tagline: "Quick orders & modifiers",
    modules: [
      "Quick order screen",
      "Custom modifiers",
      "Barista queue",
      "Loyalty stamps",
      "Takeaway vs dine-in reporting",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=800",
  },
  {
    key: "hardware",
    label: "Hardware",
    icon: Wrench,
    tagline: "Units, bundles & supplier orders",
    modules: [
      "Unit conversion",
      "Cutting services tracking",
      "Project quotations",
      "Contractor accounts",
      "Bulk pricing",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&q=80&w=800",
  },
  {
    key: "cosmetics",
    label: "Cosmetics Shop",
    icon: Sparkles,
    tagline: "Brand catalogs & promos",
    modules: [
      "Shade/skin-tone catalogs",
      "Beauty consultations",
      "Customer skin profiles",
      "Brand campaigns",
      "Expiry management",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=800",
  },
  {
    key: "liquor",
    label: "Liquor Store",
    icon: Wine,
    tagline: "Age check & licensing",
    modules: [
      "Age verification",
      "Bottle deposit tracking",
      "License compliance reports",
      "Happy-hour pricing",
      "Case/bottle conversion",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&q=80&w=800",
  },
  {
    key: "wholesale",
    label: "Wholesale",
    icon: Boxes,
    tagline: "Tiered pricing & credit",
    modules: [
      "Customer credit limits",
      "Debt management",
      "Tiered pricing",
      "Truck dispatch",
      "Delivery notes",
      "VAT invoices",
      "B2B ordering",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55?auto=format&fit=crop&q=80&w=800",
  },
  {
    key: "agrovet",
    label: "Agrovet",
    icon: Leaf,
    tagline: "Inputs, vets & seasons",
    modules: [
      "Seasonal demand forecasting",
      "Livestock medicine tracking",
      "Farmer accounts",
      "Veterinary consultation records",
      "Crop calendar",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&q=80&w=800",
  },
  {
    key: "salon",
    label: "Salon & Barbershop",
    icon: Scissors,
    tagline: "Appointments & stylists",
    modules: [
      "Appointment scheduling",
      "Chair management",
      "Stylist commissions",
      "Before/after photos",
      "Package memberships",
      "SMS reminders",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=800",
  },
  {
    key: "cyber",
    label: "Cyber Café",
    icon: Globe,
    tagline: "Time billing & services",
    modules: [
      "PC timer control",
      "Printing management",
      "Scanning services",
      "Internet packages",
      "Workstation monitoring",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&q=80&w=800",
  },
  {
    key: "mpesa",
    label: "Mobile Money Shop",
    icon: Smartphone,
    tagline: "Float tracking & commissions",
    modules: [
      "Float management",
      "Agent till tracking",
      "Commission reports",
      "Cash reconciliation",
      "Daily float balancing",
      "Fraud alerts",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=800",
  },
  {
    key: "minimart",
    label: "Mini-Mart",
    icon: Store,
    tagline: "Simple checkout & stock",
    modules: [
      "Fast checkout",
      "Simplified inventory",
      "Loyalty points",
      "Low-stock alerts",
      "Supplier restocking suggestions",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1534723452862-4c874018d66d?auto=format&fit=crop&q=80&w=800",
  },
  {
    key: "other",
    label: "Other service/business",
    icon: PanelsTopLeft,
    tagline: "Tell us your exact business type",
    modules: ["Custom modules", "Invoicing", "Bookings", "Subscriptions", "Service tickets"],
    imageUrl:
      "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&q=80&w=800",
  },
];

export const BUSINESS_TYPE_MAP: Record<BusinessTypeKey, BusinessTypeDef> = Object.fromEntries(
  BUSINESS_TYPES.map((b) => [b.key, b]),
) as Record<BusinessTypeKey, BusinessTypeDef>;
