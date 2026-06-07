import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant-context";
import { supabase } from "@/integrations/supabase/client";
import { Bell, AlertTriangle, Truck, Clock, Info, CheckCircle2, Check, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBusinessRealtime } from "@/lib/use-business-realtime";

export const Route = createFileRoute("/t/$slug/notifications")({ component: NotificationsPage });

type NotificationData = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  derived?: boolean;
};

function NotificationsPage() {
  const { business } = useTenant();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [activeTab, setActiveTab] = useState("unread");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (business) loadNotifications();
  }, [business]);

  useBusinessRealtime(business?.id, ["notifications", "products", "purchase_orders", "sales"], loadNotifications);

  async function loadNotifications() {
    if (!business) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const derivedAlerts = await buildDatabaseAlerts();
      setNotifications([...(derivedAlerts as NotificationData[]), ...((data || []) as NotificationData[])]);
    } catch (e: any) {
      toast.error("Failed to load notifications: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(id: string) {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);
      if (error) throw error;
      setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  
  async function markAllAsRead() {
    if (!business) return;
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("business_id", business.id)
        .eq("is_read", false);
      if (error) throw error;
      setNotifications(n => n.map(x => ({ ...x, is_read: true })));
      toast.success("All caught up!");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function buildDatabaseAlerts() {
    if (!business) return;
    const now = new Date().toISOString();
    const [{ data: products }, { data: suppliers }, { data: purchaseOrders }] = await Promise.all([
      supabase.from("products").select("id,name,stock_quantity,low_stock_alert,active").eq("business_id", business.id).eq("active", true),
      supabase.from("suppliers").select("id,supplier_name,delivery_days").eq("business_id", business.id),
      supabase.from("purchase_orders").select("id,status,total_amount,created_at,suppliers(supplier_name)").eq("business_id", business.id).eq("status", "pending"),
    ]);

    const alerts: NotificationData[] = [];
    (products || [])
      .filter(p => Number(p.stock_quantity || 0) <= Number(p.low_stock_alert || 0))
      .forEach(p => alerts.push({
        id: `derived-low-stock-${p.id}`,
        title: `Low stock: ${p.name}`,
        message: `${p.name} has ${p.stock_quantity ?? 0} units left. Restock threshold is ${p.low_stock_alert ?? 0}.`,
        type: "low_stock",
        is_read: false,
        created_at: now,
        derived: true,
      }));

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowLabel = tomorrow.toLocaleDateString(undefined, { weekday: "short" });
    (suppliers || []).forEach(s => {
      let days: string[] = [];
      try { days = s.delivery_days ? JSON.parse(s.delivery_days) : []; } catch { days = s.delivery_days ? String(s.delivery_days).split(",").map(d => d.trim()) : []; }
      if (days.includes(tomorrowLabel)) {
        alerts.push({
          id: `derived-delivery-${s.id}-${tomorrowLabel}`,
          title: `Delivery due: ${s.supplier_name}`,
          message: `${s.supplier_name} is scheduled for delivery on ${tomorrowLabel}.`,
          type: "delivery",
          is_read: false,
          created_at: now,
          derived: true,
        });
      }
    });

    (purchaseOrders || []).forEach((po: any) => {
      const ageDays = Math.floor((Date.now() - new Date(po.created_at).getTime()) / 86400000);
      if (ageDays >= 7) {
        alerts.push({
          id: `derived-overdue-po-${po.id}`,
          title: `Pending PO: ${po.id.substring(0, 8).toUpperCase()}`,
          message: `${po.suppliers?.supplier_name || "Supplier"} purchase order has been pending for ${ageDays} days.`,
          type: "overdue",
          is_read: false,
          created_at: now,
          derived: true,
        });
      }
    });

    return alerts;
  }

  async function syncDatabaseAlerts() {
    if (!business) return;
    setSyncing(true);
    try {
      const alerts = await buildDatabaseAlerts();
      if (!alerts?.length) {
        toast.success("No database alerts found");
        return;
      }
      const { data: existing } = await supabase
        .from("notifications")
        .select("title,message,is_read")
        .eq("business_id", business.id);
      const existingKeys = new Set((existing || []).map(n => `${n.title}|${n.message}`));
      const inserts = alerts
        .filter(a => !existingKeys.has(`${a.title}|${a.message}`))
        .map(a => ({ business_id: business.id, type: a.type, title: a.title, message: a.message }));
      if (inserts.length) await supabase.from("notifications").insert(inserts);
      toast.success(inserts.length ? `Synced ${inserts.length} database alerts` : "Database alerts already synced");
      loadNotifications();
    } catch (e: any) {
      toast.error(e.message || "Failed to sync alerts");
    } finally {
      setSyncing(false);
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "low_stock": return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case "delivery": return <Truck className="h-5 w-5 text-blue-500" />;
      case "overdue": return <Clock className="h-5 w-5 text-red-500" />;
      case "update": return <Info className="h-5 w-5 text-emerald-500" />;
      default: return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const filtered = notifications.filter(n => activeTab === "all" || (activeTab === "unread" && !n.is_read));

  return (
    <div className="w-full p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            Notifications <Bell className="h-6 w-6 text-muted-foreground" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Stay updated on stocks, deliveries, and system alerts.</p>
        </div>
        <div className="flex gap-2">
          {notifications.some(n => !n.is_read) && (
            <Button variant="outline" onClick={markAllAsRead} className="gap-2">
              <CheckCircle2 className="h-4 w-4" /> Mark all as read
            </Button>
          )}
          <Button variant="outline" onClick={syncDatabaseAlerts} disabled={syncing} className="gap-2">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Sync database alerts
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
        Alerts shown here are loaded from saved notifications plus live checks against actual products, suppliers, and purchase orders in your database. No fake test alerts are generated.
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="unread">Unread ({notifications.filter(n => !n.is_read).length})</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center p-12 border border-dashed rounded-xl bg-muted/20">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3 opacity-50" />
              <div className="text-muted-foreground">No {activeTab} notifications found.</div>
            </div>
          ) : (
            filtered.map(n => (
              <motion.div 
                key={n.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-xl border flex gap-4 ${n.is_read ? 'bg-background border-border/50 opacity-70' : 'bg-background shadow-sm border-border'}`}
              >
                <div className="mt-0.5 shrink-0">
                  <div className={`p-2 rounded-lg ${n.is_read ? 'bg-muted/50' : 'bg-muted'}`}>
                    {getIcon(n.type)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className={`font-semibold text-sm ${n.is_read ? 'text-muted-foreground' : 'text-foreground'}`}>{n.title}</h4>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                      {new Date(n.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  {n.derived && <span className="mt-2 inline-flex rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">Live database alert</span>}
                </div>
                {!n.is_read && !n.derived && (
                  <div className="shrink-0 flex items-center">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-emerald-500/10 hover:text-emerald-600" onClick={() => markAsRead(n.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>
      </Tabs>
    </div>
  );
}
