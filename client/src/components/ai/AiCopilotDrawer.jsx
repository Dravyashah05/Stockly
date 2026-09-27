import React, { useState, useEffect, useRef, useCallback } from "react";
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
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Download,
  Share2,
  ArrowRight,
  TrendingDown,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Package,
  ArrowUpRight,
  Shield,
  Zap,
  ChevronDown,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkle,
} from "lucide-react";
import { chatCopilot, getStoredAiSettings, saveStoredAiSettings, getRestockForecast } from "../../api/ai";
import { useToast } from "../../context/ToastContext";
import { playScanSound, playSuccessSound, playErrorSound, playClickSound } from "../../utils/sound";
import { hapticLight, hapticMedium, hapticSuccess, hapticWarning } from "../../utils/haptics";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

const PROMPT_CATEGORIES = [
  { id: "all", label: "✨ All Prompts" },
  { id: "alerts", label: "🚨 Urgent Alerts" },
  { id: "valuation", label: "💰 Valuation & KPIs" },
  { id: "movements", label: "⚡ Ledger Audit" },
  { id: "forecast", label: "📈 Restock Forecast" },
];

const CATEGORIZED_PROMPTS = {
  alerts: [
    "What items are currently below minimum safety stock?",
    "List all completely out-of-stock products with SKU",
    "Which suppliers have products with critical low stock?",
  ],
  valuation: [
    "What is our total warehouse inventory valuation breakdown?",
    "Which category holds the highest monetary valuation?",
    "Show unit price and total value for top 5 products",
  ],
  movements: [
    "Summarize recent Stock IN receipts vs Stock OUT dispatches",
    "Audit recent stock transactions and identify anomalies",
    "What were the most frequent dispatch reasons this week?",
  ],
  forecast: [
    "Generate a predictive restock recommendation list",
    "Estimate replenishment budget needed for low stock items",
    "Which items have high outflow velocity and need reorder?",
  ],
  all: [
    "What items are currently low on stock?",
    "What is our total inventory valuation and breakdown?",
    "Summarize recent stock movements and transactions",
    "Generate a predictive restock recommendation list",
  ],
};

const POPULAR_MODELS = [
  { id: "deepseek/deepseek-chat", name: "DeepSeek V3", tag: "Fast & Smart", provider: "Opencode" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", tag: "Analytical", provider: "OpenRouter" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", tag: "Efficient", provider: "OpenAI" },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "LLaMA 3.3 70B", tag: "Open Source", provider: "OpenRouter" },
];

/**
 * Custom Markdown & Rich Content Renderer
 */
function MarkdownContent({ content, onActionClick }) {
  if (!content) return null;

  // Split into paragraphs / blocks
  const blocks = content.split(/\n\n+/);

  return (
    <div className="space-y-3 text-xs sm:text-[13px] leading-relaxed break-words">
      {blocks.map((block, bIdx) => {
        const trimmed = block.trim();

        // 1. Code block ```
        if (trimmed.startsWith("```")) {
          const lines = trimmed.split("\n");
          const lang = lines[0].replace("```", "").trim() || "code";
          const codeText = lines.slice(1, lines[lines.length - 1] === "```" ? -1 : undefined).join("\n");
          return (
            <div key={bIdx} className="rounded-xl overflow-hidden bg-zinc-950 text-zinc-200 my-2 border border-zinc-800">
              <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[10px] text-zinc-400 font-mono">
                <span>{lang}</span>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(codeText);
                    hapticLight();
                  }}
                  className="hover:text-white transition flex items-center gap-1"
                >
                  <Copy size={11} /> Copy
                </button>
              </div>
              <pre className="p-3 text-[11.5px] font-mono overflow-x-auto selection:bg-zinc-800">
                <code>{codeText}</code>
              </pre>
            </div>
          );
        }

        // 2. Table (| Col 1 | Col 2 |)
        if (trimmed.startsWith("|") && trimmed.includes("\n|")) {
          const rows = trimmed.split("\n").filter((r) => r.trim().startsWith("|"));
          if (rows.length >= 2) {
            const parseRow = (r) =>
              r
                .split("|")
                .slice(1, -1)
                .map((c) => c.trim());
            const headerCols = parseRow(rows[0]);
            // check if row 1 is separator |---|---|
            const dataRows = rows.slice(rows[1].includes("---") ? 2 : 1).map(parseRow);

            return (
              <div key={bIdx} className="my-2.5 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700/80 shadow-xs">
                <table className="w-full text-left border-collapse text-[11px] sm:text-xs">
                  <thead>
                    <tr className="bg-zinc-100 dark:bg-zinc-800/90 border-b border-zinc-200 dark:border-zinc-700 font-bold text-zinc-800 dark:text-zinc-200">
                      {headerCols.map((c, cIdx) => (
                        <th key={cIdx} className="p-2 sm:px-3 sm:py-2">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                    {dataRows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className={
                          rIdx % 2 === 0
                            ? "bg-white dark:bg-zinc-900/90 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                            : "bg-zinc-50/50 dark:bg-zinc-850/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        }
                      >
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="p-2 sm:px-3 sm:py-2 text-zinc-700 dark:text-zinc-300">
                            {formatInline(cell, onActionClick)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
        }

        // 3. Headers
        if (trimmed.startsWith("# ")) {
          return (
            <h3 key={bIdx} className="text-sm sm:text-base font-extrabold text-zinc-900 dark:text-white pt-1">
              {formatInline(trimmed.replace(/^#\s+/, ""), onActionClick)}
            </h3>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h4 key={bIdx} className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 pt-1">
              {formatInline(trimmed.replace(/^##\s+/, ""), onActionClick)}
            </h4>
          );
        }
        if (trimmed.startsWith("### ")) {
          return (
            <h5 key={bIdx} className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wide">
              {formatInline(trimmed.replace(/^###\s+/, ""), onActionClick)}
            </h5>
          );
        }

        // 4. Blockquote / Alert Callout
        if (trimmed.startsWith(">")) {
          const quoteText = trimmed.replace(/^>\s*/gm, "");
          const isWarning = /alert|warning|critical|danger|urgent/i.test(quoteText);
          const isSuccess = /success|good|optimal|stocked/i.test(quoteText);
          return (
            <div
              key={bIdx}
              className={`p-3 rounded-xl border flex items-start gap-2.5 my-2 ${
                isWarning
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
                  : isSuccess
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                  : "bg-violet-500/10 border-violet-500/30 text-violet-900 dark:text-violet-200"
              }`}
            >
              {isWarning ? (
                <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              ) : isSuccess ? (
                <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Sparkles size={15} className="text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
              )}
              <div className="text-xs font-medium leading-relaxed">{formatInline(quoteText, onActionClick)}</div>
            </div>
          );
        }

        // 5. Unordered or Ordered List items
        const lines = trimmed.split("\n");
        const isList = lines.every((l) => /^[-*•]\s+/.test(l) || /^\d+\.\s+/.test(l));
        if (isList) {
          return (
            <ul key={bIdx} className="space-y-1.5 my-1.5 pl-1">
              {lines.map((line, lIdx) => {
                const clean = line.replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, "");
                return (
                  <li key={lIdx} className="flex items-start gap-2 text-xs sm:text-[12.5px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0 mt-1.5" />
                    <span className="flex-1 text-zinc-700 dark:text-zinc-300">{formatInline(clean, onActionClick)}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        // 6. Regular Paragraph
        return (
          <p key={bIdx} className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {formatInline(trimmed, onActionClick)}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Inline formatting for bold, italic, code, and clickable tags
 */
function formatInline(text, onActionClick) {
  if (!text) return "";

  // Split by bold **text**, code `text`, and custom action tags [Action]
  const parts = [];
  let remaining = text;
  let keyIdx = 0;

  // Regex matches **bold**, `code`, *italic*
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let match;
  let lastIdx = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.substring(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      const boldText = token.slice(2, -2);
      parts.push(
        <strong key={`b-${keyIdx++}`} className="font-extrabold text-zinc-900 dark:text-white">
          {boldText}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      const codeText = token.slice(1, -1);
      parts.push(
        <code
          key={`c-${keyIdx++}`}
          className="px-1.5 py-0.5 rounded-md bg-zinc-200/80 dark:bg-zinc-800 text-violet-700 dark:text-violet-300 font-mono text-[11px] font-bold"
        >
          {codeText}
        </code>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      const italicText = token.slice(1, -1);
      parts.push(
        <em key={`i-${keyIdx++}`} className="italic text-zinc-600 dark:text-zinc-400">
          {italicText}
        </em>
      );
    }
    lastIdx = pattern.lastIndex;
  }

  if (lastIdx < text.length) {
    parts.push(text.substring(lastIdx));
  }

  return parts.length > 0 ? parts : text;
}

export default function AiCopilotDrawer({ open, onClose }) {
  const { push } = useToast();
  const [messages, setMessages] = useState(() => {
    return [
      {
        id: "welcome",
        role: "assistant",
        content:
          "👋 **Welcome to Stockly AI Copilot!**\n\nI am connected live to your warehouse inventory, catalog, valuation metrics, and transaction ledgers. How can I assist your operations today?\n\n*Choose a suggestion chip below or ask any question!*",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        model: "DeepSeek V3",
      },
    ];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [aiSettings, setAiSettings] = useState(getStoredAiSettings());
  const [activeCategory, setActiveCategory] = useState("all");
  const [speakingId, setSpeakingId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const speechRecognitionRef = useRef(null);

  // Auto focus & scroll
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

  // Setup Web Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onresult = (e) => {
          const transcript = e.results[0]?.[0]?.transcript;
          if (transcript) {
            setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
            hapticSuccess();
          }
          setIsListening(false);
        };

        recognition.onerror = () => {
          setIsListening(false);
          hapticWarning();
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        speechRecognitionRef.current = recognition;
      }
    }

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleVoiceInput = () => {
    if (!speechRecognitionRef.current) {
      push?.("Speech recognition is not supported on this browser", "warning");
      return;
    }

    if (isListening) {
      speechRecognitionRef.current.stop();
      setIsListening(false);
      hapticLight();
    } else {
      try {
        speechRecognitionRef.current.start();
        setIsListening(true);
        hapticMedium();
        push?.("Listening… Speak your prompt", "info");
      } catch {
        setIsListening(false);
      }
    }
  };

  const handleSpeak = (text, id) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      hapticLight();
      return;
    }

    window.speechSynthesis.cancel();
    // Clean markdown symbols for natural speech
    const cleanText = text
      .replace(/[#*`_~[\]]/g, "")
      .replace(/\|/g, " ")
      .replace(/https?:\/\/\S+/g, "");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(id);
    hapticMedium();
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    hapticLight();
    playClickSound();

    const userMsg = {
      id: String(Date.now()),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

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
          model: res.model || aiSettings.model || "Opencode",
          provider: res.provider || "Stockly AI",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, botMsg]);
        hapticSuccess();
        playScanSound();
      } else {
        throw new Error(res?.message || "Failed to get AI response");
      }
    } catch (err) {
      const errorMsg = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: `❌ **Error:** ${
          err.message || "Failed to connect to AI service. Please check your Opencode API key in Settings."
        }`,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
      hapticWarning();
      playErrorSound();
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    hapticLight();
    push?.("Copied message to clipboard", "success");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setSpeakingId(null);
    hapticMedium();
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "👋 **Conversation reset.** Ask me anything about stock movements, minimum threshold warnings, catalog valuation, or warehouse forecasts!",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        model: "DeepSeek V3",
      },
    ]);
    push?.("Chat history cleared", "info");
  };

  const handleExportChat = () => {
    const transcript = messages
      .map((m) => `### ${m.role === "assistant" ? "🤖 Stockly AI Copilot" : "👤 User"} (${m.timestamp || ""})\n${m.content}\n`)
      .join("\n---\n\n");

    const blob = new Blob([`# Stockly AI Copilot Session Transcript\n*Exported on ${new Date().toLocaleString()}*\n\n${transcript}`], {
      type: "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stockly-ai-session-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    hapticSuccess();
    push?.("Chat transcript exported", "success");
  };

  const handleSaveSettings = () => {
    saveStoredAiSettings(aiSettings);
    setShowConfig(false);
    hapticSuccess();
    push?.("Opencode AI configuration updated", "success");
  };

  if (!open) return null;

  const currentPrompts = CATEGORIZED_PROMPTS[activeCategory] || CATEGORIZED_PROMPTS.all;

  return (
    <div className="fixed inset-0 z-50 flex justify-end select-none" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-zinc-950/70 backdrop-blur-md animate-fade-in transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Full Height Sheet / Drawer */}
      <div
        className={`relative w-full ${
          isFullscreen ? "sm:w-full" : "sm:w-[540px] xl:w-[580px]"
        } bg-white dark:bg-zinc-950 h-full flex flex-col shadow-2xl border-l border-zinc-200/80 dark:border-zinc-800/90 z-10 animate-slide-up sm:animate-sheet-up transition-all duration-300`}
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* 1. TOP APP BAR / CHATBOT HEADER */}
        <div className="p-3.5 sm:p-4 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-3 shrink-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl">
          {/* Brand & Live Status */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-500 text-white grid place-items-center shadow-md shadow-violet-500/25 shrink-0 relative">
              <Sparkles size={18} className="animate-pulse" />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-950" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-zinc-900 dark:text-white tracking-tight truncate">
                  Stockly AI Copilot
                </span>
                <span className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-[10px] font-extrabold uppercase tracking-wide shrink-0">
                  Opencode Live
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Live Warehouse Sync
                </span>
                <span>•</span>
                <span className="truncate font-mono">{aiSettings.model?.split("/")[1] || "deepseek-chat"}</span>
              </div>
            </div>
          </div>

          {/* Header Action Controls */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Fullscreen toggle on desktop */}
            <button
              onClick={() => {
                setIsFullscreen((v) => !v);
                hapticLight();
              }}
              className="hidden sm:grid w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 place-items-center active:scale-95 transition"
              title={isFullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>

            {/* Export Chat */}
            <button
              onClick={handleExportChat}
              className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 grid place-items-center active:scale-95 transition"
              title="Export Conversation (.md)"
            >
              <Download size={14} />
            </button>

            {/* Model & API Settings */}
            <button
              onClick={() => {
                setShowConfig(true);
                hapticLight();
              }}
              className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 grid place-items-center active:scale-95 transition"
              title="Configure AI Models & Keys"
            >
              <Settings2 size={15} />
            </button>

            {/* Clear Chat */}
            <button
              onClick={handleClear}
              className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 grid place-items-center active:scale-95 transition"
              title="Clear Chat History"
            >
              <Trash2 size={14} />
            </button>

            {/* Close */}
            <button
              onClick={() => {
                if (window.speechSynthesis) window.speechSynthesis.cancel();
                onClose();
              }}
              className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 grid place-items-center active:scale-95 transition ml-0.5"
              aria-label="Close Copilot"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 2. LIVE DATA TICKER BANNER */}
        <div className="px-4 py-2 bg-gradient-to-r from-violet-600/10 via-indigo-600/10 to-purple-600/10 border-b border-violet-500/15 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-violet-800 dark:text-violet-300 min-w-0">
            <Zap size={13} className="text-violet-600 dark:text-violet-400 shrink-0" />
            <span className="truncate">Active Knowledge: Products Catalog, Quantities, Min Alerts & Transactions</span>
          </div>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-600 text-white shrink-0">
            Realtime
          </span>
        </div>

        {/* 3. MESSAGE STREAM VIEWPORT */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 sm:space-y-5 overscroll-contain selection:bg-violet-500/20">
          {messages.map((m) => {
            const isBot = m.role === "assistant";
            const isSpeaking = speakingId === m.id;

            return (
              <div
                key={m.id}
                className={`flex gap-2.5 sm:gap-3 ${isBot ? "items-start" : "items-end flex-row-reverse"}`}
              >
                {/* Avatar Badge */}
                <div
                  className={`w-8 h-8 rounded-2xl grid place-items-center text-xs shrink-0 font-extrabold shadow-sm ${
                    isBot
                      ? "bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-violet-500/20"
                      : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                  }`}
                >
                  {isBot ? <Bot size={15} /> : <User size={15} />}
                </div>

                {/* Message Bubble Container */}
                <div className={`relative group max-w-[88%] sm:max-w-[82%] space-y-1`}>
                  {/* Sender Meta Info */}
                  <div className={`flex items-center gap-2 text-[10.5px] text-zinc-400 px-1 ${isBot ? "justify-start" : "justify-end"}`}>
                    <span className="font-bold">{isBot ? "Stockly Copilot" : "You"}</span>
                    <span>•</span>
                    <span>{m.timestamp || ""}</span>
                  </div>

                  {/* Bubble Content */}
                  <div
                    className={`rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 text-xs sm:text-[13px] select-text shadow-sm transition-all ${
                      isBot
                        ? m.isError
                          ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/20"
                          : "bg-zinc-50 dark:bg-zinc-900/90 text-zinc-800 dark:text-zinc-100 border border-zinc-200/90 dark:border-zinc-800"
                        : "bg-gradient-to-br from-zinc-900 to-zinc-800 dark:from-white dark:to-zinc-100 text-white dark:text-zinc-900 font-medium border border-transparent shadow-md"
                    }`}
                  >
                    {isBot ? (
                      <MarkdownContent content={m.content} />
                    ) : (
                      <div className="whitespace-pre-wrap break-words">{m.content}</div>
                    )}
                  </div>

                  {/* Assistant Message Tool Suite (Copy, Text-to-Speech, Model info) */}
                  {isBot && !m.isError && (
                    <div className="flex items-center gap-1 pt-0.5 px-1">
                      {/* Copy */}
                      <button
                        onClick={() => handleCopy(m.content, m.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                        title="Copy message text"
                      >
                        {copiedId === m.id ? (
                          <>
                            <Check size={11} className="text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      {/* Text-to-Speech (Read Aloud) */}
                      <button
                        onClick={() => handleSpeak(m.content, m.id)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition ${
                          isSpeaking
                            ? "bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 animate-pulse"
                            : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        }`}
                        title={isSpeaking ? "Stop speaking" : "Listen aloud"}
                      >
                        {isSpeaking ? <VolumeX size={11} /> : <Volume2 size={11} />}
                        <span>{isSpeaking ? "Speaking…" : "Read Aloud"}</span>
                      </button>

                      {/* Model signature tag */}
                      {m.model && (
                        <span className="text-[10px] text-zinc-400 font-mono ml-auto">
                          {m.model.includes("/") ? m.model.split("/")[1] : m.model}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing / Thinking Indicator */}
          {loading && (
            <div className="flex gap-2.5 sm:gap-3 items-center animate-fadeIn">
              <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white grid place-items-center text-xs shrink-0 shadow-md shadow-violet-500/20">
                <Bot size={15} />
              </div>
              <div className="px-4 py-3 rounded-2xl sm:rounded-3xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 flex items-center gap-2 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-violet-600 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.15s]" />
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce [animation-delay:0.3s]" />
                <span className="text-xs text-zinc-600 dark:text-zinc-300 font-semibold ml-1">
                  Synthesizing warehouse intelligence…
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 4. PROMPT SUGGESTION CATEGORIES & CHIPS */}
        <div className="border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/90 dark:bg-zinc-900/60 p-2.5 sm:p-3 space-y-2 shrink-0">
          {/* Category Tabs */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {PROMPT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  hapticLight();
                }}
                className={`whitespace-nowrap px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all duration-150 ${
                  activeCategory === cat.id
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs scale-[1.02]"
                    : "bg-white dark:bg-zinc-800/90 text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-zinc-700/80 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Quick Prompts Horizontal Carousel */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {currentPrompts.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                disabled={loading}
                className="whitespace-nowrap px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200/90 dark:border-zinc-700/80 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400 active:scale-95 transition shrink-0 shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles size={11} className="text-violet-500 shrink-0" />
                <span>{q}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 5. TACTILE INPUT SUITE & VOICE DICTATION */}
        <div className="p-3 sm:p-4 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            {/* Voice Input Mic Button */}
            <button
              type="button"
              onClick={toggleVoiceInput}
              className={`w-11 h-11 rounded-2xl grid place-items-center transition shrink-0 shadow-sm ${
                isListening
                  ? "bg-red-500 text-white animate-pulse ring-4 ring-red-500/25"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95"
              }`}
              title={isListening ? "Listening… tap to stop" : "Voice dictation (Speak prompt)"}
              aria-label="Voice input"
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            {/* Prompt Text Input */}
            <div className="relative flex-1">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? "Listening to your voice…" : "Ask Stockly Copilot anything about inventory…"}
                className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs sm:text-sm font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition shadow-inner min-h-[44px]"
                disabled={loading}
              />
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white grid place-items-center shadow-md shadow-violet-600/25 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition shrink-0"
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>

      {/* 6. AI PROVIDER & MODEL CONFIGURATION MODAL */}
      <Modal
        open={showConfig}
        onClose={() => setShowConfig(false)}
        title="AI Copilot Model & API Configuration"
        description="Connect Opencode, OpenRouter, DeepSeek, or custom OpenAI-compatible endpoints"
        size="md"
      >
        <div className="space-y-4 pt-1">
          {/* Preset Model Selector Grid */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
              Select AI Model
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {POPULAR_MODELS.map((m) => {
                const isSelected = aiSettings.model === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setAiSettings({ ...aiSettings, model: m.id });
                      hapticLight();
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? "bg-violet-50 dark:bg-violet-500/15 border-violet-500 ring-2 ring-violet-500/20"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-zinc-900 dark:text-white">{m.name}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                        {m.tag}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono mt-1">{m.id}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* API Key Input */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              API Key (Opencode / OpenRouter / Custom)
            </label>
            <input
              type="password"
              value={aiSettings.apiKey || ""}
              onChange={(e) => setAiSettings({ ...aiSettings, apiKey: e.target.value })}
              placeholder="sk-or-v1-..."
              className="input-field h-11 text-xs font-mono"
            />
            <p className="text-[10.5px] text-zinc-400 mt-1">
              Leave blank to use default server-configured Opencode environment credentials.
            </p>
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              Custom API Base URL
            </label>
            <input
              value={aiSettings.baseURL || ""}
              onChange={(e) => setAiSettings({ ...aiSettings, baseURL: e.target.value })}
              placeholder="https://api.opencode.ai/v1"
              className="input-field h-11 text-xs font-mono"
            />
          </div>

          {/* Custom Model String */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              Custom Model Identifier
            </label>
            <input
              value={aiSettings.model || ""}
              onChange={(e) => setAiSettings({ ...aiSettings, model: e.target.value })}
              placeholder="deepseek/deepseek-chat"
              className="input-field h-11 text-xs font-mono"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowConfig(false)}
              className="flex-1 min-h-[44px]"
            >
              Cancel
            </Button>
            <button
              type="button"
              onClick={handleSaveSettings}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-xs shadow-md shadow-violet-500/25 active:scale-95 transition flex items-center justify-center gap-1.5"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
