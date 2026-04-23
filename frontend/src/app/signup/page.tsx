"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

/* ── Shared slide data ─────────────────────────── */
const SLIDES = [
  {
    mascot: "/tiredchaos.png",
    title: "Tired of WhatsApp\nOrder Chaos?",
    desc: "200 messages a day. Price negotiations over voice note. Orders slipping through at 2am. We built this so you don't have to deal with that anymore.",
  },
  {
    mascot: "/bahasarojak.png",
    title: "Voice Notes, Text, or\nHandwritten Lists",
    desc: 'Whether a voice note in Bahasa Rojak or a photo of a handwritten list, our AI gets it. Send orders exactly how your customers do, no typing or translation needed.',
  },
  {
    mascot: "/logistic.png",
    title: "Instant Logistics\nWithout the Calls",
    desc: "Order confirmed? Delivery is already in motion. No manual entry. No booking errors. Just an automated tracking link sent straight to your customer.",
  },
    {
    mascot: "/mascot-hero.png",
    title: "Google Sheets Sync\nIn Real-Time",
    desc: "Still using whiteboards? We sync directly with your Google Sheets. Every quote is cross-referenced with your actual warehouse stock to prevent over-ordering and wasted stock.",
  },
  {
    mascot: "/mascot-working.png",
    title: "Full Control Staff \nCommand Center",
    desc: "One dashboard to rule them all. Monitor every order, track every driver, and handle 'Red Alerts' with one click. Total visibility for you and your warehouse manager.",
  },
  {
    mascot: "/mascot-celebration.png",
    title: "Enterprise-Grade\nPrivacy & PDPA",
    desc: "Your data stays yours. Fully PDPA 2010 compliant with single-tenant database security. We only keep raw content for 90 days, you're always in total control of your business data.",
  },
];

function LeftPanel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setCurrent((c) => (c + 1) % SLIDES.length), 8000);
    return () => clearInterval(t);
  }, []);

  const slide = SLIDES[current];

  return (
    <div className="hidden lg:flex lg:w-5/12 bg-teal-900 flex-col items-center justify-center p-12 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-72 h-72 bg-teal-800 rounded-full -translate-x-1/2 -translate-y-1/2 opacity-50" />
      <div className="absolute bottom-0 right-0 w-56 h-56 bg-teal-700 rounded-full translate-x-1/3 translate-y-1/3 opacity-40" />
      <div className="absolute top-1/2 left-1/4 w-48 h-48 bg-teal-600 rounded-full opacity-10 blur-3xl" />

      <div className="relative z-10 text-center max-w-sm w-full">
        {/* Mascot crossfade */}
        <div className="relative w-52 h-52 mx-auto mb-7">
          {SLIDES.map((s, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={s.mascot}
              alt=""
              className={`absolute inset-0 w-full h-full object-contain drop-shadow-2xl transition-opacity duration-700 ${i === current ? "opacity-100 animate-float" : "opacity-0"}`}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ))}
        </div>

        {/* Text fade-slide on change */}
        <div key={current} style={{ animation: "fadeSlideIn 0.6s ease-out both" }}>
          <h2 className="text-3xl lg:text-4xl font-black text-white mb-4 leading-tight whitespace-pre-line">
            {slide.title}
          </h2>
          <p className="text-teal-200 text-sm lg:text-base leading-relaxed">
            {slide.desc}
          </p>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mt-8">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`rounded-full transition-all duration-300 ${
                i === current ? "w-6 h-2 bg-teal-300" : "w-2 h-2 bg-teal-700 hover:bg-teal-500"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
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
    businessName: "", fullName: "", email: "",
    phone: "", password: "", confirmPassword: "", agreed: false,
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPw,  setShowPw]  = useState(false);

  function update(field: keyof FormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!form.agreed) { setError("Please agree to the Terms of Service and Privacy Policy."); return; }

    setLoading(true);
    const { error: authError, data } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: form.fullName,
          business_name: form.businessName,
          phone: form.phone,
          onboarding_complete: false,
        },
      },
    });
    if (authError) { setError(authError.message); setLoading(false); }
    else if (data.session) {
      // Email confirmation disabled — already signed in, go straight to setup
      router.push("/get-started");
    } else {
      // Email confirmation enabled — show "check your email" screen
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6"
        style={{ background: "linear-gradient(135deg, #edfefe 0%, #c7f0f0 40%, #edfefe 100%)" }}>
        <div className="max-w-sm w-full text-center">
          {/* Mascot — no frame, just floating */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mascot-celebration.png"
            alt=""
            className="w-40 h-40 object-contain mx-auto mb-4 drop-shadow-xl animate-float"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />

          <h2 className="text-3xl font-black text-teal-900 mb-2">Check your email</h2>
          <p className="text-slate-600 text-sm mb-1">
            We sent a link to <strong className="text-slate-800">{form.email}</strong>
          </p>
          <p className="text-slate-400 text-xs mb-7">
            Click it to verify and set up your store. Check your spam folder if it doesn&apos;t show up.
          </p>

          <div className="bg-white border border-teal-100 rounded-2xl px-5 py-4 shadow-sm text-sm text-slate-600 leading-relaxed">
            You&apos;ll be taken to your store setup once verified.
          </div>
        </div>
      </div>
    );
  }

  const strength =
    (form.password.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(form.password) ? 1 : 0) +
    (/[0-9]/.test(form.password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(form.password) ? 1 : 0);

  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="min-h-screen flex">
        <LeftPanel />

        {/* ── Right panel — centred ── */}
        <div className="flex-1 flex items-center justify-center px-10 py-10 bg-white overflow-y-auto">
          <div className="w-full max-w-lg">

            {/* Back link */}
            <Link href="/"
              className="group relative inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-teal-800 mb-6 px-3 py-1.5 rounded-lg overflow-hidden transition-colors duration-200 -ml-3">
              <span className="absolute inset-0 bg-teal-50 rounded-lg scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-250 ease-out" />
              <span className="relative z-10 flex items-center gap-1.5">
                <span className="group-hover:-translate-x-1 transition-transform duration-200 inline-block">←</span>
                Back to home
              </span>
            </Link>

            {/* Logo — bigger */}
            <Link href="/" className="flex mb-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="SupplyLah"
                className="h-16 md:h-20 w-auto scale-[2.5] origin-left object-contain" />
            </Link>

            <div className="mb-8">
              <h1 className="text-3xl lg:text-3xl font-black text-slate-900">Create your account</h1>
              <p className="text-slate-500 text-base mt-2">
                Already have one?{" "}
                <Link href="/login" className="text-teal-600 font-semibold hover:text-teal-800 underline-offset-2 hover:underline transition-colors">
                  Log in →
                </Link>
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 text-sm text-red-700 flex items-start gap-2">
                <span className="mt-0.5">⚠️</span><span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSignup} className="space-y-4">
              {/* Row 1: Business name | Full name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Business Name</label>
                  <input type="text" required value={form.businessName}
                    onChange={(e) => update("businessName", e.target.value)}
                    placeholder="Ahmad Brothers Trading"
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm
                               focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
                  <input type="text" required value={form.fullName}
                    onChange={(e) => update("fullName", e.target.value)}
                    placeholder="Ahmad bin Abdullah"
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm
                               focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300" />
                </div>
              </div>

              {/* Row 2: Email | Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
                  <input type="email" required value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="you@company.com"
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm
                               focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone (WhatsApp)</label>
                  <input type="tel" value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="+601X-XXXXXXX"
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm
                               focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300" />
                </div>
              </div>

              {/* Row 3: Password | Confirm */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPw ? "text" : "password"} required value={form.password}
                      onChange={(e) => update("password", e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300 pr-11" />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors text-base">
                      {showPw ? "🙈" : "👁"}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm Password</label>
                  <input type={showPw ? "text" : "password"} required value={form.confirmPassword}
                    onChange={(e) => update("confirmPassword", e.target.value)}
                    placeholder="Repeat your password"
                    className={`w-full px-4 py-3.5 rounded-xl border text-slate-900 placeholder-slate-400 text-sm
                               focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all
                               ${form.confirmPassword && form.confirmPassword !== form.password
                                 ? "border-red-300 bg-red-50" : "border-slate-200 hover:border-teal-300"}`} />
                  {form.confirmPassword && form.confirmPassword !== form.password && (
                    <p className="text-xs text-red-500 mt-1">Passwords don&apos;t match</p>
                  )}
                </div>
              </div>

              {/* Password strength */}
              {form.password && (
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className={`flex-1 h-1.5 rounded-full transition-colors ${
                        n <= strength
                          ? strength <= 1 ? "bg-red-400" : strength <= 2 ? "bg-yellow-400" : strength <= 3 ? "bg-teal-400" : "bg-teal-600"
                          : "bg-slate-200"
                      }`} />
                    ))}
                  </div>
                  <span className="text-xs text-slate-400 w-12 text-right">
                    {strength <= 1 ? "Weak" : strength <= 2 ? "Fair" : strength <= 3 ? "Good" : "Strong"}
                  </span>
                </div>
              )}

              {/* Terms */}
              <label className="flex items-start gap-3 cursor-pointer pt-0.5">
                <input type="checkbox" checked={form.agreed}
                  onChange={(e) => update("agreed", e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-400 cursor-pointer shrink-0" />
                <span className="text-xs text-slate-500 leading-relaxed">
                  I agree to the{" "}
                  <span className="text-teal-600 font-semibold cursor-pointer hover:underline underline-offset-2">Terms of Service</span>
                  {" "}and{" "}
                  <span className="text-teal-600 font-semibold cursor-pointer hover:underline underline-offset-2">Privacy Policy</span>.
                  Your data is handled in compliance with Malaysia&apos;s PDPA 2010.
                </span>
              </label>

              {/* Submit */}
              <button type="submit" disabled={loading || !form.agreed}
                className="btn-primary w-full py-4 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Creating account…
                  </span>
                ) : "Create account — it's free →"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
