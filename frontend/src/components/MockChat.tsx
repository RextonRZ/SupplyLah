"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { supabase, BACKEND_URL } from "@/lib/supabase";

export interface ChatMessage {
  role: "buyer" | "agent";
  text?: string;
  audioUrl?: string;
  time: string;
  isAudio?: boolean;
  recordingDuration?: number;
}

const DEFAULT_PHONE = "+60198765432";
const DEFAULT_NAME = "Demo Customer";
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


function WhatsAppText({ text }: { text: string }) {
  function parseLine(line: string): React.ReactNode {
    const segments = line.split(/(\*[^*\n]+\*|_[^_\n]+_)/g);
    return segments.map((seg, i) => {
      if (seg.startsWith("*") && seg.endsWith("*") && seg.length > 2)
        return <strong key={i} className="font-semibold">{seg.slice(1, -1)}</strong>;
      if (seg.startsWith("_") && seg.endsWith("_") && seg.length > 2)
        return <em key={i}>{seg.slice(1, -1)}</em>;
      return <span key={i}>{seg}</span>;
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
  chatMode: "text" | "voice";
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
  const esRef = useRef<EventSource | null>(null);
  const sseShown = useRef<Set<string>>(new Set());
  const nameSynced = useRef(false);

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
    <div className="bg-white flex flex-col h-full overflow-hidden">
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
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm shadow-sm ${
                m.role === "buyer"
                  ? "bg-[#dcf8c6] rounded-tr-none"
                  : "bg-white rounded-tl-none"
              }`}
            >
              {m.isAudio ? (
                <div className="flex items-center gap-3 py-1 min-w-[160px]">
                  <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-white">
                    ▶
                  </div>
                  <div className="flex-1 h-1 bg-slate-200 rounded-full relative">
                    <div className="absolute left-0 top-0 h-full w-1/3 bg-green-500 rounded-full" />
                  </div>
                  <span className="text-[10px] text-slate-500">0:{String(m.recordingDuration ?? 1).padStart(2, "0")}</span>
                </div>
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
