"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, BACKEND_URL } from "@/lib/supabase";
import { Order, Product, DashboardStats } from "@/lib/types";
import KanbanBoard from "@/components/KanbanBoard";
import AlertsPanel from "@/components/AlertsPanel";
import InventoryPanel from "@/components/InventoryPanel";
import MockChat from "@/components/MockChat";

const DEMO_MERCHANT_ID = process.env.NEXT_PUBLIC_MERCHANT_ID || "00000000-0000-0000-0000-000000000001";

interface UserProfile {
  fullName: string;
  businessName: string;
  email: string;
  initials: string;
}

/* ── Promo modal (shown to unauthenticated demo users) ── */
function PromoModal({ feature, onClose }: { feature: string; onClose: () => void }) {
  const FEATURE_COPY: Record<string, { headline: string; sub: string }> = {
    settings: {
      headline: "Your store, your rules",
      sub: "Set minimum order values, delivery fees, discount rules, and substitution logic — all in one place.",
    },
    team: {
      headline: "Bring your whole team in",
      sub: "Invite warehouse managers and staff with role-based access. Everyone sees what they need to.",
    },
    inventory: {
      headline: "Your stock, always in sync",
      sub: "Connect Google Sheets or add products manually. Every order quote checks live stock levels.",
    },
  };
  const copy = FEATURE_COPY[feature] ?? FEATURE_COPY.settings;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center relative"
        onClick={(e) => e.stopPropagation()}>

        {/* Close */}
        <button onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors text-lg">
          ×
        </button>

        {/* Mascot */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mascot-hero.png" alt="" className="w-28 h-28 object-contain mx-auto mb-4 drop-shadow-xl animate-float"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />

        {/* Copy */}
        <h2 className="text-2xl font-black text-teal-900 mb-2 leading-tight">{copy.headline}</h2>
        <p className="text-slate-500 text-sm leading-relaxed mb-6">{copy.sub}</p>

        {/* Perks */}
        <div className="bg-teal-50 rounded-2xl px-5 py-4 mb-6 text-left space-y-2">
          {["Free to start — no credit card needed", "Set up in under 3 minutes", "Your own data, your own workspace"].map(t => (
            <div key={t} className="flex items-center gap-2 text-sm text-teal-800">
              <span className="text-teal-500 font-bold">✓</span> {t}
            </div>
          ))}
        </div>

        <Link href="/signup"
          className="btn-primary block w-full py-3.5 text-sm font-bold text-center">
          Create your free account →
        </Link>
        <button onClick={onClose} className="mt-3 text-xs text-slate-400 hover:text-slate-600 transition-colors">
          Maybe later
        </button>
      </div>
    </div>
  );
}

/* ── Profile dropdown ── */
function ProfileMenu({ profile, isAuthenticated, onLogout }: {
  profile: UserProfile;
  isAuthenticated: boolean;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [promo, setPromo] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function menuItem(icon: string, label: string, href: string, promoKey: string) {
    if (isAuthenticated) {
      return (
        <Link href={href} onClick={() => setOpen(false)}
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
          <span className="text-base">{icon}</span> {label}
        </Link>
      );
    }
    return (
      <button onClick={() => { setOpen(false); setPromo(promoKey); }}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
        <span className="text-base">{icon}</span>
        <span>{label}</span>
        <span className="ml-auto text-[10px] bg-teal-100 text-teal-600 font-semibold px-1.5 py-0.5 rounded-full">Pro</span>
      </button>
    );
  }

  return (
    <>
      {promo && <PromoModal feature={promo} onClose={() => setPromo(null)} />}

      <div className="relative" ref={ref}>
        <button onClick={() => setOpen(!open)}
          className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all duration-200">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0 ${isAuthenticated ? "bg-teal-600" : "bg-slate-400"}`}>
            {isAuthenticated ? profile.initials : "?"}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-semibold text-slate-800 leading-tight">
              {isAuthenticated ? profile.businessName : "Demo Mode"}
            </p>
            <p className="text-xs text-slate-400 leading-tight">
              {isAuthenticated ? profile.fullName : "Not signed in"}
            </p>
          </div>
          <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden">
            {/* Header */}
            <div className={`px-4 py-4 border-b ${isAuthenticated ? "bg-teal-50 border-teal-100" : "bg-slate-50 border-slate-100"}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-black shrink-0 ${isAuthenticated ? "bg-teal-600" : "bg-slate-400"}`}>
                  {isAuthenticated ? profile.initials : "?"}
                </div>
                <div className="min-w-0">
                  {isAuthenticated ? (
                    <>
                      <p className="text-sm font-bold text-slate-900 truncate">{profile.businessName}</p>
                      <p className="text-xs text-slate-500 truncate">{profile.email}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-slate-700">Viewing demo</p>
                      <Link href="/signup" onClick={() => setOpen(false)}
                        className="text-xs text-teal-600 font-semibold hover:underline underline-offset-2">
                        Create a free account →
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div className="py-1.5">
              {menuItem("⚙️", "Store Settings",   "/get-started", "settings")}
              {menuItem("👥", "Team Members",      "/get-started", "team")}
              {menuItem("📦", "Manage Inventory",  "/get-started", "inventory")}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 py-1.5">
              {isAuthenticated ? (
                <button onClick={() => { setOpen(false); onLogout(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                  <span className="text-base">🚪</span> Log out
                </button>
              ) : (
                <Link href="/signup" onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-teal-600 font-semibold hover:bg-teal-50 transition-colors">
                  <span className="text-base">✨</span> Sign up free
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [merchantId, setMerchantId] = useState<string>(DEMO_MERCHANT_ID);
  const [profile, setProfile] = useState<UserProfile>({
    fullName: "User",
    businessName: "My Business",
    email: "",
    initials: "U",
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeTab, setActiveTab] = useState<"command" | "demo">("command");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  /* Load user profile + merchant */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const meta = user.user_metadata || {};
      const fullName    = meta.full_name     || user.email?.split("@")[0] || "User";
      const businessName = meta.business_name || "My Business";
      const email       = user.email || "";
      const initials    = (fullName.split(" ").map((w: string) => w[0]).join("").toUpperCase()).slice(0, 2) || "U";

      setProfile({ fullName, businessName, email, initials });

      const { data: merchant } = await supabase
        .from("merchant")
        .select("merchant_id, company_name")
        .eq("user_id", user.id)
        .single();

      if (merchant?.merchant_id) {
        setMerchantId(merchant.merchant_id);
        if (merchant.company_name) {
          setProfile(p => ({ ...p, businessName: merchant.company_name }));
        }
      }
    })();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const fetchData = useCallback(async () => {
    const [ordersResult, inventoryResult, statsResult] = await Promise.allSettled([
      fetch(`${BACKEND_URL}/api/orders?merchant_id=${merchantId}`),
      fetch(`${BACKEND_URL}/api/inventory?merchant_id=${merchantId}`),
      fetch(`${BACKEND_URL}/api/stats?merchant_id=${merchantId}`),
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
  }, [merchantId]);

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
        {/* Left: logo + badge */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="SupplyLah"
              className="h-10 md:h-12 w-auto scale-[2] md:scale-[2.5] origin-left object-contain"
            />
          </Link>
          {/* Spacer so badge doesn't overlap scaled logo */}
          <div className="w-16 md:w-18 shrink-0" />
          <span className="text-xs bg-teal-100 text-teal-700 px-3 py-1 rounded-full font-semibold whitespace-nowrap">
            Command Centre
          </span>
        </div>

        {/* Right: alerts + refresh + profile */}
        <div className="flex items-center gap-3">
          {alertCount > 0 && (
            <button
              onClick={() => setActiveTab("command")}
              className="flex items-center gap-1.5 text-sm text-red-600 font-semibold alert-pulse"
            >
              🔴 {alertCount} alert{alertCount > 1 ? "s" : ""}
            </button>
          )}
          <span className="text-xs text-slate-400 hidden sm:block">
            {lastRefresh
              ? `Updated ${lastRefresh.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : "Updating..."}
          </span>
          <button
            onClick={fetchData}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            ↻ Refresh
          </button>
          <ProfileMenu profile={profile} onLogout={handleLogout} />
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
                  { label: "Today",     value: stats.total_today,           color: "text-slate-700" },
                  { label: "Pending",   value: stats.pending,               color: "text-yellow-600" },
                  { label: "Awaiting",  value: stats.awaiting_confirmation, color: "text-blue-600" },
                  { label: "Confirmed", value: stats.confirmed,             color: "text-teal-600" },
                  { label: "Dispatched",value: stats.dispatched,            color: "text-purple-600" },
                  { label: "⚠ Review",  value: stats.requires_review,       color: "text-red-600" },
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
            <MockChat merchantId={merchantId} />
          </div>
        )}
      </main>
    </div>
  );
}
