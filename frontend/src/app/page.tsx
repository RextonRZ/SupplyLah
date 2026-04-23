"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

function SupplyLahLogo({ white = false }: { white?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={white ? "/logo-light.png" : "/logo.png"}
      alt="SupplyLah"
      className="h-12 md:h-16 w-auto scale-[2] md:scale-[2.5] origin-left object-contain"
    />
  );
}

/* ── Navbar ──────────────────────────────────────── */
function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-teal-100">
      <div className="max-w-6xl mx-auto px-6 py-1 md:py-2 flex items-center justify-between">
        <div className="flex items-center gap-8 md:gap-4">
          <Link href="/"><SupplyLahLogo /></Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-600 ml-12 md:ml-32">
            {(["#features","Features","#how-it-works","How It Works","#pricing","Pricing"] as const)
              .reduce<[string,string][]>((acc,_,i,arr) => i%2===0 ? [...acc,[arr[i] as string,arr[i+1] as string]] : acc, [])
              .map(([href, label]) => (
                <a key={href} href={href} className="relative px-4 py-2 group">
                  {/* Pill background */}
                  <span className="absolute inset-0 bg-gradient-to-br from-teal-50 to-teal-100/90 rounded-lg scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-250 ease-out" />
                  {/* Glowing underline */}
                  <span className="absolute bottom-1 left-4 right-4 h-[2px] rounded-full bg-gradient-to-r from-teal-400 to-teal-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-280 ease-out origin-left shadow-[0_0_6px_rgba(20,188,188,0.7)]" />
                  {/* Label */}
                  <span className="relative z-10 group-hover:text-teal-800 group-hover:-translate-y-px transition-all duration-250">{label}</span>
                </a>
              ))
            }
          </div>
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          {/* Log in — clean text button with pill hover */}
          <Link href="/login" className="group relative text-sm font-semibold text-teal-700 hover:text-teal-900 px-4 py-2 rounded-lg overflow-hidden transition-colors duration-200">
            <span className="absolute inset-0 bg-teal-50 rounded-lg scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-250 ease-out" />
            <span className="relative z-10">Log in</span>
          </Link>
          {/* Sign up — gradient + glow + shimmer */}
          <Link href="/signup" className="group relative overflow-hidden text-sm font-semibold text-white px-5 py-2.5 rounded-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(20,188,188,0.55)]"
            style={{ background: "linear-gradient(135deg,#0d8080 0%,#14bcbc 100%)", boxShadow: "0 2px 8px rgba(20,188,188,0.2)" }}>
            {/* Shimmer layer */}
            <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 overflow-hidden rounded-xl">
              <span className="absolute top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12" style={{ animation: "none" }} />
            </span>
            <span className="relative z-10 flex items-center gap-1.5">
              Sign up free
              <span className="group-hover:translate-x-0.5 transition-transform duration-300">→</span>
            </span>
          </Link>
        </div>

        {/* Mobile burger */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-teal-50"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          <span className="block w-5 h-0.5 bg-slate-700 mb-1" />
          <span className="block w-5 h-0.5 bg-slate-700 mb-1" />
          <span className="block w-5 h-0.5 bg-slate-700" />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden px-6 pb-4 space-y-2 border-t border-teal-100 bg-white">
          <a href="#features"     className="block py-2 text-sm text-slate-600 hover:text-teal-700">Features</a>
          <a href="#how-it-works" className="block py-2 text-sm text-slate-600 hover:text-teal-700">How It Works</a>
          <a href="#pricing"      className="block py-2 text-sm text-slate-600 hover:text-teal-700">Pricing</a>
          <hr className="border-teal-100" />
          <Link href="/login"  className="block py-2 text-sm font-semibold text-teal-700">Log in</Link>
          <Link href="/signup" className="block w-full text-center bg-teal-600 text-white font-semibold py-2.5 rounded-xl text-sm">Sign up free</Link>
        </div>
      )}
    </nav>
  );
}

/* ── Animated phone + WhatsApp chat ─────────────── */
const CHAT_SCRIPT = [
  { from: "buyer", text: "boss nk order 5 botol minyak masak 5L n 2 beg beras, hantar kat SS2 PJ yer" },
  { from: "ai",    text: "Ok tunggu sekejap! 🙏 Saya tengah proses pesanan ni..." },
  { from: "ai",    text: "📦 Minyak Masak 5L ×5 — RM129.50\n🍚 Beras 10kg ×2 — RM80.00\n🚚 Penghantaran: RM15.00\n💰 *Jumlah: RM224.50*\n\nBalas *YA* untuk sahkan!" },
  { from: "buyer", text: "YA" },
  { from: "ai",    text: "🎉 Pesanan disahkan!\n🚚 Lalamove dalam perjalanan.\n⏱️ ETA ~45 minit" },
] as const;

function PhoneWithChat({ onStep }: { onStep?: (s: number) => void } = {}) {
  const [shown, setShown] = useState<number>(0);
  const [typing, setTyping] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const schedule = (fn: () => void, ms: number) => {
      const t = setTimeout(fn, ms);
      timers.current.push(t);
    };

    const run = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setShown(0);
      setTyping(false);
      onStep?.(0);

      let t = 600;
      CHAT_SCRIPT.forEach((msg, i) => {
        if (msg.from === "ai") {
          schedule(() => setTyping(true), t);
          t += 1300;
          schedule(() => { setTyping(false); setShown(i + 1); onStep?.(i + 1); }, t);
        } else {
          schedule(() => { setShown(i + 1); onStep?.(i + 1); }, t);
        }
        t += i === CHAT_SCRIPT.length - 1 ? 200 : 1600;
      });
      schedule(run, t + 3200);
    };

    run();
    return () => timers.current.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    // Scroll only within the phone's message container — never the page
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [shown, typing]);

  const visible = CHAT_SCRIPT.slice(0, shown);

  return (
    /* Phone shell */
    <div className="relative bg-slate-900 rounded-[2.6rem] pt-[16px] px-[9px] pb-[9px] shadow-[0_30px_80px_rgba(0,0,0,0.45)] w-[262px] select-none mt-4">
      {/* Left buttons */}
      <div className="absolute -left-[3px] top-[78px]  w-[3px] h-7  bg-slate-700 rounded-l-sm" />
      <div className="absolute -left-[3px] top-[116px] w-[3px] h-10 bg-slate-700 rounded-l-sm" />
      <div className="absolute -left-[3px] top-[162px] w-[3px] h-10 bg-slate-700 rounded-l-sm" />
      {/* Right button */}
      <div className="absolute -right-[3px] top-[108px] w-[3px] h-14 bg-slate-700 rounded-r-sm" />

      {/* Screen */}
      <div className="bg-[#ece5dd] rounded-[2.1rem] overflow-hidden h-[530px] flex flex-col">

        {/* Dynamic Island / notch */}
        <div className="bg-slate-900 flex justify-center pt-2 pb-1.5 shrink-0">
          <div className="w-[88px] h-[22px] bg-black rounded-full" />
        </div>

        {/* WhatsApp header */}
        <div className="bg-[#075e54] px-3 py-2 flex items-center gap-2 shrink-0">
          <div className="w-[30px] h-[30px] rounded-full bg-[#25d366] flex items-center justify-center text-white font-bold text-[10px] shrink-0">SL</div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[11px] font-semibold leading-tight">SupplyLah AI</p>
            <p className="text-green-200 text-[9px]">● online</p>
          </div>
          <div className="flex gap-3 text-white text-[13px] shrink-0">
            <span>📞</span><span>⋮</span>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5 flex flex-col">
          <div className="flex-1" />
          {visible.map((m, i) => (
            <div key={i} className={`flex ${m.from === "buyer" ? "justify-end" : "justify-start"} animate-fade-in`}>
              <div className={`max-w-[84%] px-2.5 py-[6px] rounded-[14px] text-[10px] leading-relaxed whitespace-pre-line shadow-sm
                ${m.from === "buyer"
                  ? "bg-[#dcf8c6] text-slate-800 rounded-tr-[3px]"
                  : "bg-white       text-slate-800 rounded-tl-[3px]"
                }`}>
                {m.text}
                <span className="block text-right text-[8px] text-slate-400 mt-0.5 -mb-0.5">
                  {new Date().toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {typing && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-white px-3 py-2.5 rounded-[14px] rounded-tl-[3px] shadow-sm flex gap-1 items-center">
                {[0, 150, 300].map(d => (
                  <div key={d} className="w-[5px] h-[5px] bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="bg-[#f0f0f0] px-2 py-1.5 flex items-center gap-1.5 shrink-0">
          <div className="flex-1 bg-white rounded-full px-3 py-1 text-[9px] text-slate-400 leading-tight">Type a message</div>
          <div className="w-[28px] h-[28px] rounded-full bg-[#25d366] flex items-center justify-center text-white text-[11px] shrink-0">➤</div>
        </div>

      </div>
    </div>
  );
}

/* ── USP floating badge ───────────────────────────── */
function UspBadge({ show, icon, text, className }: {
  show: boolean; icon: string; text: string; className?: string;
}) {
  return (
    <div className={`
      absolute hidden lg:flex items-center gap-2 z-20
      bg-white/95 backdrop-blur-sm rounded-2xl px-3 py-2.5
      shadow-[0_4px_24px_rgba(0,0,0,0.13)] border border-slate-100
      text-[11px] font-semibold text-slate-700 whitespace-nowrap
      transition-all duration-500 ease-out
      ${show ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95 pointer-events-none"}
      ${className}
    `}>
      <span className="text-[15px]">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

/* ── Hero ─────────────────────────────────────────── */
function Hero() {
  const [step, setStep] = useState(0);

  return (
    <section className="hero-gradient pt-22 pb-24 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
        {/* Text */}
        <div className="animate-fade-in space-y-4 pt-8 lg:pt-14">
          <span className="section-tag mb-2">AI-Powered Wholesale</span>
          <h1 className="text-4xl sm:text-5xl lg:text-5xl font-black text-teal-900 leading-snug mb-6">
            Turn WhatsApp <br />
            Chaos Into <br />
            <span className="text-teal-500">Automated Orders</span>
          </h1>
          <p className="text-lg text-slate-600 mb-8 leading-relaxed max-w-lg">
              Built for real wholesale workflows, SupplyLah converts <strong>messy multilingual WhatsApp orders</strong> into
              <strong> ready-to-fulfill, structured orders</strong>, and automates <strong>stock verification, pricing, and delivery</strong>,
              reducing manual work to near zero.
          </p>
          <div className="flex flex-wrap gap-4 mb-10">
            <Link href="/signup" className="btn-primary text-base">
              <span className="relative z-10">Get Started Free</span>
            </Link>
            <Link href="/dashboard" className="btn-outline text-base">
              <span>View Live Demo</span>
            </Link>
          </div>
        </div>

        {/* Right: phone + mascot + floating USP badges */}
        <div className="flex justify-center lg:justify-end animate-slide-in-right">
          {/* Outer wrapper reserves horizontal space for left badges + phone + mascot */}
          {/* paddingLeft small so wrapper stays in right column; left badges use negative offsets */}
          <div className="relative" style={{ paddingLeft: "10px", paddingRight: "180px" }}>

            {/* ── Left USP badges — float left of phone using negative offset ── */}
            <UspBadge show={step >= 1} icon="🗣️" text="Bahasa Rojak ready" className="top-[80px]  -left-[130px]" />
            <UspBadge show={step >= 3} icon="📦" text="Auto stock check"   className="top-[270px] -left-[125px]" />

            {/* ── Phone ── */}
            <PhoneWithChat onStep={setStep} />

            {/* ── Right USP badges — pulled left, close to phone ── */}
            <UspBadge show={step >= 2} icon="⚡" text="Balas &lt; 2 saat"    className="top-[50px]  right-[55px]" />
            <UspBadge show={step >= 5} icon="🚚" text="Auto delivery booked" className="top-[200px] right-[45px]" />

            {/* ── Mascot — bigger, close overlap on right edge of phone ── */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mascot-hero.png"
              alt="SupplyLah mascot"
              className="absolute bottom-0 right-[-20px] w-72 h-72 object-contain animate-float z-10 drop-shadow-2xl pointer-events-none"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                const span = document.createElement("span");
                span.className = "absolute bottom-0 right-4 text-8xl animate-float z-10";
                span.textContent = "🦦";
                (e.target as HTMLImageElement).parentElement!.appendChild(span);
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Stats bar ────────────────────────────────────── */
function StatsBar() {
  const stats = [
    { value: "< 90s",  label: "End-to-end processing" },
    { value: "3+",     label: "Languages (BM, EN, Rojak)" },
    { value: "RM0.004",label: "Per order AI cost" },
    { value: "200+",   label: "Orders per day capacity" },
  ];
  return (
    <section className="bg-teal-900 py-10 px-6">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        {stats.map(({ value, label }) => (
          <div key={label}>
            <p className="text-3xl font-black text-teal-300 mb-1">{value}</p>
            <p className="text-sm text-teal-100">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── How It Works ─────────────────────────────────── */
function HowItWorks() {
  const steps = [
    {
      icon: "💬",
      title: "Customer Sends Any Message",
      desc: 'Buyer WhatsApps in Malay, English, or Bahasa Rojak — "boss nk 5 botol minyak n 2 beg beras, hantar KL". Voice notes supported too.',
    },
    {
      icon: "🤖",
      title: "AI Parses & Checks Inventory",
      desc: "SupplyLah's GLM agent extracts items and quantities, checks live stock levels, calculates pricing with discounts, and proposes substitutions if needed.",
    },
    {
      icon: "🚀",
      title: "Quote Sent, Logistics Booked",
      desc: "A WhatsApp quote is sent back in the buyer's language. On confirmation, stock is deducted and Lalamove delivery is automatically booked.",
    },
  ];
  return (
    <section id="how-it-works" className="py-20 px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <span className="section-tag mb-4">How It Works</span>
          <h2 className="text-3xl sm:text-4xl font-black text-teal-900">
            From messy WhatsApp to fulfilled order in 3 steps
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <div
              key={i}
              className="relative bg-teal-50 rounded-2xl p-7 border border-teal-100 hover:border-teal-300 hover:shadow-md transition-all duration-300"
            >
              <span className="absolute -top-4 left-6 bg-teal-600 text-white text-xs font-black px-3 py-1 rounded-full">
                Step {i + 1}
              </span>
              <div className="text-4xl mb-4 mt-2">{s.icon}</div>
              <h3 className="text-lg font-bold text-teal-900 mb-2">{s.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Features ─────────────────────────────────────── */
function Features() {
  const features = [
    { icon: "🌏", title: "Multilingual Order Parsing",         desc: "Handles Bahasa Melayu, Malaysian English, and Bahasa Rojak slang out of the box. No more lost orders from confusing messages." },
    { icon: "📦", title: "Live Inventory Sync",                desc: "Real-time stock checking before every quote. Never oversell or promise items you don't have." },
    { icon: "🔄", title: "Smart Substitutions",                desc: "When stock is low, AI suggests the closest alternative at the same price tier — and clearly informs the buyer." },
    { icon: "🚚", title: "Auto Logistics Booking",             desc: "Confirms Lalamove delivery the moment the buyer says YES. Price, ETA, and tracking link sent automatically." },
    { icon: "📊", title: "Live Operations Dashboard",          desc: "Kanban board showing all orders in real-time. Alerts for anything that needs human review." },
    { icon: "🔒", title: "PDPA-Compliant Data Handling",       desc: "Buyer data stored in your own Supabase instance. Messages retained only for active orders, purged at 90 days." },
  ];
  return (
    <section id="features" className="py-20 px-6 bg-slate-50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <span className="section-tag mb-4">Features</span>
          <h2 className="text-3xl sm:text-4xl font-black text-teal-900">
            Built for Malaysian SME wholesalers
          </h2>
          <p className="mt-3 text-slate-500 max-w-xl mx-auto">
            Every feature is designed around how wholesale actually works in Malaysia —
            not some generic international SaaS template.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-2xl p-6 border border-teal-100 shadow-sm hover:shadow-md hover:border-teal-300 transition-all duration-300 group"
            >
              <div className="w-11 h-11 bg-teal-100 group-hover:bg-teal-200 rounded-xl flex items-center justify-center text-xl mb-4 transition-colors">
                {f.icon}
              </div>
              <h3 className="font-bold text-teal-900 mb-1.5">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Before / After ───────────────────────────────── */
function BeforeAfter() {
  return (
    <section className="py-20 px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <span className="section-tag mb-4">The Problem We Solve</span>
          <h2 className="text-3xl sm:text-4xl font-black text-teal-900">
            Stop drowning in WhatsApp messages
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Before */}
          <div className="bg-red-50 border border-red-200 rounded-2xl p-7">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-3xl">😩</span>
              <h3 className="font-black text-lg text-red-700">Before SupplyLah</h3>
            </div>
            {[
              "Manually reading 200+ WhatsApp messages daily",
              "Cross-referencing stock on Excel / whiteboard",
              "Calculating prices and discounts by hand",
              "Calling Lalamove to book every single delivery",
              "Missing orders during festive peak seasons",
              "Staff burnout from repetitive manual tasks",
            ].map(t => (
              <div key={t} className="flex items-start gap-2 mb-2.5">
                <span className="text-red-400 mt-0.5">✗</span>
                <span className="text-sm text-red-700">{t}</span>
              </div>
            ))}
          </div>

          {/* After */}
          <div className="bg-teal-50 border border-teal-200 rounded-2xl p-7">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-3xl">🎉</span>
              <h3 className="font-black text-lg text-teal-700">After SupplyLah</h3>
            </div>
            {[
              "AI reads every message in under 90 seconds",
              "Live inventory check on every single order",
              "Automatic pricing, discounts & quotes",
              "Lalamove booked the second buyer confirms",
              "Zero missed orders, even at 3am",
              "Staff focus on relationships, not admin",
            ].map(t => (
              <div key={t} className="flex items-start gap-2 mb-2.5">
                <span className="text-teal-500 mt-0.5">✓</span>
                <span className="text-sm text-teal-800">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Pricing ──────────────────────────────────────── */
function Pricing() {
  const plans = [
    {
      name: "Starter",
      price: "Free",
      sub: "forever",
      highlight: false,
      features: ["1 WhatsApp number", "Up to 50 orders/month", "AI order parsing", "Live inventory dashboard", "Community support"],
    },
    {
      name: "Growth",
      price: "RM 90",
      sub: "/month",
      highlight: true,
      features: ["3 WhatsApp numbers", "Unlimited orders", "Voice note transcription", "Auto Lalamove booking", "Priority support", "Analytics & reporting"],
    },
    {
      name: "Enterprise",
      price: "Custom",
      sub: "contact us",
      highlight: false,
      features: ["Unlimited numbers", "Multi-tenant setup", "Custom AI training", "ERP integration", "Dedicated onboarding", "SLA guarantee"],
    },
  ];
  return (
    <section id="pricing" className="py-20 px-6 bg-teal-900">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-1.5 bg-teal-800 text-teal-300 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide mb-4">
            Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white">
            Commercially optimised for Malaysian SMEs
          </h2>
          <p className="mt-3 text-teal-300 max-w-xl mx-auto text-sm">
            Processing 200 orders daily costs less than RM 3. No hidden fees.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl p-7 border transition-all ${
                p.highlight
                  ? "bg-teal-500 border-teal-400 shadow-xl scale-105"
                  : "bg-teal-800 border-teal-700 hover:border-teal-500"
              }`}
            >
              {p.highlight && (
                <span className="block text-center bg-white text-teal-700 text-xs font-black px-3 py-1 rounded-full mb-4 w-fit mx-auto">
                  Most Popular
                </span>
              )}
              <h3 className={`font-black text-lg mb-1 ${p.highlight ? "text-white" : "text-teal-100"}`}>
                {p.name}
              </h3>
              <div className="flex items-baseline gap-1 mb-5">
                <span className={`text-4xl font-black ${p.highlight ? "text-white" : "text-teal-200"}`}>
                  {p.price}
                </span>
                <span className={`text-sm ${p.highlight ? "text-teal-100" : "text-teal-400"}`}>
                  {p.sub}
                </span>
              </div>
              <ul className="space-y-2.5 mb-6">
                {p.features.map((f) => (
                  <li key={f} className={`flex items-start gap-2 text-sm ${p.highlight ? "text-white" : "text-teal-200"}`}>
                    <span className={`mt-0.5 ${p.highlight ? "text-white" : "text-teal-400"}`}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`block text-center font-bold py-2.5 rounded-xl text-sm transition-all ${
                  p.highlight
                    ? "bg-white text-teal-700 hover:bg-teal-50"
                    : "bg-teal-700 text-teal-100 hover:bg-teal-600 border border-teal-600"
                }`}
              >
                {p.name === "Enterprise" ? "Contact Sales" : "Get started"}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── CTA Banner ───────────────────────────────────── */
function CTABanner() {
  return (
    <section className="py-20 px-6 bg-white">
      <div className="max-w-3xl mx-auto text-center">
        {/* Mascot — save as public/mascot-celebration.png */}
        <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-teal-100 flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mascot-celebration.png"
            alt="Celebrating mascot"
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              (e.target as HTMLImageElement).parentElement!.innerHTML += `<span class="text-4xl">🎉</span>`;
            }}
          />
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-teal-900 mb-4">
          Ready to automate your wholesale operations?
        </h2>
        <p className="text-slate-500 mb-8 text-lg">
          Join Malaysian SME wholesalers who have stopped drowning in WhatsApp messages.
          Start processing orders automatically today.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/signup" className="btn-primary text-base px-8 py-4">
            Start for Free — No Credit Card
          </Link>
          <Link href="/dashboard" className="btn-outline text-base px-8 py-4">
            View Live Dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ───────────────────────────────────────── */
function Footer() {
  return (
    <footer className="bg-teal-950 py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-10">
          <div className="md:col-span-2">
            <SupplyLahLogo white />
            <p className="mt-3 text-teal-400 text-sm leading-relaxed max-w-xs">
              AI-powered supply chain automation for Malaysian SME wholesalers.
              Turn WhatsApp chaos into structured, automated workflows.
            </p>
          </div>
          <div>
            <h4 className="text-white font-bold text-sm mb-3">Product</h4>
            <ul className="space-y-2 text-teal-400 text-sm">
              <li><a href="#features"     className="hover:text-teal-200 transition-colors">Features</a></li>
              <li><a href="#how-it-works" className="hover:text-teal-200 transition-colors">How It Works</a></li>
              <li><a href="#pricing"      className="hover:text-teal-200 transition-colors">Pricing</a></li>
              <li><Link href="/dashboard" className="hover:text-teal-200 transition-colors">Live Demo</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold text-sm mb-3">Company</h4>
            <ul className="space-y-2 text-teal-400 text-sm">
              <li><span className="hover:text-teal-200 transition-colors cursor-pointer">About</span></li>
              <li><span className="hover:text-teal-200 transition-colors cursor-pointer">Blog</span></li>
              <li><span className="hover:text-teal-200 transition-colors cursor-pointer">Privacy (PDPA)</span></li>
              <li><span className="hover:text-teal-200 transition-colors cursor-pointer">Terms</span></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-teal-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-teal-500 text-xs">© 2026 SupplyLah. All rights reserved.</p>
          <p className="text-teal-500 text-xs">Built for UMHackathon 2026 · Powered by Z.ai GLM</p>
        </div>
      </div>
    </footer>
  );
}

/* ── Page ─────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <StatsBar />
      <HowItWorks />
      <Features />
      <BeforeAfter />
      <Pricing />
      <CTABanner />
      <Footer />
    </div>
  );
}
