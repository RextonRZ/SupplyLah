"use client";

import Link from "next/link";
import { useState } from "react";

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
        <Link href="/"><SupplyLahLogo /></Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="#features"   className="hover:text-teal-700 transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-teal-700 transition-colors">How It Works</a>
          <a href="#pricing"    className="hover:text-teal-700 transition-colors">Pricing</a>
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-semibold text-teal-700 hover:text-teal-900 px-4 py-2 rounded-lg hover:bg-teal-50 transition-all"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all"
          >
            Sign up free
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

/* ── WhatsApp mock chat ──────────────────────────── */
function MockWhatsAppChat() {
  const messages = [
    { from: "buyer",  text: "boss nk order 5 botol minyak masak 5L n 2 beg beras, hantar kat SS2 PJ yer",  delay: "0ms" },
    { from: "ai",    text: "✅ Order diterima! Sedang semak stok…",                                         delay: "400ms" },
    { from: "ai",    text: "📦 Minyak Masak 5L x5 — RM129.50\n🍚 Beras Tempatan 10kg x2 — RM80.00\n🚚 Penghantaran: RM15.00\n💰 *Jumlah: RM224.50*\n\nBalas *YA* untuk sahkan!", delay: "800ms" },
    { from: "buyer", text: "YA",                                                                             delay: "1200ms" },
    { from: "ai",    text: "🎉 Pesanan disahkan! Lalamove dalam perjalanan. ETA 45 minit.",                  delay: "1600ms" },
  ];

  return (
    <div className="bg-[#0b5454] rounded-2xl shadow-2xl overflow-hidden w-full max-w-sm">
      {/* Chat header */}
      <div className="bg-teal-800 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-teal-400 flex items-center justify-center text-white text-xs font-bold">SL</div>
        <div>
          <p className="text-white text-sm font-semibold">SupplyLah AI</p>
          <p className="text-teal-300 text-xs">● Online</p>
        </div>
      </div>
      {/* Messages */}
      <div className="bg-[#e5ddd5] p-3 space-y-2 min-h-[220px]">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.from === "buyer" ? "justify-end" : "justify-start"} animate-slide-up`}
            style={{ animationDelay: m.delay, animationFillMode: "both" }}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-line shadow-sm
                ${m.from === "buyer"
                  ? "bg-[#dcf8c6] text-slate-800 rounded-br-sm"
                  : "bg-white text-slate-800 rounded-bl-sm"
                }`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Hero ─────────────────────────────────────────── */
function Hero() {
  return (
    <section className="hero-gradient pt-22 pb-24 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
        {/* Text */}
        <div className="animate-fade-in space-y-4">
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
              Get Started Free
            </Link>
            <Link href="/dashboard" className="btn-outline text-base">
              View Live Demo
            </Link>
          </div>
        </div>

        {/* Right: mascot + chat bubble */}
        <div className="flex flex-col items-center gap-6 animate-slide-in-right">
          {/* Mascot image — save your mascot PNG as public/mascot-hero.png */}
          <div className="relative">
            <div className="w-40 h-40 sm:w-52 sm:h-52 rounded-3xl bg-teal-100 flex items-center justify-center overflow-hidden animate-float">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/mascot-hero.png"
                alt="SupplyLah mascot"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).parentElement!.innerHTML +=
                    `<span class="text-7xl">🦦</span>`;
                }}
              />
            </div>
            {/* Floating badge */}
            <div className="absolute -top-3 -right-4 bg-white border border-teal-200 rounded-full px-3 py-1 shadow-md text-xs font-bold text-teal-700 whitespace-nowrap">
              ⚡ &lt;90s per order
            </div>
          </div>
          <MockWhatsAppChat />
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
