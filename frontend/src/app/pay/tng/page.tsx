"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BACKEND_URL } from "@/lib/supabase";

type Step = "redirect" | "phone" | "otp" | "confirm" | "notification" | "approve" | "success";

function TngPaymentFlow() {
  const params = useSearchParams();
  const orderId  = params.get("order")    ?? "";
  const amount   = params.get("amount")   ?? "0.00";
  const merchant = decodeURIComponent(params.get("merchant") ?? "Demo Wholesaler Sdn Bhd");

  const [step, setStep]       = useState<Step>("redirect");
  const [phone, setPhone]     = useState("0123456789");
  const [otp, setOtp]         = useState("");
  const [otpError, setOtpError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [trackingUrl, setTrackingUrl] = useState("");

  // Auto-advance from redirect screen after 2 s
  useEffect(() => {
    if (step !== "redirect") return;
    const t = setTimeout(() => setStep("phone"), 2000);
    return () => clearTimeout(t);
  }, [step]);

  async function handlePay() {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/payment/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          reference: `TNG${Date.now().toString().slice(-8)}`,
          method: "Touch 'n Go eWallet",
        }),
      });
      const data = await res.json();
      if (data.tracking_url) setTrackingUrl(data.tracking_url);
    } catch { /* demo — always succeed */ }
    setLoading(false);
    setStep("notification");
  }

  // ── Screens ──────────────────────────────────────────────────────────────

  if (step === "redirect") return (
    <Screen>
      <div className="flex flex-col items-center justify-center gap-6 h-full">
        <TngLogo size={72} />
        <p className="text-slate-500 text-sm animate-pulse">Please wait to be redirected...</p>
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </Screen>
  );

  if (step === "phone") return (
    <Screen>
      <Header amount={amount} merchant={merchant} />
      <div className="flex-1 p-6 space-y-5">
        <div>
          <label className="block text-xs text-slate-500 mb-1.5 font-medium">Mobile Number</label>
          <div className="flex items-center border-2 border-blue-600 rounded-xl overflow-hidden">
            <span className="bg-slate-100 px-3 py-3 text-sm text-slate-600 border-r border-slate-200">+60</span>
            <input
              className="flex-1 px-3 py-3 text-sm outline-none"
              value={phone.replace(/^0/, "")}
              onChange={e => setPhone("0" + e.target.value.replace(/\D/g, ""))}
              maxLength={10}
              inputMode="numeric"
              placeholder="123456789"
            />
          </div>
        </div>
        <button
          onClick={() => setStep("otp")}
          disabled={phone.length < 10}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-xl transition-colors"
        >
          Log In
        </button>
        <p className="text-center text-xs text-slate-400">
          An OTP will be sent to your registered number
        </p>
      </div>
    </Screen>
  );

  if (step === "otp") return (
    <Screen>
      <Header amount={amount} merchant={merchant} />
      <div className="flex-1 p-6 space-y-5">
        <div className="bg-slate-50 rounded-xl p-3 text-sm text-center text-slate-600">
          OTP sent to <strong>{phone}</strong>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1.5 font-medium">Enter OTP</label>
          <input
            className={`w-full border-2 ${otpError ? "border-red-400" : "border-blue-600"} rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] outline-none font-mono`}
            value={otp}
            onChange={e => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setOtpError(false); }}
            maxLength={6}
            inputMode="numeric"
            placeholder="••••••"
          />
          {otpError && <p className="text-red-500 text-xs mt-1 text-center">Invalid OTP. Try 123456.</p>}
        </div>
        <button
          onClick={() => {
            if (otp !== "123456") { setOtpError(true); return; }
            setStep("confirm");
          }}
          disabled={otp.length < 6}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-xl transition-colors"
        >
          Verify
        </button>
        <p className="text-center text-xs text-slate-400">Demo OTP: <strong>123456</strong></p>
      </div>
    </Screen>
  );

  if (step === "confirm") return (
    <Screen>
      <div className="bg-blue-600 px-5 py-4 flex items-center gap-3">
        <TngLogo size={28} white />
        <div>
          <p className="text-white text-xs opacity-80">Payment to</p>
          <p className="text-white font-bold text-sm leading-tight">{merchant}</p>
        </div>
      </div>
      <div className="flex-1 p-6 space-y-4">
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-center">
          <p className="text-xs text-slate-500 mb-1">Payment Due</p>
          <p className="text-4xl font-extrabold text-blue-700">RM {amount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 text-sm">
          {[
            ["Payment Type", "Online Purchase"],
            ["MY ID", phone.slice(0, 4) + "****" + phone.slice(-4)],
            ["Amount", `RM ${amount}`],
            ["Merchant", merchant],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between px-4 py-3">
              <span className="text-slate-500">{k}</span>
              <span className="font-semibold text-slate-800">{v}</span>
            </div>
          ))}
        </div>
        <button
          onClick={handlePay}
          disabled={loading}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-lg rounded-2xl transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
          {loading ? "Processing..." : "Pay"}
        </button>
      </div>
    </Screen>
  );

  if (step === "notification") return (
    <Screen>
      {/* Simulated phone status bar */}
      <div className="bg-gray-900 text-white text-[10px] flex justify-between px-4 py-1">
        <span>9:41</span><span>●●●</span>
      </div>
      {/* Notification bar — tappable */}
      <button
        onClick={() => setStep("approve")}
        className="w-full bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors shadow-sm"
      >
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
          <TngLogo size={22} white />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-900 truncate">Touch 'n Go eWallet</p>
          <p className="text-xs text-slate-600 truncate">
            Approve transaction of <strong>RM {amount}</strong> to {merchant}?
          </p>
        </div>
        <span className="text-[10px] text-slate-400 shrink-0">now</span>
      </button>
      <div className="flex-1 bg-gray-100 flex flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/></svg>
        </div>
        <p className="text-slate-500 text-sm">Tap the notification above to approve in TNG app</p>
      </div>
    </Screen>
  );

  if (step === "approve") return (
    <Screen>
      <div className="bg-blue-600 px-5 pt-10 pb-6 text-center">
        <TngLogo size={40} white />
        <p className="text-white text-xs mt-2 opacity-80">Touch 'n Go eWallet</p>
      </div>
      <div className="flex-1 p-6 flex flex-col items-center gap-5">
        <div className="w-full bg-slate-50 rounded-2xl p-5 text-center space-y-1">
          <p className="text-xs text-slate-500">You are about to pay</p>
          <p className="text-3xl font-extrabold text-blue-700">RM {amount}</p>
          <p className="text-xs text-slate-500">to <strong>{merchant}</strong></p>
        </div>
        <div className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <span className="text-amber-500 text-lg">⚠️</span>
          <p className="text-xs text-amber-800">
            If you did not perform this action, please <strong>Report</strong> immediately.
          </p>
        </div>
        <div className="w-full flex gap-3 mt-auto">
          <button
            onClick={() => setStep("redirect")}
            className="flex-1 py-3.5 border-2 border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
          >
            Report
          </button>
          <button
            onClick={() => setStep("success")}
            className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
          >
            Approve
          </button>
        </div>
      </div>
    </Screen>
  );

  // success
  return (
    <Screen>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div>
          <p className="text-2xl font-extrabold text-slate-900">Payment Successful!</p>
          <p className="text-slate-500 text-sm mt-1">RM {amount} paid to {merchant}</p>
        </div>
        <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-600 text-left space-y-1">
          <p>📦 Your order is being prepared for delivery.</p>
          <p>🚚 Lalamove driver will be assigned shortly.</p>
          {trackingUrl && (
            <p>🔗 <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">{trackingUrl}</a></p>
          )}
        </div>
        <p className="text-xs text-slate-400">You can now close this tab and check your WhatsApp for the delivery tracking link.</p>
        <button
          onClick={() => window.close()}
          className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
        >
          Done
        </button>
      </div>
    </Screen>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col max-w-sm mx-auto border-x border-slate-200 shadow-xl">
      {children}
    </div>
  );
}

function Header({ amount, merchant }: { amount: string; merchant: string }) {
  return (
    <div className="bg-blue-600 px-5 py-4 flex flex-col items-center gap-1">
      <TngLogo size={36} white />
      <p className="text-white text-xs opacity-80 mt-1">Payment to {merchant}</p>
      <p className="text-white font-extrabold text-2xl">RM {amount}</p>
    </div>
  );
}

function TngLogo({ size = 32, white = false }: { size?: number; white?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="12" fill={white ? "rgba(255,255,255,0.2)" : "#1565C0"} />
      <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle"
        fill="white" fontSize="18" fontWeight="bold" fontFamily="Arial">
        TNG
      </text>
    </svg>
  );
}

export default function TngPaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <TngPaymentFlow />
    </Suspense>
  );
}
