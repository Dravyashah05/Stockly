import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Send,
  X,
  Bot,
  User,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Settings2,
  TrendingDown,
  Layers,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  KeyRound,
} from "lucide-react";
import { chatCopilot, getStoredAiSettings, saveStoredAiSettings } from "../../api/ai";
import { useToast } from "../../context/ToastContext";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

const QUICK_PROMPTS = [
  "What items are currently low on stock?",
  "What is our total inventory valuation and breakdown?",
  "Summarize recent stock movements and transactions",
  "Which products need urgent replenishment this week?",
];

export default function AiCopilotDrawer({ open, onClose }) {
  const [messages, setMessages] = useState(() => {
    return [
      {
        id: "welcome",
        role: "assistant",
        content:
          "👋 Hello! I am **Stockly AI Copilot** powered by Opencode. I have live access to your warehouse catalog, stock ledgers, and valuation.\n\nAsk me anything or pick a quick prompt below!",
      },
    ];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [aiSettings, setAiSettings] = useState(getStoredAiSettings());

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const { push } = useToast();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
      scrollToBottom();
    }
  }, [open]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg = { id: String(Date.now()), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages.filter((m) => m.id !== "welcome");
      const res = await chatCopilot(text, history);

      if (res?.success) {
        const botMsg = {
          id: String(Date.now() + 1),
          role: "assistant",
          content: res.reply,
          model: res.model,
          provider: res.provider,
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        throw new Error(res?.message || "Failed to get AI response");
      }
    } catch (err) {
      const errorMsg = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: `❌ **Error:** ${err.message || "Failed to connect to AI service. Please check your Opencode API key in Settings."}`,
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    push?.("Copied to clipboard", "success");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "👋 Chat cleared. Ask me anything about your stock levels, categories, valuations, or catalog items!",
      },
    ]);
  };

  const handleSaveSettings = () => {
    saveStoredAiSettings(aiSettings);
    setShowConfig(false);
    push?.("Opencode AI Settings updated", "success");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-full sm:w-[480px] bg-white dark:bg-zinc-900 h-full flex flex-col shadow-2xl border-l border-zinc-200/80 dark:border-zinc-800/80 z-10 animate-slide-up sm:animate-sheet-up">
        {/* Drawer Header */}
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3 shrink-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 text-white grid place-items-center shadow-md shadow-violet-500/20 shrink-0">
              <Sparkles size={17} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm text-zinc-900 dark:text-white truncate">
                  Stockly Copilot
                </span>
                <span className="px-1.5 py-0.2 rounded-md bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-[9px] font-extrabold uppercase">
                  AI Live
                </span>
              </div>
              <div className="text-[10.5px] text-zinc-400 truncate">
                Powered by Opencode & Real-Time Warehouse Context
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setShowConfig(true)}
              className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 grid place-items-center active:scale-95 transition"
              title="Configure Opencode API"
            >
              <Settings2 size={15} />
            </button>
            <button
              onClick={handleClear}
              className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 grid place-items-center active:scale-95 transition"
              title="Clear Conversation"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 grid place-items-center active:scale-95 transition"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain">
          {messages.map((m) => {
            const isBot = m.role === "assistant";
            return (
              <div
                key={m.id}
                className={`flex gap-2.5 ${isBot ? "items-start" : "items-end flex-row-reverse"}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-xl grid place-items-center text-xs shrink-0 font-bold ${
                    isBot
                      ? "bg-violet-600 text-white shadow-xs"
                      : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                  }`}
                >
                  {isBot ? <Bot size={14} /> : <User size={14} />}
                </div>

                {/* Bubble */}
                <div
                  className={`relative group max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed select-text ${
                    isBot
                      ? m.isError
                        ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/20"
                        : "bg-zinc-100/90 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 border border-zinc-200/50 dark:border-zinc-700/50"
                      : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium"
                  }`}
                >
                  {/* Message content formatted with basic bold and linebreaks */}
                  <div className="whitespace-pre-wrap break-words">
                    {m.content.split("\n").map((line, idx) => (
                      <span key={idx}>
                        {line.startsWith("- ") || line.startsWith("* ") ? (
                          <span className="block pl-2 py-0.5">
                            • {line.slice(2).replace(/\*\*(.*?)\*\*/g, "$1")}
                          </span>
                        ) : line.startsWith("#") ? (
                          <span className="block font-bold text-sm my-1">
                            {line.replace(/^#+\s*/, "")}
                          </span>
                        ) : (
                          line
                        )}
                        {idx < m.content.split("\n").length - 1 && <br />}
                      </span>
                    ))}
                  </div>

                  {/* Copy button */}
                  {isBot && !m.isError && (
                    <button
                      onClick={() => handleCopy(m.content, m.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-lg bg-white/80 dark:bg-zinc-900/80 grid place-items-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                      title="Copy response"
                    >
                      {copiedId === m.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-2.5 items-center">
              <div className="w-7 h-7 rounded-xl bg-violet-600 text-white grid place-items-center text-xs shrink-0 shadow-xs">
                <Bot size={14} />
              </div>
              <div className="px-4 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce [animation-delay:0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce [animation-delay:0.3s]" />
                <span className="text-[11px] text-zinc-400 font-medium ml-1">Analyzing warehouse data…</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-3 py-2 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/50 shrink-0">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {QUICK_PROMPTS.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                disabled={loading}
                className="whitespace-nowrap px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400 active:scale-95 transition shrink-0 shadow-2xs"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Input Area */}
        <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Copilot anything about inventory…"
              className="flex-1 px-3.5 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-violet-500 transition"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="w-10 h-10 rounded-2xl bg-violet-600 text-white grid place-items-center shadow-md shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition shrink-0"
              aria-label="Send message"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>

      {/* AI Configuration Modal */}
      <Modal
        open={showConfig}
        onClose={() => setShowConfig(false)}
        title="Opencode AI Provider Settings"
        description="Configure your custom Opencode, OpenRouter, or OpenAI-compatible endpoint"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              Opencode / OpenRouter API Key
            </label>
            <input
              type="password"
              value={aiSettings.apiKey || ""}
              onChange={(e) => setAiSettings({ ...aiSettings, apiKey: e.target.value })}
              placeholder="sk-or-v1-..."
              className="input-field h-11 text-xs"
            />
            <p className="text-[10.5px] text-zinc-400 mt-1">
              Supports Opencode, OpenRouter, DeepSeek, and OpenAI-compatible API keys.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              Base URL Endpoint
            </label>
            <input
              value={aiSettings.baseURL || ""}
              onChange={(e) => setAiSettings({ ...aiSettings, baseURL: e.target.value })}
              placeholder="https://api.opencode.ai/v1"
              className="input-field h-11 text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              Model Identifier
            </label>
            <input
              value={aiSettings.model || ""}
              onChange={(e) => setAiSettings({ ...aiSettings, model: e.target.value })}
              placeholder="deepseek/deepseek-chat"
              className="input-field h-11 text-xs font-mono"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {["deepseek/deepseek-chat", "gpt-4o-mini", "anthropic/claude-3.5-sonnet", "meta-llama/llama-3-8b-instruct:free"].map(
                (m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setAiSettings({ ...aiSettings, model: m })}
                    className="px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200"
                  >
                    {m.split("/")[1] || m}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowConfig(false)}
              className="flex-1 min-h-[44px]"
            >
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} className="flex-1 min-h-[44px]">
              Save Configuration
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
