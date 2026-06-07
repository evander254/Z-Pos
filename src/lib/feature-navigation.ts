import {
  Activity,
  BadgeDollarSign,
  Banknote,
  BarChart3,
  BellRing,
  Bot,
  Boxes,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  ChartNoAxesCombined,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileText,
  Fingerprint,
  HandCoins,
  HeartPulse,
  LayoutDashboard,
  LucideIcon,
  MessageCircle,
  PackageSearch,
  Percent,
  Receipt,
  RefreshCw,
  ScanBarcode,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Store,
  Truck,
  UserCog,
  Users,
  Wallet,
  WifiOff,
} from "lucide-react";
import type { BusinessTypeKey } from "@/lib/business-types";

export type WorkspaceFeature = {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  path?: string;
  premium?: boolean;
};

export type WorkspaceFeatureGroup = {
  title: string;
  description: string;
  items: WorkspaceFeature[];
};

export function featurePath(slug: string, key: string) {
  return `/t/${slug}/features/${key}`;
}

export const CORE_FEATURE_GROUPS: WorkspaceFeatureGroup[] = [
  {
    title: "Core",
    description: "Workspace controls that every POS needs.",
    items: [
      {
        key: "dashboard",
        label: "Dashboard",
        description: "Daily workspace command center.",
        icon: LayoutDashboard,
        path: "",
      },
      {
        key: "pos",
        label: "POS",
        description: "Fast selling and checkout.",
        icon: ScanBarcode,
        path: "pos",
      },
      {
        key: "multi_branch",
        label: "Multi-branch support",
        description: "Manage stores and branches.",
        icon: Building2,
        path: "stores",
      },
      {
        key: "roles_permissions",
        label: "Roles & permissions",
        description: "Control user access by role.",
        icon: ShieldCheck,
        path: "roles-permissions",
      },
      {
        key: "offline_mode",
        label: "Offline mode",
        description: "Continue selling when internet drops.",
        icon: WifiOff,
        path: "offline-mode",
      },
    ],
  },
  {
    title: "Finance",
    description: "Money movement, reporting, and reconciliation.",
    items: [
      {
        key: "profit_loss",
        label: "Insights",
        description: "CEO dashboard for sales, profit, stock, teams, and forecasts.",
        icon: ChartNoAxesCombined,
        path: "insights",
      },
      {
        key: "cash_flow",
        label: "Cash flow",
        description: "Track incoming and outgoing cash.",
        icon: Banknote,
        path: "insights",
      },
      {
        key: "expense_tracking",
        label: "Expense tracking",
        description: "Record and categorize expenses.",
        icon: Receipt,
      },
      {
        key: "petty_cash",
        label: "Petty cash",
        description: "Manage small cash movements.",
        icon: HandCoins,
      },
      {
        key: "bank_reconciliation",
        label: "Bank reconciliation",
        description: "Match bank deposits to sales.",
        icon: BadgeDollarSign,
      },
    ],
  },
  {
    title: "Inventory",
    description: "Stock controls from purchasing to returns.",
    items: [
      {
        key: "products",
        label: "Products",
        description: "Catalog, pricing, and stock levels.",
        icon: Boxes,
        path: "products",
      },
      {
        key: "stock_transfers",
        label: "Stock transfers",
        description: "Move stock between branches.",
        icon: RefreshCw,
      },
      {
        key: "purchase_orders",
        label: "Purchase orders",
        description: "Create and receive supplier orders.",
        icon: ClipboardList,
        path: "purchase-orders",
      },
      {
        key: "supplier_management",
        label: "Supplier management",
        description: "Manage supplier contacts and terms.",
        icon: Truck,
        path: "suppliers",
      },
      {
        key: "stock_takes",
        label: "Stock takes",
        description: "Count and reconcile inventory.",
        icon: ClipboardCheck,
      },
      {
        key: "damaged_stock",
        label: "Damaged stock",
        description: "Log breakages, spoilage, and loss.",
        icon: PackageSearch,
      },
      {
        key: "returns_management",
        label: "Returns management",
        description: "Process returns and reasons.",
        icon: RefreshCw,
      },
    ],
  },
  {
    title: "Customer Management",
    description: "Retention, credit, and communication tools.",
    items: [
      {
        key: "customers",
        label: "Customers",
        description: "Customer records and purchase history.",
        icon: Users,
        path: "customers",
      },
      {
        key: "loyalty_points",
        label: "Loyalty points",
        description: "Reward repeat customers.",
        icon: Percent,
        path: "customers",
      },
      {
        key: "customer_wallets",
        label: "Customer wallets",
        description: "Preload and spend from balances.",
        icon: Wallet,
        premium: true,
      },
      {
        key: "membership_plans",
        label: "Membership plans",
        description: "Manage plans, packages, and benefits.",
        icon: CreditCard,
      },
      {
        key: "credit_accounts",
        label: "Credit accounts",
        description: "Track customer debt and repayments.",
        icon: FileText,
        path: "credit-ledger",
      },
      {
        key: "sms_whatsapp",
        label: "SMS/WhatsApp",
        description: "Send alerts, receipts, and reminders.",
        icon: MessageCircle,
        premium: true,
      },
    ],
  },
  {
    title: "Employee Management",
    description: "People, shifts, performance, and accountability.",
    items: [
      {
        key: "employees",
        label: "Employees",
        description: "Staff profiles and access.",
        icon: UserCog,
        path: "employees",
      },
      {
        key: "shift_management",
        label: "Shift management",
        description: "Schedule and enforce shifts.",
        icon: CalendarClock,
        path: "employees",
      },
      {
        key: "attendance",
        label: "Attendance",
        description: "Clock-in, clock-out, and absences.",
        icon: Fingerprint,
        path: "employees",
      },
      {
        key: "commissions",
        label: "Commissions",
        description: "Calculate commissions by staff.",
        icon: Percent,
      },
      {
        key: "performance_reports",
        label: "Performance reports",
        description: "Track staff sales and activity.",
        icon: BarChart3,
        path: "insights",
      },
      {
        key: "cash_drawer",
        label: "Cash drawer accountability",
        description: "Match cashier cash to expected sales.",
        icon: Banknote,
      },
    ],
  },
  {
    title: "AI Features",
    description: "Automation and prediction tools that differentiate ZPos.",
    items: [
      {
        key: "sales_forecasting",
        label: "Sales forecasting",
        description: "Predict future sales by trend and season.",
        icon: Bot,
        premium: true,
      },
      {
        key: "auto_reorder",
        label: "Auto-reorder suggestions",
        description: "Suggest what to buy before stockouts.",
        icon: ShoppingCart,
        premium: true,
      },
      {
        key: "slow_moving_stock",
        label: "Slow-moving stock detection",
        description: "Find dead and aging inventory.",
        icon: PackageSearch,
        premium: true,
      },
      {
        key: "product_recommendations",
        label: "Product recommendations",
        description: "Recommend bundles and cross-sells.",
        icon: Boxes,
        premium: true,
      },
      {
        key: "customer_spending_insights",
        label: "Customer spending insights",
        description: "Understand customer value and habits.",
        icon: Users,
        premium: true,
      },
    ],
  },
  {
    title: "Payment Methods",
    description: "Payments and compliance built for Kenya.",
    items: [
      {
        key: "mpesa_integration",
        label: "M-Pesa integration",
        description: "Accept and reconcile M-Pesa payments.",
        icon: Smartphone,
        premium: true,
      },
      {
        key: "airtel_money",
        label: "Airtel Money integration",
        description: "Accept Airtel Money payments.",
        icon: Smartphone,
        premium: true,
      },
    ],
  },
  {
    title: "Premium Features",
    description: "High-value owner tools and CRM automation.",
    items: [
      {
        key: "business_health_score",
        label: "Business Health Score",
        description: "AI score from sales, profits, stock turnover, and debt.",
        icon: HeartPulse,
        premium: true,
      },
      {
        key: "smart_reorder_engine",
        label: "Smart Reorder Engine",
        description: "Predict stockouts and create purchase orders.",
        icon: ShoppingCart,
        premium: true,
      },
      {
        key: "owner_whatsapp_summary",
        label: "Owner WhatsApp summary",
        description: "Daily sales, expenses, profit, top products, and shortages.",
        icon: MessageCircle,
        premium: true,
      },
      {
        key: "customer_wallet",
        label: "Customer Wallet",
        description: "Let customers preload and spend balances.",
        icon: Wallet,
        premium: true,
      },
      {
        key: "business_crm",
        label: "Business CRM",
        description: "Track birthdays, anniversaries, preferences, and history.",
        icon: BriefcaseBusiness,
        premium: true,
      },
    ],
  },
];

const INDUSTRY_FEATURES: Record<BusinessTypeKey, WorkspaceFeature[]> = {
  supermarket: [
    {
      key: "barcode_generation",
      label: "Barcode generation",
      description: "Generate product barcodes and shelf labels.",
      icon: ScanBarcode,
    },
    {
      key: "shelf_price_labels",
      label: "Shelf price labels",
      description: "Print aisle and shelf price tags.",
      icon: FileText,
    },
    {
      key: "basket_analysis",
      label: "Basket analysis",
      description: "Find common product combinations.",
      icon: ShoppingCart,
    },
    {
      key: "buy_x_get_y_promotions",
      label: "Buy 2 Get 1 promotions",
      description: "Configure bundle promotions.",
      icon: Percent,
    },
    {
      key: "supplier_rebates",
      label: "Supplier rebates",
      description: "Track supplier rebate claims.",
      icon: HandCoins,
    },
  ],
  electronics: [
    {
      key: "imei_serial_tracking",
      label: "IMEI/Serial tracking",
      description: "Track IMEI and serial numbers.",
      icon: Fingerprint,
    },
    {
      key: "warranty_management",
      label: "Warranty management",
      description: "Manage warranty claims and periods.",
      icon: ShieldCheck,
    },
    {
      key: "repair_tickets",
      label: "Repair tickets",
      description: "Open and monitor repair jobs.",
      icon: ClipboardList,
    },
    {
      key: "trade_in_devices",
      label: "Trade-in devices",
      description: "Record trade-ins and valuations.",
      icon: RefreshCw,
    },
    {
      key: "device_activation_records",
      label: "Device activations",
      description: "Store activation records after sale.",
      icon: Smartphone,
    },
  ],
  boutique: [
    {
      key: "color_size_matrix",
      label: "Color-size matrix",
      description: "Manage color and size stock variants.",
      icon: Boxes,
    },
    {
      key: "seasonal_collections",
      label: "Seasonal collections",
      description: "Group inventory by season.",
      icon: Store,
    },
    {
      key: "fitting_room_tracking",
      label: "Fitting room tracking",
      description: "Track try-ons and conversions.",
      icon: ClipboardCheck,
    },
    {
      key: "fashion_lookbooks",
      label: "Fashion lookbooks",
      description: "Build outfit catalogs.",
      icon: FileText,
    },
    {
      key: "style_profiles",
      label: "Style profiles",
      description: "Save customer sizes and preferences.",
      icon: Users,
    },
  ],
  pharmacy: [
    {
      key: "batch_tracking",
      label: "Batch tracking",
      description: "Track medicine lots and batches.",
      icon: Boxes,
    },
    {
      key: "expiry_alerts",
      label: "Expiry alerts",
      description: "Flag medicines near expiry.",
      icon: BellRing,
    },
    {
      key: "prescription_uploads",
      label: "Prescription uploads",
      description: "Attach prescriptions to patient records.",
      icon: FileText,
    },
    {
      key: "controlled_medicine_logs",
      label: "Controlled medicine logs",
      description: "Maintain restricted medicine logs.",
      icon: ShieldAlert,
    },
    {
      key: "drug_interaction_warnings",
      label: "Drug interaction warnings",
      description: "Warn on risky combinations.",
      icon: HeartPulse,
    },
  ],
  restaurant: [
    {
      key: "table_reservations",
      label: "Table reservations",
      description: "Book and manage tables.",
      icon: CalendarClock,
    },
    {
      key: "kitchen_display_system",
      label: "Kitchen display system",
      description: "Send orders to kitchen queues.",
      icon: ClipboardList,
    },
    {
      key: "waiter_accounts",
      label: "Waiter accounts",
      description: "Assign orders and sales to waiters.",
      icon: UserCog,
    },
    {
      key: "split_bills",
      label: "Split bills",
      description: "Split payments by guest or item.",
      icon: Receipt,
    },
    {
      key: "recipe_costing",
      label: "Recipe costing",
      description: "Cost menu items by ingredients.",
      icon: BadgeDollarSign,
    },
  ],
  cafe: [
    {
      key: "quick_order_screen",
      label: "Quick order screen",
      description: "Fast counter ordering.",
      icon: ScanBarcode,
    },
    {
      key: "custom_modifiers",
      label: "Custom modifiers",
      description: "Extra sugar, soy milk, and add-ons.",
      icon: ClipboardList,
    },
    {
      key: "barista_queue",
      label: "Barista queue",
      description: "Queue drinks for preparation.",
      icon: CalendarClock,
    },
    {
      key: "loyalty_stamps",
      label: "Loyalty stamps",
      description: "Stamp cards and free drink rewards.",
      icon: Percent,
    },
    {
      key: "takeaway_dinein_reporting",
      label: "Takeaway vs dine-in",
      description: "Report by fulfillment mode.",
      icon: BarChart3,
    },
  ],
  hardware: [
    {
      key: "unit_conversion",
      label: "Unit conversion",
      description: "Meters, rolls, kilos, and packs.",
      icon: RefreshCw,
    },
    {
      key: "cutting_services",
      label: "Cutting services",
      description: "Track cutting jobs and measurements.",
      icon: ClipboardList,
    },
    {
      key: "project_quotations",
      label: "Project quotations",
      description: "Quote materials for projects.",
      icon: FileText,
    },
    {
      key: "contractor_accounts",
      label: "Contractor accounts",
      description: "Track contractors and terms.",
      icon: Users,
    },
    {
      key: "bulk_pricing",
      label: "Bulk pricing",
      description: "Set quantity price breaks.",
      icon: Percent,
    },
  ],
  cosmetics: [
    {
      key: "shade_skin_tone_catalogs",
      label: "Shade catalogs",
      description: "Track shades and skin tones.",
      icon: Boxes,
    },
    {
      key: "beauty_consultations",
      label: "Beauty consultations",
      description: "Record consultation notes.",
      icon: ClipboardList,
    },
    {
      key: "skin_profiles",
      label: "Skin profiles",
      description: "Store skin type and preferences.",
      icon: Users,
    },
    {
      key: "brand_campaigns",
      label: "Brand campaigns",
      description: "Manage brand promotions.",
      icon: Percent,
    },
    {
      key: "expiry_management",
      label: "Expiry management",
      description: "Track product shelf life.",
      icon: BellRing,
    },
  ],
  liquor: [
    {
      key: "age_verification",
      label: "Age verification",
      description: "Record restricted-sale checks.",
      icon: ShieldCheck,
    },
    {
      key: "bottle_deposits",
      label: "Bottle deposits",
      description: "Track deposits and returns.",
      icon: RefreshCw,
    },
    {
      key: "license_compliance",
      label: "License compliance",
      description: "Prepare compliance reports.",
      icon: FileText,
    },
    {
      key: "happy_hour_pricing",
      label: "Happy-hour pricing",
      description: "Time-based price rules.",
      icon: Percent,
    },
    {
      key: "case_bottle_conversion",
      label: "Case/bottle conversion",
      description: "Convert case inventory to bottles.",
      icon: Boxes,
    },
  ],
  wholesale: [
    {
      key: "credit_limits",
      label: "Customer credit limits",
      description: "Set B2B customer limits.",
      icon: CreditCard,
    },
    {
      key: "debt_management",
      label: "Debt management",
      description: "Track debts and repayments.",
      icon: FileText,
      path: "credit-ledger",
    },
    {
      key: "tiered_pricing",
      label: "Tiered pricing",
      description: "Price by quantity or customer tier.",
      icon: Percent,
    },
    {
      key: "truck_dispatch",
      label: "Truck dispatch",
      description: "Plan dispatch and routes.",
      icon: Truck,
    },
    {
      key: "vat_invoices",
      label: "VAT invoices",
      description: "Issue VAT-ready invoices.",
      icon: Receipt,
    },
  ],
  agrovet: [
    {
      key: "seasonal_forecasting",
      label: "Seasonal forecasting",
      description: "Predict seasonal demand.",
      icon: Bot,
    },
    {
      key: "livestock_medicine_tracking",
      label: "Livestock medicine",
      description: "Track animal medicines.",
      icon: HeartPulse,
    },
    {
      key: "farmer_accounts",
      label: "Farmer accounts",
      description: "Manage farmer records.",
      icon: Users,
    },
    {
      key: "veterinary_consultations",
      label: "Veterinary consultations",
      description: "Record vet consultation notes.",
      icon: ClipboardList,
    },
    {
      key: "crop_calendar",
      label: "Crop calendar",
      description: "Plan by crop season.",
      icon: CalendarClock,
    },
  ],
  salon: [
    {
      key: "appointment_scheduling",
      label: "Appointments",
      description: "Schedule salon services.",
      icon: CalendarClock,
    },
    {
      key: "chair_management",
      label: "Chair management",
      description: "Track chair availability.",
      icon: Store,
    },
    {
      key: "stylist_commissions",
      label: "Stylist commissions",
      description: "Calculate stylist earnings.",
      icon: Percent,
    },
    {
      key: "before_after_photos",
      label: "Before/after photos",
      description: "Attach service photos.",
      icon: FileText,
    },
    {
      key: "sms_reminders",
      label: "SMS reminders",
      description: "Remind clients automatically.",
      icon: MessageCircle,
    },
  ],
  cyber: [
    {
      key: "pc_timer_control",
      label: "PC timer control",
      description: "Track timed workstation sessions.",
      icon: CalendarClock,
    },
    {
      key: "printing_management",
      label: "Printing management",
      description: "Track print jobs and charges.",
      icon: FileText,
    },
    {
      key: "scanning_services",
      label: "Scanning services",
      description: "Track scan jobs.",
      icon: ScanBarcode,
    },
    {
      key: "internet_packages",
      label: "Internet packages",
      description: "Sell timed internet bundles.",
      icon: WifiOff,
    },
    {
      key: "workstation_monitoring",
      label: "Workstation monitoring",
      description: "Monitor workstation status.",
      icon: Activity,
    },
  ],
  mpesa: [
    {
      key: "float_management",
      label: "Float management",
      description: "Track cash and e-money float.",
      icon: Wallet,
    },
    {
      key: "agent_till_tracking",
      label: "Agent till tracking",
      description: "Track transactions per till.",
      icon: Smartphone,
    },
    {
      key: "commission_reports",
      label: "Commission reports",
      description: "Report service commissions.",
      icon: BarChart3,
    },
    {
      key: "cash_reconciliation",
      label: "Cash reconciliation",
      description: "Reconcile cash and transactions.",
      icon: Banknote,
    },
    {
      key: "fraud_alerts",
      label: "Fraud alerts",
      description: "Flag suspicious activity.",
      icon: ShieldAlert,
    },
  ],
  minimart: [
    {
      key: "fast_checkout",
      label: "Fast checkout",
      description: "Quick small-basket selling.",
      icon: ScanBarcode,
      path: "pos",
    },
    {
      key: "simplified_inventory",
      label: "Simplified inventory",
      description: "Easy stock controls.",
      icon: Boxes,
      path: "products",
    },
    {
      key: "loyalty_points",
      label: "Loyalty points",
      description: "Reward repeat buyers.",
      icon: Percent,
      path: "customers",
    },
    {
      key: "low_stock_alerts",
      label: "Low-stock alerts",
      description: "Restock before shelves empty.",
      icon: BellRing,
    },
    {
      key: "supplier_restocking",
      label: "Restocking suggestions",
      description: "Suggested supplier orders.",
      icon: Truck,
    },
  ],
  other: [
    {
      key: "custom_modules",
      label: "Custom modules",
      description: "Configure modules for your workflow.",
      icon: BriefcaseBusiness,
    },
    {
      key: "invoicing",
      label: "Invoicing",
      description: "Create and track invoices.",
      icon: Receipt,
    },
    {
      key: "bookings",
      label: "Bookings",
      description: "Schedule customer bookings.",
      icon: CalendarClock,
    },
    {
      key: "subscriptions",
      label: "Subscriptions",
      description: "Manage recurring plans.",
      icon: CreditCard,
    },
    {
      key: "service_tickets",
      label: "Service tickets",
      description: "Track customer service jobs.",
      icon: ClipboardList,
    },
  ],
};

export function getIndustryFeatureGroup(businessType?: string | null): WorkspaceFeatureGroup {
  const key = (businessType || "other") as BusinessTypeKey;
  return {
    title: "Industry Workspace",
    description: "Specialized pages for this business type.",
    items: INDUSTRY_FEATURES[key] || INDUSTRY_FEATURES.other,
  };
}

export function getWorkspaceFeatureGroups(_businessType?: string | null) {
  return CORE_FEATURE_GROUPS;
}

export function getWorkspaceFeature(key: string, businessType?: string | null) {
  return getWorkspaceFeatureGroups(businessType)
    .flatMap((group) => group.items.map((item) => ({ ...item, group: group.title })))
    .find((item) => item.key === key);
}
