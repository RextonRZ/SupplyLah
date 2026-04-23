"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

/* ── Types ── */
interface Product { name: string; sku: string; price: string; stock: string; }
interface Customer { name: string; phone: string; address: string; }
interface TeamMember { email: string; role: "Wholesale Supplier" | "Warehouse Manager"; }
interface Rules {
  minOrderValue: string;
  allowDiscount: boolean;
  discountPct: string;
  chargeDelivery: boolean;
  deliveryFee: string;
}

const STEPS = ["Inventory", "Customers", "Business Rules", "Team Access"];

/* ── Step indicator ── */
function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black border-2 transition-all duration-300 ${
              i < current  ? "bg-teal-600 border-teal-600 text-white" :
              i === current ? "bg-white border-teal-600 text-teal-700" :
                              "bg-white border-slate-200 text-slate-400"
            }`}>
              {i < current ? "✓" : i + 1}
            </div>
            <span className={`mt-1.5 text-xs font-semibold whitespace-nowrap ${
              i === current ? "text-teal-700" : i < current ? "text-teal-500" : "text-slate-400"
            }`}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 w-16 mx-1 mb-5 transition-colors duration-300 ${i < current ? "bg-teal-500" : "bg-slate-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Step 1: Inventory ── */
function InventoryStep({ products, setProducts }: {
  products: Product[];
  setProducts: (p: Product[]) => void;
}) {
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [row, setRow] = useState<Product>({ name: "", sku: "", price: "", stock: "" });
  const [importing, setImporting] = useState(false);

  function addRow() {
    if (!row.name || !row.price) return;
    setProducts([...products, row]);
    setRow({ name: "", sku: "", price: "", stock: "" });
  }

  function removeRow(i: number) {
    setProducts(products.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900 mb-1">Add Your Inventory</h2>
        <p className="text-slate-500 text-sm">Import from Google Sheets or add products manually. Your stock levels will be checked on every order.</p>
      </div>

      {/* Google Sheets import */}
      <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5">
        <p className="text-sm font-bold text-teal-800 mb-1">📊 Import from Google Sheets</p>
        <p className="text-xs text-teal-600 mb-3">Paste your sheet URL — we'll pull product name, SKU, price, and stock quantity columns automatically.</p>
        <div className="flex gap-2">
          <input
            type="url"
            value={sheetsUrl}
            onChange={(e) => setSheetsUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-teal-200 bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
          />
          <button
            onClick={() => { setImporting(true); setTimeout(() => setImporting(false), 1500); }}
            disabled={!sheetsUrl || importing}
            className="btn-primary px-5 py-2.5 text-sm font-bold whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            {importing ? "Importing…" : "Import →"}
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-100" />
        <span className="text-xs text-slate-400 font-medium">OR add manually</span>
        <div className="flex-1 h-px bg-slate-100" />
      </div>

      {/* Manual add row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { key: "name", placeholder: "Product name *", col: "col-span-2" },
          { key: "sku",  placeholder: "SKU" },
          { key: "price",placeholder: "Price (RM) *" },
          { key: "stock",placeholder: "Stock qty" },
        ].map(({ key, placeholder, col }) => (
          <input key={key} type={key === "price" || key === "stock" ? "number" : "text"}
            placeholder={placeholder}
            value={(row as Record<string,string>)[key]}
            onChange={(e) => setRow({ ...row, [key]: e.target.value })}
            className={`${col ?? ""} px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm
                        focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300`}
          />
        ))}
      </div>
      <button onClick={addRow} disabled={!row.name || !row.price}
        className="btn-primary px-5 py-2.5 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none">
        + Add Product
      </button>

      {/* Product table */}
      {products.length > 0 && (
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Product Name", "SKU", "Price (RM)", "Stock", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 text-slate-500">{p.sku || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">RM {p.price}</td>
                  <td className="px-4 py-3 text-slate-700">{p.stock || "—"}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600 transition-colors text-xs font-semibold">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {products.length === 0 && (
        <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-2xl">
          No products added yet. Import from Sheets or add manually above.
        </div>
      )}
    </div>
  );
}

/* ── Step 2: Customers ── */
function CustomersStep({ customers, setCustomers }: {
  customers: Customer[];
  setCustomers: (c: Customer[]) => void;
}) {
  const [row, setRow] = useState<Customer>({ name: "", phone: "", address: "" });

  function addRow() {
    if (!row.name || !row.phone) return;
    setCustomers([...customers, row]);
    setRow({ name: "", phone: "", address: "" });
  }

  function removeRow(i: number) {
    setCustomers(customers.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900 mb-1">Customer Alias Database <span className="text-slate-400 font-medium text-base">(optional)</span></h2>
        <p className="text-slate-500 text-sm">Add your existing customers so the AI knows who "Uncle Tan SS15" or "Pn Rohana Klang" is. New customers are added automatically when they first message you.</p>
      </div>

      {/* Manual add */}
      <div className="grid grid-cols-3 gap-2">
        <input type="text" placeholder='Nickname (e.g. "Uncle Tan SS15") *'
          value={row.name} onChange={(e) => setRow({ ...row, name: e.target.value })}
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm
                     focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300" />
        <input type="tel" placeholder="WhatsApp number *"
          value={row.phone} onChange={(e) => setRow({ ...row, phone: e.target.value })}
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm
                     focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300" />
        <input type="text" placeholder="Default delivery address"
          value={row.address} onChange={(e) => setRow({ ...row, address: e.target.value })}
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm
                     focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300" />
      </div>
      <button onClick={addRow} disabled={!row.name || !row.phone}
        className="btn-primary px-5 py-2.5 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none">
        + Add Customer
      </button>

      {/* Customer table */}
      {customers.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Nickname", "WhatsApp", "Default Address", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-slate-500">{c.phone}</td>
                  <td className="px-4 py-3 text-slate-500">{c.address || "—"}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600 transition-colors text-xs font-semibold">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-2xl">
          No customers added yet — you can skip this and add them later.
        </div>
      )}
    </div>
  );
}

/* ── Step 3: Business Rules ── */
function Toggle({ on, onChange, label, desc }: { on: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-slate-100 last:border-0">
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
      <button type="button" onClick={() => onChange(!on)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${on ? "bg-teal-500" : "bg-slate-200"}`}>
        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${on ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

function RulesStep({ rules, setRules }: { rules: Rules; setRules: (r: Rules) => void }) {
  function set<K extends keyof Rules>(k: K, v: Rules[K]) {
    setRules({ ...rules, [k]: v });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900 mb-1">Pricing & Logistics Rules</h2>
        <p className="text-slate-500 text-sm">Set your business logic. The AI will apply these automatically to every order quote.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1">
        {/* Min order */}
        <div className="py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-800 mb-1">Minimum Order Value (RM)</p>
          <p className="text-xs text-slate-500 mb-3">Orders below this amount will be rejected with a polite message.</p>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-sm font-semibold">RM</span>
            <input type="number" min="0" value={rules.minOrderValue}
              onChange={(e) => set("minOrderValue", e.target.value)}
              placeholder="50"
              className="w-32 px-3 py-2 rounded-xl border border-slate-200 text-slate-900 text-sm
                         focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300" />
          </div>
        </div>

        {/* Discount toggle */}
        <Toggle
          on={rules.allowDiscount}
          onChange={(v) => set("allowDiscount", v)}
          label="Allow AI to offer substitution discount"
          desc="When an item is out of stock, the AI can offer an alternative at a small discount."
        />
        {rules.allowDiscount && (
          <div className="pb-4 flex items-center gap-2 pl-1">
            <span className="text-sm text-slate-600">Discount up to</span>
            <input type="number" min="0" max="50" value={rules.discountPct}
              onChange={(e) => set("discountPct", e.target.value)}
              className="w-20 px-3 py-2 rounded-xl border border-slate-200 text-slate-900 text-sm
                         focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300" />
            <span className="text-sm text-slate-600">%</span>
          </div>
        )}

        {/* Delivery fee toggle */}
        <Toggle
          on={rules.chargeDelivery}
          onChange={(v) => set("chargeDelivery", v)}
          label="Automatically add Lalamove delivery fee to customer bill"
          desc="The AI will include the delivery quote in the order total sent to the customer."
        />
        {rules.chargeDelivery && (
          <div className="pb-4 flex items-center gap-2 pl-1">
            <span className="text-sm text-slate-600">Flat delivery fee</span>
            <span className="text-slate-500 text-sm font-semibold">RM</span>
            <input type="number" min="0" value={rules.deliveryFee}
              onChange={(e) => set("deliveryFee", e.target.value)}
              className="w-24 px-3 py-2 rounded-xl border border-slate-200 text-slate-900 text-sm
                         focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300" />
            <span className="text-xs text-slate-400">(or leave 0 to use live Lalamove price)</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Step 4: Team Access ── */
function TeamStep({ team, setTeam }: { team: TeamMember[]; setTeam: (t: TeamMember[]) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamMember["role"]>("Warehouse Manager");

  function addMember() {
    if (!email) return;
    if (team.find(m => m.email === email)) return;
    setTeam([...team, { email, role }]);
    setEmail("");
  }

  function removeMember(i: number) {
    setTeam(team.filter((_, idx) => idx !== i));
  }

  const ROLES: TeamMember["role"][] = ["Wholesale Supplier", "Warehouse Manager"];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900 mb-1">Grant Access</h2>
        <p className="text-slate-500 text-sm">Invite your team. They'll receive an email to join your SupplyLah workspace. You can change roles anytime from settings.</p>
      </div>

      {/* Role descriptions */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { role: "Wholesale Supplier", desc: "Full access — can view all orders, manage inventory, configure rules, and manage team.", icon: "👔" },
          { role: "Warehouse Manager",  desc: "Operational access — can view and update order status, view inventory. Cannot change settings or billing.", icon: "🏭" },
        ].map(({ role: r, desc, icon }) => (
          <div key={r} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-sm font-bold text-slate-800 mb-1">{icon} {r}</p>
            <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* Add member */}
      <div className="flex gap-2">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@company.com"
          onKeyDown={(e) => e.key === "Enter" && addMember()}
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm
                     focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300" />
        <select value={role} onChange={(e) => setRole(e.target.value as TeamMember["role"])}
          className="px-3 py-3 rounded-xl border border-slate-200 text-slate-700 text-sm bg-white
                     focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300">
          {ROLES.map(r => <option key={r}>{r}</option>)}
        </select>
        <button onClick={addMember} disabled={!email}
          className="btn-primary px-5 py-3 text-sm font-bold whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none">
          Invite
        </button>
      </div>

      {/* Member list */}
      {team.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Email", "Role", "Status", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {team.map((m, i) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{m.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      m.role === "Wholesale Supplier" ? "bg-teal-100 text-teal-700" : "bg-blue-100 text-blue-700"
                    }`}>{m.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">Invite pending</span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => removeMember(i)} className="text-red-400 hover:text-red-600 transition-colors text-xs font-semibold">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-2xl">
          No team members added yet — you can skip this and invite them later from Settings.
        </div>
      )}
    </div>
  );
}

/* ── Main page ── */
export default function GetStartedPage() {
  const router = useRouter();
  const [step, setStep]           = useState(0);
  const [saving, setSaving]       = useState(false);
  const [merchantId, setMerchantId] = useState<string | null>(null);

  const [products,  setProducts]  = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rules, setRules]         = useState<Rules>({
    minOrderValue: "50",
    allowDiscount: true,
    discountPct: "10",
    chargeDelivery: true,
    deliveryFee: "15",
  });
  const [team, setTeam] = useState<TeamMember[]>([]);

  /* Get current user's merchant on mount */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: merchant } = await supabase
        .from("merchant")
        .select("merchant_id")
        .eq("user_id", user.id)
        .single();

      if (merchant) setMerchantId(merchant.merchant_id);
    })();
  }, [router]);

  async function handleComplete() {
    if (!merchantId) return;
    setSaving(true);

    try {
      /* Save products */
      if (products.length > 0) {
        await supabase.from("product").insert(
          products.map(p => ({
            merchant_id: merchantId,
            product_name: p.name,
            product_sku: p.sku || null,
            unit_price: parseFloat(p.price) || 0,
            stock_quantity: parseInt(p.stock) || 0,
            slang_aliases: [],
          }))
        );
      }

      /* Save customers */
      if (customers.length > 0) {
        await supabase.from("customer").insert(
          customers.map(c => ({
            merchant_id: merchantId,
            customer_name: c.name,
            whatsapp_number: c.phone,
            delivery_address: c.address || null,
          }))
        );
      }

      /* Save business rules to knowledge_base */
      const rulesText = [
        `Minimum order value: RM${rules.minOrderValue}.`,
        rules.allowDiscount
          ? `AI may offer up to ${rules.discountPct}% discount for substitute items.`
          : "Do not offer discounts for substitutes.",
        rules.chargeDelivery
          ? `Charge delivery fee to customer. Flat rate: RM${rules.deliveryFee || "0 (use live Lalamove price)"}.`
          : "Delivery fee is absorbed by the merchant, do not charge customer.",
      ].join(" ");

      await supabase.from("knowledge_base").upsert({
        merchant_id: merchantId,
        content: rulesText,
        document_type: "business_rules",
      }, { onConflict: "merchant_id,document_type" });

      /* Save team invites */
      if (team.length > 0) {
        await supabase.from("merchant_users").insert(
          team.map(m => ({
            merchant_id: merchantId,
            invited_email: m.email,
            role: m.role,
            status: "invited",
          }))
        );
      }

      /* Mark onboarding complete */
      await supabase.auth.updateUser({
        data: { onboarding_complete: true, merchant_id: merchantId },
      });

      router.push("/dashboard");
    } catch (err) {
      console.error("Setup error:", err);
      setSaving(false);
    }
  }

  const stepLabels: Record<number, string> = {
    0: "Next: Add Customers →",
    1: "Next: Business Rules →",
    2: "Next: Team Access →",
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <Link href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="SupplyLah" className="h-10 md:h-12 w-auto scale-[2] md:scale-[2.5] origin-left object-contain" />
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Step {step + 1} of {STEPS.length}</span>
          <button onClick={() => router.push("/dashboard")}
            className="text-xs text-slate-500 hover:text-teal-700 font-semibold transition-colors hover:underline underline-offset-2">
            Skip setup →
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-6 py-10">
        <div className="w-full max-w-2xl">

          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-slate-900">Let&apos;s set up your store 🚀</h1>
            <p className="text-slate-500 text-sm mt-2">Takes about 3 minutes. You can change everything later in Settings.</p>
          </div>

          <StepBar current={step} />

          {/* Step card */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 mb-6">
            {step === 0 && <InventoryStep products={products} setProducts={setProducts} />}
            {step === 1 && <CustomersStep customers={customers} setCustomers={setCustomers} />}
            {step === 2 && <RulesStep rules={rules} setRules={setRules} />}
            {step === 3 && <TeamStep team={team} setTeam={setTeam} />}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button onClick={() => setStep(s => s - 1)} disabled={step === 0}
              className="group inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-700 px-4 py-2.5 rounded-xl hover:bg-teal-50 transition-all duration-200 disabled:opacity-0 disabled:pointer-events-none font-semibold">
              <span className="group-hover:-translate-x-0.5 transition-transform duration-200 inline-block">←</span>
              Back
            </button>

            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(s => s + 1)}
                className="btn-primary px-7 py-3 text-sm font-bold">
                {stepLabels[step]}
              </button>
            ) : (
              <button onClick={handleComplete} disabled={saving || !merchantId}
                className="btn-primary px-7 py-3 text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none">
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Saving your setup…
                  </span>
                ) : "Complete Setup — Go to Dashboard →"}
              </button>
            )}
          </div>

          {/* Skip hint on optional steps */}
          {(step === 1 || step === 3) && (
            <p className="text-center text-xs text-slate-400 mt-4">
              This step is optional —{" "}
              <button onClick={() => step < STEPS.length - 1 ? setStep(s => s + 1) : handleComplete()}
                className="text-teal-600 font-semibold hover:underline underline-offset-2">
                skip for now
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
