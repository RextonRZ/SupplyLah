"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

function SupplyLahLogo() {
  return (
    <Link href="/" className="flex justify-center my-6">
      <img 
        src="/logo.png" 
        alt="SupplyLah" 
        className="h-12 md:h-16 w-auto scale-[1.5] md:scale-[2] origin-center object-contain" 
      />
    </Link>
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

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel (decorative, desktop only) ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-teal-900 flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Background circles */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-800 rounded-full -translate-y-1/2 translate-x-1/2 opacity-60" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-700 rounded-full translate-y-1/3 -translate-x-1/3 opacity-40" />

        <div className="relative z-10 text-center max-w-sm">
          {/* Mascot — save as public/mascot-hero.png */}
          <div className="w-52 h-52 mx-auto mb-8 rounded-3xl bg-teal-800/60 flex items-center justify-center overflow-hidden animate-float">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mascot-working.png"
              alt="SupplyLah mascot"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).parentElement!.innerHTML += `<span class="text-8xl">🦦</span>`;
              }}
            />
          </div>
          <h2 className="text-2xl font-black text-white mb-3">
            Welcome back!
          </h2>
          <p className="text-teal-300 text-sm leading-relaxed">
            Your AI supply chain is running 24/7 — log in to see what it&apos;s been up to.
          </p>

          {/* Mini stats */}
          <div className="mt-8 grid grid-cols-3 gap-3 text-center">
            {[
              { v: "24/7", l: "Always on" },
              { v: "< 90s", l: "Per order" },
              { v: "3+", l: "Languages" },
            ].map(({ v, l }) => (
              <div key={l} className="bg-teal-800/50 rounded-xl p-3">
                <p className="text-teal-300 font-black text-lg">{v}</p>
                <p className="text-teal-400 text-xs">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-md">
          {/* Back link */}
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-700 mb-8 transition-colors">
            ← Back to home
          </Link>

          <SupplyLahLogo />

          <div className="mt-8 mb-6">
            <h1 className="text-2xl font-black text-slate-900">Log in to your account</h1>
            <p className="text-slate-500 text-sm mt-1">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-teal-600 font-semibold hover:text-teal-800 transition-colors">
                Sign up free
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

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm
                           focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all
                           hover:border-teal-300"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-slate-700">Password</label>
                <button
                  type="button"
                  className="text-xs text-teal-600 hover:text-teal-800 font-medium transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm
                             focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all
                             hover:border-teal-300 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPw ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:bg-teal-300
                         text-white font-bold py-3.5 rounded-xl text-sm shadow-sm hover:shadow-md
                         transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Logging in…
                </span>
              ) : (
                "Log in →"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">OR</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Demo access */}
          <Link
            href="/dashboard"
            className="w-full flex items-center justify-center gap-2 border-2 border-slate-200 hover:border-teal-300 text-slate-600 hover:text-teal-700 font-semibold py-3 rounded-xl text-sm transition-all"
          >
            <span>👀</span> View demo dashboard (no login needed)
          </Link>

          <p className="mt-8 text-center text-xs text-slate-400">
            By logging in, you agree to our{" "}
            <span className="text-teal-600 cursor-pointer hover:underline">Terms of Service</span>
            {" "}and{" "}
            <span className="text-teal-600 cursor-pointer hover:underline">Privacy Policy</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
