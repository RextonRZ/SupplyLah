"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { supabase, BACKEND_URL } from "@/lib/supabase";

export interface ChatMessage {
  role: "buyer" | "agent";
  text?: string;
  audioUrl?: string;
  imageDataUrl?: string;
  time: string;
  isAudio?: boolean;
  isImage?: boolean;
  recordingDuration?: number;
}

const DEFAULT_PHONE = "+60198765432";
const DEFAULT_NAME = "Demo Customer";
const DEMO_MERCHANT = "00000000-0000-0000-0000-000000000001";

// Helper function to get initial messages
const getInitialMessages = (
  chatMode: "text" | "voice" | "image",
  now: () => string,
): ChatMessage[] => {
  const hints: Record<string, string> = {
    text: 'Type an order: "boss nak 3 botol minyak masak n 2 bag beras, hantar ke Jalan Ampang KL"',
    voice: 'Hold the mic to record your order. Try: "boss nak 5 kg ayam."',
    image: "Tap 📎 to attach a photo of a handwritten order list, or type your order below.",
  };
  return [
    {
      role: "agent",
      text: `👋 Demo WhatsApp — ${chatMode === "text" ? "Text" : chatMode === "voice" ? "Voice Note" : "Image"} Mode.\n\n${hints[chatMode]}`,
      time: now(),
    },
  ];
};

const MALAY_WORDS =
  /\b(nak|nk|boleh|jap|saya|ni|tu|ke|dan|dengan|untuk|minyak|beras|ayam|bawang|hantar|kirim|harga|berapa|lagi|dah|tak|guna|boss|lah|la|ya|tidak|tolong|ekor|biji|sahaja|je|tahu|tau|maaf|terima|kasih|taman|jalan|sikit|tambah)\b/i;
const EN_WORDS =
  /\b(please|want|need|send|deliver|thank|hello|hi|yes|no|cancel|confirm|address|price|how|order|i|can|know|what|is|the|for|and|are|we|do|have|stock|remaining|left)\b/i;

function getImmediateAck(text: string): string {
  const msHits = (text.match(MALAY_WORDS) || []).length;
  const enHits = (text.match(EN_WORDS) || []).length;
  const isMalay = msHits > enHits; // ties default to English
  return isMalay
    ? "Ok tunggu jap! 🙏 Saya tengah proses pesanan ni..."
    : "On it! 🔍 Processing your order, give me a sec...";
}

function logToHint(log: string): string | null {
  if (log.includes("CRM") || log.includes("customer")) return "Looking up your profile…";
  if (log.includes("catalogue") || log.includes("Catalogue")) return "Loading product catalogue…";
  if (log.includes("AI model") || log.includes("IntakeAgent")) return "AI model processing…";
  if (log.includes("Intent:")) return "Order intent analysed ✓";
  if (log.includes("InventoryAgent") || log.includes("stock")) return "Checking stock levels…";
  if (log.includes("grand_total") || log.includes("Total:")) return "Calculating order total…";
  if (log.includes("DB") || log.includes("Saving")) return "Saving order to database…";
  if (log.includes("Composer") || log.includes("quote")) return "Drafting your summary…";
  return null;
}


const URL_RE = /(https?:\/\/[^\s]+)/g;
const PAYMENT_MARKER_RE = /\[PAYMENT:([^:]+):([^:]+):([^\]]+)\]/;
const TNG_URL_RE = /(https?:\/\/[^\s]*\/pay\/tng[^\s]*)/;

type TngStep = "redirect" | "phone" | "confirm" | "notif" | "approve" | "success";
interface TngData { orderId: string; amount: string; merchant: string }

function TngOverlay({ data, onDone }: {
  data: TngData;
  onDone: (ref: string, trackUrl: string, confMsg: string) => void;
}) {
  const [step, setStep]         = React.useState<TngStep>("redirect");
  const [transitioning, setTr]  = React.useState(false);
  const [phone, setPhone]       = React.useState("0123456789");
  const [pin, setPin]           = React.useState("");
  const [pinErr, setPinErr]     = React.useState(false);
  const [payRef, setPayRef]     = React.useState("");
  const [payDate]               = React.useState(new Date().toLocaleString("en-MY"));

  // Advance to next step with a brief TNG-style loading transition
  function goTo(next: TngStep, delay = 700) {
    setTr(true);
    setTimeout(() => { setStep(next); setTr(false); }, delay);
  }

  React.useEffect(() => {
    if (step !== "redirect") return;
    const t = setTimeout(() => setStep("phone"), 1800);
    return () => clearTimeout(t);
  }, [step]);

  function pay() {
    // Only generate a reference — backend is called AFTER Approve+Done so the
    // dashboard card stays in Awaiting Payment until the buyer actually approves.
    const ref = `TNG${Date.now().toString().slice(-8)}`;
    setPayRef(ref);
    goTo("notif", 900);
  }

  const TNG_BLUE = "#005EB8";
  const merchant = decodeURIComponent(data.merchant);

  return (
    <div className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-white">
      {/* Status bar always visible on top */}
      <img src="/status-bar.png" alt="" className="absolute top-0 left-0 w-full h-12 object-fill z-10 pointer-events-none" />

      {/* TNG-style loading transition overlay */}
      {transitioning && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white" style={{ paddingTop: 48 }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: TNG_BLUE }}>
            <img src="/tnglogo.png" alt="" className="w-12 h-12 object-contain"
              onError={e => {
                (e.target as HTMLImageElement).style.display = "none";
                const fb = (e.target as HTMLImageElement).nextSibling as HTMLElement;
                if (fb) fb.style.display = "flex";
              }}
            />
            <span className="hidden items-center justify-center text-white text-xs font-black w-12 h-12">TNG</span>
          </div>
          {/* Animated progress bar */}
          <div className="w-32 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full animate-[tng-progress_0.7s_ease-in-out_forwards]"
              style={{ background: TNG_BLUE, width: "0%" }}
            />
          </div>
          <style>{`
            @keyframes tng-progress {
              0%   { width: 0%; }
              60%  { width: 80%; }
              100% { width: 100%; }
            }
          `}</style>
        </div>
      )}

      {/* ── Redirect ──────────────────────────────────────────────── */}
      {step === "redirect" && (
        <div className="flex-1 flex flex-col items-center justify-center bg-white pt-12">
          <p className="text-[11px] text-gray-400">Please wait to be redirected...</p>
          <div className="mt-3 flex gap-1.5">
            {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i*150}ms` }} />)}
          </div>
          <p className="absolute bottom-4 text-[9px] text-gray-300">© 2024, Wavv Biz. All rights reserved.</p>
        </div>
      )}

      {/* ── Phone + PIN (img2 style) ───────────────────────────────── */}
      {step === "phone" && (
        <div className="flex flex-col flex-1 pt-12">
          {/* Gradient header */}
          <div className="px-4 pt-4 pb-6 text-white" style={{ background: "linear-gradient(145deg,#0047AB 0%,#1565C0 40%,#42A5F5 100%)" }}>
            <img src="/tnglogo.png" alt="TNG" className="w-14 h-14 object-contain mb-3"
              onError={e => {
                const el = e.target as HTMLImageElement;
                el.style.display = "none";
                const fb = document.createElement("div");
                fb.className = "w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-3";
                fb.innerHTML = `<span style="color:white;font-size:10px;font-weight:900">TNG</span>`;
                el.parentNode?.insertBefore(fb, el);
              }}
            />
            <p className="text-[11px] opacity-80">Payment to {merchant}</p>
            <p className="text-3xl font-extrabold mt-0.5">RM<span className="font-black">{data.amount}</span></p>
          </div>

          {/* Form body */}
          <div className="flex-1 bg-white px-5 pt-5 pb-4 flex flex-col">
            <p className="text-sm font-semibold text-gray-800 mb-4">Log In</p>

            {/* Phone field */}
            <div className="border-b border-gray-300 flex items-center mb-5 pb-1 gap-2">
              <button className="flex items-center gap-1 shrink-0 text-sm text-gray-700">
                MY +60
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div className="w-px h-4 bg-gray-300 shrink-0" />
              <input
                className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
                placeholder="Mobile Number"
                value={phone.replace(/^0/, "")}
                onChange={e => setPhone("0" + e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                maxLength={10}
              />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="3"/></svg>
            </div>

            {/* 6-digit PIN */}
            <p className="text-xs text-gray-600 mb-3">6-digit PIN</p>
            <div className="flex gap-2 mb-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex-1 h-11 border-b-2 border-gray-300 flex items-center justify-center">
                  {pin.length > i && <span className="w-2.5 h-2.5 rounded-full bg-gray-800 block" />}
                </div>
              ))}
            </div>
            {/* Hidden real input to capture PIN */}
            <input
              type="tel"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setPinErr(false); }}
              className="opacity-0 h-0 w-0 absolute"
              id="tng-pin-input"
              autoFocus
            />
            <button
              type="button"
              onClick={() => document.getElementById("tng-pin-input")?.focus()}
              className="text-[10px] text-blue-600 text-center mb-2"
            >
              Tap here to enter PIN
            </button>
            {pinErr && <p className="text-red-500 text-[10px] text-center mb-1">Wrong PIN. Use <strong>123456</strong>.</p>}

            <div className="mt-auto">
              <button
                onClick={() => {
                  if (pin !== "123456") { setPinErr(true); return; }
                  goTo("confirm");
                }}
                disabled={phone.length < 10 || pin.length < 6}
                className="w-full py-3 rounded-full text-sm font-semibold transition-colors disabled:bg-gray-200 disabled:text-gray-400"
                style={phone.length >= 10 && pin.length >= 6 ? { background: TNG_BLUE, color: "#fff" } : {}}
              >
                Log In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm (also shown as background for notif step) ────────── */}
      {(step === "confirm" || step === "notif") && (
        <div className={`flex flex-col flex-1 pt-12 relative ${step === "notif" ? "pointer-events-none" : ""}`}>
          <div className="text-white px-4 py-3 flex items-center gap-2" style={{ background: TNG_BLUE }}>
            <img src="/tnglogo.png" alt="" className="w-7 h-7 object-contain rounded-lg bg-white/20 p-0.5"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <div>
              <p className="text-[9px] opacity-75">Payment to</p>
              <p className="text-xs font-bold leading-tight">{merchant}</p>
            </div>
          </div>
          <div className="flex-1 bg-gray-100 overflow-y-auto">
            <div className="bg-white mx-3 my-3 rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
              <div className="px-4 py-4">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Payment Due</p>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-gray-600">Mobile Top Up</p>
                    <p className="text-[10px] text-gray-400">MY ID – {phone.slice(0,4)}****{phone.slice(-3)}</p>
                  </div>
                  <p className="text-sm font-bold">RM {data.amount}</p>
                </div>
              </div>
              {[["Amount", `RM ${data.amount}`], ["Merchant", merchant]].map(([k,v]) => (
                <div key={k} className="flex justify-between px-4 py-3 text-xs">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-semibold text-right max-w-[55%] truncate">{v}</span>
                </div>
              ))}
            </div>
            <div className="mx-3 mb-3 bg-green-50 border border-green-200 rounded-xl px-3 py-2 flex items-start gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" className="mt-0.5 shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
              <p className="text-[10px] text-green-700">As per regulations, you receive a TNG eWallet receipt for this transaction.</p>
            </div>
          </div>
          <div className="bg-white px-4 py-3 border-t border-gray-100">
            <button onClick={pay}
              className="w-full py-3 rounded-full text-white text-sm font-semibold"
              style={{ background: TNG_BLUE }}
            >
              Pay
            </button>
          </div>

          {/* Notification overlay — sits on top of confirm screen */}
          {step === "notif" && (
            <div className="absolute inset-0 bg-black/40 flex flex-col pointer-events-auto z-10" style={{ paddingTop: 48 }}>
              <button
                onClick={() => goTo("approve", 600)}
                className="mx-2 mt-2 px-3 py-2.5 rounded-2xl flex items-center gap-2.5 text-left shadow-2xl"
                style={{ background: "rgba(28,28,28,0.95)" }}
              >
                <img src="/tnglogo.png" alt="" className="w-8 h-8 rounded-xl object-contain shrink-0 p-0.5"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <p className="text-white text-[10px] font-semibold">Transaction Approval</p>
                    <p className="text-gray-400 text-[8px] shrink-0 ml-2">now</p>
                  </div>
                  <p className="text-gray-300 text-[10px] leading-tight truncate">
                    Approve <strong className="text-white">RM {data.amount}</strong> to {merchant}?
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Approve ───────────────────────────────────────────────── */}
      {step === "approve" && (
        <div className="flex flex-col flex-1 pt-12">
          <div className="text-white px-4 py-3 flex items-center gap-2" style={{ background: TNG_BLUE }}>
            <img src="/tnglogo.png" alt="" className="w-6 h-6 rounded-lg object-contain"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <p className="text-xs font-bold">Touch 'n Go eWallet</p>
          </div>
          <div className="flex-1 bg-gray-50 px-4 py-5 flex flex-col gap-4">
            <p className="text-sm font-semibold text-gray-800 text-center">Please confirm to perform this action</p>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 divide-y divide-gray-100 text-xs">
              {[["Transaction","Online Purchase"],["Amount",`RM ${data.amount}`],["Merchant",merchant]].map(([k,v]) => (
                <div key={k} className="flex justify-between px-4 py-3">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-semibold text-right max-w-[55%] truncate">{v}</span>
                </div>
              ))}
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-white text-[9px] font-bold">!</span>
              </div>
              <p className="text-[10px] text-red-700"><strong>Beware of cybersecurity messages.</strong> Do not approve if you did not perform this action.</p>
            </div>
            <p className="text-[9px] text-gray-400 text-center">Tap "Report" if you did not perform this action</p>
            <div className="flex gap-3 mt-auto">
              <button onClick={() => onDone("", "", "")} className="flex-1 py-3 border border-gray-300 rounded-full text-sm font-semibold text-gray-600">Report</button>
              <button onClick={() => goTo("success", 800)} className="flex-1 py-3 rounded-full text-sm font-semibold text-white" style={{ background: TNG_BLUE }}>Approve</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success (img3 style) ──────────────────────────────────── */}
      {step === "success" && (
        <div className="flex flex-col flex-1 pt-12">
          <div className="text-white px-4 py-3 text-center font-semibold text-sm" style={{ background: TNG_BLUE }}>
            Payment Result
          </div>
          <div className="flex-1 bg-white flex flex-col items-center px-5 pt-8 pb-6 gap-3">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p className="text-3xl font-extrabold text-gray-900">RM {data.amount}</p>
            <p className="text-sm text-gray-400 -mt-2">Paid</p>

            <div className="w-full border border-gray-200 rounded-xl divide-y divide-gray-100 text-xs mt-2">
              {[
                ["Merchant", merchant],
                ["Date & Time", payDate],
                ["eWallet Reference No.", payRef || `20231026${Date.now().toString().slice(-12)}`],
                ["Payment Method", "eWallet Balance"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between px-4 py-2.5 gap-2">
                  <span className="text-gray-400 shrink-0">{k}</span>
                  <span className="font-semibold text-right text-gray-800 break-all">{v}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto w-full">
              <button
                onClick={() => onDone(payRef, "", "")}
                className="w-full py-3 rounded-full text-white text-sm font-semibold"
                style={{ background: TNG_BLUE }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentCard({ text, onTngPay }: { text: string; onTngPay: (d: TngData) => void }) {
  const markerMatch = text.match(PAYMENT_MARKER_RE);
  const amount   = markerMatch?.[2] ?? "0.00";
  const orderId  = markerMatch?.[1] ?? "";
  const merchant = markerMatch?.[3] ?? "Demo+Wholesaler+Sdn+Bhd";

  // Strip method list lines and marker, keep only the confirmation header + amount
  const bodyText = text
    .replace(PAYMENT_MARKER_RE, "")
    .replace(TNG_URL_RE, "")
    .split("\n")
    .filter(l => !["Online Banking","Touch 'n Go eWallet","Kredit / Debit Kad","Credit / Debit Card"].includes(l.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return (
    // WhatsApp template card — no outer padding, the bubble provides it
    <div className="-mx-3 -my-2 overflow-hidden rounded-xl">
      {/* Header image */}
      <img
        src="/whatsappheader.png"
        alt=""
        className="w-full h-28 object-cover"
        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
      />

      {/* Body */}
      <div className="px-3 pt-2 pb-1">
        <WhatsAppText text={bodyText} />
      </div>

      {/* WhatsApp template buttons — separated by hairline borders */}
      <div className="border-t border-slate-200 mt-1">
        {/* Online Banking */}
        <button className="w-full flex items-center justify-center gap-2 py-2.5 border-b border-slate-100 transition-colors hover:bg-slate-50 active:bg-slate-100" style={{ color: "#00A884" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span className="text-xs font-medium">Online Banking</span>
        </button>

        {/* Touch 'n Go eWallet — opens TNG overlay */}
        <button
          onClick={() => onTngPay({ orderId, amount, merchant })}
          className="w-full flex items-center justify-center gap-2 py-2.5 border-b border-slate-100 transition-colors hover:bg-slate-50 active:bg-slate-100"
          style={{ color: "#00A884" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"/>
            <path d="M2 10h20"/>
            <path d="M7 15h2M11 15h4"/>
          </svg>
          <span className="text-xs font-medium">Touch 'n Go eWallet</span>
        </button>

        {/* Credit / Debit Card */}
        <button className="w-full flex items-center justify-center gap-2 py-2.5 transition-colors hover:bg-slate-50 active:bg-slate-100" style={{ color: "#00A884" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2"/>
            <line x1="1" y1="10" x2="23" y2="10"/>
            <circle cx="6" cy="15" r="1" fill="currentColor"/>
            <circle cx="10" cy="15" r="1" fill="currentColor"/>
          </svg>
          <span className="text-xs font-medium">Credit / Debit Card</span>
        </button>
      </div>
    </div>
  );
}

function WhatsAppText({ text }: { text: string }) {
  function parseLine(line: string): React.ReactNode {
    // Split on URLs first, then on bold/italic markers
    const urlParts = line.split(URL_RE);
    return urlParts.map((part, ui) => {
      if (URL_RE.test(part)) {
        URL_RE.lastIndex = 0;
        return (
          <a
            key={ui}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline underline-offset-2 break-all hover:text-blue-800 active:text-blue-900"
          >
            {part}
          </a>
        );
      }
      URL_RE.lastIndex = 0;
      const segments = part.split(/(\*[^*\n]+\*|_[^_\n]+_)/g);
      return segments.map((seg, i) => {
        if (seg.startsWith("*") && seg.endsWith("*") && seg.length > 2)
          return <strong key={`${ui}-${i}`} className="font-semibold">{seg.slice(1, -1)}</strong>;
        if (seg.startsWith("_") && seg.endsWith("_") && seg.length > 2)
          return <em key={`${ui}-${i}`}>{seg.slice(1, -1)}</em>;
        return <span key={`${ui}-${i}`}>{seg}</span>;
      });
    });
  }

  const paragraphs = text.split(/\n{2,}/);
  return (
    <div className="space-y-2 leading-relaxed">
      {paragraphs.map((para, pi) => {
        const lines = para.split("\n").filter(l => l !== undefined);
        return (
          <div key={pi} className="space-y-0.5">
            {lines.map((line, li) => (
              <div key={li}>{parseLine(line)}</div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function MockChat({
  merchantId,
  fromPhone,
  fromName,
  shopName,
  chatMode,
  onLog,
  messages,      
  setMessages,  
  voiceFile,     
  setVoiceFile, 
}: {
  merchantId?: string;
  fromPhone?: string;
  fromName?: string;
  shopName?: string;
  chatMode: "text" | "voice" | "image";
  onLog?: (message: string) => void;
  messages: ChatMessage[];
  setMessages: (msgs: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  voiceFile: "order.m4a" | "ok.m4a";
  setVoiceFile: React.Dispatch<React.SetStateAction<"order.m4a" | "ok.m4a">>;
}) {
  const resolvedMerchant = merchantId || DEMO_MERCHANT;
  const now = useCallback(() => {
    return new Date().toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
  }, []);

  useEffect(() => {
  // Only set initial messages if the parent array is actually empty.
  // This allows tab-switching to keep the history stored in Dashboard.tsx.
  if (!messages || messages.length === 0) {
    setMessages(getInitialMessages(chatMode, now));
  }
}, [chatMode, now, setMessages]);

  const clearHistory = () => {
    setMessages(getInitialMessages(chatMode, now));
    setVoiceFile("order.m4a");
    setSelectedImage(null);
    onLog?.("🗑️ Chat history cleared by user.");
  };

  const phone = fromPhone || DEFAULT_PHONE;
  const name = fromName || DEFAULT_NAME;
  const shop = shopName || "Demo Wholesaler";
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatHint, setChatHint] = useState("Thinking…");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const sseShown = useRef<Set<string>>(new Set());
  const nameSynced = useRef(false);
  const [selectedImage, setSelectedImage] = useState<{ dataUrl: string; base64: string; type: string } | null>(null);
  const [tngPayment, setTngPayment] = useState<TngData | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Effect to reset textarea height when input is cleared
  useEffect(() => {
    if (textareaRef.current && input === "") {
      textareaRef.current.style.height = "auto"; // Reset to default height
    }
  }, [input]);

  // --- Voice Recording Simulation ---
  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  };

  const stopAndSendVoice = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);

    const currentVoiceFile = voiceFile;

    const audioMsg: ChatMessage = {
      role: "buyer",
      isAudio: true,
      recordingDuration: recordingTime || 1,
      time: now(),
    };
    setMessages((prev) => [...prev, audioMsg]);
    setLoading(true);
    setChatHint("Transcribing voice note…");

    onLog?.("─────────────────────────────────");
    onLog?.(`📨 Buyer: [Voice Note — ${currentVoiceFile}]`);

    // Open SSE stream like text mode
    const sessionId = crypto.randomUUID();
    esRef.current?.close();
    sseShown.current.clear();
    const es = new EventSource(`${BACKEND_URL}/api/session-logs/${sessionId}`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "log") {
          onLog?.(data.message);
          const hint = logToHint(data.message);
          if (hint) setChatHint(hint);
        }
        if (data.type === "message") {
          if (sseShown.current.has(data.text)) return;
          sseShown.current.add(data.text);
          setMessages((prev) => [...prev, { role: "agent", text: data.text, time: now() }]);
        }
        if (data.type === "done") es.close();
      } catch {}
    };
    es.onerror = () => es.close();

    // Wait for EventSource to connect before sending the fetch
    await new Promise<void>((resolve) => {
      es.addEventListener("open", () => resolve(), { once: true });
      setTimeout(resolve, 500);
    });

    const t0 = Date.now();

    try {
      const res = await fetch(`${BACKEND_URL}/webhook/mock-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": sessionId,
        },
        body: JSON.stringify({
          from_number: phone,
          message_type: "audio",
          media_url: `demo/${currentVoiceFile}`,
          merchant_id: resolvedMerchant,
        }),
      });

      es.close();
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const data = await res.json();
      const allReplies: string[] = data.replies ?? [];
      const replies = allReplies.filter((r) => !sseShown.current.has(r));
      sseShown.current.clear();

      onLog?.(`✅ [Pipeline] Response in ${elapsed}s — ${replies.length} message(s) to buyer`);
      setLoading(false);

      await syncNameToDb();

      for (let i = 0; i < replies.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 650));
        setMessages((prev) => [...prev, { role: "agent", text: replies[i], time: now() }]);
      }

      setVoiceFile("ok.m4a");
    } catch {
      es.close();
      onLog?.("❌ [System] Voice processing failed — is the backend running?");
      setLoading(false);
      setMessages((prev) => [
        ...prev,
        { role: "agent", text: "⚠ Voice processing failed.", time: now() },
      ]);
    }
  };

  useEffect(
    () => () => {
      esRef.current?.close();
    },
    [],
  );

  async function syncNameToDb() {
    if (nameSynced.current || !name || name === DEFAULT_NAME) return;
    try {
      await supabase
        .from("customer")
        .update({ customer_name: name })
        .eq("whatsapp_number", phone)
        .eq("merchant_id", resolvedMerchant);
      nameSynced.current = true;
    } catch {}
  }

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      setSelectedImage({ dataUrl, base64, type: file.type || "image/jpeg" });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function sendImageMessage() {
    if (!selectedImage || loading) return;
    const { dataUrl, base64, type } = selectedImage;
    setSelectedImage(null);

    const ack = "Ok! 🖼️ Tengah baca gambar pesanan tu, jap sekejap...";
    setMessages((prev) => [
      ...prev,
      { role: "buyer", isImage: true, imageDataUrl: dataUrl, text: input.trim() || undefined, time: now() },
      { role: "agent", text: ack, time: now() },
    ]);
    setInput("");
    setLoading(true);
    setChatHint("Reading your order image…");

    onLog?.("─────────────────────────────────");
    onLog?.("📨 Buyer: [Image — order list photo]");

    const sessionId = crypto.randomUUID();
    esRef.current?.close();
    sseShown.current.clear();
    sseShown.current.add(ack);
    const es = new EventSource(`${BACKEND_URL}/api/session-logs/${sessionId}`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "log") { onLog?.(data.message); const h = logToHint(data.message); if (h) setChatHint(h); }
        if (data.type === "message") { if (sseShown.current.has(data.text)) return; sseShown.current.add(data.text); setMessages((prev) => [...prev, { role: "agent", text: data.text, time: now() }]); }
        if (data.type === "done") es.close();
      } catch {}
    };
    es.onerror = () => es.close();

    await new Promise<void>((resolve) => { es.addEventListener("open", () => resolve(), { once: true }); setTimeout(resolve, 500); });

    const t0 = Date.now();
    try {
      const res = await fetch(`${BACKEND_URL}/webhook/mock-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Id": sessionId },
        body: JSON.stringify({
          from_number: phone,
          message_type: "image",
          text_content: input.trim() || null,
          media_content: base64,
          media_content_type: type,
          merchant_id: resolvedMerchant,
        }),
      });
      es.close();
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const data = await res.json();
      const allReplies: string[] = data.replies ?? [];
      const replies = allReplies.filter((r) => !sseShown.current.has(r));
      sseShown.current.clear();
      onLog?.(`✅ [Pipeline] Response in ${elapsed}s — ${replies.length} message(s) to buyer`);
      setLoading(false);
      await syncNameToDb();
      for (let i = 0; i < replies.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 650));
        setMessages((prev) => [...prev, { role: "agent", text: replies[i], time: now() }]);
      }
    } catch {
      es.close();
      onLog?.("❌ [System] Image processing failed — is the backend running?");
      setLoading(false);
      setMessages((prev) => [...prev, { role: "agent", text: "⚠ Image processing failed.", time: now() }]);
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");

    const ackMsg = getImmediateAck(text);
    setMessages((prev) => [
      ...prev,
      { role: "buyer", text, time: now() },
      { role: "agent", text: ackMsg, time: now() },
    ]);
    setLoading(true);
    setChatHint("Connecting to agent pipeline…");

    onLog?.("─────────────────────────────────");
    onLog?.(`📨 Buyer: "${text.slice(0, 60)}${text.length > 60 ? "…" : ""}"`);

    const sessionId = crypto.randomUUID();
    esRef.current?.close();
    sseShown.current.clear();
    sseShown.current.add(ackMsg);
    const es = new EventSource(`${BACKEND_URL}/api/session-logs/${sessionId}`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "log") {
          onLog?.(data.message);
          const hint = logToHint(data.message);
          if (hint) setChatHint(hint);
        }
        if (data.type === "message") {
          if (sseShown.current.has(data.text)) return;
          sseShown.current.add(data.text);
          setMessages((prev) => [...prev, { role: "agent", text: data.text, time: now() }]);
        }
        if (data.type === "done") es.close();
      } catch {}
    };
    es.onerror = () => es.close();

    // Wait for EventSource to connect before sending the fetch,
    // otherwise early SSE events (like "Dapat!" ack) may be missed
    await new Promise<void>((resolve) => {
      es.addEventListener("open", () => resolve(), { once: true });
      setTimeout(resolve, 500); // fallback timeout
    });

    const t0 = Date.now();

    try {
      const res = await fetch(`${BACKEND_URL}/webhook/mock-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": sessionId,
        },
        body: JSON.stringify({
          from_number: phone,
          message_type: "text",
          text_content: text,
          merchant_id: resolvedMerchant,
        }),
      });

      es.close();
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const data = await res.json();
      const allReplies: string[] = data.replies ?? (data.reply ? [data.reply] : []);
      const replies = allReplies.filter(
        (r) => r.trim() !== ackMsg.trim() && !sseShown.current.has(r)
      );
      sseShown.current.clear();

      onLog?.(`✅ [Pipeline] Response in ${elapsed}s — ${replies.length} message(s) to buyer`);
      setLoading(false);

      await syncNameToDb();

      for (let i = 0; i < replies.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 650));
        setMessages((prev) => [...prev, { role: "agent", text: replies[i], time: now() }]);
      }
    } catch {
      es.close();
      onLog?.("❌ [System] Backend unreachable — is the server running?");
      setLoading(false);
      setMessages((prev) => [
        ...prev,
        { role: "agent", text: "⚠ Error connecting to backend. Is it running?", time: now() },
      ]);
    }
  }

  return (
    <div className="bg-white flex flex-col h-full overflow-hidden relative">
      {/* TNG Payment Overlay */}
      {tngPayment && (
        <TngOverlay
          data={tngPayment}
          onDone={(ref: string, _t: string, _c: string) => {
            const orderId = tngPayment!.orderId;
            setTngPayment(null);
            if (!ref) return; // Report button — just close

            // img2: ack message at 2 s
            setTimeout(() => {
              setMessages(prev => [...prev, {
                role: "agent",
                text: "✅ Dapat! Tengah sahkan pesanan dan atur penghantaran... Kejap lagi dapat konfirmasi dengan tracking! 🚚\n/ ✅ Got it! Confirming your order and arranging delivery... You'll get tracking info shortly!",
                time: now(),
              }]);
            }, 2000);

            // Call backend NOW (after Approve+Done) — order stays Awaiting Payment until here
            fetch(`${BACKEND_URL}/api/payment/confirm`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ order_id: orderId, reference: ref, method: "Touch 'n Go eWallet" }),
            })
              .then(r => r.json())
              .then(d => {
                const confMsg = d.confirmation_message || (
                  "🎉 Pesanan anda telah disahkan!\n\n📦 Barang sedang disediakan untuk penghantaran.\n🚚 Pemandu Lalamove akan tiba dalam ~45 minit.\n🔗 Jejak penghantaran anda:\nhttps://web.lalamove.com/tracking/LAL-" + ref.slice(-8) + "\n\nTerima kasih kerana membeli dengan SupplyLah! 😊"
                );
                setTimeout(() => {
                  setMessages(prev => [...prev, { role: "agent", text: confMsg, time: now() }]);
                }, 3500);
              })
              .catch(() => {
                setTimeout(() => {
                  setMessages(prev => [...prev, {
                    role: "agent",
                    text: "🎉 Pesanan anda telah disahkan!\n\n📦 Barang sedang disediakan untuk penghantaran.\n🚚 Pemandu Lalamove akan tiba dalam ~45 minit.\n🔗 Jejak penghantaran anda:\nhttps://web.lalamove.com/tracking/LAL-" + ref.slice(-8) + "\n\nTerima kasih kerana membeli dengan SupplyLah! 😊",
                    time: now(),
                  }]);
                }, 3500);
              });
          }}
        />
      )}
      {/* Header with Mode Switcher */}
      <div className="bg-[#075E54] text-white px-5 h-24 py-4 items-end gap-3 flex justify-between relative">
        <img
          src="/status-bar.png"
          className="absolute top-0 left-0 w-full h-12 object-fill z-20 pointer-events-none"
          alt="status bar"
        />
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-400 flex items-center justify-center text-xl">
            🏪
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">{shop}</p>
            <p className="text-[10px] opacity-75 leading-tight">
              WhatsApp Business · online
            </p>
          </div>
        </div>

        <button 
           onClick={(e) => { e.stopPropagation(); clearHistory(); }}
           className="mb-1 p-1.5 rounded-full hover:bg-black/10 transition-colors"
           title="Clear Chat"
         >
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
             <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
           </svg>
         </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#e5ddd5]">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "buyer" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm shadow-sm break-words overflow-hidden ${
                m.role === "buyer"
                  ? "bg-[#dcf8c6] rounded-tr-none"
                  : "bg-white rounded-tl-none"
              }`}
            >
              {m.isAudio ? (
                <div className="flex items-center gap-3 py-1 min-w-[160px]">
                  <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-white">▶</div>
                  <div className="flex-1 h-1 bg-slate-200 rounded-full relative">
                    <div className="absolute left-0 top-0 h-full w-1/3 bg-green-500 rounded-full" />
                  </div>
                  <span className="text-[10px] text-slate-500">0:{String(m.recordingDuration ?? 1).padStart(2, "0")}</span>
                </div>
              ) : m.isImage ? (
                <div className="space-y-1">
                  <img src={m.imageDataUrl} alt="order list" className="rounded-lg max-w-[200px] max-h-[200px] object-cover" />
                  {m.text && <WhatsAppText text={m.text} />}
                </div>
              ) : PAYMENT_MARKER_RE.test(m.text ?? "") ? (
                <PaymentCard text={m.text ?? ""} onTngPay={setTngPayment} />
              ) : (
                <WhatsAppText text={m.text ?? ""} />
              )}
              <p className="text-right text-[10px] text-slate-400 mt-1">
                {m.time}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-2.5 shadow-sm max-w-[85%]">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: "160ms" }} />
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: "320ms" }} />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">{chatHint}</p>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Hidden file input for image mode */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />

      {/* Input */}
      <div className="border-t border-slate-200 bg-white px-3 pt-2 pb-5 flex items-end gap-2">
        {chatMode === "image" ? (
          <>
            {/* Image preview strip */}
            {selectedImage && (
              <div className="absolute bottom-20 left-3 right-3 bg-white border border-slate-200 rounded-xl p-2 flex items-center gap-2 shadow-md z-10">
                <img src={selectedImage.dataUrl} alt="preview" className="w-14 h-14 rounded-lg object-cover" />
                <div className="flex-1 text-xs text-slate-500 truncate">Image ready to send</div>
                <button onClick={() => setSelectedImage(null)} className="text-slate-400 hover:text-red-500 text-lg leading-none">×</button>
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="w-10 h-10 rounded-full bg-slate-100 border border-slate-300 text-slate-600 flex items-center justify-center hover:bg-slate-200 disabled:opacity-40 shrink-0 text-lg"
              title="Attach image"
            >
              📎
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); selectedImage ? sendImageMessage() : sendMessage(); } }}
              placeholder="Attach image or type order…"
              rows={1}
              className="flex-1 self-end resize-none rounded-2xl border border-slate-300 px-4 py-2 text-sm leading-5 focus:outline-none focus:border-green-400 max-h-[100px] overflow-y-auto"
            />
            <button
              onClick={selectedImage ? sendImageMessage : sendMessage}
              disabled={loading || (!selectedImage && !input.trim())}
              className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center hover:bg-green-700 disabled:opacity-40 shrink-0"
            >
              ➤
            </button>
          </>
        ) : chatMode === "text" ? (
          <>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type your order…"
              rows={1}
              className="flex-1 self-end resize-none rounded-2xl border border-slate-300 px-4 py-2 text-sm leading-5 focus:outline-none focus:border-green-400 max-h-[100px] overflow-y-auto"
            />

            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center hover:bg-green-700 disabled:opacity-40"
            >
              ➤
            </button>
          </>
        ) : isRecording ? (
          /* WhatsApp-style recording indicator */
          <>
            <div className="flex-1 flex items-center gap-2.5 bg-white rounded-2xl border border-red-200 px-3 py-2 h-10">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-red-500 text-sm font-medium tabular-nums">
                {String(Math.floor(recordingTime / 60)).padStart(2, "0")}:{String(recordingTime % 60).padStart(2, "0")}
              </span>
              <div className="flex-1 flex items-center gap-0.5 h-5">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-0.5 bg-red-400 rounded-full animate-pulse"
                    style={{
                      height: `${30 + Math.sin(i * 0.8) * 40}%`,
                      animationDelay: `${i * 60}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
            <button
              onMouseUp={stopAndSendVoice}
              onTouchEnd={stopAndSendVoice}
              className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0 shadow"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
            </button>
          </>
        ) : (
          <>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type or hold mic…"
              rows={1}
              className="flex-1 self-end resize-none rounded-2xl border border-slate-300 px-4 py-2 text-sm leading-5 focus:outline-none focus:border-green-400 max-h-[100px] overflow-y-auto"
            />
            {input.trim() ? (
              <button
                onClick={sendMessage}
                disabled={loading}
                className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center hover:bg-green-700 disabled:opacity-40 shrink-0"
              >
                ➤
              </button>
            ) : (
              <button
                onMouseDown={startRecording}
                onTouchStart={startRecording}
                disabled={loading}
                className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center shrink-0 disabled:opacity-40"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
