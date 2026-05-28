import {
  ShoppingCart, Cpu, Shirt, Pill, UtensilsCrossed, Coffee, Wrench,
  Sparkles, Wine, Boxes, Leaf, Scissors, Globe, Smartphone, Store,
  type LucideIcon,
} from "lucide-react";

export type BusinessTypeKey =
  | "supermarket" | "electronics" | "boutique" | "pharmacy" | "restaurant"
  | "cafe" | "hardware" | "cosmetics" | "liquor" | "wholesale"
  | "agrovet" | "salon" | "cyber" | "mpesa" | "minimart";

export interface BusinessTypeDef {
  key: BusinessTypeKey;
  label: string;
  icon: LucideIcon;
  tagline: string;
  modules: string[];
  imageUrl: string;
}

export const BUSINESS_TYPES: BusinessTypeDef[] = [
  { key: "supermarket", label: "Supermarket", icon: ShoppingCart, tagline: "Barcode-first checkout & inventory",
    modules: ["Barcode scanner", "Stock alerts", "Suppliers", "Bulk import", "Fast checkout"],
    imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600" },
  { key: "electronics", label: "Electronics Shop", icon: Cpu, tagline: "Serial numbers & warranty tracking",
    modules: ["Serial numbers", "Warranty", "Trade-ins", "Repairs"],
    imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=600" },
  { key: "boutique", label: "Boutique / Fashion", icon: Shirt, tagline: "Variants, sizes & seasons",
    modules: ["Variants", "Sizes & colors", "Lookbook", "Customer styles"],
    imageUrl: "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&q=80&w=600" },
  { key: "pharmacy", label: "Pharmacy", icon: Pill, tagline: "Expiry, batches & prescriptions",
    modules: ["Prescriptions", "Expiry alerts", "Batch tracking", "Controlled drugs"],
    imageUrl: "https://images.unsplash.com/photo-1586015555751-63bb77f4322a?auto=format&fit=crop&q=80&w=600" },
  { key: "restaurant", label: "Restaurant", icon: UtensilsCrossed, tagline: "Tables, kitchen & split bills",
    modules: ["Tables", "Kitchen tickets", "Waiter system", "Split bills", "Menu"],
    imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=600" },
  { key: "cafe", label: "Café", icon: Coffee, tagline: "Quick orders & modifiers",
    modules: ["Quick orders", "Modifiers", "Loyalty stamps"],
    imageUrl: "https://images.unsplash.com/photo-1507133750040-4a8f57021571?auto=format&fit=crop&q=80&w=600" },
  { key: "hardware", label: "Hardware", icon: Wrench, tagline: "Units, bundles & supplier orders",
    modules: ["Units", "Bundles", "Quotations", "Supplier orders"],
    imageUrl: "https://images.unsplash.com/photo-1530124560072-aae82489ee2e?auto=format&fit=crop&q=80&w=600" },
  { key: "cosmetics", label: "Cosmetics Shop", icon: Sparkles, tagline: "Brand catalogs & promos",
    modules: ["Brands", "Promotions", "Loyalty"],
    imageUrl: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&q=80&w=600" },
  { key: "liquor", label: "Liquor Store", icon: Wine, tagline: "Age check & licensing",
    modules: ["Age verification", "License tracking", "Bottle deposits"],
    imageUrl: "https://images.unsplash.com/photo-1569937756447-1d44f657bc69?auto=format&fit=crop&q=80&w=600" },
  { key: "wholesale", label: "Wholesale", icon: Boxes, tagline: "Tiered pricing & credit",
    modules: ["Tiered pricing", "Credit accounts", "Bulk orders"],
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=600" },
  { key: "agrovet", label: "Agrovet", icon: Leaf, tagline: "Inputs, vets & seasons",
    modules: ["Seeds & feeds", "Veterinary", "Seasonal stock"],
    imageUrl: "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&q=80&w=600" },
  { key: "salon", label: "Salon & Barbershop", icon: Scissors, tagline: "Appointments & stylists",
    modules: ["Appointments", "Stylist commission", "Services", "Loyalty"],
    imageUrl: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=600" },
  { key: "cyber", label: "Cyber Café", icon: Globe, tagline: "Time billing & services",
    modules: ["Time billing", "Print/scan", "Services menu"],
    imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=600" },
  { key: "mpesa", label: "Mobile Money Shop", icon: Smartphone, tagline: "Float tracking & commissions",
    modules: ["Float tracking", "Commissions", "Daily reconcile"],
    imageUrl: "https://images.unsplash.com/photo-1563013544-824ae1d704d3?auto=format&fit=crop&q=80&w=600" },
  { key: "minimart", label: "Mini-Mart", icon: Store, tagline: "Simple checkout & stock",
    modules: ["Quick checkout", "Stock", "Suppliers"],
    imageUrl: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&q=80&w=600" },
];

export const BUSINESS_TYPE_MAP: Record<BusinessTypeKey, BusinessTypeDef> =
  Object.fromEntries(BUSINESS_TYPES.map(b => [b.key, b])) as Record<BusinessTypeKey, BusinessTypeDef>;
