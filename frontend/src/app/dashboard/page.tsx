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

const DEMO_MERCHANT_ID =
  process.env.NEXT_PUBLIC_MERCHANT_ID || "00000000-0000-0000-0000-000000000001";

interface UserProfile {
  fullName: string;
  businessName: string;
  email: string;
  initials: string;
}

/* ── Promo modal (shown to unauthenticated demo users) ── */
function PromoModal({
  feature,
  onClose,
}: {
  feature: string;
  onClose: () => void;
}) {
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors text-lg"
        >
          ×
        </button>

        {/* Mascot */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mascot-hero.png"
          alt=""
          className="w-28 h-28 object-contain mx-auto mb-4 drop-shadow-xl animate-float"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />

        {/* Copy */}
        <h2 className="text-2xl font-black text-teal-900 mb-2 leading-tight">
          {copy.headline}
        </h2>
        <p className="text-slate-500 text-sm leading-relaxed mb-6">
          {copy.sub}
        </p>

        {/* Perks */}
        <div className="bg-teal-50 rounded-2xl px-5 py-4 mb-6 text-left space-y-2">
          {[
            "Free to start — no credit card needed",
            "Set up in under 3 minutes",
            "Your own data, your own workspace",
          ].map((t) => (
            <div
              key={t}
              className="flex items-center gap-2 text-sm text-teal-800"
            >
              <span className="text-teal-500 font-bold">✓</span> {t}
            </div>
          ))}
        </div>

        <Link
          href="/signup"
          className="btn-primary block w-full py-3.5 text-sm font-bold text-center"
        >
          Create your free account →
        </Link>
        <button
          onClick={onClose}
          className="mt-3 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

/* ── Profile dropdown ── */
function ProfileMenu({
  profile,
  isAuthenticated,
  onLogout,
  onSelectTab,
}: {
  profile: UserProfile;
  isAuthenticated: boolean;
  onLogout: () => void;
  onSelectTab: (tabId: "settings" | "team" | "inventory") => void;
}) {
  const [open, setOpen] = useState(false);
  const [promo, setPromo] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function menuItem(
    icon: string,
    label: string,
    tabId: "settings" | "team" | "inventory",
  ) {
    if (isAuthenticated) {
      return (
        <button
          onClick={() => {
            setOpen(false);
            onSelectTab(tabId);
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <span className="text-base">{icon}</span> {label}
        </button>
      );
    }
    return (
      <button
        onClick={() => {
          setOpen(false);
          setPromo(tabId);
        }}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
      >
        <span className="text-base">{icon}</span>
        <span>{label}</span>
        <span className="ml-auto text-[10px] bg-teal-100 text-teal-600 font-semibold px-1.5 py-0.5 rounded-full">
          Pro
        </span>
      </button>
    );
  }

  return (
    <>
      {promo && <PromoModal feature={promo} onClose={() => setPromo(null)} />}

      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all duration-200"
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0 ${isAuthenticated ? "bg-teal-600" : "bg-slate-400"}`}
          >
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
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden">
            {/* Header */}
            <div
              className={`px-4 py-4 border-b ${isAuthenticated ? "bg-teal-50 border-teal-100" : "bg-slate-50 border-slate-100"}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-black shrink-0 ${isAuthenticated ? "bg-teal-600" : "bg-slate-400"}`}
                >
                  {isAuthenticated ? profile.initials : "?"}
                </div>
                <div className="min-w-0">
                  {isAuthenticated ? (
                    <>
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {profile.businessName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {profile.email}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-slate-700">
                        Viewing demo
                      </p>
                      <Link
                        href="/signup"
                        onClick={() => setOpen(false)}
                        className="text-xs text-teal-600 font-semibold hover:underline underline-offset-2"
                      >
                        Create a free account →
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div className="py-1.5">
              {menuItem("", "Manage Inventory", "inventory")}
              {menuItem("", "Team Members", "team")}
              {menuItem("", "Store Settings", "settings")}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 py-1.5">
              {isAuthenticated ? (
                <button
                  onClick={() => {
                    setOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <span className="text-base"></span> Log out
                </button>
              ) : (
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-teal-600 font-semibold hover:bg-teal-50 transition-colors"
                >
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

/* ── Skeleton components ── */
function Sk({ className }: { className?: string }) {
  return <div className={`skeleton ${className ?? ""}`} />;
}

/* ── Team Tab ── */
function TabSkeleton({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <Sk className="h-6 w-44 rounded-lg" />
        <Sk className="h-9 w-32 rounded-xl" />
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex gap-6">
          {Array.from({ length: cols }).map((_, i) => (
            <Sk key={i} className="h-3 w-20 rounded-md" />
          ))}
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="px-6 py-4 flex gap-6 items-center">
              {Array.from({ length: cols }).map((_, j) => (
                <Sk
                  key={j}
                  className={`h-4 rounded-md ${j === 1 ? "w-40" : "w-24"}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TeamAdminTab({ merchantId }: { merchantId: string }) {
  const [team, setTeam] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("Warehouse Manager");
  const [loading, setLoading] = useState(true);

  async function fetchTeam() {
    setLoading(true);
    const { data } = await supabase
      .from("merchant_users")
      .select("*")
      .eq("merchant_id", merchantId);
    setTeam(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchTeam();
  }, [merchantId]);

  async function invite() {
    if (!email || !phone) return;
    await supabase.from("merchant_users").insert({
      merchant_id: merchantId,
      invited_email: email,
      contact_number: phone,
      role,
      status: "invited",
    });
    setEmail("");
    setPhone("");
    fetchTeam();
  }

  if (loading) return <TabSkeleton rows={3} cols={5} />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 mb-4">
          Invite Team Member
        </h2>
        <div className="flex gap-3">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <input
            type="tel"
            placeholder="Contact number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option>Warehouse Manager</option>
            <option>Wholesale Supplier</option>
          </select>
          <button
            onClick={invite}
            disabled={!email || !phone}
            className="btn-primary px-6 py-2.5 font-bold whitespace-nowrap disabled:opacity-50"
          >
            Invite →
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3">User</th>
              <th className="px-6 py-3">Contact</th>
              <th className="px-6 py-3">Role</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {team.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-900">
                  {m.invited_email}
                </td>
                <td className="px-6 py-4 text-slate-500">
                  {m.contact_number || "—"}
                </td>
                <td className="px-6 py-4 text-slate-500">{m.role}</td>
                <td className="px-6 py-4">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                    {m.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={async () => {
                      await supabase
                        .from("merchant_users")
                        .delete()
                        .eq("id", m.id);
                      fetchTeam();
                    }}
                    className="text-red-500 hover:text-red-700 text-xs font-bold"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {team.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-8 text-center text-slate-400"
                >
                  No team members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Analytics Dashboard ── */
function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function StatRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${accent ? "text-teal-700" : "text-slate-800"}`}>{value}</span>
    </div>
  );
}

function BarRow({ label, value, max, pct, color = "bg-teal-500" }: { label: string; value: string; max?: number; pct: number; color?: string }) {
  return (
    <div className="py-2 border-b border-slate-50 last:border-0">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-sm text-slate-700 truncate max-w-[200px]">{label}</span>
        <span className="text-xs text-slate-500 font-mono ml-3 shrink-0">{value}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%`, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

function AnalyticsDashboard({ orders, inventory }: { orders: Order[]; inventory: Product[] }) {
  const now           = new Date();
  const todayStr      = now.toISOString().slice(0, 10);
  const weekAgo       = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const sevenDaysAgo  = new Date(now.getTime() - 7 * 86400000);

  const confirmedOrders = orders.filter(o => o.order_status === "Confirmed" || o.order_status === "Dispatched");

  // ── Module 1: Revenue & Sales Velocity ──
  const totalRevenue  = confirmedOrders.reduce((s, o) => s + (o.order_amount || 0), 0);
  const revenueToday  = confirmedOrders.filter(o => (o.created_at || "").startsWith(todayStr)).reduce((s, o) => s + (o.order_amount || 0), 0);
  const revenueWeek   = confirmedOrders.filter(o => (o.created_at || "") >= weekAgo).reduce((s, o) => s + (o.order_amount || 0), 0);
  const avgOrderValue = confirmedOrders.length ? totalRevenue / confirmedOrders.length : 0;

  // Daily revenue last 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() - (6 - i) * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const dailyRevenue = days.map(day => ({
    label: new Date(day).toLocaleDateString("en-MY", { weekday: "short" }),
    value: confirmedOrders.filter(o => (o.created_at || "").startsWith(day)).reduce((s, o) => s + (o.order_amount || 0), 0),
  }));
  const maxDayRevenue = Math.max(...dailyRevenue.map(d => d.value), 1);

  // ── Module 2: AI Performance & Automation ──
  const totalOrders       = orders.length;
  const automatedOrders   = orders.filter(o => !o.requires_human_review).length;
  const automationRate    = totalOrders > 0 ? (automatedOrders / totalOrders) * 100 : 0;
  const avgConfidence     = orders.filter(o => o.confidence_score != null).reduce((s, o, _, a) => s + (o.confidence_score || 0) / a.length, 0) * 100;
  const languageMap: Record<string, number> = {};
  for (const o of orders) {
    try {
      const notes = JSON.parse(o.order_notes || "{}");
      const lang = notes.language || notes.intake_result?.language_detected || "unknown";
      languageMap[lang] = (languageMap[lang] || 0) + 1;
    } catch {}
  }
  const langEntries = Object.entries(languageMap).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const langTotal   = langEntries.reduce((s, [, v]) => s + v, 0) || 1;

  // ── Module 3: Substitution Intelligence ──
  const ordersWithSub      = orders.filter(o => o.order_item?.some(i => i.is_substituted));
  const substitutedItems   = orders.flatMap(o => (o.order_item || []).filter(i => i.is_substituted));
  const subAcceptedOrders  = confirmedOrders.filter(o => o.order_item?.some(i => i.is_substituted));
  const subRate            = ordersWithSub.length > 0 ? (subAcceptedOrders.length / ordersWithSub.length) * 100 : 0;
  const subProductMap: Record<string, number> = {};
  for (const item of substitutedItems) {
    subProductMap[item.product_name] = (subProductMap[item.product_name] || 0) + 1;
  }
  const topSubProducts = Object.entries(subProductMap).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxSubCount    = topSubProducts[0]?.[1] || 1;
  const revenueSaved   = subAcceptedOrders.reduce((s, o) => s + (o.order_amount || 0), 0);

  // ── Module 4: Top Products & Sales SKU ──
  const productMap: Record<string, { qty: number; orders: number }> = {};
  for (const o of orders) {
    for (const item of (o.order_item || [])) {
      if (!productMap[item.product_name]) productMap[item.product_name] = { qty: 0, orders: 0 };
      productMap[item.product_name].qty    += item.quantity || 0;
      productMap[item.product_name].orders += 1;
    }
  }
  const topProducts = Object.entries(productMap).sort((a, b) => b[1].qty - a[1].qty).slice(0, 6);
  const maxProductQty = topProducts[0]?.[1].qty || 1;

  // ── Module 5: Customer Loyalty & Activity ──
  const buyerMap: Record<string, { name: string; phone: string; count: number; spent: number; lastOrder: string }> = {};
  for (const o of orders) {
    const id = o.customer_id;
    if (!buyerMap[id]) buyerMap[id] = { name: o.customer?.customer_name || "Unknown", phone: o.customer?.whatsapp_number || "", count: 0, spent: 0, lastOrder: o.created_at || "" };
    buyerMap[id].count++;
    buyerMap[id].spent    += o.order_amount || 0;
    if ((o.created_at || "") > buyerMap[id].lastOrder) buyerMap[id].lastOrder = o.created_at || "";
  }
  const allBuyers   = Object.values(buyerMap);
  const topBuyers   = allBuyers.sort((a, b) => b.count - a.count).slice(0, 5);
  const dormant     = allBuyers.filter(b => b.lastOrder && new Date(b.lastOrder) < sevenDaysAgo);
  const repeatRate  = allBuyers.length > 0 ? (allBuyers.filter(b => b.count > 1).length / allBuyers.length) * 100 : 0;

  const CARD = "bg-white rounded-xl border border-slate-200 overflow-hidden";
  const HEAD = "px-5 pt-5 pb-0";

  return (
    <div className="space-y-4 pb-6">
      {/* Section divider */}
      <div className="flex items-center gap-3 pt-2">
        <span className="text-xs font-semibold text-slate-500">Trends &amp; Analytics</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      {/* Row 1: Revenue + AI Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Revenue & Sales Velocity */}
        <div className={CARD}>
          <div className={HEAD}>
            <SectionHeader title="Revenue & Sales Velocity" sub="Confirmed and dispatched orders only" />
          </div>
          <div className="px-5 pb-2">
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-3xl font-semibold text-slate-900 tabular-nums">RM {totalRevenue.toFixed(2)}</span>
              <span className="text-sm text-slate-400">all-time</span>
            </div>
            <div className="mb-4">
              <StatRow label="Today"     value={`RM ${revenueToday.toFixed(2)}`} />
              <StatRow label="This week" value={`RM ${revenueWeek.toFixed(2)}`} />
              <StatRow label="Avg order value" value={`RM ${avgOrderValue.toFixed(2)}`} accent />
            </div>
            {/* 7-day bar chart */}
            <p className="text-xs text-slate-400 mb-2">Daily revenue — last 7 days</p>
            <div className="flex items-end gap-1 h-16">
              {dailyRevenue.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t relative" style={{ height: `${Math.max((d.value / maxDayRevenue) * 52, d.value > 0 ? 4 : 0)}px`, background: d.label === new Date().toLocaleDateString("en-MY", { weekday: "short" }) ? "linear-gradient(180deg,#0d8080,#14bcbc)" : "#e2e8f0" }} />
                  <span className="text-[10px] text-slate-400">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Performance & Automation */}
        <div className={CARD}>
          <div className={HEAD}>
            <SectionHeader title="AI Performance & Automation" sub="Quality of AI order processing" />
          </div>
          <div className="px-5 pb-5">
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: "Automation Rate",    value: `${automationRate.toFixed(0)}%`,   color: "text-teal-700" },
                { label: "Avg AI Confidence",  value: `${avgConfidence.toFixed(0)}%`,    color: "text-slate-800" },
                { label: "Auto-processed",     value: `${automatedOrders}`,              color: "text-slate-800" },
                { label: "Flagged for Review", value: `${totalOrders - automatedOrders}`, color: totalOrders - automatedOrders > 0 ? "text-red-600" : "text-slate-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">{label}</p>
                  <p className={`text-xl font-semibold tabular-nums ${color}`}>{value}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mb-2">Order language distribution</p>
            {langEntries.length === 0 ? (
              <p className="text-sm text-slate-400">No data yet</p>
            ) : (
              <div className="space-y-1">
                {langEntries.map(([lang, count]) => (
                  <BarRow
                    key={lang}
                    label={lang === "ms" ? "Bahasa Melayu / Rojak" : lang === "en" ? "English" : lang === "mixed" ? "Mixed" : lang}
                    value={`${count} orders`}
                    pct={Math.round((count / langTotal) * 100)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Substitution + Top Products + Customer Loyalty */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Substitution Intelligence */}
        <div className={CARD}>
          <div className={HEAD}>
            <SectionHeader title="Substitution Intelligence" sub="AI-driven stock-out recovery" />
          </div>
          <div className="px-5 pb-5">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Acceptance Rate</p>
                <p className="text-xl font-semibold text-teal-700 tabular-nums">{ordersWithSub.length > 0 ? `${subRate.toFixed(0)}%` : "—"}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Revenue Saved</p>
                <p className="text-xl font-semibold text-slate-800 tabular-nums">RM {revenueSaved.toFixed(0)}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-2">Most substituted products</p>
            {topSubProducts.length === 0 ? (
              <p className="text-sm text-slate-400 py-3 text-center">No substitutions recorded</p>
            ) : (
              topSubProducts.map(([name, count]) => (
                <BarRow key={name} label={name} value={`${count}×`} pct={Math.round((count / maxSubCount) * 100)} color="bg-orange-400" />
              ))
            )}
          </div>
        </div>

        {/* Top Products by Volume */}
        <div className={CARD}>
          <div className={HEAD}>
            <SectionHeader title="Top Products by Volume" sub="Units ordered across all orders" />
          </div>
          <div className="px-5 pb-5">
            {topProducts.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No order items yet</p>
            ) : (
              topProducts.map(([name, { qty }]) => (
                <BarRow key={name} label={name} value={`${qty} units`} pct={Math.round((qty / maxProductQty) * 100)} />
              ))
            )}
          </div>
        </div>

        {/* Customer Loyalty */}
        <div className={CARD}>
          <div className={HEAD}>
            <SectionHeader title="Customer Activity" sub="Loyalty and engagement signals" />
          </div>
          <div className="px-5 pb-5">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Repeat Rate</p>
                <p className="text-xl font-semibold text-teal-700 tabular-nums">{repeatRate.toFixed(0)}%</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Dormant (7d)</p>
                <p className={`text-xl font-semibold tabular-nums ${dormant.length > 0 ? "text-amber-600" : "text-slate-400"}`}>{dormant.length}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-2">Top buyers by order count</p>
            {topBuyers.length === 0 ? (
              <p className="text-sm text-slate-400 py-3 text-center">No orders yet</p>
            ) : (
              <div className="space-y-0">
                {topBuyers.map((b, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500"}`}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate leading-tight">{b.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{b.phone}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-slate-700 tabular-nums">{b.count}×</p>
                      <p className="text-xs text-teal-600 tabular-nums">RM {b.spent.toFixed(0)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Rules Tab ── */
type Rules = {
  minOrderValue: string;
  allowDiscount: boolean;
  substitutions: {
    [productId: string]: { substitute_id: string; discount: string };
  };
  chargeDelivery: boolean;
  deliveryFee: string;
  customRules: string;
};

const defaultRules: Rules = {
  minOrderValue: "50",
  allowDiscount: true,
  substitutions: {},
  chargeDelivery: true,
  deliveryFee: "15",
  customRules: "",
};

function Toggle({
  on,
  onChange,
  label,
  desc,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-5">
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed max-w-sm">
          {desc}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!on)}
        className={`relative shrink-0 w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none mt-0.5 ${on ? "bg-teal-500" : "bg-slate-200"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${on ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}

function RulesAdminTab({
  merchantId,
  products,
  inventoryLoading,
}: {
  merchantId: string;
  products: Product[];
  inventoryLoading: boolean;
}) {
  const [rules, setRules] = useState<Rules>(defaultRules);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("knowledge_base")
        .select("content")
        .eq("merchant_id", merchantId)
        .eq("document_type", "business_rules_json")
        .maybeSingle();
      if (data && data.content) {
        try {
          const parsed = JSON.parse(data.content);
          setRules({ ...defaultRules, ...parsed });
        } catch (e) {}
      }
      setLoading(false);
    })();
  }, [merchantId]);

  function set<K extends keyof Rules>(k: K, v: Rules[K]) {
    setRules({ ...rules, [k]: v });
  }

  function updateSub(
    productId: string,
    field: "substitute_id" | "discount",
    value: string,
  ) {
    const existing = rules.substitutions[productId] || {
      substitute_id: "N/A",
      discount: "",
    };
    set("substitutions", {
      ...rules.substitutions,
      [productId]: {
        ...existing,
        [field]: value,
      },
    });
  }

  async function save() {
    setSaving(true);
    const { error: kbJsonError } = await supabase.from("knowledge_base").upsert(
      {
        merchant_id: merchantId,
        document_type: "business_rules_json",
        content: JSON.stringify(rules),
      },
      { onConflict: "merchant_id,document_type" },
    );
    if (kbJsonError) {
      setSaving(false);
      return;
    }

    const subRules = Object.entries(rules.substitutions)
      .filter(([_, sub]) => sub.substitute_id && sub.substitute_id !== "N/A")
      .map(([prodId, sub]) => {
        const original =
          products.find((p) => p.product_id === prodId)?.product_name || prodId;
        const substitute =
          products.find((p) => p.product_id === sub.substitute_id)
            ?.product_name || sub.substitute_id;
        return `- If "${original}" is out of stock, offer "${substitute}" as a substitute at a ${sub.discount || 0}% discount.`;
      })
      .join("\n");

    const rulesText = [
      `Minimum order value: RM${rules.minOrderValue}.`,
      rules.allowDiscount
        ? `Substitutions allowed:\n${subRules}`
        : "Do not offer discounts for substitutes.",
      rules.chargeDelivery
        ? `Charge delivery fee. Flat rate: RM${rules.deliveryFee || "0 (use live Lalamove price)"}.`
        : "Delivery fee absorbed by merchant.",
      ...(rules.customRules?.trim() ? [`Additional rules:\n${rules.customRules.trim()}`] : []),
    ].join("\n\n");

    const { error: kbTextError } = await supabase.from("knowledge_base").upsert(
      {
        merchant_id: merchantId,
        document_type: "business_rules",
        content: rulesText,
      },
      { onConflict: "merchant_id,document_type" },
    );
    if (kbTextError) {
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  if (loading || inventoryLoading) return <TabSkeleton rows={5} cols={3} />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-slate-900">
          Manage Business Rules
        </h2>
        <button
          onClick={save}
          disabled={saving}
          className="btn-primary px-6 py-2.5 font-bold w-32 justify-center"
        >
          {saving ? "Saving..." : "Save Rules"}
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200">
        <p className="text-sm text-slate-500 mb-4">
          These rules are applied to every order quote automatically by the AI.
        </p>

        <div className="py-5 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-800 mb-0.5">
            Minimum order value
          </p>
          <p className="text-xs text-slate-500 mb-3">
            Orders below this amount will be politely declined.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-400">RM</span>
            <input
              type="number"
              min="0"
              value={rules.minOrderValue}
              onChange={(e) => set("minOrderValue", e.target.value)}
              placeholder="50"
              className="w-28 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all hover:border-slate-300"
            />
          </div>
        </div>

        <div className="border-b border-slate-100 pb-5">
          <Toggle
            on={rules.allowDiscount}
            onChange={(v) => set("allowDiscount", v)}
            label="Allow substitution discount"
            desc="When an item is out of stock, offer an alternative at a slight discount rather than rejecting the order."
          />
          {rules.allowDiscount && products.length > 0 && (
            <div className="mt-2 text-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold rounded-tl-lg">
                      Product
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      Substitute Product
                    </th>
                    <th className="px-4 py-3 font-semibold rounded-tr-lg">
                      Discount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((p) => {
                    // Rules saved from get-started use user-entered SKU as key (e.g. "PROD-001"),
                    // rules saved from dashboard use the DB UUID. Try both.
                    const sub = rules.substitutions[p.product_id] ||
                      rules.substitutions[p.product_sku || ""] || {
                        substitute_id: "N/A",
                        discount: "",
                      };

                    // substitute_id may also be a SKU — resolve to DB UUID for the select
                    const resolvedSubId =
                      !sub.substitute_id || sub.substitute_id === "N/A"
                        ? "N/A"
                        : products.find(
                            (p2) => p2.product_id === sub.substitute_id,
                          )?.product_id ||
                          products.find(
                            (p2) => p2.product_sku === sub.substitute_id,
                          )?.product_id ||
                          "N/A";
                    const isNA = resolvedSubId === "N/A";
                    return (
                      <tr key={p.product_id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {p.product_name}
                          <div className="text-xs text-slate-400 font-normal mt-0.5">
                            {p.product_sku || p.product_id.split("-")[0]}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={resolvedSubId}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateSub(p.product_id, "substitute_id", val);
                              if (val === "N/A")
                                updateSub(p.product_id, "discount", "");
                            }}
                            className="w-full max-w-[200px] px-2 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                          >
                            <option value="N/A">N/A</option>
                            {products
                              .filter((opt) => opt.product_id !== p.product_id)
                              .map((opt) => (
                                <option
                                  key={opt.product_id}
                                  value={opt.product_id}
                                >
                                  {opt.product_name}
                                </option>
                              ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {isNA ? (
                            <span className="text-slate-400 text-xs italic">
                              N/A
                            </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={sub.discount || ""}
                                onChange={(e) =>
                                  updateSub(
                                    p.product_id,
                                    "discount",
                                    e.target.value,
                                  )
                                }
                                className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                                placeholder="10"
                              />
                              <span className="text-xs text-slate-500">%</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {rules.allowDiscount && products.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mt-2 border border-amber-200 inline-block">
              Add products in the Inventory tab to configure substitutions with
              discounts.
            </p>
          )}
        </div>

        <div className="border-b border-slate-100">
          <Toggle
            on={rules.chargeDelivery}
            onChange={(v) => set("chargeDelivery", v)}
            label="Pass delivery fee to customer"
            desc="Include the Lalamove delivery charge in the order total sent to the buyer."
          />
          {rules.chargeDelivery && (
            <div className="pb-4 flex items-center gap-3">
              <span className="text-sm text-slate-600">Flat rate</span>
              <span className="text-sm font-semibold text-slate-400">RM</span>
              <input
                type="number"
                min="0"
                value={rules.deliveryFee}
                onChange={(e) => set("deliveryFee", e.target.value)}
                className="w-20 px-3 py-2 rounded-lg border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <span className="text-xs text-slate-400">
                Leave 0 to use live Lalamove pricing
              </span>
            </div>
          )}
        </div>

        <div className="pt-5">
          <p className="text-sm font-semibold text-slate-800 mb-0.5">
            Additional business rules
          </p>
          <p className="text-xs text-slate-500 mb-3">
            Write any extra pricing or discount rules in plain text — the AI will follow these when generating quotes.
          </p>
          <textarea
            rows={5}
            value={rules.customRules || ""}
            onChange={(e) => set("customRules", e.target.value)}
            placeholder={`Examples:\n- Spend above RM500 and get 5% discount\n- Free delivery for orders above RM300\n- No orders accepted on Sundays\n- Bulk purchase of 100+ units gets 8% off`}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all hover:border-slate-300 resize-none font-mono leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
}

/* ── Inventory Tab ── */
type EditRow = {
  product_name: string;
  product_sku: string;
  unit: string;
  stock_quantity: string;
  reorder_threshold: string;
  unit_price: string;
};

function InventoryAdminTab({
  merchantId,
  inventory,
  onRefresh,
  inventoryLoading,
}: {
  merchantId: string;
  inventory: Product[];
  onRefresh: () => void;
  inventoryLoading: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState({
    product_id: "",
    product_name: "",
    unit: "",
    available_quantity: "",
    reorder_threshold: "",
    unit_price: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<EditRow>({
    product_name: "",
    product_sku: "",
    unit: "",
    stock_quantity: "",
    reorder_threshold: "",
    unit_price: "",
  });
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Clear refreshing as soon as the parent pushes down fresh inventory data
  useEffect(() => {
    setRefreshing(false);
  }, [inventory]);

  async function add() {
    if (!newRow.product_name || !newRow.unit_price) return;
    setSaving(true);
    await supabase.from("product").insert({
      merchant_id: merchantId,
      product_name: newRow.product_name,
      product_sku: newRow.product_id || null,
      unit_price: parseFloat(newRow.unit_price),
      stock_quantity: parseInt(newRow.available_quantity) || 0,
      unit: newRow.unit || null,
      reorder_threshold: parseInt(newRow.reorder_threshold) || 0,
    });
    setSaving(false);
    setNewRow({
      product_id: "",
      product_name: "",
      unit: "",
      available_quantity: "",
      reorder_threshold: "",
      unit_price: "",
    });
    setAdding(false);
    setRefreshing(true);
    onRefresh();
  }

  function startEdit(p: Product) {
    setEditingId(p.product_id);
    setEditRow({
      product_name: p.product_name,
      product_sku: p.product_sku || "",
      unit: p.unit || "",
      stock_quantity: String(p.stock_quantity ?? ""),
      reorder_threshold: String(p.reorder_threshold ?? ""),
      unit_price: String(p.unit_price),
    });
  }

  async function saveEdit(productId: string) {
    if (!editRow.product_name || !editRow.unit_price) return;
    setSaving(true);
    await supabase
      .from("product")
      .update({
        product_name: editRow.product_name,
        product_sku: editRow.product_sku || null,
        unit: editRow.unit || null,
        stock_quantity: parseInt(editRow.stock_quantity) || 0,
        reorder_threshold: parseInt(editRow.reorder_threshold) || 0,
        unit_price: parseFloat(editRow.unit_price),
      })
      .eq("product_id", productId);
    setSaving(false);
    setEditingId(null);
    setRefreshing(true);
    onRefresh();
  }

  const INPUT = `w-full px-2 py-1.5 bg-white border border-teal-300 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500`;
  const INPUT_ADD = `w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all hover:border-slate-300`;

  if (inventoryLoading || refreshing) return <TabSkeleton rows={6} cols={7} />;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <h2 className="text-xl font-bold text-slate-900">Manage Inventory</h2>
        <button
          onClick={() => {
            setAdding(!adding);
            setEditingId(null);
          }}
          className="btn-primary px-5 py-2 text-sm font-bold"
        >
          {adding ? "Cancel" : "+ Add new product"}
        </button>
      </div>

      {adding && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
          <div className="grid grid-cols-4 gap-2 items-end">
            {(
              [
                { key: "product_id", label: "ID", col: "", type: "text" },
                {
                  key: "product_name",
                  label: "Name *",
                  col: "col-span-2",
                  type: "text",
                },
                { key: "unit", label: "Unit", col: "", type: "text" },
                {
                  key: "available_quantity",
                  label: "Available Qty",
                  col: "",
                  type: "number",
                },
                {
                  key: "reorder_threshold",
                  label: "Reorder Threshold",
                  col: "",
                  type: "number",
                },
                {
                  key: "unit_price",
                  label: "Price (RM) *",
                  col: "",
                  type: "number",
                },
              ] as const
            ).map(({ key, label, col, type }) => (
              <div key={key} className={col}>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {label}
                </label>
                <input
                  type={type}
                  value={(newRow as Record<string, string>)[key]}
                  onChange={(e) =>
                    setNewRow({ ...newRow, [key]: e.target.value })
                  }
                  className={INPUT_ADD}
                />
              </div>
            ))}
          </div>
          <button
            onClick={add}
            disabled={!newRow.product_name || !newRow.unit_price}
            className="btn-primary px-5 py-2.5 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">ID</th>
              <th className="px-5 py-3">Product</th>
              <th className="px-5 py-3">Unit</th>
              <th className="px-5 py-3">Avail Qty</th>
              <th className="px-5 py-3">Reorder</th>
              <th className="px-5 py-3">Price (RM)</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {inventory.map((p) => {
              const isEditing = editingId === p.product_id;
              return (
                <tr
                  key={p.product_id}
                  className={isEditing ? "bg-teal-50" : "hover:bg-slate-50"}
                >
                  <td className="px-5 py-3 text-slate-400 text-xs">
                    {isEditing ? (
                      <input
                        value={editRow.product_sku}
                        onChange={(e) =>
                          setEditRow({
                            ...editRow,
                            product_sku: e.target.value,
                          })
                        }
                        className={INPUT}
                        placeholder="SKU"
                      />
                    ) : (
                      p.product_sku || p.product_id.split("-")[0]
                    )}
                  </td>
                  <td className="px-5 py-3 font-semibold text-slate-900">
                    {isEditing ? (
                      <input
                        value={editRow.product_name}
                        onChange={(e) =>
                          setEditRow({
                            ...editRow,
                            product_name: e.target.value,
                          })
                        }
                        className={INPUT}
                      />
                    ) : (
                      p.product_name
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {isEditing ? (
                      <input
                        value={editRow.unit}
                        onChange={(e) =>
                          setEditRow({ ...editRow, unit: e.target.value })
                        }
                        className={INPUT}
                        placeholder="e.g. kg"
                      />
                    ) : (
                      p.unit || "—"
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-700">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editRow.stock_quantity}
                        onChange={(e) =>
                          setEditRow({
                            ...editRow,
                            stock_quantity: e.target.value,
                          })
                        }
                        className={INPUT}
                      />
                    ) : (
                      (p.stock_quantity ?? "—")
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editRow.reorder_threshold}
                        onChange={(e) =>
                          setEditRow({
                            ...editRow,
                            reorder_threshold: e.target.value,
                          })
                        }
                        className={INPUT}
                      />
                    ) : (
                      (p.reorder_threshold ?? "—")
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-700">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editRow.unit_price}
                        onChange={(e) =>
                          setEditRow({ ...editRow, unit_price: e.target.value })
                        }
                        className={INPUT}
                      />
                    ) : (
                      `RM ${p.unit_price}`
                    )}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => saveEdit(p.product_id)}
                          disabled={
                            saving ||
                            !editRow.product_name ||
                            !editRow.unit_price
                          }
                          className="text-teal-600 hover:text-teal-800 text-xs font-bold disabled:opacity-40 transition-colors"
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-slate-400 hover:text-slate-600 text-xs font-bold transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => {
                            setAdding(false);
                            startEdit(p);
                          }}
                          className="text-teal-500 hover:text-teal-700 text-xs font-bold transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            await supabase
                              .from("product")
                              .delete()
                              .eq("product_id", p.product_id);
                            onRefresh();
                          }}
                          className="text-slate-400 hover:text-red-500 text-xs font-bold transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <main className="px-6 py-4 space-y-4">
      {/* Stat bar */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col items-center gap-2"
          >
            <Sk className="h-7 w-12 rounded-lg" />
            <Sk className="h-3 w-14 rounded-md" />
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Kanban — 3 columns */}
        <div className="lg:col-span-3 grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, col) => (
            <div
              key={col}
              className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3"
            >
              <Sk className="h-4 w-24 rounded-md" />
              {Array.from({ length: col === 1 ? 3 : 2 }).map((_, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
                  <Sk className="h-3 w-full rounded-md" />
                  <Sk className="h-3 w-3/4 rounded-md" />
                  <div className="flex justify-between pt-1">
                    <Sk className="h-3 w-16 rounded-md" />
                    <Sk className="h-5 w-20 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <Sk className="h-4 w-20 rounded-md" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Sk className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Sk className="h-3 w-full rounded-md" />
                  <Sk className="h-2.5 w-2/3 rounded-md" />
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <Sk className="h-4 w-24 rounded-md" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <Sk className="h-3 w-28 rounded-md" />
                <Sk className="h-3 w-12 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function Dashboard() {
  const router = useRouter();

  // merchantId is null until resolved — prevents early wrong fetch
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [setupDismissed, setSetupDismissed] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(true); // assume complete to avoid flash
  const [profile, setProfile] = useState<UserProfile>({
    fullName: "User",
    businessName: "My Business",
    email: "",
    initials: "U",
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeTab, setActiveTab] = useState<
    "command" | "demo" | "inventory" | "team" | "settings"
  >("command");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true); // skeleton until first fetch done
  const [aiLogs, setAiLogs] = useState<{ t: string; m: string }[]>([]);
  const [demoPhone, setDemoPhone] = useState("+60198765432");
  const [demoName,  setDemoName]  = useState("Demo Customer");
  const [demoEditOpen, setDemoEditOpen] = useState(false);
  const [draftDemoPhone, setDraftDemoPhone] = useState("+60198765432");
  const [draftDemoName,  setDraftDemoName]  = useState("Demo Customer");
  const [demoChatKey, setDemoChatKey] = useState(0); // increment to force MockChat remount

  /* Resolve auth + merchant, THEN set merchantId to trigger fetch */
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setIsAuthenticated(true);
        const meta = user.user_metadata || {};
        const fullName = meta.full_name || user.email?.split("@")[0] || "User";
        const businessName = meta.business_name || "My Business";
        const email = user.email || "";
        const initials =
          fullName
            .split(" ")
            .map((w: string) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2) || "U";
        setProfile({ fullName, businessName, email, initials });
        const { data: merchant } = await supabase
          .from("merchant")
          .select("merchant_id, company_name")
          .eq("user_id", user.id)
          .single();

        if (merchant?.merchant_id) {
          if (merchant.company_name)
            setProfile((p) => ({ ...p, businessName: merchant.company_name }));
          setMerchantId(merchant.merchant_id);

          // Check if actually set up: metadata flag OR has products
          const flagDone = meta.onboarding_complete === true;
          if (!flagDone) {
            const { count } = await supabase
              .from("product")
              .select("*", { count: "exact", head: true })
              .eq("merchant_id", merchant.merchant_id);
            setOnboardingComplete((count ?? 0) > 0);
          } else {
            setOnboardingComplete(true);
          }
          return;
        }

        // Authenticated but no merchant row yet — show empty dashboard, not demo data
        setOnboardingComplete(false);
        setOrders([]);
        setInventory([]);
        setStats({
          total_today: 0,
          pending: 0,
          awaiting_substitution: 0,
          awaiting_confirmation: 0,
          confirmed: 0,
          dispatched: 0,
          failed: 0,
          requires_review: 0,
        });
        setLastRefresh(new Date());
        setLoading(false);
        return;
      }

      // Not logged in — demo mode, load demo data
      setMerchantId(DEMO_MERCHANT_ID);
    })();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleRefresh() {
    if (!merchantId) return;
    setLoading(true);
    await fetchData(merchantId);
  }

  const fetchData = useCallback(async (mid: string) => {
    const [ordersResult, inventoryResult, statsResult] =
      await Promise.allSettled([
        fetch(`${BACKEND_URL}/api/orders?merchant_id=${mid}`),
        fetch(`${BACKEND_URL}/api/inventory?merchant_id=${mid}`),
        fetch(`${BACKEND_URL}/api/stats?merchant_id=${mid}`),
      ]);
    if (ordersResult.status === "fulfilled" && ordersResult.value.ok) {
      setOrders((await ordersResult.value.json()).orders || []);
    }
    if (inventoryResult.status === "fulfilled" && inventoryResult.value.ok) {
      setInventory((await inventoryResult.value.json()).inventory || []);
    }
    if (statsResult.status === "fulfilled" && statsResult.value.ok) {
      setStats(await statsResult.value.json());
    }
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  /* Only start fetching once merchantId is resolved */
  useEffect(() => {
    if (!merchantId) return;
    fetchData(merchantId);
    const interval = setInterval(() => fetchData(merchantId), 60_000);
    return () => clearInterval(interval);
  }, [merchantId, fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel("order-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order" },
        () => {
          if (merchantId) fetchData(merchantId);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchantId, fetchData]);

  const alertCount = orders.filter(
    (o) =>
      o.requires_human_review &&
      o.order_status !== "Confirmed" &&
      o.order_status !== "Dispatched",
  ).length;

  const showSetupBanner =
    isAuthenticated && !onboardingComplete && !setupDismissed;

  const addLog = (m: string) => {
    setAiLogs((prev) =>
      [...prev, { t: new Date().toLocaleTimeString(), m }].slice(-50),
    );
  };

  const clearAiLogs = useCallback(() => {
    // Memoize clearAiLogs
    setAiLogs([]);
  }, []);


  return (
    <div className="min-h-screen bg-slate-50">
      {/* Setup banner */}
      {showSetupBanner && (
        <div className="sticky top-0 z-50 bg-teal-900 px-6 py-2.5 flex items-center gap-4">
          {/* Progress dots */}
          <div className="hidden sm:flex items-center gap-1 shrink-0">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-teal-700" />
            ))}
          </div>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="text-teal-400 text-xs font-bold uppercase tracking-widest shrink-0">
              Setup
            </span>
            <span className="text-white text-sm truncate">
              Your store isn&apos;t ready yet — orders can&apos;t come in until
              you finish setup.
            </span>
          </div>
          <Link
            href="/get-started"
            className="shrink-0 text-xs font-bold text-teal-900 bg-teal-300 hover:bg-teal-200 px-4 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            Finish setup →
          </Link>
          <button
            onClick={() => setSetupDismissed(true)}
            className="shrink-0 text-teal-500 hover:text-white transition-colors text-xl leading-none ml-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Nav */}
      <nav
        className={`bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky z-40 ${showSetupBanner ? "top-[40px]" : "top-0"}`}
      >
        <div className="flex items-center gap-4">
          <Link
            href={isAuthenticated ? "/dashboard" : "/"}
            className="flex items-center shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="SupplyLah"
              className="h-10 md:h-12 w-auto scale-[2] md:scale-[2.5] origin-left object-contain"
            />
          </Link>
          <div className="w-16 md:w-16 shrink-0" />
          <span className="text-xs bg-teal-100 text-teal-700 px-3 py-1 rounded-full font-semibold whitespace-nowrap">
            Command Centre
          </span>
        </div>

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
              : "Loading..."}
          </span>
          <button
            onClick={handleRefresh}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            ↻ Refresh
          </button>
          <ProfileMenu
            profile={profile}
            isAuthenticated={isAuthenticated}
            onLogout={handleLogout}
            onSelectTab={(t) => setActiveTab(t)}
          />
        </div>
      </nav>

      {/* Tabs */}
      <div className="px-6 pt-4 flex gap-2 overflow-x-auto pb-2">
        {[
          { id: "command", label: "🏗 Command Centre" },
          { id: "inventory", label: "📦 Inventory" },
          { id: "team", label: "👥 Team" },
          { id: "settings", label: "⚙️ Settings" },
          { id: "demo", label: "💬 Demo Chat" },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`text-sm font-semibold px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === id
                ? "bg-teal-700 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Skeleton while loading, then real content */}
      {activeTab === "command" && loading ? (
        <DashboardSkeleton />
      ) : (
        <main className="px-6 py-4 space-y-4">
          {activeTab === "command" && (
            <>
              {/* ── KPI Strip ── */}
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Orders Today",    value: stats.total_today,                          sub: `${stats.pending} pending · ${stats.awaiting_substitution} substitution`,  valueColor: "text-slate-900" },
                    { label: "Awaiting Reply",  value: stats.awaiting_confirmation,                sub: "customers yet to confirm",                                                valueColor: "text-blue-600"  },
                    { label: "Fulfilled",       value: stats.confirmed + stats.dispatched,         sub: `${stats.confirmed} confirmed · ${stats.dispatched} dispatched`,            valueColor: "text-teal-700"  },
                    { label: "Needs Review",    value: stats.requires_review,                      sub: "low-confidence orders",                                                   valueColor: stats.requires_review > 0 ? "text-red-600" : "text-slate-300" },
                  ].map(({ label, value, sub, valueColor }) => (
                    <div key={label} className={`bg-white rounded-xl border p-5 ${label === "Needs Review" && stats.requires_review > 0 ? "border-red-200" : "border-slate-200"}`}>
                      <p className="text-xs font-medium text-slate-500 mb-3">{label}</p>
                      <p className={`text-3xl font-semibold leading-none mb-2 tabular-nums ${valueColor}`}>{value}</p>
                      <p className="text-xs text-slate-400 leading-relaxed">{sub}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Pipeline + Side ── */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-3">
                  <KanbanBoard orders={orders} onRefresh={() => merchantId && fetchData(merchantId)} />
                </div>
                <div className="space-y-4">
                  <AlertsPanel orders={orders} onRefresh={() => merchantId && fetchData(merchantId)} />
                  <InventoryPanel inventory={inventory} />
                </div>
              </div>

              {/* ── Analytics ── */}
              <AnalyticsDashboard orders={orders} inventory={inventory} />
            </>
          )}

          {activeTab === "inventory" && merchantId && (
            <InventoryAdminTab
              merchantId={merchantId}
              inventory={inventory}
              onRefresh={() => fetchData(merchantId)}
              inventoryLoading={loading}
            />
          )}

          {activeTab === "team" && merchantId && (
            <TeamAdminTab merchantId={merchantId} />
          )}

          {activeTab === "settings" && merchantId && (
            <RulesAdminTab
              merchantId={merchantId}
              products={inventory}
              inventoryLoading={loading}
            />
          )}

          {activeTab === "demo" && (
            <div className="max-w-7xl mx-auto flex flex-row gap-6 items-start h-[calc(100vh-180px)]">

              {/* FAR LEFT: Customer identity card */}
              <div className="w-52 shrink-0 flex flex-col gap-3 mr-2">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Mock Customer</p>

                  {demoEditOpen ? (
                    <div className="space-y-2">
                      <div>
                        <p className="text-[10px] text-slate-400 mb-1">Name</p>
                        <input
                          type="text"
                          value={draftDemoName}
                          onChange={(e) => setDraftDemoName(e.target.value)}
                          placeholder="Ah Kow"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 mb-1">Phone</p>
                        <input
                          type="text"
                          value={draftDemoPhone}
                          onChange={(e) => setDraftDemoPhone(e.target.value)}
                          placeholder="+60123456789"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => {
                            const phone = draftDemoPhone.trim() || "+60198765432";
                            const name  = draftDemoName.trim()  || "Demo Customer";
                            if (phone !== demoPhone) setDemoChatKey(k => k + 1);
                            setDemoPhone(phone);
                            setDemoName(name);
                            setDemoEditOpen(false);
                          }}
                          className="flex-1 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition-colors"
                        >
                          Apply
                        </button>
                        <button
                          onClick={() => setDemoEditOpen(false)}
                          className="flex-1 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col items-center text-center gap-2 mb-4">
                        <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-lg font-black">
                          {demoName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 leading-tight">{demoName}</p>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">{demoPhone}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${demoPhone === "+60198765432" ? "bg-slate-100 text-slate-500" : "bg-teal-50 text-teal-600"}`}>
                          {demoPhone === "+60198765432" ? "default" : "custom"}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <button
                          onClick={() => { setDraftDemoName(demoName); setDraftDemoPhone(demoPhone); setDemoEditOpen(true); }}
                          className="w-full py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          Edit customer
                        </button>
                        <button
                          onClick={() => setDemoChatKey(k => k + 1)}
                          className="w-full py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
                        >
                          Reset chat
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <p className="text-[10px] text-slate-400 leading-relaxed px-1">
                  Different phone numbers create different customers in the dashboard.
                </p>
              </div>

              {/* CENTRE: Phone Frame — fixed height to match reasoning panel */}
              <div className="relative h-[740px] aspect-[9/18.5] shrink-0 select-none drop-shadow-2xl">
                <img
                  src="/phone-frame.png"
                  className="absolute inset-0 w-full h-full object-fill pointer-events-none z-20"
                  alt="phone"
                />
                <div className="absolute top-[2.2%] left-[6.6%] right-[6.6%] bottom-[2.2%] z-10 overflow-hidden rounded-[2.6rem] bg-[#e5ddd5]">
                  <MockChat
                    key={demoChatKey}
                    merchantId={merchantId ?? DEMO_MERCHANT_ID}
                    fromPhone={demoPhone}
                    fromName={demoName}
                    shopName={profile.businessName || "Demo Wholesaler"}
                    onLog={addLog}
                  />
                </div>
              </div>

              {/* RIGHT: AI Reasoning Panel */}
              <div className="flex-1 w-full flex flex-col min-h-[500px] lg:h-[740px] bg-slate-950 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden transition-all duration-300">
                <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/40 shrink-0">
                  <h3 className="text-slate-200 font-bold flex items-center gap-2">
                    <span className="text-teal-400">🧠</span> AI Reasoning
                    Pipeline
                  </h3>
                  <button
                    onClick={() => clearAiLogs}
                    className="text-[10px] uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Clear
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 font-mono text-[11px] leading-relaxed space-y-3 custom-scrollbar">
                  {aiLogs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 italic">
                      <p>Send a message to see the AI agent&apos;s logic flow...</p>
                    </div>
                  ) : (
                    aiLogs.map((log, i) => {
                      const isSeparator = log.m.startsWith("─");
                      const isError     = log.m.includes("❌");
                      const isSuccess   = log.m.includes("✅");
                      const isBuyer     = log.m.startsWith("📨");
                      const color = isSeparator ? "text-slate-700"
                                  : isError     ? "text-red-400"
                                  : isSuccess   ? "text-green-400"
                                  : isBuyer     ? "text-yellow-300"
                                  : log.m.includes("Inventory") ? "text-blue-300"
                                  : log.m.includes("Pricing") || log.m.includes("🧮") ? "text-purple-300"
                                  : log.m.includes("Logistics") || log.m.includes("🚚") ? "text-orange-300"
                                  : log.m.includes("Composer") || log.m.includes("📝") ? "text-pink-300"
                                  : "text-slate-300";
                      return (
                        <div key={i} className={isSeparator ? "my-1" : ""}>
                          {!isSeparator && (
                            <span className="text-slate-600 mr-2 select-none">[{log.t}]</span>
                          )}
                          <span className={color}>{log.m}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
