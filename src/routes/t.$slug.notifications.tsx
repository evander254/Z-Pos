import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant-context";
import { supabase } from "@/integrations/supabase/client";
import { Bell, AlertTriangle, Truck, Clock, Info, CheckCircle2, Check, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/t/$slug/notifications")({ component: NotificationsPage });

type NotificationData = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
};

function NotificationsPage() {
  const { business } = useTenant();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [activeTab, setActiveTab] = useState("unread");

  useEffect(() => {
    if (business) loadNotifications();
    
    if (business) {
      const channel = supabase.channel('page_notifications_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `business_id=eq.${business.id}` }, () => {
          loadNotifications();
        }).subscribe();
        
      return () => { supabase.removeChannel(channel); };
    }
  }, [business]);

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
      setNotifications(data || []);
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

  // Debug function for mock notifications
  async function triggerMockAlert(type: string, title: string, message: string) {
    if (!business) return;
    try {
      await supabase.from("notifications").insert({
        business_id: business.id,
        type,
        title,
        message
      });
      toast.success("Test alert generated");
    } catch(e) {
      console.error(e);
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
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
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
        </div>
      </div>
      
      {/* Dev test buttons (hidden in real prod, but useful here for testing) */}
      <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg border border-dashed border-border/50 text-xs">
        <span className="font-semibold text-muted-foreground self-center mr-2">Test Triggers:</span>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => triggerMockAlert("low_stock", "Low Stock Alert", "Paracetamol 500mg is below minimum threshold (3 left).")}>Low Stock</Button>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => triggerMockAlert("delivery", "Next Delivery", "Supplier 'Fresh Farms' is scheduled to deliver tomorrow.")}>Delivery</Button>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => triggerMockAlert("overdue", "Overdue Invoice", "Purchase Order PO-3829 is overdue for payment.")}>Overdue</Button>
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
                </div>
                {!n.is_read && (
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
