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
              {menuItem("⚙️", "Store Settings", "settings")}
              {menuItem("👥", "Team Members", "team")}
              {menuItem("📦", "Manage Inventory", "inventory")}
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
                  <span className="text-base">🚪</span> Log out
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
    await supabase
      .from("merchant_users")
      .insert({
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

/* ── Rules Tab ── */
type Rules = {
  minOrderValue: string;
  allowDiscount: boolean;
  substitutions: {
    [productId: string]: { substitute_id: string; discount: string };
  };
  chargeDelivery: boolean;
  deliveryFee: string;
};

const defaultRules: Rules = {
  minOrderValue: "50",
  allowDiscount: true,
  substitutions: {},
  chargeDelivery: true,
  deliveryFee: "15",
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

        <div>
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
              {stats && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {[
                    {
                      label: "Today",
                      value: stats.total_today,
                      color: "text-slate-700",
                    },
                    {
                      label: "Pending",
                      value: stats.pending,
                      color: "text-yellow-600",
                    },
                    {
                      label: "Awaiting",
                      value: stats.awaiting_confirmation,
                      color: "text-blue-600",
                    },
                    {
                      label: "Confirmed",
                      value: stats.confirmed,
                      color: "text-teal-600",
                    },
                    {
                      label: "Dispatched",
                      value: stats.dispatched,
                      color: "text-purple-600",
                    },
                    {
                      label: "⚠ Review",
                      value: stats.requires_review,
                      color: "text-red-600",
                    },
                  ].map(({ label, value, color }) => (
                    <div
                      key={label}
                      className="bg-white rounded-xl border border-slate-200 p-3 text-center"
                    >
                      <p className={`text-2xl font-black ${color}`}>{value}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-3">
                  <KanbanBoard
                    orders={orders}
                    onRefresh={() => merchantId && fetchData(merchantId)}
                  />
                </div>
                <div className="space-y-4">
                  <AlertsPanel
                    orders={orders}
                    onRefresh={() => merchantId && fetchData(merchantId)}
                  />
                  <InventoryPanel inventory={inventory} />
                </div>
              </div>
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
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[500px_1fr] gap-10 items-start h-[calc(100vh-180px)]">
              {/* LEFT: Phone Frame Wrapper */}
              <div className="relative w-full max-w-[360px] aspect-[9/18.5] mx-auto shrink-0 select-none drop-shadow-2xl">
                <img
                  src="/phone-frame.png"
                  className="absolute inset-0 w-full h-full object-fill pointer-events-none z-20"
                  alt="phone"
                />

                {/* The "Screen" area - Locked to the frame edges */}
                <div className="absolute top-[2.2%] left-[6.6%] right-[6.6%] bottom-[2.2%] z-10 overflow-hidden rounded-[2.6rem] bg-[#e5ddd5]">
                  <MockChat
                    merchantId={merchantId ?? DEMO_MERCHANT_ID}
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
                    onClick={() => setAiLogs([])}
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
