"use client";

<<<<<<< HEAD
import { useState, useRef, useEffect, useCallback } from "react";
=======
import { useState, useRef, useEffect } from "react";
>>>>>>> 3e1a2ea68648e1ce9897e1ee4b868b52fac03503
import { supabase, BACKEND_URL } from "@/lib/supabase";

interface ChatMessage {
  role: "buyer" | "agent";
<<<<<<< HEAD
  text?: string;
  audioUrl?: string;
=======
  text: string;
>>>>>>> 3e1a2ea68648e1ce9897e1ee4b868b52fac03503
  time: string;
  isAudio?: boolean;
}

const DEFAULT_PHONE = "+60198765432";
<<<<<<< HEAD
const DEFAULT_NAME = "Demo Customer";
const VOICE_BUYER_PHONE = "+60123456789";
const DEMO_MERCHANT = "00000000-0000-0000-0000-000000000001";

// Helper function to get initial messages
const getInitialMessages = (
  chatMode: "text" | "voice",
  now: () => string,
): ChatMessage[] => {
  const commonWelcome = `👋 Demo WhatsApp — ${chatMode === "text" ? "Text Mode" : "Voice Note Mode"}.`;
  const textSpecific =
    'Type an order: "boss nak 3 botol minyak masak n 2 bag beras, hantar ke Jalan Ampang KL"';
  const voiceSpecific =
    'Hold the mic to record your order. Try: "boss nak 5 kg ayam."';

  return [
    {
      role: "agent",
      text: `${commonWelcome}\n\n${chatMode === "text" ? textSpecific : voiceSpecific}`,
      time: now(),
    },
  ];
};

const MALAY_WORDS =
  /\b(nak|nk|boleh|jap|saya|ni|tu|ke|dan|dengan|untuk|minyak|beras|ayam|bawang|hantar|kirim|harga|berapa|lagi|dah|tak|guna|boss|lah|la|ya|tolong|ekor|biji|sahaja|je|tahu|tau|maaf|terima|kasih|taman|jalan)\b/i;
const EN_WORDS =
  /\b(please|want|need|send|deliver|thank|hello|hi|yes|cancel|confirm|address|price|how|order)\b/i;
=======
const DEFAULT_NAME  = "Demo Customer";
const DEMO_MERCHANT = "00000000-0000-0000-0000-000000000001";

const MALAY_WORDS = /\b(nak|nk|boleh|jap|saya|ni|tu|ke|dan|dengan|untuk|minyak|beras|ayam|bawang|hantar|kirim|harga|berapa|lagi|dah|tak|guna|boss|lah|la|ya|tolong|ekor|biji|sahaja|je|tahu|tau|maaf|terima|kasih|taman|jalan)\b/i;
const EN_WORDS    = /\b(please|want|need|send|deliver|thank|hello|hi|yes|cancel|confirm|address|price|how|order)\b/i;
>>>>>>> 3e1a2ea68648e1ce9897e1ee4b868b52fac03503

function getImmediateAck(text: string): string {
  const msHits = (text.match(MALAY_WORDS) || []).length;
  const enHits = (text.match(EN_WORDS) || []).length;
  const isMalay = msHits >= enHits;
  return isMalay
    ? "Ok tunggu jap! 🙏 Saya tengah proses pesanan ni..."
    : "On it! 🔍 Processing your order, give me a sec...";
}

function logToHint(log: string): string | null {
<<<<<<< HEAD
  if (log.includes("CRM") || log.includes("customer"))
    return "Looking up your profile…";
  if (log.includes("catalogue") || log.includes("Catalogue"))
    return "Loading product catalogue…";
  if (log.includes("AI model") || log.includes("IntakeAgent"))
    return "AI model processing…";
  if (log.includes("Intent:")) return "Order intent analysed ✓";
  if (log.includes("InventoryAgent") || log.includes("stock"))
    return "Checking stock levels…";
  if (log.includes("grand_total") || log.includes("Total:"))
    return "Calculating order total…";
  if (log.includes("DB") || log.includes("Saving"))
    return "Saving order to database…";
  if (log.includes("Composer") || log.includes("quote"))
    return "Drafting your summary…";
=======
  if (log.includes("CRM") || log.includes("customer")) return "Looking up your profile…";
  if (log.includes("catalogue") || log.includes("Catalogue")) return "Loading product catalogue…";
  if (log.includes("AI model") || log.includes("IntakeAgent")) return "AI model processing…";
  if (log.includes("Intent:")) return "Order intent analysed ✓";
  if (log.includes("InventoryAgent") || log.includes("stock")) return "Checking stock levels…";
  if (log.includes("grand_total") || log.includes("Total:")) return "Calculating order total…";
  if (log.includes("DB") || log.includes("Saving")) return "Saving order to database…";
  if (log.includes("Composer") || log.includes("quote")) return "Drafting your summary…";
>>>>>>> 3e1a2ea68648e1ce9897e1ee4b868b52fac03503
  return null;
}

function now() {
<<<<<<< HEAD
  return new Date().toLocaleTimeString("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
  });
=======
  return new Date().toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
>>>>>>> 3e1a2ea68648e1ce9897e1ee4b868b52fac03503
}

function WhatsAppText({ text }: { text: string }) {
  function parseLine(line: string): React.ReactNode {
    const segments = line.split(/(\*[^*\n]+\*|_[^_\n]+_)/g);
    return segments.map((seg, i) => {
      if (seg.startsWith("*") && seg.endsWith("*") && seg.length > 2)
<<<<<<< HEAD
        return (
          <strong key={i} className="font-semibold">
            {seg.slice(1, -1)}
          </strong>
        );
=======
        return <strong key={i} className="font-semibold">{seg.slice(1, -1)}</strong>;
>>>>>>> 3e1a2ea68648e1ce9897e1ee4b868b52fac03503
      if (seg.startsWith("_") && seg.endsWith("_") && seg.length > 2)
        return <em key={i}>{seg.slice(1, -1)}</em>;
      return <span key={i}>{seg}</span>;
    });
  }

  const paragraphs = text.split(/\n{2,}/);
  return (
    <div className="space-y-2 leading-relaxed">
      {paragraphs.map((para, pi) => {
<<<<<<< HEAD
        const lines = para.split("\n").filter((l) => l !== undefined);
=======
        const lines = para.split("\n").filter(l => l !== undefined);
>>>>>>> 3e1a2ea68648e1ce9897e1ee4b868b52fac03503
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
<<<<<<< HEAD
  chatMode,
=======
>>>>>>> 3e1a2ea68648e1ce9897e1ee4b868b52fac03503
  onLog,
}: {
  merchantId?: string;
  fromPhone?: string;
  fromName?: string;
  shopName?: string;
<<<<<<< HEAD
  chatMode: "text" | "voice";
  onLog?: (message: string) => void;
}) {
  const resolvedMerchant = merchantId || DEMO_MERCHANT;
  const [voiceFile, setVoiceFile] = useState<"order.m4a" | "ok.m4a">(
    "order.m4a",
  );
  const now = useCallback(() => {
    // Memoize now function
    return new Date().toLocaleTimeString("en-MY", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const phone = fromPhone || DEFAULT_PHONE;
  const name = fromName || DEFAULT_NAME;
  const shop = shopName || "Demo Wholesaler";
  const [messages, setMessages] = useState<ChatMessage[]>(
    getInitialMessages(chatMode, now),
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatHint, setChatHint] = useState("Thinking…");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const sseShown = useRef<Set<string>>(new Set());
  const nameSynced = useRef(false);

  useEffect(() => {
    setMessages(getInitialMessages(chatMode, now));
  }, [chatMode, now]);
=======
  onLog?: (message: string) => void;
}) {
  const resolvedMerchant = merchantId || DEMO_MERCHANT;
  const phone = fromPhone || DEFAULT_PHONE;
  const name  = fromName  || DEFAULT_NAME;
  const shop  = shopName  || "Demo Wholesaler";

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "agent",
      text: "👋 Demo WhatsApp — type a message as if you're a buyer placing a wholesale order.\n\nTry: \"boss nak 3 botol minyak masak n 2 bag beras, hantar ke Jalan Ampang KL\"",
      time: now(),
    },
  ]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [chatHint, setChatHint] = useState("Thinking…");

  const bottomRef  = useRef<HTMLDivElement>(null);
  const esRef      = useRef<EventSource | null>(null);
  const sseShown   = useRef<Set<string>>(new Set());
  const nameSynced = useRef(false);
>>>>>>> 3e1a2ea68648e1ce9897e1ee4b868b52fac03503

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

<<<<<<< HEAD
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

    // 1. Add visual audio message to chat
    const audioMsg: ChatMessage = {
      role: "buyer",
      isAudio: true,
      time: now(),
    };
    setMessages((prev) => [...prev, audioMsg]);
    setLoading(true);

    // 2. Trigger logs for the pipeline
    onLog?.(`Buyer: [Voice Note sent from ${VOICE_BUYER_PHONE}]`);
    onLog?.(`S3 Service: Uploading '${currentVoiceFile}' to secure bucket...`);

    setTimeout(() => {
      onLog?.(
        `Transcription Service: Calling Groq (Whisper-v3) with pre-signed URL...`,
      );
    }, 5000);

    try {
      const res = await fetch(`${BACKEND_URL}/webhook/mock-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_number: VOICE_BUYER_PHONE,
          message_type: "audio",
          media_url: `demo/${currentVoiceFile}`,
          merchant_id: resolvedMerchant,
        }),
      });

      const data = await res.json();
      const replies: string[] = data.replies ?? [];

      // Log the initial transcription result here
      if (replies.length > 0) {
        onLog?.(`Whisper Transcription: "${replies[0].substring(0, 70)}..."`);
      }

      onLog?.(`Orchestrator: Transcription received. Routing to GLM-5.1...`);

      for (let i = 0; i < replies.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 800));
        setMessages((prev) => [
          ...prev,
          { role: "agent", text: replies[i], time: now() },
        ]);
        onLog?.(`AI Agent: ${replies[i].substring(0, 60)}...`);
      }

      setVoiceFile((prev) => (prev === "order.m4a" ? "ok.m4a" : "order.m4a"));
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "agent", text: "⚠ Voice processing failed.", time: now() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(
    () => () => {
      esRef.current?.close();
    },
    [],
  );
=======
  useEffect(() => () => { esRef.current?.close(); }, []);
>>>>>>> 3e1a2ea68648e1ce9897e1ee4b868b52fac03503

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
<<<<<<< HEAD
      const allReplies: string[] =
        data.replies ?? (data.reply ? [data.reply] : []);
      const replies = allReplies.filter(
        (r) => r.trim() !== ackMsg.trim() && !sseShown.current.has(r),
      );
      sseShown.current.clear();

      onLog?.(
        `✅ [Pipeline] Response in ${elapsed}s — ${replies.length} message(s) to buyer`,
      );
=======
      const allReplies: string[] = data.replies ?? (data.reply ? [data.reply] : []);
      const replies = allReplies.filter(
        (r) => r.trim() !== ackMsg.trim() && !sseShown.current.has(r)
      );
      sseShown.current.clear();

      onLog?.(`✅ [Pipeline] Response in ${elapsed}s — ${replies.length} message(s) to buyer`);
>>>>>>> 3e1a2ea68648e1ce9897e1ee4b868b52fac03503
      setLoading(false);

      await syncNameToDb();

      for (let i = 0; i < replies.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 650));
<<<<<<< HEAD
        setMessages((prev) => [
          ...prev,
          { role: "agent", text: replies[i], time: now() },
        ]);
=======
        setMessages((prev) => [...prev, { role: "agent", text: replies[i], time: now() }]);
>>>>>>> 3e1a2ea68648e1ce9897e1ee4b868b52fac03503
      }
    } catch {
      es.close();
      onLog?.("❌ [System] Backend unreachable — is the server running?");
      setLoading(false);
      setMessages((prev) => [
        ...prev,
<<<<<<< HEAD
        {
          role: "agent",
          text: "⚠ Error connecting to backend. Is it running?",
          time: now(),
        },
=======
        { role: "agent", text: "⚠ Error connecting to backend. Is it running?", time: now() },
>>>>>>> 3e1a2ea68648e1ce9897e1ee4b868b52fac03503
      ]);
    }
  }

  return (
<<<<<<< HEAD
    <div className="bg-white flex flex-col h-full overflow-hidden">
      {/* Header with Mode Switcher */}
      <div className="bg-[#075E54] text-white px-5 h-24 py-4 items-end gap-3">
        <img
          src="/status-bar.png"
          className="absolute top-0 left-0 w-full h-12 object-fill z-20 pointer-events-none"
          alt="status bar"
        />
        <div className="flex items-center pt-7 gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-green-400 flex items-center justify-center text-xl">
            🏪
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">{shop}</p>
            <p className="text-[10px] opacity-75 leading-tight">
              WhatsApp Business · online
            </p>
          </div>
=======
    <div className="bg-black flex flex-col h-full overflow-hidden">
      {/* Status bar */}
      <div className="bg-black text-white flex items-center justify-between px-5 pt-2 pb-1 shrink-0" style={{ fontSize: "11px" }}>
        <span className="font-semibold tabular-nums">{now()}</span>
        <div className="flex items-center gap-1.5">
          <svg width="16" height="12" viewBox="0 0 16 12" fill="white">
            <rect x="0" y="8" width="3" height="4" rx="0.5" />
            <rect x="4.5" y="5" width="3" height="7" rx="0.5" />
            <rect x="9" y="2" width="3" height="10" rx="0.5" />
            <rect x="13.5" y="0" width="2.5" height="12" rx="0.5" opacity="0.3" />
          </svg>
          <svg width="15" height="12" viewBox="0 0 24 18" fill="white">
            <path d="M12 14a2 2 0 110 4 2 2 0 010-4z"/>
            <path d="M5.6 9.4a9 9 0 0112.8 0" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <path d="M1.4 5.2a15 15 0 0121.2 0" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5"/>
          </svg>
          <div className="flex items-center gap-0.5">
            <div className="relative w-[22px] h-[11px] rounded-[2px] border border-white/80">
              <div className="absolute inset-[1.5px] right-[3px] bg-white rounded-[1px]" />
            </div>
            <div className="w-[2px] h-[5px] bg-white/60 rounded-r-[1px]" />
          </div>
        </div>
      </div>

      {/* WhatsApp header */}
      <div className="bg-[#075E54] text-white px-3 py-2 flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-full bg-green-400 flex items-center justify-center text-base shrink-0">
          🏪
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">{shop}</p>
          <p className="text-[10px] opacity-75 leading-tight">WhatsApp Business · online</p>
>>>>>>> 3e1a2ea68648e1ce9897e1ee4b868b52fac03503
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#e5ddd5]">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "buyer" ? "justify-end" : "justify-start"}`}>
            <div
<<<<<<< HEAD
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm shadow-sm ${
=======
              className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
>>>>>>> 3e1a2ea68648e1ce9897e1ee4b868b52fac03503
                m.role === "buyer"
                  ? "bg-[#dcf8c6] rounded-tr-none"
                  : "bg-white rounded-tl-none"
              }`}
            >
<<<<<<< HEAD
              {m.isAudio ? (
                <div className="flex items-center gap-3 py-1 min-w-[160px]">
                  <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-white">
                    ▶
                  </div>
                  <div className="flex-1 h-1 bg-slate-200 rounded-full relative">
                    <div className="absolute left-0 top-0 h-full w-1/3 bg-green-500 rounded-full" />
                  </div>
                  <span className="text-[10px] text-slate-500">0:04</span>
                </div>
              ) : (
                <WhatsAppText text={m.text} />
              )}
              <p className="text-right text-[10px] text-slate-400 mt-1">
                {m.time}
              </p>
=======
              <WhatsAppText text={m.text} />
              <p className="text-right text-[10px] text-slate-400 mt-0.5">{m.time}</p>
>>>>>>> 3e1a2ea68648e1ce9897e1ee4b868b52fac03503
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-2.5 shadow-sm max-w-[85%]">
              <div className="flex items-center gap-1.5 mb-1">
<<<<<<< HEAD
                <span
                  className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce"
                  style={{ animationDelay: "160ms" }}
                />
                <span
                  className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce"
                  style={{ animationDelay: "320ms" }}
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {chatHint}
              </p>
=======
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: "160ms" }} />
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: "320ms" }} />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">{chatHint}</p>
>>>>>>> 3e1a2ea68648e1ce9897e1ee4b868b52fac03503
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

<<<<<<< HEAD
      {/* Input */}
      <div className="border-t border-slate-200 bg-white px-3 pt-2 pb-5 flex items-end gap-2">
        {chatMode === "text" ? (
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
        ) : (
          <div className="flex-1 flex items-center gap-3">
            <div className="flex-1 bg-slate-100 rounded-full px-4 py-2.5 text-sm text-slate-400">
              {isRecording ? (
                <span className="text-red-500 font-bold animate-pulse flex items-center gap-2">
                  🔴 Recording... {recordingTime}s
                </span>
              ) : (
                "Hold to record..."
              )}
            </div>
            <button
              onMouseDown={startRecording}
              onMouseUp={stopAndSendVoice}
              onTouchStart={startRecording}
              onTouchEnd={stopAndSendVoice}
              disabled={loading}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-125 ${
                isRecording
                  ? "bg-red-500 text-white"
                  : "bg-green-600 text-white"
              } disabled:opacity-40`}
            >
              🎙️
            </button>
          </div>
        )}
=======
      {/* Input bar */}
      <div className="border-t border-slate-200 bg-[#f0f2f5] px-3 pt-2 pb-3 flex items-end gap-2 shrink-0">
        <textarea
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
          className="flex-1 self-end resize-none rounded-2xl border-0 bg-white px-4 py-2 text-sm leading-5 focus:outline-none shadow-sm max-h-[100px] overflow-y-auto"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center hover:bg-green-700 disabled:opacity-40 transition-colors shrink-0"
        >
          ➤
        </button>
>>>>>>> 3e1a2ea68648e1ce9897e1ee4b868b52fac03503
      </div>
    </div>
  );
}
