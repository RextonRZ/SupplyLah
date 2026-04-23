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

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [showPw,   setShowPw]   = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: authError, data } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { setError(authError.message); setLoading(false); }
    else {
      const onboarded = data.user?.user_metadata?.onboarding_complete === true;
      router.push(onboarded ? "/dashboard" : "/get-started");
    }
  }

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
        <div className="flex-1 flex items-center justify-center px-10 py-12 bg-white">
          <div className="w-full max-w-md">

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
            <Link href="/" className="flex mb-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="SupplyLah"
                className="h-16 md:h-20 w-auto scale-[2.5] origin-left object-contain" />
            </Link>

            <div className="mb-8">
              <h1 className="text-3xl lg:text-3xl font-black text-slate-900">Welcome back</h1>
              <p className="text-slate-500 text-sm mt-1.5">
                No account yet?{" "}
                <Link href="/signup" className="text-teal-600 font-semibold hover:text-teal-800 underline-offset-2 hover:underline transition-colors">
                  Sign up free →
                </Link>
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-sm text-red-700 flex items-start gap-2">
                <span className="mt-0.5">⚠️</span><span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email address</label>
                <input type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm
                             focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-slate-700">Password</label>
                  <button type="button" className="text-xs text-teal-600 hover:text-teal-800 font-medium transition-colors hover:underline underline-offset-2">
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} required value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm
                               focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300 pr-12" />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors text-base"
                    aria-label="Toggle password visibility">
                    {showPw ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="btn-primary w-full py-4 text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Logging in…
                  </span>
                ) : "Log in →"}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-xs text-slate-400 font-medium">OR</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            <Link href="/dashboard"
              className="group w-full flex items-center justify-center gap-2 border-2 border-slate-200
                         hover:border-teal-400 hover:bg-teal-50 text-slate-500 hover:text-teal-700
                         font-semibold py-3.5 rounded-xl text-sm transition-all duration-200">
              <span className="group-hover:scale-110 transition-transform duration-200"></span>
              View demo dashboard (no login needed)
            </Link>

            <p className="mt-6 text-center text-xs text-slate-400">
              By logging in, you agree to our{" "}
              <span className="text-teal-600 cursor-pointer hover:underline underline-offset-2">Terms</span>
              {" "}&{" "}
              <span className="text-teal-600 cursor-pointer hover:underline underline-offset-2">Privacy Policy</span>.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
