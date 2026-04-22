"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase, BACKEND_URL } from "@/lib/supabase";
import { Order, Product, DashboardStats } from "@/lib/types";
import KanbanBoard from "@/components/KanbanBoard";
import AlertsPanel from "@/components/AlertsPanel";
import InventoryPanel from "@/components/InventoryPanel";
import MockChat from "@/components/MockChat";

const MERCHANT_ID = process.env.NEXT_PUBLIC_MERCHANT_ID || "00000000-0000-0000-0000-000000000001";

function SupplyLahLogo() {
  return (
    <Link href="/dashboard" className="flex items-center">
      <img 
        src="/logo.png" 
        alt="SupplyLah" 
        className="h-10 md:h-12 w-auto scale-[2] md:scale-[2.5] origin-left object-contain" 
      />
    </Link>
  );
}

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeTab, setActiveTab] = useState<"command" | "demo">("command");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    const [ordersResult, inventoryResult, statsResult] = await Promise.allSettled([
      fetch(`${BACKEND_URL}/api/orders?merchant_id=${MERCHANT_ID}`),
      fetch(`${BACKEND_URL}/api/inventory?merchant_id=${MERCHANT_ID}`),
      fetch(`${BACKEND_URL}/api/stats?merchant_id=${MERCHANT_ID}`),
    ]);

    if (ordersResult.status === "fulfilled" && ordersResult.value.ok) {
      const d = await ordersResult.value.json();
      setOrders(d.orders || []);
    }
    if (inventoryResult.status === "fulfilled" && inventoryResult.value.ok) {
      const d = await inventoryResult.value.json();
      setInventory(d.inventory || []);
    }
    if (statsResult.status === "fulfilled" && statsResult.value.ok) {
      setStats(await statsResult.value.json());
    }
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel("order-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "order" }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const alertCount = orders.filter(
    (o) => o.requires_human_review && o.order_status !== "Confirmed" && o.order_status !== "Dispatched"
  ).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <SupplyLahLogo />
          <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-semibold">
            Command Centre
          </span>
        </div>

        <div className="flex items-center gap-4">
          {alertCount > 0 && (
            <button
              onClick={() => setActiveTab("command")}
              className="flex items-center gap-1.5 text-sm text-red-600 font-semibold alert-pulse"
            >
              🔴 {alertCount} alert{alertCount > 1 ? "s" : ""}
            </button>
          )}
          <span className="text-xs text-slate-400">
            {lastRefresh
              ? `Updated ${lastRefresh.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : "Updating..."}
          </span>
          <button
            onClick={fetchData}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-medium"
          >
            ↻ Refresh
          </button>
        </div>
      </nav>

      {/* Tabs */}
      <div className="px-6 pt-4 flex gap-2">
        {[
          { id: "command", label: "🏗 Command Centre" },
          { id: "demo",    label: "💬 Demo Chat" },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as "command" | "demo")}
            className={`text-sm font-semibold px-4 py-2 rounded-xl transition-all ${
              activeTab === id
                ? "bg-teal-700 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <main className="px-6 py-4 space-y-4">
        {activeTab === "command" && (
          <>
            {stats && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {[
                  { label: "Today",    value: stats.total_today,              color: "text-slate-700" },
                  { label: "Pending",  value: stats.pending,                  color: "text-yellow-600" },
                  { label: "Awaiting", value: stats.awaiting_confirmation,    color: "text-blue-600" },
                  { label: "Confirmed",value: stats.confirmed,                color: "text-teal-600" },
                  { label: "Dispatched",value: stats.dispatched,              color: "text-purple-600" },
                  { label: "⚠ Review", value: stats.requires_review,          color: "text-red-600" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                    <p className={`text-2xl font-black ${color}`}>{value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-3">
                <KanbanBoard orders={orders} onRefresh={fetchData} />
              </div>
              <div className="space-y-4">
                <AlertsPanel orders={orders} onRefresh={fetchData} />
                <InventoryPanel inventory={inventory} />
              </div>
            </div>
          </>
        )}

        {activeTab === "demo" && (
          <div className="max-w-md mx-auto space-y-3">
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-sm text-teal-700">
              <strong>Demo Mode</strong> — This simulates a buyer sending WhatsApp messages.
              Responses come from the real AI pipeline. Check the Command Centre tab to see orders appear live.
            </div>
            <MockChat />
          </div>
        )}
      </main>
    </div>
  );
}
