"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";
import Papa from "papaparse";

interface Product { 
  product_id: string; 
  product_name: string; 
  unit: string; 
  available_quantity: string; 
  reorder_threshold: string; 
  unit_price: string; 
}
interface Customer  { name: string; phone: string; address: string; }
interface TeamMember { email: string; phone: string; role: "Wholesale Supplier" | "Warehouse Manager"; }
interface Rules {
  minOrderValue: string;
  allowDiscount: boolean;
  substitutions: Record<string, { substitute_id: string; discount: string }>;
  chargeDelivery: boolean;
  deliveryFee: string;
}

const STEPS = [
  { label: "Inventory",      desc: "Add your products and stock levels" },
  { label: "Customers",      desc: "Import existing customer nicknames" },
  { label: "Business Rules", desc: "Set pricing and delivery logic" },
  { label: "Team Access",    desc: "Invite your staff" },
];

const INPUT = `w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm
               focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all hover:border-slate-300 bg-white`;

function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden mt-5">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>{headers.map(h => (
            <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
          ))}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/* ── Step 1: Inventory ── */
function InventoryStep({ products, setProducts }: { products: Product[]; setProducts: (p: Product[]) => void }) {
  const [tab, setTab]             = useState<"sheets" | "file" | "manual">("sheets");
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName]   = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [row, setRow]             = useState<Product>({ product_id: "", product_name: "", unit: "", available_quantity: "", reorder_threshold: "", unit_price: "" });
  const fileRef                   = useRef<HTMLInputElement>(null);

  function addRow() {
    if (!row.product_name || !row.unit_price) return;
    setProducts([...products, row]);
    setRow({ product_id: "", product_name: "", unit: "", available_quantity: "", reorder_threshold: "", unit_price: "" });
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext ?? "")) {
      setFileError("Please upload a .csv, .xlsx, or .xls file.");
      return;
    }

    setFileName(file.name);

    // AI-driven robust parsing strategy
    const processData = (data: Record<string, any>[]) => {
      const parsed: Product[] = [];
      for (const row of data) {
        // Fallback: Support exact headers or index-based fallback 
        const rowVals = Object.values(row);
        
        // Priority 1: Read by exact column header if it exists
        const id = row["product_id"] ?? rowVals[0];
        const name = row["product_name"] ?? rowVals[1];
        
        if (!name) continue; // Must at least have a product name

        parsed.push({ 
          product_id: String(id || "").trim(), 
          product_name: String(name || "").trim(), 
          unit: String(row["unit"] ?? rowVals[2] ?? "").trim(), 
          available_quantity: String(row["available_quantity"] ?? rowVals[3] ?? "").trim(),
          reorder_threshold: String(row["reorder_threshold"] ?? rowVals[4] ?? "").trim(),
          unit_price: String(row["unit_price"] ?? rowVals[5] ?? "").trim() 
        });
      }
      
      if (parsed.length > 0) {
        setProducts([...products, ...parsed]);
        setFileName(`${file.name} — ${parsed.length} products imported`);
      } else {
        setFileError("No valid rows found. Check your file format.");
      }
    };

    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processData(results.data as Record<string, any>[])
      });
    } else {
      // Excel Magic! (.xlsx / .xls)
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        processData(json as Record<string, any>[]);
      };
      reader.readAsArrayBuffer(file);
    }
  }

  async function handleGoogleSheet() {
    if (!sheetsUrl) return;
    setImporting(true);
    setFileError(null);

    try {
      // Extract Google Sheet ID from typical URLs
      // e.g. https://docs.google.com/spreadsheets/d/1BxiMvs0X_5u.../edit#gid=0 -> 1Bxi...
      const idMatch = sheetsUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (!idMatch || idMatch.length < 2) {
        throw new Error("Invalid Google Sheets URL structure.");
      }
      
      const sheetId = idMatch[1];
      // Public export link trick!
      const csvExportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

      const response = await fetch(csvExportUrl);
      if (!response.ok) {
        throw new Error("Could not read sheet. Ensure it is shared 'Anyone with the link can view'.");
      }
      
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
           const parsed: Product[] = [];
           for (const row of results.data as Record<string, any>[]) {
             const rowVals = Object.values(row);
             const id = row["product_id"] ?? rowVals[0];
             const name: string = row["product_name"] ?? rowVals[1];
             if (!name) continue;
             
             parsed.push({ 
                product_id: String(id || "").trim(), 
                product_name: String(name || "").trim(), 
                unit: String(row["unit"] ?? rowVals[2] ?? "").trim(), 
                available_quantity: String(row["available_quantity"] ?? rowVals[3] ?? "").trim(),
                reorder_threshold: String(row["reorder_threshold"] ?? rowVals[4] ?? "").trim(),
                unit_price: String(row["unit_price"] ?? rowVals[5] ?? "").trim() 
             });
           }
           
           if (parsed.length > 0) {
             setProducts([...products, ...parsed]);
             setTab("manual"); // jump tab to show them their loaded list naturally!
           } else {
             setFileError("Sheet read successfully, but no valid rows found.");
           }
        }
      });
      
    } catch (err: any) {
      setFileError(err.message || "Failed to import from Google Sheets.");
    } finally {
      setImporting(false);
    }
  }

  const TABS = [
    { id: "sheets", label: "Google Sheets" },
    { id: "file",   label: "Upload file" },
    { id: "manual", label: "Manual entry" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Google Sheets */}
      {tab === "sheets" && (
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-700">Sheet URL</label>
          <p className="text-xs text-slate-400">Share the sheet publicly (view only). Expected columns: product_id, product_name, unit, available_quantity, reorder_threshold, unit_price.</p>
          <div className="flex gap-2 mt-2">
            <input type="url" value={sheetsUrl} onChange={(e) => setSheetsUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className={INPUT} />
            <button
              onClick={handleGoogleSheet}
              disabled={!sheetsUrl || importing}
              className="btn-primary px-5 py-3 text-sm font-bold whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none">
              {importing ? "Importing…" : "Import"}
            </button>
          </div>
          {fileError && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">{fileError}</p>}
        </div>
      )}

      {/* Upload file */}
      {tab === "file" && (
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700">Upload spreadsheet</label>
          <p className="text-xs text-slate-400">Accepts .csv, .xlsx, or .xls. First row should be headers match the exact template: product_id, product_name, unit, available_quantity, reorder_threshold, unit_price.</p>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-200 hover:border-teal-300 rounded-xl px-6 py-8 text-center cursor-pointer transition-colors group">
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
            <p className="text-sm font-semibold text-slate-500 group-hover:text-teal-700 transition-colors">
              {fileName ? fileName : "Click to choose file"}
            </p>
            <p className="text-xs text-slate-400 mt-1">CSV, Excel — max 10MB</p>
          </div>
          {fileError && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{fileError}</p>
          )}
        </div>
      )}

      {/* Manual entry */}
      {tab === "manual" && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {([
              { key: "product_id",         label: "ID",           col: "",           type: "text" },
              { key: "product_name",       label: "Name *",       col: "col-span-2", type: "text" },
              { key: "unit",               label: "Unit",         col: "",           type: "text" },
              { key: "available_quantity", label: "Available Qty",    col: "",           type: "number" },
              { key: "reorder_threshold",  label: "Reorder Threshold",      col: "",           type: "number" },
              { key: "unit_price",         label: "Price(RM)*",   col: "",           type: "number" },
            ] as const).map(({ key, label, col, type }) => (
              <div key={key} className={col}>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
                <input type={type} value={(row as any)[key]}
                  onChange={(e) => setRow({ ...row, [key]: e.target.value })}
                  className={INPUT} />
              </div>
            ))}
          </div>
          <button onClick={addRow} disabled={!row.product_name || !row.unit_price}
            className="btn-primary px-5 py-2.5 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none">
            Add product
          </button>
        </div>
      )}

      {/* Product list */}
      {products.length > 0 ? (
        <DataTable headers={["ID", "Product", "Unit", "Avail Qty", "Reorder Threshold", "Price(RM)", ""]}>
          {products.map((p, i) => (
            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-500 text-xs">{p.product_id}</td>
              <td className="px-4 py-3 font-medium text-slate-900">{p.product_name}</td>
              <td className="px-4 py-3 text-slate-500 text-xs">{p.unit || "—"}</td>
              <td className="px-4 py-3 text-slate-700 text-xs">{p.available_quantity || "—"}</td>
              <td className="px-4 py-3 text-slate-500 text-xs">{p.reorder_threshold || "—"}</td>
              <td className="px-4 py-3 text-slate-700">RM {p.unit_price}</td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => setProducts(products.filter((_, idx) => idx !== i))}
                  className="text-slate-300 hover:text-red-500 transition-colors text-xs font-medium">Remove</button>
              </td>
            </tr>
          ))}
        </DataTable>
      ) : (
        <div className="border border-dashed border-slate-200 rounded-xl py-8 text-center">
          <p className="text-sm text-slate-400">No products yet</p>
        </div>
      )}
    </div>
  );
}

/* ── Step 2: Customers ── */
function CustomersStep({ customers, setCustomers, onSkip }: { customers: Customer[]; setCustomers: (c: Customer[]) => void; onSkip: () => void }) {
  const [row, setRow] = useState<Customer>({ name: "", phone: "", address: "" });

  function addRow() {
    if (!row.name || !row.phone) return;
    setCustomers([...customers, row]);
    setRow({ name: "", phone: "", address: "" });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">Add existing customers so the AI recognises them by nickname. New customers are picked up automatically when they first message you.</p>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {([
            { key: "name",    label: "Nickname *",              type: "text" },
            { key: "phone",   label: "WhatsApp number *",       type: "tel" },
            { key: "address", label: "Default delivery address",type: "text" },
          ] as const).map(({ key, label, type }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
              <input type={type} value={row[key]} onChange={(e) => setRow({ ...row, [key]: e.target.value })}
                className={INPUT} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={addRow} disabled={!row.name || !row.phone}
            className="btn-primary px-5 py-2.5 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none">
            Add customer
          </button>
          {customers.length === 0 && (
            <button onClick={onSkip}
              className="px-5 py-2.5 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
              No Valid Customer
            </button>
          )}
        </div>
      </div>
      {customers.length > 0 ? (
        <DataTable headers={["Nickname", "WhatsApp", "Address", ""]}>
          {customers.map((c, i) => (
            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
              <td className="px-4 py-3 text-slate-500">{c.phone}</td>
              <td className="px-4 py-3 text-slate-500">{c.address || "—"}</td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => setCustomers(customers.filter((_, idx) => idx !== i))}
                  className="text-slate-300 hover:text-red-500 transition-colors text-xs font-medium">Remove</button>
              </td>
            </tr>
          ))}
        </DataTable>
      ) : (
        <div className="border border-dashed border-slate-200 rounded-xl py-8 text-center">
          <p className="text-sm text-slate-400">No customers yet</p>
        </div>
      )}
    </div>
  );
}

/* ── Step 3: Business Rules ── */
function Toggle({ on, onChange, label, desc }: { on: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <div className="flex items-start justify-between gap-6 py-5">
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed max-w-sm">{desc}</p>
      </div>
      <button type="button" onClick={() => onChange(!on)}
        className={`relative shrink-0 w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none mt-0.5 ${on ? "bg-teal-500" : "bg-slate-200"}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${on ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

function RulesStep({ rules, setRules, products }: { rules: Rules; setRules: (r: Rules) => void; products: Product[] }) {
  function set<K extends keyof Rules>(k: K, v: Rules[K]) { setRules({ ...rules, [k]: v }); }
  
  function updateSub(productId: string, field: "substitute_id" | "discount", value: string) {
    const existing = rules.substitutions[productId] || { substitute_id: "N/A", discount: "" };
    set("substitutions", {
      ...rules.substitutions,
      [productId]: {
        ...existing,
        [field]: value
      }
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-500 mb-4">These rules are applied to every order quote automatically.</p>
      <div className="py-5 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-800 mb-0.5">Minimum order value</p>
        <p className="text-xs text-slate-500 mb-3">Orders below this amount will be politely declined.</p>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-400">RM</span>
          <input type="number" min="0" value={rules.minOrderValue} onChange={(e) => set("minOrderValue", e.target.value)}
            placeholder="50"
            className="w-28 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm
                       focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all hover:border-slate-300" />
        </div>
      </div>
      <div className="border-b border-slate-100 pb-5">
        <Toggle on={rules.allowDiscount} onChange={(v) => set("allowDiscount", v)}
          label="Allow substitution discount"
          desc="When an item is out of stock, offer an alternative at a slight discount rather than rejecting the order." />
        {rules.allowDiscount && products.length > 0 && (
          <div className="mt-2">
            <DataTable headers={["ID", "Product", "Substitute Product", "Discount"]}>
              {products.map((p) => {
                const sub = rules.substitutions[p.product_id] || { substitute_id: "N/A", discount: "" };
                const isNA = sub.substitute_id === "N/A" || !sub.substitute_id;
                
                return (
                  <tr key={p.product_id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 text-xs">{p.product_id}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 text-sm">{p.product_name}</td>
                    <td className="px-4 py-3">
                      <select 
                        value={sub.substitute_id || "N/A"} 
                        onChange={(e) => {
                          const val = e.target.value;
                          updateSub(p.product_id, "substitute_id", val);
                          if (val === "N/A") updateSub(p.product_id, "discount", ""); // clear discount if N/A
                        }}
                        className="w-full max-w-[200px] px-2 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="N/A">N/A</option>
                        {products
                          .filter(opt => opt.product_id !== p.product_id) // don't substitute with itself
                          .map(opt => (
                            <option key={opt.product_id} value={opt.product_id}>
                              {opt.product_name}
                            </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {isNA ? (
                        <span className="text-slate-400 text-xs italic">N/A</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input 
                            type="number" min="0" max="100" 
                            value={sub.discount || ""} 
                            placeholder="10"
                            onChange={(e) => updateSub(p.product_id, "discount", e.target.value)}
                            className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500" 
                          />
                          <span className="text-xs text-slate-500">%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          </div>
        )}
        {rules.allowDiscount && products.length === 0 && (
           <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mt-2 border border-amber-200 inline-block">
             You need to add products in Step 1 to configure substitutions.
           </p>
        )}
      </div>
      <div>
        <Toggle on={rules.chargeDelivery} onChange={(v) => set("chargeDelivery", v)}
          label="Pass delivery fee to customer"
          desc="Include the Lalamove delivery charge in the order total sent to the buyer." />
        {rules.chargeDelivery && (
          <div className="pb-4 flex items-center gap-3">
            <span className="text-sm text-slate-600">Flat rate</span>
            <span className="text-sm font-semibold text-slate-400">RM</span>
            <input type="number" min="0" value={rules.deliveryFee} onChange={(e) => set("deliveryFee", e.target.value)}
              className="w-20 px-3 py-2 rounded-lg border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
            <span className="text-xs text-slate-400">Leave 0 to use live Lalamove pricing</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Step 4: Team ── */
function TeamStep({ team, setTeam }: { team: TeamMember[]; setTeam: (t: TeamMember[]) => void }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole]   = useState<TeamMember["role"]>("Warehouse Manager");

  function addMember() {
    if (!email || !phone || team.find(m => m.email === email)) return;
    setTeam([...team, { email, phone, role }]);
    setEmail("");
    setPhone("");
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">Invite staff to your workspace. Roles control what they can see and do.</p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { role: "Wholesale Supplier", desc: "Full access — orders, inventory, rules, billing, and team." },
          { role: "Warehouse Manager",  desc: "Operational — view and update orders and inventory only." },
        ].map(({ role: r, desc }) => (
          <div key={r} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">{r}</p>
            <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email address & Contact number</label>
        <div className="flex gap-2">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            onKeyDown={(e) => e.key === "Enter" && addMember()}
            className={INPUT} />
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="Contact number"
            onKeyDown={(e) => e.key === "Enter" && addMember()}
            className={INPUT} />
          <select value={role} onChange={(e) => setRole(e.target.value as TeamMember["role"])}
            className="px-3 py-3 rounded-xl border border-slate-200 text-slate-700 text-sm bg-white
                       focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all hover:border-slate-300 shrink-0">
            <option>Wholesale Supplier</option>
            <option>Warehouse Manager</option>
          </select>
          <button onClick={addMember} disabled={!email || !phone}
            className="btn-primary flex items-center justify-center px-5 py-3 text-sm font-bold whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none">
            Invite
          </button>
        </div>
      </div>
      {team.length > 0 ? (
        <DataTable headers={["Email", "Contact", "Role", "Status", ""]}>
          {team.map((m, i) => (
            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-900">{m.email}</td>
              <td className="px-4 py-3 text-slate-600 text-sm">{m.phone}</td>
              <td className="px-4 py-3">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  m.role === "Wholesale Supplier" ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-600"
                }`}>{m.role}</span>
              </td>
              <td className="px-4 py-3">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Pending</span>
              </td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => setTeam(team.filter((_, idx) => idx !== i))}
                  className="text-slate-300 hover:text-red-500 transition-colors text-xs font-medium">Remove</button>
              </td>
            </tr>
          ))}
        </DataTable>
      ) : (
        <div className="border border-dashed border-slate-200 rounded-xl py-8 text-center">
          <p className="text-sm text-slate-400">No team members yet</p>
        </div>
      )}
    </div>
  );
}

/* ── Main page ── */
export default function GetStartedPage() {
  const router = useRouter();
  const [step, setStep]             = useState(0);
  const [saving, setSaving]         = useState(false);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [products,  setProducts]    = useState<Product[]>([]);
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [rules, setRules]           = useState<Rules>({ minOrderValue: "50", allowDiscount: true, substitutions: {}, chargeDelivery: true, deliveryFee: "15" });
  const [team, setTeam]             = useState<TeamMember[]>([]);
  // Track steps the user proceeded through without adding data
  const [warnedEmpty, setWarnedEmpty] = useState<Set<number>>(new Set());
  const [showEmptyWarning, setShowEmptyWarning] = useState(false);
  const [skippedSteps, setSkippedSteps] = useState<Set<number>>(new Set());

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: merchant } = await supabase.from("merchant").select("merchant_id").eq("user_id", user.id).single();
      if (merchant) setMerchantId(merchant.merchant_id);
    })();
  }, [router]);

  const stepHasData = [
    products.length > 0 || skippedSteps.has(0),
    customers.length > 0 || skippedSteps.has(1),
    true, // business rules always has defaults
    team.length > 0 || skippedSteps.has(3),
  ];

  function tryAdvance() {
    if (!stepHasData[step] && !showEmptyWarning) {
      // First click on Next with empty step — show inline warning
      setShowEmptyWarning(true);
      return;
    }
    // Either has data, or user confirmed via second click
    if (!stepHasData[step]) setWarnedEmpty(s => new Set([...s, step]));
    setShowEmptyWarning(false);
    setStep(s => s + 1);
  }

  // Clear warning when step changes or user adds data
  useEffect(() => { setShowEmptyWarning(false); }, [step]);
  useEffect(() => { if (stepHasData[step]) setShowEmptyWarning(false); }, [products, customers, team]);

  const incompleteSteps = STEPS.map((s, i) => ({ ...s, i }))
    .filter(({ i }) => warnedEmpty.has(i) && !stepHasData[i]);

  const pct = Math.round((step / STEPS.length) * 100);

  async function handleComplete() {
    if (!merchantId) return;
    setSaving(true);
    try {
      if (products.length > 0) {
        // Mapping our UI model to Supabase table schema
        await supabase.from("product").insert(products.map(p => ({
          merchant_id: merchantId, 
          product_name: p.product_name, 
          product_sku: p.product_id || null, // mapping UI 'product_id' to logic 'product_sku' temp
          unit_price: parseFloat(p.unit_price) || 0, 
          stock_quantity: parseInt(p.available_quantity) || 0,
          unit: p.unit || null,
          reorder_threshold: parseInt(p.reorder_threshold) || 0,
          slang_aliases: [],
        })));
      }
      if (customers.length > 0) {
        await supabase.from("customer").insert(customers.map(c => ({
          merchant_id: merchantId, customer_name: c.name, whatsapp_number: c.phone, delivery_address: c.address || null,
        })));
      }

      // Format substitution rules for the AI Agent
      const subRules = Object.entries(rules.substitutions)
        .filter(([_, sub]) => sub.substitute_id && sub.substitute_id !== "N/A")
        .map(([prodId, sub]) => {
          const original = products.find(p => p.product_id === prodId)?.product_name || prodId;
          const substitute = products.find(p => p.product_id === sub.substitute_id)?.product_name || sub.substitute_id;
          return `- If "${original}" is out of stock, offer "${substitute}" as a substitute at a ${sub.discount || 0}% discount.`;
        }).join("\n");

      const rulesText = [
        `Minimum order value: RM${rules.minOrderValue}.`,
        rules.allowDiscount ? `Substitutions allowed:\n${subRules}` : "Do not offer discounts for substitutes.",
        rules.chargeDelivery ? `Charge delivery fee. Flat rate: RM${rules.deliveryFee || "0 (use live Lalamove price)"}.` : "Delivery fee absorbed by merchant.",
      ].join("\n\n");
      
      const { error: kbError } = await supabase.from("knowledge_base").upsert([
        { merchant_id: merchantId, content: rulesText, document_type: "business_rules" },
        { merchant_id: merchantId, content: JSON.stringify(rules), document_type: "business_rules_json" }
      ], { onConflict: "merchant_id,document_type" });
      if (kbError) throw kbError;

      if (team.length > 0) {
        await supabase.from("merchant_users").insert(team.map(m => ({ merchant_id: merchantId, invited_email: m.email, contact_number: m.phone, role: m.role, status: "invited" })));
      }
      await supabase.auth.updateUser({ data: { onboarding_complete: true, merchant_id: merchantId } });
      router.push("/dashboard");
    } catch (err) {
      console.error("Setup error:", err);
      setSaving(false);
    }
  }

  const nextLabel = ["Next: Customers", "Next: Business Rules", "Next: Team Access"][step] ?? "";

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Progress bar */}
      <div className="h-0.5 bg-slate-100 sticky top-0 z-20">
        <div className="h-full bg-teal-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {/* Navbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0.5 z-10">
        <Link href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="SupplyLah" className="h-10 md:h-12 w-auto scale-[2] md:scale-[2.5] origin-left object-contain" />
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400 font-medium">{step + 1} / {STEPS.length}</span>
          <button onClick={() => router.push("/dashboard")}
            className="text-xs text-slate-400 hover:text-teal-700 font-semibold transition-colors">
            Exit setup
          </button>
        </div>
      </div>

      <div className="flex flex-1">

        {/* Sidebar */}
        <div className="hidden lg:flex w-72 shrink-0 border-r border-slate-100 flex-col px-8 py-10 bg-slate-50">
          <div className="mb-10">
            <h1 className="text-xl font-black text-slate-900 mb-1">Set up your store</h1>
            <p className="text-xs text-slate-400 leading-relaxed">Takes about 3 minutes. Everything can be changed later.</p>
          </div>


          <nav className="space-y-1">
            {STEPS.map((s, i) => {
              const done    = i < step && stepHasData[i];
              const incomplete = i < step && warnedEmpty.has(i) && !stepHasData[i];
              const current = i === step;
              // Only allow clicking steps the user has already visited
              const isClickable = i < step || i === step;
              return (
                <div key={i} className={`flex items-start gap-3 px-3 py-3 rounded-xl transition-colors ${
                  current ? "bg-white shadow-sm border border-slate-200" : isClickable ? "hover:bg-white cursor-pointer" : "opacity-60 cursor-not-allowed"
                }`}
                onClick={() => {
                  if (isClickable) {
                    setStep(i);
                    setShowEmptyWarning(false);
                  }
                }}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5 transition-all ${
                    done       ? "bg-teal-500 text-white"
                  : incomplete ? "bg-amber-400 text-white"
                  : current   ? "bg-teal-900 text-white"
                  :             "bg-slate-200 text-slate-500"
                  }`}>
                    {done ? "✓" : incomplete ? "!" : i + 1}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold leading-tight ${
                      current ? "text-slate-900" : done ? "text-teal-600" : incomplete ? "text-amber-600" : "text-slate-400"
                    }`}>{s.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-snug">{s.desc}</p>
                    {incomplete && (
                      <span className="text-xs text-amber-500 font-semibold mt-0.5 inline-block">
                        Not filled in
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="mt-auto pt-10">
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span>Progress</span><span>{pct}%</span>
            </div>
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-teal-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          <div className="flex-1 px-8 lg:px-14 py-10 max-w-3xl">


            {/* Step header */}
            <div className="mb-8 pb-6 border-b border-slate-100">
              <span className="text-xs font-bold text-teal-600 uppercase tracking-widest">Step {step + 1}</span>
              <h2 className="text-2xl font-black text-slate-900 mt-1">{STEPS[step].label}</h2>
            </div>

            {step === 0 && <InventoryStep  products={products}   setProducts={setProducts} />}
            {step === 1 && <CustomersStep customers={customers} setCustomers={setCustomers} onSkip={() => { setSkippedSteps(s => new Set([...s, 1])); setShowEmptyWarning(false); setStep(2); }} />}
            {step === 2 && <RulesStep     rules={rules}         setRules={setRules}     products={products} />}
            {step === 3 && <TeamStep      team={team}           setTeam={setTeam} />}
          </div>

          {/* Bottom nav */}
          <div className="border-t border-slate-100 bg-white px-8 lg:px-14 py-4 sticky bottom-0">
            {/* Inline empty-step warning — appears between Back and Next */}
            {showEmptyWarning && (
              <div className="mb-3 flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-amber-800">
                  You haven&apos;t added anything here yet. Continue anyway?
                </p>
                <button onClick={tryAdvance}
                  className="shrink-0 text-xs font-bold text-amber-700 hover:text-amber-900 underline underline-offset-2 transition-colors">
                  Yes, continue
                </button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <button onClick={() => { setShowEmptyWarning(false); setStep(s => s - 1); }} disabled={step === 0}
                className="group inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 font-semibold transition-colors disabled:opacity-0 disabled:pointer-events-none">
                <span className="group-hover:-translate-x-0.5 transition-transform inline-block">←</span> Back
              </button>

              {step < STEPS.length - 1 ? (
                <button onClick={tryAdvance} className="btn-primary px-6 py-2.5 text-sm font-bold">
                  {nextLabel} →
                </button>
              ) : (
                <button onClick={handleComplete} disabled={saving || !merchantId}
                  className="btn-primary px-6 py-2.5 text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none">
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Saving…
                    </span>
                  ) : "Complete setup →"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
