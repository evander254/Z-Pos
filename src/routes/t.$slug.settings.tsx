import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deleteBusinessAccountFn } from "@/lib/account-actions";
import { useTenant } from "@/lib/tenant-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { PACKAGE_LIMITS, getBusinessPlan, type PackagePlan } from "@/lib/package-limits";
import { getShopSubdomainUrl } from "@/lib/subdomain-url";
import { useBusinessRealtime } from "@/lib/use-business-realtime";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CalendarClock,
  Coins,
  Copy,
  CreditCard,
  DatabaseBackup,
  ExternalLink,
  Gift,
  Globe2,
  Image as ImageIcon,
  Loader2,
  Network,
  Package,
  Palette,
  Power,
  Receipt,
  Save,
  ShieldCheck,
  Store,
  Trash2,
  Upload,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/t/$slug/settings")({ component: Settings });

const PRESET_COLORS = ["#7c3aed", "#2563eb", "#059669", "#d97706", "#e11d48", "#6366f1"];
const DAYS = [
  ["mon", "Mon"],
  ["tue", "Tue"],
  ["wed", "Wed"],
  ["thu", "Thu"],
  ["fri", "Fri"],
  ["sat", "Sat"],
  ["sun", "Sun"],
];

const tabs = [
  { id: "package", label: "Package", icon: CreditCard },
  { id: "business", label: "Business Profile", icon: Building2 },
  { id: "financial", label: "Financial", icon: Coins },
  { id: "loyalty", label: "Loyalty", icon: Gift },
  { id: "users", label: "Users & Cashiers", icon: Users },
  { id: "appearance", label: "Branding", icon: Palette },
  { id: "receipt", label: "Receipts", icon: Receipt },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "sales", label: "Sales", icon: CalendarClock },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Backup & Security", icon: ShieldCheck },
  { id: "branches", label: "Branches", icon: Store },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "integrations", label: "Integrations", icon: Network },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "account", label: "Account", icon: AlertTriangle },
];

const defaultForm = {
  business_name: "",
  description: "",
  business_slogan: "",
  address: "",
  city: "",
  country: "Kenya",
  phone: "",
  email: "",
  website_url: "",
  registration_number: "",
  tax_pin_vat_number: "",
  currency: "KES",
  currency_symbol: "KSh",
  decimal_places: 2,
  default_tax_rate: 16,
  tax_pricing_mode: "exclusive",
  max_discount_percentage: 0,
  max_refund_amount: 0,
  refund_policy: "",
  points_per_amount_spent: 1,
  loyalty_amount_basis: 100,
  redemption_rate: 1,
  minimum_redeemable_points: 0,
  points_expiry_days: 0,
  birthday_rewards_enabled: false,
  birthday_reward_points: 0,
  membership_levels_text: "[]",
  cashier_login_start_time: "",
  cashier_login_end_time: "",
  allowed_working_days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
  password_min_length: 8,
  password_require_uppercase: true,
  password_require_lowercase: true,
  password_require_number: true,
  password_require_symbol: false,
  two_factor_auth_enabled: false,
  primary_color: "#6366f1",
  secondary_color: "#8b5cf6",
  sidebar_color: "#111827",
  color_mode: "system",
  receipt_footer_message: "",
  receipt_width: "80mm",
  receipt_header: "",
  receipt_footer: "",
  show_tax_breakdown: true,
  show_cashier_name: true,
  show_loyalty_points: true,
  show_receipt_qr_code: false,
  show_receipt_barcode: false,
  low_stock_alert_threshold: 5,
  auto_reorder_level: 0,
  negative_stock_control: "block",
  product_expiry_alert_days: 30,
  batch_tracking_enabled: false,
  allow_backdated_sales: false,
  allow_price_override: false,
  allow_open_pricing: false,
  credit_sales_enabled: false,
  quotations_enabled: false,
  proforma_invoices_enabled: false,
  low_stock_notifications: true,
  daily_sales_summary: false,
  weekly_sales_report: false,
  email_notifications: true,
  sms_notifications: false,
  whatsapp_notifications: false,
  automatic_backups: false,
  backup_frequency: "daily",
  session_timeout_minutes: 60,
  audit_logs_enabled: true,
  login_history_enabled: true,
  device_management_enabled: false,
  ip_restrictions_enabled: false,
  multi_branch_support: false,
  default_branch_manager_id: "",
  branch_targets_text: "{}",
  branch_specific_taxes: false,
  pay_cash: true,
  pay_mpesa: true,
  pay_airtel_money: false,
  pay_card: false,
  pay_bank_transfer: false,
  pay_gift_cards: false,
  pay_store_credit: false,
  mpesa_api_enabled: false,
  sms_gateway_enabled: false,
  whatsapp_api_enabled: false,
  accounting_integration_enabled: false,
  sales_forecasting_enabled: false,
  slow_moving_stock_detection: true,
  customer_purchase_trends: true,
  inventory_mode: "products",
};

type SettingsForm = typeof defaultForm;
type ExtendedBusiness = {
  id: string;
  business_name?: string | null;
  description?: string | null;
  currency?: string | null;
  receipt_type?: string | null;
  logo_url?: string | null;
  theme_color?: string | null;
  tax_rate?: number | string | null;
  business_slogan?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website_url?: string | null;
  registration_number?: string | null;
  tax_pin_vat_number?: string | null;
  currency_symbol?: string | null;
  decimal_places?: number | string | null;
  inventory_mode?: string | null;
  account_status?: string | null;
  account_suspended_at?: string | null;
  account_deleted_at?: string | null;
};
type SettingsRow = Partial<
  Omit<SettingsForm, "membership_levels_text" | "branch_targets_text"> & {
    password_rules: {
      minLength?: number;
      requireUppercase?: boolean;
      requireLowercase?: boolean;
      requireNumber?: boolean;
      requireSymbol?: boolean;
    };
    payment_methods: {
      cash?: boolean;
      mpesa?: boolean;
      airtelMoney?: boolean;
      card?: boolean;
      bankTransfer?: boolean;
      giftCards?: boolean;
      storeCredit?: boolean;
    };
    integrations: {
      mpesaApi?: { enabled?: boolean };
      smsGateway?: { enabled?: boolean };
      whatsappApi?: { enabled?: boolean };
      accountingSoftware?: { enabled?: boolean };
    };
    membership_levels: unknown;
    branch_targets: unknown;
    receipt_logo_url: string | null;
  }
>;

function Settings() {
  const { business, refresh, role } = useTenant();
  const nav = useNavigate();
  const [activeTab, setActiveTab] = useState("business");
  const [form, setForm] = useState<SettingsForm>(defaultForm);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [receiptLogoFile, setReceiptLogoFile] = useState<File | null>(null);
  const [receiptLogoPreview, setReceiptLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [packageSaving, setPackageSaving] = useState<PackagePlan | null>(null);
  const [accountAction, setAccountAction] = useState<"suspend" | "reactivate" | "delete" | null>(
    null,
  );

  const canEdit = role === "owner" || role === "admin";
  const isOwner = role === "owner";
  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const currentPlan = getBusinessPlan(business);
  const shopSubdomainUrl = getShopSubdomainUrl(business?.slug);
  const accountStatus = ((business as unknown as ExtendedBusiness | null)?.account_status ||
    "active") as "active" | "suspended" | "deleted";

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id]);

  useBusinessRealtime(business?.id, ["business_system_settings"], loadSettings);

  async function loadSettings() {
    if (!business) return;
    setLoading(true);

    const businessRow = business as unknown as ExtendedBusiness;
    const { data: rawSettingsRow } = await supabase
      .from("business_system_settings" as "businesses")
      .select("*")
      .eq("business_id" as "id", business.id)
      .maybeSingle();

    const settings = (rawSettingsRow || {}) as SettingsRow;
    const passwordRules = settings.password_rules || {};
    const paymentMethods = settings.payment_methods || {};
    const integrations = settings.integrations || {};

    setForm({
      ...defaultForm,
      business_name: businessRow.business_name || "",
      description: businessRow.description || "",
      business_slogan: businessRow.business_slogan || "",
      address: businessRow.address || "",
      city: businessRow.city || "",
      country: businessRow.country || "Kenya",
      phone: businessRow.phone || "",
      email: businessRow.email || "",
      website_url: businessRow.website_url || "",
      inventory_mode: businessRow.inventory_mode || "products",
      registration_number: businessRow.registration_number || "",
      tax_pin_vat_number: businessRow.tax_pin_vat_number || "",
      currency: settings.currency || businessRow.currency || "KES",
      currency_symbol: settings.currency_symbol || businessRow.currency_symbol || "KSh",
      decimal_places: Number(settings.decimal_places ?? businessRow.decimal_places ?? 2),
      default_tax_rate: Number(settings.default_tax_rate ?? businessRow.tax_rate ?? 16),
      tax_pricing_mode: settings.tax_pricing_mode || "exclusive",
      max_discount_percentage: Number(settings.max_discount_percentage || 0),
      max_refund_amount: Number(settings.max_refund_amount || 0),
      refund_policy: settings.refund_policy || "",
      points_per_amount_spent: Number(settings.points_per_amount_spent ?? 1),
      loyalty_amount_basis: Number(settings.loyalty_amount_basis ?? 100),
      redemption_rate: Number(settings.redemption_rate ?? 1),
      minimum_redeemable_points: Number(settings.minimum_redeemable_points || 0),
      points_expiry_days: Number(settings.points_expiry_days || 0),
      birthday_rewards_enabled: Boolean(settings.birthday_rewards_enabled),
      birthday_reward_points: Number(settings.birthday_reward_points || 0),
      membership_levels_text: JSON.stringify(settings.membership_levels || [], null, 2),
      cashier_login_start_time: settings.cashier_login_start_time || "",
      cashier_login_end_time: settings.cashier_login_end_time || "",
      allowed_working_days: settings.allowed_working_days || defaultForm.allowed_working_days,
      password_min_length: Number(passwordRules.minLength || 8),
      password_require_uppercase: passwordRules.requireUppercase ?? true,
      password_require_lowercase: passwordRules.requireLowercase ?? true,
      password_require_number: passwordRules.requireNumber ?? true,
      password_require_symbol: Boolean(passwordRules.requireSymbol),
      two_factor_auth_enabled: Boolean(settings.two_factor_auth_enabled),
      primary_color: settings.primary_color || businessRow.theme_color || "#6366f1",
      secondary_color: settings.secondary_color || "#8b5cf6",
      sidebar_color: settings.sidebar_color || "#111827",
      color_mode: settings.color_mode || "system",
      receipt_footer_message: settings.receipt_footer_message || "",
      receipt_width: settings.receipt_width || "80mm",
      receipt_header: settings.receipt_header || "",
      receipt_footer: settings.receipt_footer || "",
      show_tax_breakdown: settings.show_tax_breakdown ?? true,
      show_cashier_name: settings.show_cashier_name ?? true,
      show_loyalty_points: settings.show_loyalty_points ?? true,
      show_receipt_qr_code: Boolean(settings.show_receipt_qr_code),
      show_receipt_barcode: Boolean(settings.show_receipt_barcode),
      low_stock_alert_threshold: Number(settings.low_stock_alert_threshold ?? 5),
      auto_reorder_level: Number(settings.auto_reorder_level || 0),
      negative_stock_control: settings.negative_stock_control || "block",
      product_expiry_alert_days: Number(settings.product_expiry_alert_days ?? 30),
      batch_tracking_enabled: Boolean(settings.batch_tracking_enabled),
      allow_backdated_sales: Boolean(settings.allow_backdated_sales),
      allow_price_override: Boolean(settings.allow_price_override),
      allow_open_pricing: Boolean(settings.allow_open_pricing),
      credit_sales_enabled: Boolean(settings.credit_sales_enabled),
      quotations_enabled: Boolean(settings.quotations_enabled),
      proforma_invoices_enabled: Boolean(settings.proforma_invoices_enabled),
      low_stock_notifications: settings.low_stock_notifications ?? true,
      daily_sales_summary: Boolean(settings.daily_sales_summary),
      weekly_sales_report: Boolean(settings.weekly_sales_report),
      email_notifications: settings.email_notifications ?? true,
      sms_notifications: Boolean(settings.sms_notifications),
      whatsapp_notifications: Boolean(settings.whatsapp_notifications),
      automatic_backups: Boolean(settings.automatic_backups),
      backup_frequency: settings.backup_frequency || "daily",
      session_timeout_minutes: Number(settings.session_timeout_minutes ?? 60),
      audit_logs_enabled: settings.audit_logs_enabled ?? true,
      login_history_enabled: settings.login_history_enabled ?? true,
      device_management_enabled: Boolean(settings.device_management_enabled),
      ip_restrictions_enabled: Boolean(settings.ip_restrictions_enabled),
      multi_branch_support: Boolean(settings.multi_branch_support),
      default_branch_manager_id: settings.default_branch_manager_id || "",
      branch_targets_text: JSON.stringify(settings.branch_targets || {}, null, 2),
      branch_specific_taxes: Boolean(settings.branch_specific_taxes),
      pay_cash: paymentMethods.cash ?? true,
      pay_mpesa: paymentMethods.mpesa ?? true,
      pay_airtel_money: Boolean(paymentMethods.airtelMoney),
      pay_card: Boolean(paymentMethods.card),
      pay_bank_transfer: Boolean(paymentMethods.bankTransfer),
      pay_gift_cards: Boolean(paymentMethods.giftCards),
      pay_store_credit: Boolean(paymentMethods.storeCredit),
      mpesa_api_enabled: Boolean(integrations.mpesaApi?.enabled),
      sms_gateway_enabled: Boolean(integrations.smsGateway?.enabled),
      whatsapp_api_enabled: Boolean(integrations.whatsappApi?.enabled),
      accounting_integration_enabled: Boolean(integrations.accountingSoftware?.enabled),
      sales_forecasting_enabled: Boolean(settings.sales_forecasting_enabled),
      slow_moving_stock_detection: settings.slow_moving_stock_detection ?? true,
      customer_purchase_trends: settings.customer_purchase_trends ?? true,
    });
    setLogoPreview(businessRow.logo_url || null);
    setReceiptLogoPreview(settings.receipt_logo_url || businessRow.logo_url || null);
    setLogoFile(null);
    setReceiptLogoFile(null);
    setLoading(false);
  }

  function setValue<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function numberValue(key: keyof SettingsForm, value: string) {
    setForm((current) => ({ ...current, [key]: value === "" ? 0 : Number(value) }));
  }

  function toggleDay(day: string) {
    setForm((current) => ({
      ...current,
      allowed_working_days: current.allowed_working_days.includes(day)
        ? current.allowed_working_days.filter((item) => item !== day)
        : [...current.allowed_working_days, day],
    }));
  }

  function chooseImage(
    file: File | undefined,
    setFile: (file: File | null) => void,
    setPreview: (url: string | null) => void,
  ) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a valid image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be 5MB or smaller");
      return;
    }
    setFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function uploadImage(file: File | null, existingUrl: string | null, folder: string) {
    if (!business) return existingUrl;
    if (!existingUrl) return null;
    if (!file) return existingUrl;

    try {
      await supabase.storage.createBucket("businesslogos", { public: true });
    } catch (_) {
      // Bucket may already exist.
    }

    const fileExt = file.name.split(".").pop() || "png";
    const fileName = `${business.id}/${folder}-${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage
      .from("businesslogos")
      .upload(fileName, file, { upsert: true });
    if (error) throw new Error(`Logo upload failed: ${error.message}`);
    return supabase.storage.from("businesslogos").getPublicUrl(fileName).data.publicUrl;
  }

  function validate() {
    if (!form.business_name.trim()) return "Business name is required";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) return "Enter a valid email address";
    if (form.website_url && !/^https?:\/\//i.test(form.website_url))
      return "Website URL must start with http:// or https://";
    if (form.default_tax_rate < 0 || form.default_tax_rate > 100)
      return "Default tax rate must be between 0 and 100";
    if (form.max_discount_percentage < 0 || form.max_discount_percentage > 100)
      return "Discount limit must be between 0 and 100";
    try {
      JSON.parse(form.membership_levels_text || "[]");
      JSON.parse(form.branch_targets_text || "{}");
    } catch (_) {
      return "Membership levels and branch targets must be valid JSON";
    }
    return null;
  }

  async function save() {
    if (!business || !canEdit) return;
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSaving(true);

    try {
      const uploadedLogo = await uploadImage(logoFile, logoPreview, "business-logo");
      const uploadedReceiptLogo = await uploadImage(
        receiptLogoFile,
        receiptLogoPreview,
        "receipt-logo",
      );

      const businessPayload = {
        business_name: form.business_name.trim(),
        description: form.description.trim() || null,
        business_slogan: form.business_slogan.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        country: form.country.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        website_url: form.website_url.trim() || null,
        registration_number: form.registration_number.trim() || null,
        tax_pin_vat_number: form.tax_pin_vat_number.trim() || null,
        currency: form.currency.trim().toUpperCase(),
        currency_symbol: form.currency_symbol.trim(),
        decimal_places: form.decimal_places,
        tax_rate: form.default_tax_rate,
        theme_color: form.primary_color,
        logo_url: uploadedLogo,
        inventory_mode: form.inventory_mode,
      };

      const settingsPayload = {
        business_id: business.id,
        currency: form.currency.trim().toUpperCase(),
        currency_symbol: form.currency_symbol.trim(),
        decimal_places: form.decimal_places,
        default_tax_rate: form.default_tax_rate,
        tax_pricing_mode: form.tax_pricing_mode,
        max_discount_percentage: form.max_discount_percentage,
        max_refund_amount: form.max_refund_amount,
        refund_policy: form.refund_policy.trim() || null,
        points_per_amount_spent: form.points_per_amount_spent,
        loyalty_amount_basis: form.loyalty_amount_basis,
        redemption_rate: form.redemption_rate,
        minimum_redeemable_points: form.minimum_redeemable_points,
        points_expiry_days: form.points_expiry_days || null,
        birthday_rewards_enabled: form.birthday_rewards_enabled,
        birthday_reward_points: form.birthday_reward_points,
        membership_levels: JSON.parse(form.membership_levels_text || "[]"),
        cashier_login_start_time: form.cashier_login_start_time || null,
        cashier_login_end_time: form.cashier_login_end_time || null,
        allowed_working_days: form.allowed_working_days,
        password_rules: {
          minLength: form.password_min_length,
          requireUppercase: form.password_require_uppercase,
          requireLowercase: form.password_require_lowercase,
          requireNumber: form.password_require_number,
          requireSymbol: form.password_require_symbol,
        },
        two_factor_auth_enabled: form.two_factor_auth_enabled,
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
        sidebar_color: form.sidebar_color,
        color_mode: form.color_mode,
        receipt_logo_url: uploadedReceiptLogo,
        receipt_footer_message: form.receipt_footer_message.trim() || null,
        receipt_width: form.receipt_width,
        receipt_header: form.receipt_header.trim() || null,
        receipt_footer: form.receipt_footer.trim() || null,
        show_tax_breakdown: form.show_tax_breakdown,
        show_cashier_name: form.show_cashier_name,
        show_loyalty_points: form.show_loyalty_points,
        show_receipt_qr_code: form.show_receipt_qr_code,
        show_receipt_barcode: form.show_receipt_barcode,
        low_stock_alert_threshold: form.low_stock_alert_threshold,
        auto_reorder_level: form.auto_reorder_level,
        negative_stock_control: form.negative_stock_control,
        product_expiry_alert_days: form.product_expiry_alert_days,
        batch_tracking_enabled: form.batch_tracking_enabled,
        allow_backdated_sales: form.allow_backdated_sales,
        allow_price_override: form.allow_price_override,
        allow_open_pricing: form.allow_open_pricing,
        credit_sales_enabled: form.credit_sales_enabled,
        quotations_enabled: form.quotations_enabled,
        proforma_invoices_enabled: form.proforma_invoices_enabled,
        low_stock_notifications: form.low_stock_notifications,
        daily_sales_summary: form.daily_sales_summary,
        weekly_sales_report: form.weekly_sales_report,
        email_notifications: form.email_notifications,
        sms_notifications: form.sms_notifications,
        whatsapp_notifications: form.whatsapp_notifications,
        automatic_backups: form.automatic_backups,
        backup_frequency: form.backup_frequency,
        session_timeout_minutes: form.session_timeout_minutes,
        audit_logs_enabled: form.audit_logs_enabled,
        login_history_enabled: form.login_history_enabled,
        device_management_enabled: form.device_management_enabled,
        ip_restrictions_enabled: form.ip_restrictions_enabled,
        multi_branch_support: form.multi_branch_support,
        default_branch_manager_id: form.default_branch_manager_id || null,
        branch_targets: JSON.parse(form.branch_targets_text || "{}"),
        branch_specific_taxes: form.branch_specific_taxes,
        payment_methods: {
          cash: form.pay_cash,
          mpesa: form.pay_mpesa,
          airtelMoney: form.pay_airtel_money,
          card: form.pay_card,
          bankTransfer: form.pay_bank_transfer,
          giftCards: form.pay_gift_cards,
          storeCredit: form.pay_store_credit,
        },
        integrations: {
          mpesaApi: { enabled: form.mpesa_api_enabled },
          smsGateway: { enabled: form.sms_gateway_enabled },
          whatsappApi: { enabled: form.whatsapp_api_enabled },
          accountingSoftware: { enabled: form.accounting_integration_enabled },
        },
        sales_forecasting_enabled: form.sales_forecasting_enabled,
        slow_moving_stock_detection: form.slow_moving_stock_detection,
        customer_purchase_trends: form.customer_purchase_trends,
      };

      const [{ error: businessError }, { error: settingsError }] = await Promise.all([
        supabase
          .from("businesses")
          .update(businessPayload as never)
          .eq("id", business.id),
        supabase.from("business_system_settings" as "businesses").upsert(settingsPayload as never, {
          onConflict: "business_id" as "id",
        }),
      ]);

      if (businessError) throw businessError;
      if (settingsError) throw settingsError;

      toast.success("System settings saved");
      await refresh();
      await loadSettings();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function changePackage(plan: PackagePlan) {
    if (!business || !canEdit) return;
    setPackageSaving(plan);
    try {
      const trialStartedAt = business.trial_started_at
        ? new Date(business.trial_started_at)
        : new Date();
      const trialEndsAt = business.trial_ends_at ? new Date(business.trial_ends_at) : new Date();
      if (!business.trial_ends_at) trialEndsAt.setDate(trialStartedAt.getDate() + 14);

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
      setPackageSaving(null);
    }
  }

  async function updateAccountStatus(nextStatus: "active" | "suspended" | "deleted") {
    if (!business || !isOwner) return;
    const action =
      nextStatus === "active" ? "reactivate" : nextStatus === "suspended" ? "suspend" : "delete";
    const confirmed = window.confirm(
      nextStatus === "deleted"
        ? "Delete this account? This will permanently erase the business and its records from the database."
        : nextStatus === "suspended"
          ? "Suspend this account? Only the owner will be able to log in and check the account."
          : "Reactivate this account and restore staff access?",
    );
    if (!confirmed) return;

    setAccountAction(action);
    try {
      if (nextStatus === "deleted") {
        await deleteBusinessAccountFn({ data: { businessId: business.id } });
        toast.success("Account and business records deleted");
        nav({ to: "/onboarding" });
        return;
      }

      const now = new Date().toISOString();
      const { error } = await supabase
        .from("businesses")
        .update({
          account_status: nextStatus,
          account_suspended_at: nextStatus === "suspended" ? now : null,
          account_deleted_at: null,
        } as never)
        .eq("id", business.id)
        .eq("owner_id", business.owner_id || "");

      if (error) throw error;
      toast.success(nextStatus === "suspended" ? "Account suspended" : "Account reactivated");
      await refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update account");
    } finally {
      setAccountAction(null);
    }
  }

  async function copyShopSubdomainUrl() {
    if (!shopSubdomainUrl) return;
    try {
      await navigator.clipboard.writeText(shopSubdomainUrl);
      toast.success("Shop subdomain link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  const summaryCards = useMemo(
    () => [
      {
        label: "Business",
        value: form.business_name || "Missing",
        helper: form.country || "No country",
        icon: Building2,
      },
      {
        label: "Financial",
        value: form.currency,
        helper: `${form.default_tax_rate}% tax`,
        icon: Coins,
      },
      {
        label: "Payments",
        value: [form.pay_cash, form.pay_mpesa, form.pay_card].filter(Boolean).length,
        helper: "core methods active",
        icon: CreditCard,
      },
      {
        label: "Security",
        value: `${form.session_timeout_minutes}m`,
        helper: form.two_factor_auth_enabled ? "2FA enabled" : "2FA disabled",
        icon: ShieldCheck,
      },
    ],
    [form],
  );

  return (
    <div className="w-full p-4 md:p-8 space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 md:p-8 shadow-sm">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary/20 via-blue-500/10 to-transparent" />
        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <DatabaseBackup className="h-3.5 w-3.5" /> Enterprise POS configuration
            </div>
            <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">System Settings</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage business profile, finance, loyalty, cashiers, receipts, security, branches,
              payments, integrations, and analytics.
            </p>
          </div>
          <Button
            onClick={save}
            disabled={saving || loading || !canEdit}
            className="gradient-violet text-white border-0 h-11 px-6 gap-2 cursor-pointer"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>

      {!canEdit && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
          You can view settings, but only owners and admins can edit them.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm"
          >
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{card.label}</span>
              <card.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-4 text-2xl font-bold truncate">{card.value}</div>
            <div className="mt-1 text-xs text-muted-foreground truncate">{card.helper}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <aside className="rounded-2xl border border-border/60 bg-card p-2 lg:sticky lg:top-4 lg:self-start">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors cursor-pointer ${activeTab === tab.id ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-2xl border border-border/60 bg-card p-5 md:p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-border/60 pb-4 mb-5">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <activeTabMeta.icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{activeTabMeta.label}</h2>
              <p className="text-xs text-muted-foreground">Changes save to your tenant settings.</p>
            </div>
          </div>
          {loading ? (
            <div className="py-20 flex items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading settings...
            </div>
          ) : (
            <fieldset disabled={!canEdit || saving} className="space-y-5 disabled:opacity-70">
              {renderTab()}
            </fieldset>
          )}
        </section>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={save}
          disabled={saving || loading || !canEdit}
          className="gradient-violet text-white border-0 px-6 gap-2 cursor-pointer"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving Changes..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );

  function renderTab() {
    switch (activeTab) {
      case "package":
        return (
          <div className="space-y-5">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
              <div className="text-sm font-semibold">Current package</div>
              <div className="mt-2 text-3xl font-bold">{PACKAGE_LIMITS[currentPlan].name}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {currentPlan === "trial" && business?.trial_ends_at
                  ? `Trial ends ${new Date(business.trial_ends_at).toLocaleDateString()}`
                  : PACKAGE_LIMITS[currentPlan].support}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {(Object.keys(PACKAGE_LIMITS) as PackagePlan[]).map((plan) => {
                const limits = PACKAGE_LIMITS[plan];
                return (
                  <div
                    key={plan}
                    className={`rounded-2xl border p-5 ${currentPlan === plan ? "border-primary bg-primary/5" : "border-border/60 bg-background/40"}`}
                  >
                    <div className="text-lg font-semibold">{limits.name}</div>
                    <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                      <li>
                        {limits.maxBusinesses === null ? "Unlimited businesses" : "1 business"}
                      </li>
                      <li>
                        {limits.maxProducts === null
                          ? "Unlimited products"
                          : `Up to ${limits.maxProducts} products`}
                      </li>
                      <li>
                        {limits.maxStaff === null ? "Unlimited staff" : `${limits.maxStaff} staff`}
                      </li>
                      <li>{limits.mpesa ? "M-Pesa integration" : "Cash/card payments"}</li>
                      <li>{limits.analytics ? "Analytics" : "Basic dashboard"}</li>
                      <li>{limits.support}</li>
                    </ul>
                    <Button
                      type="button"
                      variant={currentPlan === plan ? "outline" : "default"}
                      disabled={currentPlan === plan || packageSaving !== null}
                      onClick={() => changePackage(plan)}
                      className={`mt-5 w-full ${currentPlan === plan ? "" : "gradient-violet text-white border-0"}`}
                    >
                      {packageSaving === plan
                        ? "Updating..."
                        : currentPlan === plan
                          ? "Current"
                          : "Switch package"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case "business":
        return (
          <>
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Globe2 className="h-4 w-4 text-primary" /> Shop subdomain link
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Share this URL with owners and staff to login directly to this business
                    workspace.
                  </p>
                  <div className="mt-3 break-all rounded-xl border border-border/60 bg-background/70 px-3 py-2 font-mono text-sm">
                    {shopSubdomainUrl || "No subdomain available"}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={copyShopSubdomainUrl}
                    disabled={!shopSubdomainUrl}
                    className="gap-2 cursor-pointer"
                  >
                    <Copy className="h-4 w-4" /> Copy
                  </Button>
                  {shopSubdomainUrl && (
                    <a
                      href={shopSubdomainUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                    >
                      <ExternalLink className="h-4 w-4" /> Open
                    </a>
                  )}
                </div>
              </div>
            </div>
            <Grid>
              <TextField
                label="Business Name"
                value={form.business_name}
                onChange={(value) => setValue("business_name", value)}
                required
              />
              <TextField
                label="Business Slogan"
                value={form.business_slogan}
                onChange={(value) => setValue("business_slogan", value)}
              />
              <TextField
                label="Phone Number"
                value={form.phone}
                onChange={(value) => setValue("phone", value)}
              />
              <TextField
                label="Email Address"
                type="email"
                value={form.email}
                onChange={(value) => setValue("email", value)}
              />
              <TextField
                label="Website URL"
                value={form.website_url}
                onChange={(value) => setValue("website_url", value)}
                placeholder="https://example.com"
              />
              <TextField
                label="City"
                value={form.city}
                onChange={(value) => setValue("city", value)}
              />
              <TextField
                label="Country"
                value={form.country}
                onChange={(value) => setValue("country", value)}
              />
              <TextField
                label="Registration Number"
                value={form.registration_number}
                onChange={(value) => setValue("registration_number", value)}
              />
              <TextField
                label="Tax PIN/VAT Number"
                value={form.tax_pin_vat_number}
                onChange={(value) => setValue("tax_pin_vat_number", value)}
              />
              <div className="space-y-2">
                <Label>Inventory Mode</Label>
                <Select
                  value={form.inventory_mode}
                  onValueChange={(v) => setValue("inventory_mode", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="products">
                      Products only (Requires stock tracking)
                    </SelectItem>
                    <SelectItem value="services">Services only (No stock tracking)</SelectItem>
                    <SelectItem value="both">Both Products and Services</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Grid>
            <TextAreaField
              label="Business Description"
              value={form.description}
              onChange={(value) => setValue("description", value)}
            />
            <TextAreaField
              label="Business Address"
              value={form.address}
              onChange={(value) => setValue("address", value)}
            />
            <LogoPicker
              label="Business Logo"
              preview={logoPreview}
              onRemove={() => {
                setLogoPreview(null);
                setLogoFile(null);
              }}
              onChange={(file) => chooseImage(file, setLogoFile, setLogoPreview)}
            />
          </>
        );
      case "financial":
        return (
          <>
            <Grid>
              <TextField
                label="Currency"
                value={form.currency}
                onChange={(value) => setValue("currency", value.toUpperCase())}
                placeholder="KES"
              />
              <TextField
                label="Currency Symbol"
                value={form.currency_symbol}
                onChange={(value) => setValue("currency_symbol", value)}
                placeholder="KSh"
              />
              <NumberField
                label="Decimal Places"
                value={form.decimal_places}
                onChange={(value) => numberValue("decimal_places", value)}
              />
              <NumberField
                label="Default Tax Rate (%)"
                value={form.default_tax_rate}
                step="0.01"
                onChange={(value) => numberValue("default_tax_rate", value)}
              />
              <SelectField
                label="Tax Inclusive/Exclusive Pricing"
                value={form.tax_pricing_mode}
                onChange={(value) => setValue("tax_pricing_mode", value)}
                options={[
                  ["exclusive", "Tax Exclusive"],
                  ["inclusive", "Tax Inclusive"],
                ]}
              />
              <NumberField
                label="Discount Limit (%)"
                value={form.max_discount_percentage}
                step="0.01"
                onChange={(value) => numberValue("max_discount_percentage", value)}
              />
              <NumberField
                label="Maximum Refund Amount"
                value={form.max_refund_amount}
                step="0.01"
                onChange={(value) => numberValue("max_refund_amount", value)}
              />
            </Grid>
            <TextAreaField
              label="Refund Policy"
              value={form.refund_policy}
              onChange={(value) => setValue("refund_policy", value)}
            />
          </>
        );
      case "loyalty":
        return (
          <>
            <Grid>
              <NumberField
                label="Points Per Amount Spent"
                value={form.points_per_amount_spent}
                step="0.01"
                onChange={(value) => numberValue("points_per_amount_spent", value)}
              />
              <NumberField
                label="Amount Basis"
                value={form.loyalty_amount_basis}
                step="0.01"
                onChange={(value) => numberValue("loyalty_amount_basis", value)}
                helper={`Example: ${form.points_per_amount_spent} point(s) per ${form.currency_symbol}${form.loyalty_amount_basis}`}
              />
              <NumberField
                label="Redemption Rate"
                value={form.redemption_rate}
                step="0.01"
                onChange={(value) => numberValue("redemption_rate", value)}
                helper="Cash value per point"
              />
              <NumberField
                label="Minimum Redeemable Points"
                value={form.minimum_redeemable_points}
                onChange={(value) => numberValue("minimum_redeemable_points", value)}
              />
              <NumberField
                label="Points Expiry Days"
                value={form.points_expiry_days}
                onChange={(value) => numberValue("points_expiry_days", value)}
              />
              <NumberField
                label="Birthday Reward Points"
                value={form.birthday_reward_points}
                onChange={(value) => numberValue("birthday_reward_points", value)}
              />
            </Grid>
            <Toggle
              label="Birthday Rewards"
              checked={form.birthday_rewards_enabled}
              onChange={(value) => setValue("birthday_rewards_enabled", value)}
            />
            <TextAreaField
              label="Customer Membership Levels (JSON)"
              value={form.membership_levels_text}
              onChange={(value) => setValue("membership_levels_text", value)}
              rows={8}
            />
          </>
        );
      case "users":
        return (
          <>
            <Grid>
              <TextField
                label="Cashier Login Start Time"
                type="time"
                value={form.cashier_login_start_time}
                onChange={(value) => setValue("cashier_login_start_time", value)}
              />
              <TextField
                label="Cashier Login End Time"
                type="time"
                value={form.cashier_login_end_time}
                onChange={(value) => setValue("cashier_login_end_time", value)}
              />
              <NumberField
                label="Maximum Discount Percentage"
                value={form.max_discount_percentage}
                step="0.01"
                onChange={(value) => numberValue("max_discount_percentage", value)}
              />
              <NumberField
                label="Maximum Refund Amount"
                value={form.max_refund_amount}
                step="0.01"
                onChange={(value) => numberValue("max_refund_amount", value)}
              />
              <NumberField
                label="Minimum Password Length"
                value={form.password_min_length}
                onChange={(value) => numberValue("password_min_length", value)}
              />
            </Grid>
            <div>
              <Label>Allowed Working Days</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {DAYS.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleDay(value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${form.allowed_working_days.includes(value) ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Toggle
                label="Require Uppercase"
                checked={form.password_require_uppercase}
                onChange={(value) => setValue("password_require_uppercase", value)}
              />
              <Toggle
                label="Require Lowercase"
                checked={form.password_require_lowercase}
                onChange={(value) => setValue("password_require_lowercase", value)}
              />
              <Toggle
                label="Require Number"
                checked={form.password_require_number}
                onChange={(value) => setValue("password_require_number", value)}
              />
              <Toggle
                label="Require Symbol"
                checked={form.password_require_symbol}
                onChange={(value) => setValue("password_require_symbol", value)}
              />
              <Toggle
                label="Two-Factor Authentication"
                checked={form.two_factor_auth_enabled}
                onChange={(value) => setValue("two_factor_auth_enabled", value)}
              />
            </div>
          </>
        );
      case "appearance":
        return (
          <>
            <Grid>
              <ColorField
                label="Primary Color"
                value={form.primary_color}
                onChange={(value) => setValue("primary_color", value)}
              />
              <ColorField
                label="Secondary Color"
                value={form.secondary_color}
                onChange={(value) => setValue("secondary_color", value)}
              />
              <ColorField
                label="Sidebar Color"
                value={form.sidebar_color}
                onChange={(value) => setValue("sidebar_color", value)}
              />
              <SelectField
                label="Light/Dark Mode"
                value={form.color_mode}
                onChange={(value) => setValue("color_mode", value)}
                options={[
                  ["system", "Use System"],
                  ["light", "Light"],
                  ["dark", "Dark"],
                ]}
              />
            </Grid>
            <div>
              <Label>Preset Primary Colors</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setValue("primary_color", color)}
                    className="h-9 w-9 rounded-full border border-border ring-offset-background hover:scale-105 transition-transform"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <LogoPicker
              label="Receipt Logo"
              preview={receiptLogoPreview}
              onRemove={() => {
                setReceiptLogoPreview(null);
                setReceiptLogoFile(null);
              }}
              onChange={(file) => chooseImage(file, setReceiptLogoFile, setReceiptLogoPreview)}
            />
            <TextAreaField
              label="Receipt Footer Message"
              value={form.receipt_footer_message}
              onChange={(value) => setValue("receipt_footer_message", value)}
            />
          </>
        );
      case "receipt":
        return (
          <>
            <Grid>
              <SelectField
                label="Receipt Width"
                value={form.receipt_width}
                onChange={(value) => setValue("receipt_width", value)}
                options={[
                  ["58mm", "58mm"],
                  ["80mm", "80mm"],
                  ["a4", "A4"],
                ]}
              />
            </Grid>
            <TextAreaField
              label="Receipt Header"
              value={form.receipt_header}
              onChange={(value) => setValue("receipt_header", value)}
            />
            <TextAreaField
              label="Receipt Footer"
              value={form.receipt_footer}
              onChange={(value) => setValue("receipt_footer", value)}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Toggle
                label="Show Tax Breakdown"
                checked={form.show_tax_breakdown}
                onChange={(value) => setValue("show_tax_breakdown", value)}
              />
              <Toggle
                label="Show Cashier Name"
                checked={form.show_cashier_name}
                onChange={(value) => setValue("show_cashier_name", value)}
              />
              <Toggle
                label="Show Loyalty Points"
                checked={form.show_loyalty_points}
                onChange={(value) => setValue("show_loyalty_points", value)}
              />
              <Toggle
                label="QR Code"
                checked={form.show_receipt_qr_code}
                onChange={(value) => setValue("show_receipt_qr_code", value)}
              />
              <Toggle
                label="Barcode"
                checked={form.show_receipt_barcode}
                onChange={(value) => setValue("show_receipt_barcode", value)}
              />
            </div>
          </>
        );
      case "inventory":
        return (
          <>
            <Grid>
              <NumberField
                label="Low Stock Alert Threshold"
                value={form.low_stock_alert_threshold}
                onChange={(value) => numberValue("low_stock_alert_threshold", value)}
              />
              <NumberField
                label="Auto Reorder Level"
                value={form.auto_reorder_level}
                onChange={(value) => numberValue("auto_reorder_level", value)}
              />
              <SelectField
                label="Negative Stock Control"
                value={form.negative_stock_control}
                onChange={(value) => setValue("negative_stock_control", value)}
                options={[
                  ["block", "Block Sale"],
                  ["warn", "Warn Cashier"],
                  ["allow", "Allow"],
                ]}
              />
              <NumberField
                label="Product Expiry Alert Days"
                value={form.product_expiry_alert_days}
                onChange={(value) => numberValue("product_expiry_alert_days", value)}
              />
            </Grid>
            <Toggle
              label="Batch Tracking"
              checked={form.batch_tracking_enabled}
              onChange={(value) => setValue("batch_tracking_enabled", value)}
            />
          </>
        );
      case "sales":
        return (
          <ToggleGrid
            items={[
              ["Allow Backdated Sales", "allow_backdated_sales"],
              ["Allow Price Override", "allow_price_override"],
              ["Allow Open Pricing", "allow_open_pricing"],
              ["Credit Sales", "credit_sales_enabled"],
              ["Quotations", "quotations_enabled"],
              ["Proforma Invoices", "proforma_invoices_enabled"],
            ]}
          />
        );
      case "notifications":
        return (
          <ToggleGrid
            items={[
              ["Low Stock Notifications", "low_stock_notifications"],
              ["Daily Sales Summary", "daily_sales_summary"],
              ["Weekly Sales Report", "weekly_sales_report"],
              ["Email Notifications", "email_notifications"],
              ["SMS Notifications", "sms_notifications"],
              ["WhatsApp Notifications", "whatsapp_notifications"],
            ]}
          />
        );
      case "security":
        return (
          <>
            <Grid>
              <SelectField
                label="Backup Frequency"
                value={form.backup_frequency}
                onChange={(value) => setValue("backup_frequency", value)}
                options={[
                  ["hourly", "Hourly"],
                  ["daily", "Daily"],
                  ["weekly", "Weekly"],
                  ["monthly", "Monthly"],
                ]}
              />
              <NumberField
                label="Session Timeout (minutes)"
                value={form.session_timeout_minutes}
                onChange={(value) => numberValue("session_timeout_minutes", value)}
              />
            </Grid>
            <ToggleGrid
              items={[
                ["Automatic Backups", "automatic_backups"],
                ["Audit Logs", "audit_logs_enabled"],
                ["Login History", "login_history_enabled"],
                ["Device Management", "device_management_enabled"],
                ["IP Restrictions", "ip_restrictions_enabled"],
              ]}
            />
          </>
        );
      case "branches":
        return (
          <>
            <Grid>
              <TextField
                label="Branch Manager User ID"
                value={form.default_branch_manager_id}
                onChange={(value) => setValue("default_branch_manager_id", value)}
              />
            </Grid>
            <Toggle
              label="Multi-Branch Support"
              checked={form.multi_branch_support}
              onChange={(value) => setValue("multi_branch_support", value)}
            />
            <Toggle
              label="Branch-Specific Taxes"
              checked={form.branch_specific_taxes}
              onChange={(value) => setValue("branch_specific_taxes", value)}
            />
            <TextAreaField
              label="Branch Targets (JSON)"
              value={form.branch_targets_text}
              onChange={(value) => setValue("branch_targets_text", value)}
              rows={8}
            />
          </>
        );
      case "payments":
        return (
          <ToggleGrid
            items={[
              ["Cash", "pay_cash"],
              ["M-Pesa", "pay_mpesa"],
              ["Airtel Money", "pay_airtel_money"],
              ["Card Payments", "pay_card"],
              ["Bank Transfers", "pay_bank_transfer"],
              ["Gift Cards", "pay_gift_cards"],
              ["Store Credit", "pay_store_credit"],
            ]}
          />
        );
      case "integrations":
        return (
          <ToggleGrid
            items={[
              ["M-Pesa API", "mpesa_api_enabled"],
              ["SMS Gateway", "sms_gateway_enabled"],
              ["WhatsApp API", "whatsapp_api_enabled"],
              ["Accounting Software Integration", "accounting_integration_enabled"],
            ]}
          />
        );
      case "analytics":
        return (
          <ToggleGrid
            items={[
              ["Sales Forecasting", "sales_forecasting_enabled"],
              ["Slow Moving Stock Detection", "slow_moving_stock_detection"],
              ["Customer Purchase Trends", "customer_purchase_trends"],
            ]}
          />
        );
      case "account":
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-background/70 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold">Account status</div>
                  <div className="mt-2 text-2xl font-bold capitalize">{accountStatus}</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Suspended accounts allow owner access only. Deleted accounts block workspace
                    access.
                  </p>
                </div>
                <div className="rounded-full border border-border px-3 py-1 text-xs font-medium capitalize text-muted-foreground">
                  {accountStatus}
                </div>
              </div>
            </div>

            {!isOwner && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
                Only the business owner can suspend, reactivate, or delete the account.
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
                <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300">
                  <Power className="h-4 w-4" /> Suspend account
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Temporarily locks out employees and admins. The owner can still log in to review
                  or reactivate the account.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    !isOwner ||
                    accountAction !== null ||
                    accountStatus === "suspended" ||
                    accountStatus === "deleted"
                  }
                  onClick={() => updateAccountStatus("suspended")}
                  className="mt-4 w-full border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
                >
                  {accountAction === "suspend" ? "Suspending..." : "Suspend Account"}
                </Button>
              </div>

              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
                <div className="flex items-center gap-2 font-semibold text-destructive">
                  <Trash2 className="h-4 w-4" /> Delete account
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Permanently erases the business and its linked records. Use this only when the
                  account should no longer exist.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!isOwner || accountAction !== null || accountStatus === "deleted"}
                  onClick={() => updateAccountStatus("deleted")}
                  className="mt-4 w-full"
                >
                  {accountAction === "delete" ? "Deleting..." : "Delete Account"}
                </Button>
              </div>
            </div>

            {accountStatus === "suspended" && (
              <Button
                type="button"
                disabled={!isOwner || accountAction !== null}
                onClick={() => updateAccountStatus("active")}
                className="gradient-violet text-white border-0"
              >
                {accountAction === "reactivate" ? "Reactivating..." : "Reactivate Account"}
              </Button>
            )}
          </div>
        );
      default:
        return null;
    }
  }

  function ToggleGrid({ items }: { items: [string, keyof SettingsForm][] }) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map(([label, key]) => (
          <Toggle
            key={String(key)}
            label={label}
            checked={Boolean(form[key])}
            onChange={(value) => setForm((current) => ({ ...current, [key]: value }))}
          />
        ))}
      </div>
    );
  }
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        className="mt-1"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = "1",
  helper,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
  step?: string;
  helper?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        className="mt-1"
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Textarea
        className="mt-1 font-mono text-sm"
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex gap-2">
        <Input
          type="color"
          className="h-10 w-14 p-1"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <Input
          className="font-mono uppercase"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/70 p-3 cursor-pointer">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="checkbox"
        className="h-4 w-4 accent-primary"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function LogoPicker({
  label,
  preview,
  onRemove,
  onChange,
}: {
  label: string;
  preview: string | null;
  onRemove: () => void;
  onChange: (file: File | undefined) => void;
}) {
  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 flex flex-col sm:flex-row items-center gap-4">
        {preview ? (
          <div className="relative h-24 w-24 rounded-lg overflow-hidden border border-border bg-white group flex items-center justify-center">
            <img src={preview} alt={`${label} preview`} className="h-full w-full object-contain" />
            <button
              type="button"
              onClick={onRemove}
              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="h-24 w-24 rounded-lg border border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
        <div className="space-y-2 text-center sm:text-left">
          <label className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground cursor-pointer hover:bg-secondary/80">
            <Upload className="h-3.5 w-3.5" /> {preview ? "Change Image" : "Upload Image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => onChange(event.target.files?.[0])}
            />
          </label>
          <p className="text-xs text-muted-foreground">PNG or JPG, up to 5MB.</p>
        </div>
      </div>
    </div>
  );
}
