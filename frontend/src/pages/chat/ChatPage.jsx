import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Send, Sparkles, BookOpen, RotateCcw, WifiOff, Languages, Copy, Check, Pencil, Mic, MicOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useWebSocket } from "../../hooks/useWebSocket";
import { clearChatHistory } from "../../api/chat";
import { Skeleton } from "../../components/ui/Skeleton";

// The backend's detect_language_override() only recognizes these three —
// it's a plain keyword check on the message text (see groq_utils.py), not
// tied to the site's 8-language UI switcher at all. Sending one of these
// exact trigger phrases as a real chat message is the only thing that
// actually changes what language the agent replies in.
const REPLY_LANGUAGES = [
  { code: "English", label: "English", trigger: "Reply in English" },
  { code: "Telugu", label: "తెలుగు", trigger: "Reply in Telugu" },
  { code: "Hindi", label: "हिन्दी", trigger: "Reply in Hindi" },
];

// BCP-47 locale per reply language, for the Web Speech API — matching the
// language the farmer is currently getting replies in gives noticeably
// better recognition accuracy than always using one fixed locale.
const SPEECH_LOCALES = { English: "en-IN", Telugu: "te-IN", Hindi: "hi-IN" };

const SpeechRecognitionAPI =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

// One bubble — user messages right-aligned/filled, assistant left-aligned/
// outlined. Assistant replies that used RAG document search show which
// documents backed the answer, since the backend already tells us. A
// small action row under each bubble offers copy (everyone) and edit +
// resend (user messages only — re-sends as a new message rather than
// mutating stored history, which keeps the backend contract unchanged).
function MessageBubble({ message, t, onEdit }) {
  const isUser = message.role === "user";
  const isError = !!message.isError;
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API blocked/unavailable — not critical, just no feedback.
    }
  }

  return (
    <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[85%] md:max-w-[65%] rounded-md px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-primary text-white"
            : isError
              ? "bg-danger-tint border border-danger/30 text-danger"
              : "bg-surface border border-border text-ink"
        }`}
      >
        {message.content}
        {message.usedRag && message.sources?.length > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-border/70 flex flex-wrap items-center gap-1.5">
            <BookOpen size={12} className="text-accent shrink-0" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              {t("chat.groundedIn")}
            </span>
            {message.sources.map((s) => (
              <span key={s} className="text-[11px] px-1.5 py-0.5 rounded-sm bg-accent-tint text-accent font-medium">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className={`flex items-center gap-3 px-1 ${isUser ? "flex-row-reverse" : ""}`}>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-ink-soft hover:text-ink transition-colors duration-150"
        >
          {copied ? <Check size={12} className="text-accent" /> : <Copy size={12} />}
          {copied ? t("chat.copied") : t("chat.copy")}
        </button>
        {isUser && (
          <button
            type="button"
            onClick={() => onEdit(message.content)}
            className="flex items-center gap-1 text-[11px] text-ink-soft hover:text-ink transition-colors duration-150"
          >
            <Pencil size={12} />
            {t("chat.edit")}
          </button>
        )}
      </div>
    </div>
  );
}

// Three-dot "the agent is reasoning/calling tools" indicator — shown between
// sending a question and getting a reply back over the socket.
function ThinkingBubble({ t }) {
  return (
    <div className="flex justify-start">
      <div className="bg-surface border border-border rounded-md px-4 py-3 flex items-center gap-1.5">
        <span className="sr-only">{t("chat.thinking")}</span>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-ink-soft/50 animate-bounce"
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { messages, status, thinking, meta, sendMessage, reconnect, clearMessages } = useWebSocket(user?.username);
  const [input, setInput] = useState("");
  const [replyLang, setReplyLang] = useState("English");
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  // The "connected" greeting tells us what language the session actually
  // started in (from the farmer's saved profile) — sync the dropdown to it.
  useEffect(() => {
    if (meta?.language) setReplyLang(meta.language);
  }, [meta]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  // Stop any in-progress recognition if the farmer navigates away mid-listen.
  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  function handleSend(e) {
    e.preventDefault();
    if (sendMessage(input)) setInput("");
  }

  function handleLanguageChange(e) {
    const target = REPLY_LANGUAGES.find((l) => l.code === e.target.value);
    if (!target || status !== "open") return;
    setReplyLang(target.code); // optimistic — confirmed by the agent's next reply
    sendMessage(target.trigger);
  }

  // Edit & resend — loads a past message of yours back into the input
  // instead of mutating stored chat history, which keeps the backend's
  // history contract (and the agent's own memory of the conversation)
  // exactly as-is; this only ever adds a new message, never rewrites one.
  function handleEditMessage(content) {
    setInput(content);
    inputRef.current?.focus();
  }

  function toggleVoiceInput() {
    if (!SpeechRecognitionAPI || status !== "open") return;

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = SPEECH_LOCALES[replyLang] || "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }

  async function handleClear() {
    if (!user?.username) return;
    try {
      await clearChatHistory(user.username);
    } catch {
      // Not critical if this fails — the visible chat still clears below.
    }
    clearMessages();
  }

  const isDisconnected = status === "closed" || status === "error";

  return (
    <div className="flex flex-col h-[calc(100dvh-132px)] md:h-[calc(100dvh-68px)] -mb-20 md:mb-0">
      <div className="flex items-center justify-between gap-3 px-5 md:px-8 py-4 border-b border-border bg-surface shrink-0">
        <div className="min-w-0">
          <h1 className="font-display text-lg font-bold text-ink flex items-center gap-2">
            <Sparkles size={18} className="text-primary shrink-0" />
            {t("chat.title")}
          </h1>
          <p className="text-xs text-ink-soft mt-0.5">{t("chat.subtitle")}</p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="relative inline-flex items-center">
            <Languages size={13} className="absolute left-2.5 text-ink-soft pointer-events-none" />
            <select
              aria-label={t("chat.replyLanguage")}
              value={replyLang}
              onChange={handleLanguageChange}
              disabled={status !== "open"}
              className="appearance-none bg-transparent border border-border rounded-sm pl-7 pr-2.5 py-1.5 text-[12px] font-medium text-ink cursor-pointer hover:border-ink-soft transition-colors duration-150 focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {REPLY_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          {isDisconnected ? (
            <button
              type="button"
              onClick={reconnect}
              className="flex items-center gap-1.5 text-xs font-semibold text-danger"
            >
              <WifiOff size={14} /> {t("chat.reconnect")}
            </button>
          ) : (
            <span className={`text-xs font-medium ${status === "open" ? "text-accent" : "text-ink-soft"}`}>
              {status === "open" ? t("chat.online") : t("chat.connecting")}
            </span>
          )}
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-danger transition-colors duration-150"
          >
            <RotateCcw size={14} /> {t("chat.clear")}
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-5 flex flex-col gap-3">
        {messages.length === 0 && status === "connecting" ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-14 w-2/3" />
            <Skeleton className="h-10 w-1/3 self-end" />
            <Skeleton className="h-16 w-3/4" />
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} t={t} onEdit={handleEditMessage} />)
        )}
        {thinking && <ThinkingBubble t={t} />}
      </div>

      <form
        onSubmit={handleSend}
        className="flex items-center gap-2.5 px-4 md:px-8 py-3.5 border-t border-border bg-surface shrink-0"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("chat.placeholder")}
          disabled={status !== "open"}
          className="flex-1 rounded-sm border border-border bg-bg px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-soft/60 focus:border-primary focus:outline-none transition-colors duration-150 disabled:opacity-60"
        />
        {SpeechRecognitionAPI && (
          <button
            type="button"
            onClick={toggleVoiceInput}
            disabled={status !== "open"}
            title={isListening ? t("chat.listening") : t("chat.voiceInput")}
            className={`shrink-0 w-11 h-11 rounded-sm border flex items-center justify-center transition-all duration-200 ease-out-expo active:scale-[0.97] disabled:opacity-40 ${
              isListening
                ? "bg-danger text-white border-danger animate-pulse"
                : "bg-surface text-ink-soft border-border hover:text-ink hover:border-ink-soft"
            }`}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        )}
        <button
          type="submit"
          disabled={status !== "open" || !input.trim()}
          className="shrink-0 w-11 h-11 rounded-sm bg-primary text-white flex items-center justify-center hover:bg-primary-dark transition-all duration-200 ease-out-expo active:scale-[0.97] disabled:opacity-40 disabled:hover:bg-primary"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}