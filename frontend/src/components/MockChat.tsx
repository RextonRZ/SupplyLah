"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { BACKEND_URL } from "@/lib/supabase";

interface ChatMessage {
  role: "buyer" | "system";
  text?: string;
  audioUrl?: string;
  time: string;
  isAudio?: boolean;
}

const DEMO_PHONE = "+60198765432";
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
      role: "system",
      text: `${commonWelcome}\n\n${chatMode === "text" ? textSpecific : voiceSpecific}`,
      time: now(),
    },
  ];
};

export default function MockChat({
  merchantId,
  onLog,
  onClearLogs,
}: {
  merchantId?: string;
  onLog?: (message: string) => void;
  onClearLogs?: () => void;
}) {
  const resolvedMerchant = merchantId || DEMO_MERCHANT;
  const [chatMode, setChatMode] = useState<"text" | "voice">("text");
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

  const [messages, setMessages] = useState<ChatMessage[]>(
    getInitialMessages(chatMode, now),
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Effect to reset chat messages and clear logs when chatMode changes
  useEffect(() => {
    setMessages(getInitialMessages(chatMode, now)); // Reset chat messages to initial state
    onClearLogs?.(); // Call the parent's function to clear logs
  }, [chatMode, onClearLogs]); // Include onClearLogs in dependencies

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
          { role: "system", text: replies[i], time: now() },
        ]);
        onLog?.(`AI Agent: ${replies[i].substring(0, 60)}...`);
      }

      setVoiceFile((prev) => (prev === "order.m4a" ? "ok.m4a" : "order.m4a"));
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "system", text: "⚠ Voice processing failed.", time: now() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");

    setMessages((prev) => [...prev, { role: "buyer", text, time: now() }]);
    setLoading(true);

    // Trigger reasoning log
    onLog?.(`Buyer: "${text}"`);
    onLog?.(
      `Intake Agent: Analyzing message for merchant ${resolvedMerchant.slice(0, 8)}...`,
    );

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
      const replies: string[] =
        data.replies ?? (data.reply ? [data.reply] : []);

      onLog?.(`Orchestrator: Routing to GLM-5.1 for response generation...`);

      for (let i = 0; i < replies.length; i++) {
        // Brief typing pause between messages so they feel sequential
        if (i > 0) await new Promise((r) => setTimeout(r, 700));
        setMessages((prev) => [
          ...prev,
          { role: "system", text: replies[i], time: now() },
        ]);
        onLog?.(`AI Agent: ${replies[i].substring(0, 50)}...`);
      }
    } catch (err) {
      onLog?.(`System Error: Backend connection failed.`);
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: "⚠ Error connecting to backend. Is it running?",
          time: now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white flex flex-col h-full overflow-hidden">
      {/* Header with Mode Switcher */}
      <div className="bg-green-600 text-white px-5 h-35 py-4 items-end gap-3">
        <div className="flex items-center pt-7 gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-green-400 flex items-center justify-center text-xl">
            🏪
          </div>
          <div>
            <p className="text-sm font-bold">Demo Wholesaler</p>
            <p className="text-[10px] opacity-80 uppercase tracking-wider font-bold">
              {chatMode === "text" ? "💬 Text Mode" : "🎙️ Voice Note Mode"}
            </p>
          </div>
        </div>

        <div className="flex bg-green-800/50 p-1 rounded-lg">
          <button
            onClick={() => setChatMode("text")}
            className={`flex-1 text-[10px] font-bold py-1 rounded transition-all ${chatMode === "text" ? "bg-white text-green-800" : "text-green-200"}`}
          >
            TEXT BUYER
          </button>
          <button
            onClick={() => setChatMode("voice")}
            className={`flex-1 text-[10px] font-bold py-1 rounded transition-all ${chatMode === "voice" ? "bg-white text-green-800" : "text-green-200"}`}
          >
            VOICE BUYER
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e5ddd5]">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "buyer" ? "justify-end" : "justify-start"}`}
          >
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
                  <span className="text-[10px] text-slate-500">0:04</span>
                </div>
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
              )}
              <p className="text-right text-[10px] text-slate-400 mt-1">
                {m.time}
              </p>
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
      </div>
    </div>
  );
}
