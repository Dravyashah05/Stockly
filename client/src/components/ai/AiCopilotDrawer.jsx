import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Bot,
  Trash2,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Download,
  CheckCircle2,
  AlertTriangle,
  Package,
  ArrowUp,
  MoreHorizontal,
  Sparkles,
  Plus,
} from "lucide-react";
import { chatCopilot, getStoredAiSettings, saveStoredAiSettings, getRestockForecast } from "../../api/ai";
import { useToast } from "../../context/ToastContext";
import { playScanSound, playSuccessSound, playErrorSound, playClickSound } from "../../utils/sound";
import { hapticLight, hapticMedium, hapticSuccess, hapticWarning } from "../../utils/haptics";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

const PROMPT_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "alerts", label: "Low stock" },
  { id: "valuation", label: "Valuation" },
  { id: "movements", label: "Ledger" },
  { id: "forecast", label: "Forecast" },
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
    <div className="space-y-3 text-[14px] leading-relaxed break-words">
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
                  : "bg-zinc-500/10 border-zinc-500/25 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              {isWarning ? (
                <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              ) : isSuccess ? (
                <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Bot size={15} className="text-zinc-500 dark:text-zinc-400 shrink-0 mt-0.5" />
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
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 shrink-0 mt-1.5" />
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
          className="px-1.5 py-0.5 rounded-md bg-zinc-200/70 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono text-[11px] font-semibold"
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
          "Welcome to Stockly AI.\n\nI'm connected to your inventory, catalog, valuation metrics, and transaction ledger. Ask me anything, or try a suggestion below.",
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const speechRecognitionRef = useRef(null);

  // Close the header menu on outside tap
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

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

  // Autogrow the composer
  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 140) + "px";
    }
  }, [input, open]);

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
    setShowSuggestions(false);
    setMenuOpen(false);

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
        content: `Something went wrong: ${
          err.message || "Could not reach the AI service. Check your API key in Settings."
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
    setShowSuggestions(true);
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Conversation reset. Ask me about stock movements, low-stock warnings, valuation, or forecasts.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        model: "DeepSeek V3",
      },
    ]);
    push?.("Chat history cleared", "info");
  };

  const handleExportChat = () => {
    const transcript = messages
      .map((m) => `### ${m.role === "assistant" ? "Assistant" : "User"} (${m.timestamp || ""})\n${m.content}\n`)
      .join("\n---\n\n");

    const blob = new Blob([`# Stockly AI Session Transcript\n*Exported on ${new Date().toLocaleString()}*\n\n${transcript}`], {
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
  const isFresh = messages.length <= 1;

  return (
    <div className="fixed inset-0 z-50 flex justify-end select-none" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-zinc-950/70 backdrop-blur-md animate-fade-in transition-opacity"
        onClick={onClose}
      />

      {/* Chat panel */}
      <div
        className="relative w-full sm:w-[560px] xl:w-[600px] bg-white dark:bg-zinc-950 h-full flex flex-col shadow-2xl border-l border-zinc-200 dark:border-zinc-800 z-10 animate-slide-in-right"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Minimal header */}
        <div className="px-2.5 py-2 flex items-center gap-1 shrink-0">
          <button
            onClick={() => {
              if (window.speechSynthesis) window.speechSynthesis.cancel();
              onClose();
            }}
            className="w-9 h-9 grid place-items-center rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition shrink-0"
            aria-label="Close Stockly AI"
          >
            <X size={19} />
          </button>

          <button
            onClick={() => {
              setShowConfig(true);
              hapticLight();
            }}
            className="flex-1 min-w-0 flex flex-col items-center px-2 py-0.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/70 active:scale-[0.99] transition"
            title="Model settings"
          >
            <span className="text-[15px] font-bold tracking-tight text-zinc-900 dark:text-white leading-tight">
              Stockly AI
            </span>
            <span className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="truncate">{aiSettings.model ? aiSettings.model.split("/").pop() : "Live"}</span>
            </span>
          </button>

          <button
            onClick={handleClear}
            className="w-9 h-9 grid place-items-center rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition shrink-0"
            title="New chat"
            aria-label="New chat"
          >
            <Plus size={19} />
          </button>

          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => {
                setMenuOpen((v) => !v);
                hapticLight();
              }}
              className="w-9 h-9 grid place-items-center rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition"
              title="More options"
              aria-label="More options"
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-11 w-48 card p-1.5 shadow-xl z-30 animate-scale-in">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    handleExportChat();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-left"
                >
                  <Download size={15} className="text-zinc-400" /> Export chat
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    handleClear();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition text-left"
                >
                  <Trash2 size={15} /> Clear chat
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Conversation */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {isFresh ? (
            /* Hero empty state */
            <div className="min-h-full flex flex-col items-center justify-center text-center px-6 py-8 w-full max-w-md mx-auto">
              <span className="w-14 h-14 rounded-[18px] bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 grid place-items-center shadow-sm">
                <Bot size={26} />
              </span>
              <h2 className="mt-4 text-[22px] font-bold tracking-tight text-zinc-900 dark:text-white">
                How can I help?
              </h2>
              <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-400">
                Live answers from your inventory, ledger and valuation.
              </p>

              {showSuggestions && (
                <div className="w-full mt-6 animate-fade-in">
                  <div className="flex gap-1.5 justify-center overflow-x-auto no-scrollbar pb-2.5">
                    {PROMPT_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setActiveCategory(cat.id);
                          hapticLight();
                        }}
                        className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold transition shrink-0 ${
                          activeCategory === cat.id
                            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {currentPrompts.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(q)}
                        disabled={loading}
                        className="text-left p-3.5 rounded-2xl bg-zinc-100/70 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 text-[13px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.98] transition disabled:opacity-50 leading-snug"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Thread */
            <div className="px-4 sm:px-6 py-5 space-y-6 w-full max-w-2xl mx-auto">
              {messages
                .filter((m) => m.id !== "welcome")
                .map((m) => {
                  const isBot = m.role === "assistant";
                  const isSpeaking = speakingId === m.id;

                  if (!isBot) {
                    return (
                      <div key={m.id} className="flex justify-end">
                        <div className="max-w-[85%] px-4 py-2.5 rounded-[20px] bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[15px] leading-snug whitespace-pre-wrap break-words">
                          {m.content}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={m.id} className="flex gap-2.5">
                      <span className="w-7 h-7 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 grid place-items-center shrink-0 mt-0.5">
                        <Bot size={14} />
                      </span>
                      <div className="flex-1 min-w-0">
                        {m.isError ? (
                          <div className="px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 text-sm">
                            {m.content}
                          </div>
                        ) : (
                          <MarkdownContent content={m.content} />
                        )}
                        {!m.isError && (
                          <div className="flex items-center gap-0.5 mt-1.5">
                            <button
                              onClick={() => handleCopy(m.content, m.id)}
                              className="w-7 h-7 grid place-items-center rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition"
                              title="Copy"
                              aria-label="Copy message"
                            >
                              {copiedId === m.id ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                            </button>
                            <button
                              onClick={() => handleSpeak(m.content, m.id)}
                              className={`w-7 h-7 grid place-items-center rounded-full active:scale-95 transition ${
                                isSpeaking
                                  ? "text-zinc-900 dark:text-white animate-pulse"
                                  : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              }`}
                              title={isSpeaking ? "Stop" : "Read aloud"}
                              aria-label="Read aloud"
                            >
                              {isSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
                            </button>
                            {m.model && (
                              <span className="text-[10px] text-zinc-400 ml-1.5">
                                {m.model.includes("/") ? m.model.split("/")[1] : m.model}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

              {loading && (
                <div className="flex gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 grid place-items-center shrink-0">
                    <Bot size={14} />
                  </span>
                  <div className="flex items-center gap-1.5 pt-2.5">
                    <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce" />
                    <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:0.15s]" />
                    <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:0.3s]" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="shrink-0 px-3 sm:px-6 pt-1">
          <div className="w-full max-w-2xl mx-auto">
            {showSuggestions && !isFresh && (
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2">
                {currentPrompts.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(q)}
                    disabled={loading}
                    className="whitespace-nowrap px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800/80 text-xs text-zinc-600 dark:text-zinc-300 active:scale-95 transition shrink-0 disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              <div className="rounded-[26px] border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm focus-within:border-zinc-400 dark:focus-within:border-zinc-500 transition">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={1}
                  placeholder={isListening ? "Listening…" : "Ask anything"}
                  className="w-full bg-transparent px-4 pt-3.5 pb-1 text-[15px] text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none resize-none leading-snug"
                  disabled={loading}
                />
                <div className="flex items-center gap-0.5 px-2.5 pb-2.5">
                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    className={`w-9 h-9 rounded-full grid place-items-center transition shrink-0 active:scale-95 ${
                      isListening
                        ? "bg-red-500 text-white animate-pulse"
                        : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                    title={isListening ? "Stop listening" : "Voice input"}
                    aria-label="Voice input"
                  >
                    {isListening ? <MicOff size={17} /> : <Mic size={17} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSuggestions((v) => !v);
                      hapticLight();
                    }}
                    className={`w-9 h-9 rounded-full grid place-items-center transition shrink-0 active:scale-95 ${
                      showSuggestions
                        ? "text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800"
                        : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                    title="Suggestions"
                    aria-label="Toggle suggestions"
                  >
                    <Sparkles size={16} />
                  </button>
                  <span className="flex-1" />
                  <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="w-9 h-9 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 grid place-items-center shrink-0 active:scale-90 transition disabled:opacity-20"
                    aria-label="Send message"
                  >
                    <ArrowUp size={17} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
              <p className="text-center text-[10px] text-zinc-400 dark:text-zinc-500 py-2">
                Stockly AI can make mistakes — verify stock before dispatch.
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* 4. Model configuration */}
      <Modal
        open={showConfig}
        onClose={() => setShowConfig(false)}
        title="AI model & API"
        description="Connect Opencode, OpenRouter, DeepSeek, or custom OpenAI-compatible endpoints"
        size="md"
      >
        <div className="space-y-4 pt-1">
          <div>
            <label className="input-label">Model</label>
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
                    className={`p-3 rounded-2xl border text-left transition ${
                      isSelected
                        ? "bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-bold text-xs ${isSelected ? "text-white dark:text-zinc-900" : "text-zinc-900 dark:text-white"}`}
                      >
                        {m.name}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${
                          isSelected
                            ? "bg-white/20 dark:bg-zinc-900/10 text-white dark:text-zinc-900"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                        }`}
                      >
                        {m.tag}
                      </span>
                    </div>
                    <div
                      className={`text-[11px] font-mono mt-1 truncate ${isSelected ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400"}`}
                    >
                      {m.id}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="input-label">API key</label>
            <input
              type="password"
              value={aiSettings.apiKey || ""}
              onChange={(e) => setAiSettings({ ...aiSettings, apiKey: e.target.value })}
              placeholder="sk-or-v1-..."
              className="input-field font-mono text-xs"
            />
            <p className="text-xs text-zinc-400 mt-1.5">
              Leave blank to use the server-configured credentials.
            </p>
          </div>

          <div>
            <label className="input-label">Custom API base URL</label>
            <input
              value={aiSettings.baseURL || ""}
              onChange={(e) => setAiSettings({ ...aiSettings, baseURL: e.target.value })}
              placeholder="https://api.opencode.ai/v1"
              className="input-field font-mono text-xs"
            />
          </div>

          <div>
            <label className="input-label">Custom model identifier</label>
            <input
              value={aiSettings.model || ""}
              onChange={(e) => setAiSettings({ ...aiSettings, model: e.target.value })}
              placeholder="deepseek/deepseek-chat"
              className="input-field font-mono text-xs"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={() => setShowConfig(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} className="flex-1">
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
