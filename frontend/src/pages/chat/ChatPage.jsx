import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Send, Sparkles, BookOpen, RotateCcw, WifiOff, Copy, Check, Pencil,
  Mic, MicOff, Paperclip, Volume2, VolumeX, Sprout, Leaf, X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useWebSocket } from "../../hooks/useWebSocket";
import { clearChatHistory, transcribeAudio, synthesizeSpeech } from "../../api/chat";
import { classifySoil, detectDisease } from "../../api/vision";
import { translateSoilType } from "../../utils/soilTypeLabel";
import { Skeleton } from "../../components/ui/Skeleton";

// The disease-detection ML model returns fertilizer as a structured object
// ({applicable, name, method, related_fertilizers: [{name, reason}]} when
// applicable, or {applicable: false, note} when not) — never a plain
// string. Passing it straight into an i18next template stringifies it to
// literal "[object Object]"; this turns it into a readable sentence.
function formatFertilizer(fert) {
  if (!fert || !fert.applicable) {
    return fert?.note || "No fertilizer recommendation for this condition.";
  }
  const parts = [fert.name].filter(Boolean);
  if (fert.method) parts.push(fert.method);
  if (Array.isArray(fert.related_fertilizers) && fert.related_fertilizers.length) {
    const options = fert.related_fertilizers
      .filter((r) => r?.name)
      .map((r) => (r.reason ? `${r.name} (${r.reason})` : r.name))
      .join("; ");
    if (options) parts.push(`Options: ${options}`);
  }
  return parts.join(" ");
}

const canRecordAudio =
  typeof window !== "undefined" && !!navigator.mediaDevices && typeof window.MediaRecorder !== "undefined";

// One bubble — user messages right-aligned/filled, assistant left-aligned/
// outlined. Assistant replies that used RAG document search show which
// documents backed the answer. Photo-analysis exchanges (soil/disease) get
// an image thumbnail on the user side and a structured result card on the
// assistant side instead of plain text.
function MessageBubble({ message, t, onEdit, onSpeak, speakingId, loadingSpeechId }) {
  const isUser = message.role === "user";
  const isError = !!message.isError;
  const [copied, setCopied] = useState(false);
  const isSpeakingThis = speakingId === message.id;
  const isLoadingSpeech = loadingSpeechId === message.id;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API blocked/unavailable — not critical, just no feedback.
    }
  }

  if (message.imageUrl) {
    return (
      <div className="flex justify-end">
        <img
          src={message.imageUrl}
          alt="Uploaded"
          className="max-w-[60%] md:max-w-[35%] rounded-md border border-border object-cover"
        />
      </div>
    );
  }

  const analysis = message.analysis;

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
        {analysis && (
          <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
            {analysis.kind === "soil" ? <Sprout size={12} /> : <Leaf size={12} />}
            {analysis.kind === "soil" ? t("chat.soilAnalysis") : t("chat.diseaseAnalysis")}
          </div>
        )}
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
        {!isUser && (
          <button
            type="button"
            onClick={() => onSpeak(message)}
            disabled={isLoadingSpeech}
            className={`flex items-center gap-1 text-[11px] transition-colors duration-150 disabled:opacity-50 ${
              isSpeakingThis ? "text-primary" : "text-ink-soft hover:text-ink"
            }`}
          >
            {isLoadingSpeech ? (
              <span className="w-3 h-3 rounded-full border-2 border-ink-soft/40 border-t-ink-soft animate-spin" />
            ) : isSpeakingThis ? (
              <VolumeX size={12} />
            ) : (
              <Volume2 size={12} />
            )}
            {isLoadingSpeech ? t("chat.readAloud") : isSpeakingThis ? t("chat.stopSpeaking") : t("chat.readAloud")}
          </button>
        )}
      </div>
    </div>
  );
}

// Three-dot "the agent is reasoning/calling tools" indicator — shown between
// sending a question and getting a reply back over the socket, and reused
// (with a different label) while a soil/disease photo is being analyzed.
function ThinkingBubble({ t, label }) {
  return (
    <div className="flex justify-start">
      <div className="bg-surface border border-border rounded-md px-4 py-3 flex items-center gap-2">
        {label && <span className="text-xs text-ink-soft">{label}</span>}
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
  const { messages, status, thinking, sendMessage, reconnect, clearMessages, addPhotoExchange } =
    useWebSocket(user?.username);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [analyzingKind, setAnalyzingKind] = useState(null); // null | "soil" | "disease"
  const [speakingId, setSpeakingId] = useState(null);
  const [loadingSpeechId, setLoadingSpeechId] = useState(null);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const pendingPhotoKindRef = useRef(null);
  const spokenIdsRef = useRef(new Set());
  const readyRef = useRef(false);
  const ttsAudioRef = useRef(null); // single reused <audio> element for playback
  const ttsCacheRef = useRef(new Map()); // messageId -> object URL, so re-tapping a message doesn't re-synthesize

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking, analyzingKind]);

  // Stop any in-progress recording/playback if the farmer navigates away,
  // and release the cached audio object URLs.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- these refs hold
  // imperative objects assigned after mount (recorder/audio), not DOM nodes,
  // so reading .current at cleanup time (not mount time) is intentional.
  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stream?.getTracks().forEach((tr) => tr.stop());
      ttsAudioRef.current?.pause();
      ttsCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Once the socket has moved past "idle" the initial history load has
  // already resolved (useWebSocket awaits it before connecting), so from
  // that point on any newly-appended assistant message is a genuinely new
  // reply — not part of the history batch — and is safe to auto-read aloud.
  useEffect(() => {
    if (status !== "idle") readyRef.current = true;
  }, [status]);

  useEffect(() => {
    if (!readyRef.current) {
      messages.forEach((m) => spokenIdsRef.current.add(m.id));
      return;
    }
    const last = messages[messages.length - 1];
    if (!last) return;
    if (last.role === "assistant" && !last.isError && !last.imageUrl && !spokenIdsRef.current.has(last.id)) {
      spokenIdsRef.current.add(last.id);
      speak(last);
    } else {
      spokenIdsRef.current.add(last.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Text-to-speech via the backend's edge-tts endpoint — real neural audio
  // generated server-side, so it sounds the same (and actually correct) on
  // every farmer's phone, instead of depending on which voices happen to be
  // installed locally the way the browser's speechSynthesis did.
  async function speak(message) {
    if (!ttsAudioRef.current) ttsAudioRef.current = new Audio();
    const audio = ttsAudioRef.current;
    audio.pause();
    setSpeakingId(null);

    let url = ttsCacheRef.current.get(message.id);
    if (!url) {
      setLoadingSpeechId(message.id);
      try {
        const blob = await synthesizeSpeech(message.content);
        url = URL.createObjectURL(blob);
        ttsCacheRef.current.set(message.id, url);
      } catch (err) {
        // FIX: previously caught with an empty `catch {}` — a fully broken
        // TTS backend (stale edge-tts install, blocked outbound network,
        // etc.) was indistinguishable from a harmless one-off network
        // blip, since nothing was ever logged. Logging the actual error
        // (check the browser console + Network tab on /chat/speak) is
        // what makes "read aloud does nothing" actually diagnosable.
        console.error("TTS synthesis failed:", err?.response?.data || err?.message || err);
        setLoadingSpeechId((id) => (id === message.id ? null : id));
        return;
      }
      setLoadingSpeechId((id) => (id === message.id ? null : id));
    }

    audio.src = url;
    audio.onplay = () => setSpeakingId(message.id);
    audio.onended = () => setSpeakingId((id) => (id === message.id ? null : id));
    audio.onerror = () => setSpeakingId((id) => (id === message.id ? null : id));
    try {
      await audio.play();
    } catch (err) {
      // FIX: distinct failure mode from the synthesis catch above — audio
      // WAS generated fine here, but the browser blocked playback, most
      // commonly its autoplay policy (this fires automatically from a
      // useEffect on new messages, not a fresh click). Logging separately
      // makes the two failure modes distinguishable instead of both just
      // going silent.
      console.error("Audio playback blocked/failed:", err?.name || err);
      setSpeakingId(null);
    }
  }

  function handleSpeakToggle(message) {
    if (speakingId === message.id) {
      ttsAudioRef.current?.pause();
      setSpeakingId(null);
      return;
    }
    speak(message);
  }

  function handleSend(e) {
    e.preventDefault();
    ttsAudioRef.current?.pause();
    setSpeakingId(null);
    if (sendMessage(input)) setInput("");
  }

  // Edit & resend — loads a past message of yours back into the input
  // instead of mutating stored chat history, which keeps the backend's
  // history contract (and the agent's own memory of the conversation)
  // exactly as-is; this only ever adds a new message, never rewrites one.
  function handleEditMessage(content) {
    setInput(content);
    inputRef.current?.focus();
  }

  // Voice input via Groq Whisper (server-side) rather than the browser's
  // native SpeechRecognition — that API only works reliably in Chrome and
  // its accuracy for Indian languages varies a lot by device. Recording
  // locally and sending the audio to /chat/transcribe gives consistent
  // quality everywhere and needs no language hint: Whisper detects it.
  async function toggleVoiceInput() {
    if (!canRecordAudio || status !== "open") return;

    if (isListening) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        setIsListening(false);
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) return;

        setTranscribing(true);
        try {
          const { text } = await transcribeAudio(blob);
          if (text) {
            setInput((prev) => (prev ? `${prev} ${text}` : text));
            inputRef.current?.focus();
          }
        } catch (err) {
          // Transcription failed — farmer can just type instead; not fatal,
          // but log it so a fully-broken STT path is diagnosable too.
          console.error("Voice transcription failed:", err?.response?.data || err?.message || err);
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsListening(true);
    } catch {
      // Mic permission denied/unavailable.
      setIsListening(false);
    }
  }

  // Photo-in-chat: farmer picks Soil or Crop/Disease first (explicit, every
  // time — the two use different ML models, so guessing risks a confusing
  // wrong-model result), THEN a photo, which goes through the existing
  // classify-soil / detect-disease REST endpoints (not through the LLM,
  // which can't see images) with log_to_chat=true so the result is also
  // saved into the persisted conversation.
  function openPhotoPicker(kind) {
    pendingPhotoKindRef.current = kind;
    setPickerOpen(false);
    fileInputRef.current?.click();
  }

  async function handlePhotoSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    const kind = pendingPhotoKindRef.current;
    if (!file || !kind || !user?.username) return;

    const previewUrl = URL.createObjectURL(file);
    setAnalyzingKind(kind);

    try {
      if (kind === "soil") {
        const result = await classifySoil(user.username, file, true, true);
        // FIX: result.confidence is already a 0-100 percentage from the
        // backend ML model (e.g. 87.34), not a 0-1 fraction — multiplying
        // by 100 again turned "87% confidence" into "8734% confidence".
        // Same bug as backend/app/routes/vision.py's chat-summary
        // formatters; fixed there too.
        const summary = t("chat.soilResult", {
          type: translateSoilType(t, result.soil_type),
          confidence: Math.round(result.confidence),
        });
        addPhotoExchange(previewUrl, summary, { kind: "soil", ...result });
      } else {
        const result = await detectDisease(user.username, file, true);
        const summary = result.is_healthy
          ? t("chat.healthyResult")
          : t("chat.diseaseResult", {
              disease: result.disease,
              confidence: Math.round(result.confidence),
              severity: result.severity,
              treatment: result.treatment,
              fertilizer: formatFertilizer(result.fertilizer),
              prevention: result.prevention,
            });
        addPhotoExchange(previewUrl, summary, { kind: "disease", ...result });
      }
    } catch {
      addPhotoExchange(previewUrl, t("chat.analysisFailed"), null);
    } finally {
      setAnalyzingKind(null);
      pendingPhotoKindRef.current = null;
    }
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
  const analyzingLabel =
    analyzingKind === "soil" ? t("chat.analyzingSoil") : analyzingKind === "disease" ? t("chat.analyzingCrop") : null;

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
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              t={t}
              onEdit={handleEditMessage}
              onSpeak={handleSpeakToggle}
              speakingId={speakingId}
              loadingSpeechId={loadingSpeechId}
            />
          ))
        )}
        {thinking && <ThinkingBubble t={t} />}
        {analyzingLabel && <ThinkingBubble t={t} label={analyzingLabel} />}
      </div>

      {pickerOpen && (
        <div className="px-4 md:px-8 py-2.5 border-t border-border bg-surface shrink-0 flex items-center gap-2">
          <span className="text-xs text-ink-soft mr-1">{t("chat.whatIsThisPhoto")}</span>
          <button
            type="button"
            onClick={() => openPhotoPicker("soil")}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-sm border border-border text-ink hover:border-primary hover:text-primary transition-colors duration-150"
          >
            <Sprout size={14} /> {t("chat.soilPhoto")}
          </button>
          <button
            type="button"
            onClick={() => openPhotoPicker("disease")}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-sm border border-border text-ink hover:border-primary hover:text-primary transition-colors duration-150"
          >
            <Leaf size={14} /> {t("chat.cropPhoto")}
          </button>
          <button
            type="button"
            onClick={() => setPickerOpen(false)}
            className="ml-auto flex items-center gap-1 text-xs text-ink-soft hover:text-ink"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <form
        onSubmit={handleSend}
        className="flex items-center gap-2.5 px-4 md:px-8 py-3.5 border-t border-border bg-surface shrink-0"
      >
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelected} />
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={transcribing ? t("chat.transcribing") : t("chat.placeholder")}
          disabled={status !== "open"}
          className="flex-1 rounded-sm border border-border bg-bg px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-soft/60 focus:border-primary focus:outline-none transition-colors duration-150 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          disabled={status !== "open" || !!analyzingKind}
          title={t("chat.attachPhoto")}
          className="shrink-0 w-11 h-11 rounded-sm border border-border bg-surface text-ink-soft flex items-center justify-center hover:text-ink hover:border-ink-soft transition-all duration-200 ease-out-expo active:scale-[0.97] disabled:opacity-40"
        >
          <Paperclip size={18} />
        </button>
        {canRecordAudio && (
          <button
            type="button"
            onClick={toggleVoiceInput}
            disabled={status !== "open" || transcribing}
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