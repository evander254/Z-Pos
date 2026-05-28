import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant-context";
import { formatMoney } from "@/lib/format";
import { TrendingUp, Clock, Percent, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/t/$slug/insights")({ component: InsightsDashboard });

function InsightsDashboard() {
  const { business } = useTenant();
  const [loading, setLoading] = useState(true);

  // Mock data for initial presentation
  const marginData = { revenue: 45000, profit: 15750, margin: 35 };
  const restockingItems = [
    { name: "Premium Coffee Beans", stock: 12, velocity: "8/day", runsOut: "1.5 days" },
    { name: "Almond Milk", stock: 4, velocity: "5/day", runsOut: "0.8 days" },
    { name: "Paper Cups (Large)", stock: 150, velocity: "120/day", runsOut: "1.2 days" }
  ];
  
  const heatmapData = [
    { day: "Mon", hours: [20, 30, 45, 80, 100, 60, 30] },
    { day: "Tue", hours: [15, 25, 40, 75, 90, 50, 25] },
    { day: "Wed", hours: [25, 35, 50, 85, 95, 65, 35] },
    { day: "Thu", hours: [30, 40, 60, 90, 100, 75, 45] },
    { day: "Fri", hours: [40, 50, 80, 100, 100, 90, 60] },
    { day: "Sat", hours: [60, 80, 100, 90, 70, 50, 40] },
    { day: "Sun", hours: [50, 70, 90, 80, 60, 40, 30] },
  ];
  const timeLabels = ["8am", "10am", "12pm", "2pm", "4pm", "6pm", "8pm"];

  useEffect(() => {
    // Simulate Supabase fetch
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (!business) return null;
  const currency = business.currency || "KES";

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Business Insights</h1>
        <p className="text-sm text-muted-foreground mt-1">Predictive analytics and performance metrics for your store.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Margin Tracker */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 lg:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Margin Tracker</div>
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Percent className="h-4 w-4 text-white" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Gross Profit Margin</p>
          </div>
          <div className="mt-6">
            {loading ? (
              <div className="space-y-2">
                <div className="h-10 w-24 bg-muted animate-pulse rounded"></div>
                <div className="h-4 w-32 bg-muted animate-pulse rounded"></div>
              </div>
            ) : (
              <>
                <div className="text-4xl font-bold">{marginData.margin}%</div>
                <div className="text-sm text-muted-foreground mt-2 flex justify-between border-t border-border pt-2">
                  <span>Revenue: <span className="font-medium text-foreground">{formatMoney(marginData.revenue, currency)}</span></span>
                  <span>Profit: <span className="font-medium text-foreground">{formatMoney(marginData.profit, currency)}</span></span>
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* Predictive Restocking */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Smart Restock Recommendations</div>
              <div className="text-xs text-muted-foreground mt-1">Products likely to run out in the next 48 hours</div>
            </div>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-destructive to-accent flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-white" />
            </div>
          </div>
          
          <div className="mt-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-12 w-full bg-muted animate-pulse rounded-lg"></div>)}
              </div>
            ) : (
              <div className="space-y-2">
                {restockingItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/50">
                    <div>
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-xs text-muted-foreground">Current Stock: {item.stock} • Velocity: {item.velocity}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-1 rounded-md">Runs out in {item.runsOut}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Peak Hours Heatmap */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-sm font-medium">Peak Hours Heatmap</div>
            <div className="text-xs text-muted-foreground mt-1">Busiest hours based on historical transaction volume</div>
          </div>
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
            <Clock className="h-4 w-4 text-white" />
          </div>
        </div>

        {loading ? (
          <div className="h-64 w-full bg-muted animate-pulse rounded-lg"></div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="grid grid-cols-8 gap-1 mb-1">
                <div className="col-span-1"></div>
                {timeLabels.map((time, i) => (
                  <div key={i} className="text-center text-xs text-muted-foreground">{time}</div>
                ))}
              </div>
              
              {heatmapData.map((row, i) => (
                <div key={i} className="grid grid-cols-8 gap-1 mb-1 items-center">
                  <div className="col-span-1 text-xs font-medium text-muted-foreground">{row.day}</div>
                  {row.hours.map((intensity, j) => (
                    <div 
                      key={j} 
                      className="h-10 rounded-md flex items-center justify-center text-[10px] font-medium transition-all hover:scale-105 hover:shadow-md cursor-help border border-border/5"
                      style={{ 
                        backgroundColor: `color-mix(in srgb, var(--theme-primary) ${intensity}%, transparent)`,
                        opacity: intensity < 20 ? 0.2 : (intensity / 100) + 0.1,
                        color: intensity > 60 ? 'white' : 'inherit'
                      }}
                      title={`${row.day} at ${timeLabels[j]}: ~${intensity}% capacity`}
                    >
                      {intensity > 70 ? 'High' : intensity > 40 ? 'Med' : ''}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
