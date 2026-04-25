"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const SLIDES = [
  {
    mascot: "/tiredchaos.png",
    title: "Tired of WhatsApp\nOrder Chaos?",
    desc: "200 messages a day. Price negotiations over voice note. Orders slipping through at 2am. We built this so you don't have to deal with that anymore.",
  },
  {
    mascot: "/bahasarojak.png",
    title: "Voice Notes, Text, or\nHandwritten Lists",
    desc: "Whether a voice note in Bahasa Rojak or a photo of a handwritten list, our AI gets it. No typing or translation needed.",
  },
  {
    mascot: "/logistic.png",
    title: "Instant Logistics\nWithout the Calls",
    desc: "Order confirmed? Delivery is already in motion. No manual entry. No booking errors. Just an automated tracking link sent straight to your customer.",
  },
  {
    mascot: "/mascot-working.png",
    title: "Full Control Staff\nCommand Center",
    desc: "One dashboard to rule them all. Monitor every order, track every driver, and handle Red Alerts with one click.",
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
      <div className="relative z-10 text-center max-w-sm w-full">
        <div className="relative w-52 h-52 mx-auto mb-7">
          {SLIDES.map((s, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={s.mascot} alt=""
              className={`absolute inset-0 w-full h-full object-contain drop-shadow-2xl transition-opacity duration-700 ${i === current ? "opacity-100" : "opacity-0"}`}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ))}
        </div>
        <div key={current} style={{ animation: "fadeSlideIn 0.6s ease-out both" }}>
          <h2 className="text-3xl lg:text-4xl font-black text-white mb-4 leading-tight whitespace-pre-line">{slide.title}</h2>
          <p className="text-teal-200 text-sm lg:text-base leading-relaxed">{slide.desc}</p>
        </div>
        <div className="flex justify-center gap-2 mt-8">
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`rounded-full transition-all duration-300 ${i === current ? "w-6 h-2 bg-teal-300" : "w-2 h-2 bg-teal-700 hover:bg-teal-500"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus]         = useState<"verifying" | "set-password" | "saving" | "error">("verifying");
  const [name,     setName]         = useState("");
  const [password, setPassword]     = useState("");
  const [confirm,  setConfirm]      = useState("");
  const [showPw,   setShowPw]       = useState(false);
  const [showCf,   setShowCf]       = useState(false);
  const [errMsg,   setErrMsg]       = useState("");
  const [inviteRole, setInviteRole] = useState("");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "USER_UPDATED" && session) {
        router.replace("/dashboard");
        return;
      }
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        const isInvite = session.user.user_metadata?.role && !session.user.user_metadata?.onboarding_complete;
        if (isInvite) {
          setInviteRole(session.user.user_metadata?.role || "");
          setStatus("set-password");
        } else {
          router.replace(session.user.user_metadata?.onboarding_complete ? "/dashboard" : "/get-started");
        }
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const isInvite = session.user.user_metadata?.role && !session.user.user_metadata?.onboarding_complete;
        if (isInvite) {
          setInviteRole(session.user.user_metadata?.role || "");
          setStatus("set-password");
        } else {
          router.replace(session.user.user_metadata?.onboarding_complete ? "/dashboard" : "/get-started");
        }
      }
    });

    const timeout = setTimeout(() => {
      setStatus((s) => s === "verifying" ? "error" : s);
    }, 8000);

    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, [router]);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg("");
    if (!name.trim()) { setErrMsg("Please enter your name."); return; }
    if (password.length < 8) { setErrMsg("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setErrMsg("Passwords don't match."); return; }
    setStatus("saving");
    const { error } = await supabase.auth.updateUser({ password, data: { full_name: name.trim() } });
    if (error) { setErrMsg(error.message); setStatus("set-password"); }
  }

  if (status === "set-password" || status === "saving") {
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
          <div className="flex-1 flex items-center justify-center px-10 py-12 bg-white">
            <div className="w-full max-w-md">

              <Link href="/" className="group relative inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-teal-800 mb-6 px-3 py-1.5 rounded-lg overflow-hidden transition-colors duration-200 -ml-3">
                <span className="absolute inset-0 bg-teal-50 rounded-lg scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-250 ease-out" />
                <span className="relative z-10 flex items-center gap-1.5">
                  <span className="group-hover:-translate-x-1 transition-transform duration-200 inline-block">←</span>
                  Back to home
                </span>
              </Link>

              <Link href="/" className="flex mb-10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="SupplyLah" className="h-16 md:h-20 w-auto scale-[2.5] origin-left object-contain" />
              </Link>

              <div className="mb-8">
                <h1 className="text-3xl font-black text-slate-900">Welcome to SupplyLah!</h1>
                <p className="text-slate-500 text-sm mt-1.5">
                  You've been invited as{" "}
                  {inviteRole && (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-700 border border-teal-200 ml-1">
                      {inviteRole}
                    </span>
                  )}
                </p>
                <p className="text-slate-400 text-xs mt-1">Set up your account to get started.</p>
              </div>

              {errMsg && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-sm text-red-700 flex items-start gap-2">
                  <span className="mt-0.5">⚠️</span><span>{errMsg}</span>
                </div>
              )}

              <form onSubmit={handleSetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Your Name</label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ahmad bin Ali"
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300 pr-12" />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors text-base">
                      {showPw ? "🙈" : "👁"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <input type={showCf ? "text" : "password"} required value={confirm} onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repeat your password"
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all hover:border-teal-300 pr-12" />
                    <button type="button" onClick={() => setShowCf(!showCf)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors text-base">
                      {showCf ? "🙈" : "👁"}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={status === "saving"}
                  className="btn-primary w-full py-4 text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed">
                  {status === "saving" ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Activating…
                    </span>
                  ) : "Activate Account →"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </>
    );
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
        <div className="flex-1 flex items-center justify-center px-10 py-12 bg-white">
          <div className="w-full max-w-md text-center">
            {status === "verifying" ? (
              <>
                <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-teal-100 flex items-center justify-center">
                  <svg className="animate-spin h-7 w-7 text-teal-600" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                </div>
                <h2 className="text-lg font-black text-slate-900 mb-1">Verifying your invite…</h2>
                <p className="text-slate-500 text-sm">Hang on, setting things up for you.</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-red-100 flex items-center justify-center text-2xl">⚠️</div>
                <h2 className="text-lg font-black text-slate-900 mb-1">Link expired or invalid</h2>
                <p className="text-slate-500 text-sm mb-5">Ask your admin to resend the invite, or log in if you already set a password.</p>
                <Link href="/login" className="btn-primary inline-block px-6 py-2.5 text-sm font-bold">Go to Login</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
