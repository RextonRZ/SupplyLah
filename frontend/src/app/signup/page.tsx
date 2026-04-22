"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

function SupplyLahLogo() {
  return (
    <Link href="/" className="flex justify-center my-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img 
        src="/logo.png" 
        alt="SupplyLah" 
        className="h-12 md:h-16 w-auto scale-[1.5] md:scale-[2] origin-center object-contain" 
      />
    </Link>
  );
}

interface FormData {
  businessName: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  agreed: boolean;
}

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({
    businessName: "",
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    agreed: false,
  });
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);
  const [showPw,   setShowPw]   = useState(false);

  function update(field: keyof FormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!form.agreed) {
      setError("Please agree to the Terms of Service and Privacy Policy.");
      return;
    }

    setLoading(true);

    const { error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name:     form.fullName,
          business_name: form.businessName,
          phone:         form.phone,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), 3000);
    }
  }

  /* ── Success state ── */
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teal-50 px-6">
        <div className="max-w-md w-full text-center bg-white rounded-3xl shadow-xl p-10 border border-teal-100">
          <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-teal-100 flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mascot-celebration.png"
              alt="Celebrating"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).parentElement!.innerHTML += `<span class="text-5xl">🎉</span>`;
              }}
            />
          </div>
          <h2 className="text-2xl font-black text-teal-900 mb-2">Welcome to SupplyLah!</h2>
          <p className="text-slate-500 text-sm mb-6">
            Check your email to verify your account. Redirecting to dashboard in a moment…
          </p>
          <Link
            href="/dashboard"
            className="inline-block bg-teal-600 hover:bg-teal-700 text-white font-bold px-8 py-3 rounded-xl text-sm transition-all"
          >
            Go to Dashboard →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-5/12 bg-teal-900 flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-teal-800 rounded-full -translate-x-1/2 -translate-y-1/2 opacity-60" />
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-teal-700 rounded-full translate-x-1/3 translate-y-1/3 opacity-40" />

        <div className="relative z-10 text-center max-w-sm">
          <div className="w-52 h-52 mx-auto mb-8 rounded-3xl bg-teal-800/60 flex items-center justify-center overflow-hidden animate-float">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mascot-hero.png"
              alt="SupplyLah mascot"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).parentElement!.innerHTML += `<span class="text-8xl">🦦</span>`;
              }}
            />
          </div>
          <h2 className="text-2xl font-black text-white mb-3">
            Start automating today
          </h2>
          <p className="text-teal-300 text-sm leading-relaxed mb-6">
            Join Malaysian wholesalers who have stopped drowning in WhatsApp messages.
          </p>

          {/* Feature list */}
          <div className="space-y-3 text-left">
            {[
              "🌏 Reads Bahasa Rojak, Malay & English",
              "📦 Live stock check on every order",
              "🚚 Auto Lalamove booking",
              "📊 Real-time operations dashboard",
              "🔒 PDPA-compliant data handling",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-teal-200">
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 bg-white overflow-y-auto">
        <div className="w-full max-w-md">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-700 mb-8 transition-colors">
            ← Back to home
          </Link>

          <SupplyLahLogo />

          <div className="mt-8 mb-6">
            <h1 className="text-2xl font-black text-slate-900">Create your account</h1>
            <p className="text-slate-500 text-sm mt-1">
              Already have an account?{" "}
              <Link href="/login" className="text-teal-600 font-semibold hover:text-teal-800 transition-colors">
                Log in
              </Link>
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-sm text-red-700 flex items-start gap-2">
              <span className="mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            {/* Business name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Business / Company Name
              </label>
              <input
                type="text"
                required
                value={form.businessName}
                onChange={(e) => update("businessName", e.target.value)}
                placeholder="Ahmad Brothers Trading"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm
                           focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300"
              />
            </div>

            {/* Full name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                placeholder="Ahmad bin Abdullah"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm
                           focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300"
              />
            </div>

            {/* Email + Phone (side by side) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm
                             focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone (WhatsApp)</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="+601X-XXXXXXX"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm
                             focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm
                             focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPw ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm Password</label>
              <input
                type={showPw ? "text" : "password"}
                required
                value={form.confirmPassword}
                onChange={(e) => update("confirmPassword", e.target.value)}
                placeholder="Repeat your password"
                className={`w-full px-4 py-3 rounded-xl border text-slate-900 placeholder-slate-400 text-sm
                           focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all
                           ${form.confirmPassword && form.confirmPassword !== form.password
                             ? "border-red-300 bg-red-50"
                             : "border-slate-200 hover:border-teal-300"}`}
              />
              {form.confirmPassword && form.confirmPassword !== form.password && (
                <p className="text-xs text-red-500 mt-1">Passwords don&apos;t match</p>
              )}
            </div>

            {/* Password strength indicator */}
            {form.password && (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((n) => {
                    const strength =
                      (form.password.length >= 8 ? 1 : 0) +
                      (/[A-Z]/.test(form.password) ? 1 : 0) +
                      (/[0-9]/.test(form.password) ? 1 : 0) +
                      (/[^A-Za-z0-9]/.test(form.password) ? 1 : 0);
                    return (
                      <div
                        key={n}
                        className={`flex-1 h-1.5 rounded-full transition-colors ${
                          n <= strength
                            ? strength <= 1 ? "bg-red-400"
                              : strength <= 2 ? "bg-yellow-400"
                              : strength <= 3 ? "bg-teal-400"
                              : "bg-teal-600"
                            : "bg-slate-200"
                        }`}
                      />
                    );
                  })}
                </div>
                <p className="text-xs text-slate-400">
                  Tip: mix uppercase, numbers, and symbols for a stronger password
                </p>
              </div>
            )}

            {/* Terms */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.agreed}
                onChange={(e) => update("agreed", e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-400 cursor-pointer"
              />
              <span className="text-xs text-slate-500 leading-relaxed">
                I agree to the{" "}
                <span className="text-teal-600 font-semibold cursor-pointer hover:underline">Terms of Service</span>
                {" "}and{" "}
                <span className="text-teal-600 font-semibold cursor-pointer hover:underline">Privacy Policy</span>.
                Your data is handled in compliance with Malaysia&apos;s PDPA 2010.
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !form.agreed}
              className="w-full bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:bg-teal-300
                         text-white font-bold py-3.5 rounded-xl text-sm shadow-sm hover:shadow-md
                         transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Creating account…
                </span>
              ) : (
                "Create account — it's free →"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">OR</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Demo access */}
          <Link
            href="/dashboard"
            className="w-full flex items-center justify-center gap-2 border-2 border-slate-200 hover:border-teal-300 text-slate-600 hover:text-teal-700 font-semibold py-3 rounded-xl text-sm transition-all"
          >
            <span>👀</span> Try demo without signing up
          </Link>
        </div>
      </div>
    </div>
  );
}
