"use client";

import { useState, useRef, useEffect } from "react";
import { BACKEND_URL } from "@/lib/supabase";

interface ChatMessage {
  role: "buyer" | "system";
  text: string;
  time: string;
}

const DEMO_PHONE = "+60198765432";
const DEMO_MERCHANT = "00000000-0000-0000-0000-000000000001";

export default function MockChat({ merchantId, onLog }: { merchantId?: string; onLog?: (message: string) => void; }) {
  const resolvedMerchant = merchantId || DEMO_MERCHANT;
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "system",
      text: "👋 Demo WhatsApp — type a message as if you're a buyer placing a wholesale order.\n\nTry: \"boss nak 3 botol minyak masak n 2 bag beras, hantar ke Jalan Ampang KL\"",
      time: now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function now() {
    return new Date().toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");

    setMessages((prev) => [...prev, { role: "buyer", text, time: now() }]);
    setLoading(true);

    // Trigger reasoning log
    onLog?.(`Buyer: "${text}"`);
    onLog?.(`Intake Agent: Analyzing message for merchant ${resolvedMerchant.slice(0,8)}...`);

    try {
      const res = await fetch(`${BACKEND_URL}/webhook/mock-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_number: DEMO_PHONE,
          message_type: "text",
          text_content: text,
          merchant_id: resolvedMerchant,
        }),
      });
      const data = await res.json();
      const replies: string[] = data.replies ?? (data.reply ? [data.reply] : []);

      onLog?.(`Orchestrator: Routing to GLM-5.1 for response generation...`);

      for (let i = 0; i < replies.length; i++) {
        // Brief typing pause between messages so they feel sequential
        if (i > 0) await new Promise((r) => setTimeout(r, 700));
        setMessages((prev) => [...prev, { role: "system", text: replies[i], time: now() }]);
        onLog?.(`AI Agent: ${replies[i].substring(0, 50)}...`);
      }
    } catch (err) {
      onLog?.(`System Error: Backend connection failed.`);
      setMessages((prev) => [
        ...prev,
        { role: "system", text: "⚠ Error connecting to backend. Is it running?", time: now() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    // <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col h-full min-h-[680px]">
    <div className="bg-white flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="bg-green-600 text-white px-5 h-24 py-4 flex items-end gap-3">
        <div className="w-9 h-9 rounded-full bg-green-400 flex items-center justify-center text-lg">
          🏪
        </div>
        <div>
          <p className="text-sm font-bold">Demo Wholesaler</p>
          <p className="text-xs opacity-80">WhatsApp Business (mock)</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e5ddd5]">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "buyer" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                m.role === "buyer"
                  ? "bg-[#dcf8c6] text-slate-800 rounded-tr-sm"
                  : "bg-white text-slate-800 rounded-tl-sm"
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
              <p className="text-right text-[10px] text-slate-400 mt-1">{m.time}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-2 shadow-sm text-slate-400 text-sm">
              SupplyLah AI is typing…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 bg-white p-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="Type your order…"
          className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:border-green-400"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center hover:bg-green-700 disabled:opacity-40"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
