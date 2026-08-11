import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../hooks/useWebSocket";
import { clearChatHistory, transcribeAudio, synthesizeSpeech } from "../api/chat";
import { classifySoil, detectDisease } from "../api/vision";
import {
    Send, MessageCircle, Wifi, WifiOff, RefreshCw, Trash2,
    Mic, MicOff, Paperclip, Volume2, VolumeX, Copy, Check, Bot, User
} from "lucide-react";

const canRecordAudio =
    typeof window !== "undefined" && !!navigator.mediaDevices && typeof window.MediaRecorder !== "undefined";

function MessageBubble({ message, t, onSpeak, speakingId, loadingSpeechId }) {
    const isUser = message.role === "user";
    const isError = !!message.isError;
    const isSpeakingThis = speakingId === message.id;
    const isLoadingSpeech = loadingSpeechId === message.id;
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(message.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // Clipboard unavailable — not critical.
        }
    };

    if (message.imageUrl) {
        return (
            <div style={{ alignSelf: "flex-end" }}>
                <img src={message.imageUrl} alt="Uploaded" style={{ maxWidth: "220px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }} />
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: isUser ? "flex-end" : "flex-start" }}>
            <div className={`chat-bubble ${isUser ? "user" : "assistant"}`} style={isError ? { border: "1px solid var(--color-danger)", color: "var(--color-danger)" } : undefined}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    {!isUser && <Bot size={15} color={isError ? "var(--color-danger)" : "var(--color-primary)"} />}
                    {isUser && <User size={15} color="var(--color-primary-dark)" />}
                    <span style={{ fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.6 }}>
                        {isUser ? "You" : "AI"}
                    </span>
                </div>
                <p style={{ whiteSpace: "pre-wrap", fontSize: "0.95rem" }}>{message.content}</p>

                {message.usedRag && message.sources?.length > 0 && (
                    <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.4rem" }}>
                        {t("chat.groundedIn", "Grounded in:")}{" "}
                        {message.sources.map((s) => s.title || s).join(", ")}
                    </p>
                )}

                {!isUser && !isError && (
                    <div className="chat-bubble-actions">
                        <button className="chat-bubble-btn" onClick={handleCopy} title={t("chat.copy", "Copy")}>
                            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? t("chat.copied", "Copied") : t("chat.copy", "Copy")}
                        </button>
                        <button className="chat-bubble-btn" onClick={() => onSpeak(message)} title={t("chat.readAloud", "Read aloud")}>
                            {isLoadingSpeech ? <RefreshCw size={13} className="spin" /> : isSpeakingThis ? <VolumeX size={13} /> : <Volume2 size={13} />}
                            {isSpeakingThis ? t("chat.stopSpeaking", "Stop") : t("chat.readAloud", "Listen")}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function Chat() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { messages, status, thinking, meta, sendMessage, reconnect, clearMessages, addPhotoExchange } = useWebSocket(user?.username);

    const [input, setInput] = useState("");
    const [recording, setRecording] = useState(false);
    const [transcribing, setTranscribing] = useState(false);
    const [speakingId, setSpeakingId] = useState(null);
    const [loadingSpeechId, setLoadingSpeechId] = useState(null);
    const [analyzingPhoto, setAnalyzingPhoto] = useState(null); // 'soil' | 'crop' | null
    const [toast, setToast] = useState("");

    const historyRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const fileInputRef = useRef(null);
    const speechAudioRef = useRef(null);
    const toastTimerRef = useRef(null);

    const showToast = useCallback((msg) => {
        setToast(msg);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(""), 3000);
    }, []);

    // Auto-scroll on new messages
    useEffect(() => {
        if (historyRef.current) {
            historyRef.current.scrollTop = historyRef.current.scrollHeight;
        }
    }, [messages, thinking]);

    // Stop any ongoing speech on unmount
    useEffect(() => {
        return () => {
            speechAudioRef.current?.pause();
        };
    }, []);

    const handleSend = () => {
        const ok = sendMessage(input);
        if (ok) setInput("");
    };

    const handleClear = async () => {
        if (!user?.username) return;
        try {
            await clearChatHistory(user.username);
            clearMessages();
        } catch {
            showToast(t("chat.deleteError", "Failed to clear chat history"));
        }
    };

    const startRecording = async () => {
        if (!canRecordAudio) {
            showToast("Voice input not supported in this browser");
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            chunksRef.current = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };
            recorder.onstop = async () => {
                stream.getTracks().forEach((tr) => tr.stop());
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
                if (blob.size < 1000) return;
                setTranscribing(true);
                try {
                    const data = await transcribeAudio(blob);
                    const text = data.transcript || data.text || "";
                    if (text) setInput((prev) => (prev ? `${prev} ${text}` : text));
                } catch {
                    showToast("Voice transcription failed");
                } finally {
                    setTranscribing(false);
                }
            };
            mediaRecorderRef.current = recorder;
            recorder.start();
            setRecording(true);
        } catch {
            showToast("Microphone access denied");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }
        setRecording(false);
    };

    const handleSpeak = async (message) => {
        if (!message?.content) return;
        // Stop current speech
        if (speechAudioRef.current) {
            speechAudioRef.current.pause();
            speechAudioRef.current = null;
            setSpeakingId(null);
            if (speakingId === message.id) return;
        }
        setLoadingSpeechId(message.id);
        try {
            const blob = await synthesizeSpeech(message.content);
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            speechAudioRef.current = audio;
            setSpeakingId(message.id);
            audio.onended = () => {
                setSpeakingId(null);
                speechAudioRef.current = null;
            };
            audio.play();
        } catch {
            showToast("Speech unavailable");
        } finally {
            setLoadingSpeechId(null);
        }
    };

    const handlePhoto = async (file, kind) => {
        if (!file || !user?.username) return;
        const url = URL.createObjectURL(file);
        setAnalyzingPhoto(kind);
        try {
            if (kind === "soil") {
                const data = await classifySoil(user.username, file, true, true);
                const content = `${t("chat.soilAnalysis", "Soil analysis")}: ${data.soil_type} (${Math.round((data.confidence || 0) * 100)}%)`;
                addPhotoExchange(url, content, { kind: "soil", data });
            } else {
                const data = await detectDisease(user.username, file, true);
                const statusText = data.is_healthy
                    ? t("chat.healthyResult", "Your plant looks healthy")
                    : `${data.disease} — ${data.severity}`;
                const content = `${t("chat.diseaseAnalysis", "Crop analysis")}: ${statusText}`;
                addPhotoExchange(url, content, { kind: "disease", data });
            }
        } catch {
            showToast(t("chat.analysisFailed", "Photo analysis failed"));
            addPhotoExchange(url, "⚠️ " + t("chat.analysisFailed", "Photo analysis failed"), null);
        } finally {
            setAnalyzingPhoto(null);
        }
    };

    const statusLabel =
        status === "open" ? t("chat.online", "Online") :
        status === "connecting" ? t("chat.connecting", "Connecting…") :
        status === "error" ? t("chat.offline", "Offline") :
        t("chat.offline", "Offline");

    const StatusIcon = status === "open" ? Wifi : WifiOff;

    return (
        <div className="container" style={{ padding: "var(--spacing-lg) var(--spacing-md)" }}>
            <div className="page-header" style={{ borderRadius: "var(--radius-md)", marginBottom: "var(--spacing-xl)" }}>
                <h1 style={{ color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                    <MessageCircle size={30} /> {t("chat.title", "Farm Assistant")}
                </h1>
                <p style={{ opacity: 0.8 }}>{t("chat.subtitle", "Ask anything — crops, fertilizer, disease, weather, prices.")}</p>
            </div>

            {toast && (
                <div className="alert-banner" style={{ background: "rgba(30,94,58,0.08)", borderLeftColor: "var(--color-primary)", color: "var(--color-primary)" }}>
                    {toast}
                </div>
            )}

            <div className="chat-window">
                {/* Chat header */}
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0.75rem 1rem", borderBottom: "1px solid var(--color-border)",
                    background: "var(--color-bg-card)", borderTopLeftRadius: "var(--radius-md)", borderTopRightRadius: "var(--radius-md)",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.85rem", color: status === "open" ? "var(--color-success)" : "var(--color-text-muted)", fontWeight: 600 }}>
                            <StatusIcon size={15} /> {statusLabel}
                        </span>
                        {meta?.season && <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>· {meta.season}</span>}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        {status !== "open" && (
                            <button className="btn btn-secondary" onClick={reconnect} style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem" }}>
                                <RefreshCw size={13} /> {t("chat.reconnect", "Reconnect")}
                            </button>
                        )}
                        <button className="btn btn-secondary" onClick={handleClear} style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem" }}>
                            <Trash2 size={13} /> {t("chat.clear", "Clear chat")}
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="chat-history" ref={historyRef}>
                    {messages.length === 0 && !thinking && (
                        <div style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "2rem 1rem" }}>
                            <Bot size={40} style={{ margin: "0 auto 0.75rem", opacity: 0.4 }} />
                            <p>{t("chat.placeholder", "Ask about crops, fertilizer, disease, prices…")}</p>
                        </div>
                    )}
                    {messages.map((m) => (
                        <MessageBubble key={m.id} message={m} t={t} onSpeak={handleSpeak} speakingId={speakingId} loadingSpeechId={loadingSpeechId} />
                    ))}
                    {thinking && (
                        <div className="chat-bubble assistant" style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
                            <span className="spin" style={{ display: "inline-block", width: "14px", height: "14px", border: "2px solid var(--color-border)", borderTopColor: "var(--color-primary)", borderRadius: "50%" }} />
                            {t("chat.thinking", "Thinking…")}
                        </div>
                    )}
                    {analyzingPhoto && (
                        <div className="chat-bubble assistant" style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
                            <span className="spin" style={{ display: "inline-block", width: "14px", height: "14px", border: "2px solid var(--color-border)", borderTopColor: "var(--color-primary)", borderRadius: "50%" }} />
                            {analyzingPhoto === "soil" ? t("chat.analyzingSoil", "Analyzing soil…") : t("chat.analyzingCrop", "Analyzing crop…")}
                        </div>
                    )}
                </div>

                {/* Photo attach choices */}
                <div style={{ padding: "0.5rem 1rem 0", display: "flex", gap: "0.5rem", borderTop: "1px solid var(--color-border)", background: "var(--color-bg-base)" }}>
                    <button className="btn btn-secondary" style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem" }} onClick={() => fileInputRef.current?.click()}>
                        <Paperclip size={13} /> {t("chat.attachPhoto", "Attach photo")}
                    </button>
                    <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", alignSelf: "center" }}>
                        {t("chat.whatIsThisPhoto", "What is this photo?")}
                    </span>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/jpg,image/webp"
                        style={{ display: "none" }}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                const kind = window.confirm(t("chat.soilPhoto", "Is this a soil photo? OK = Soil, Cancel = Crop leaf")) ? "soil" : "crop";
                                handlePhoto(file, kind);
                            }
                            e.target.value = "";
                        }}
                    />
                </div>

                {/* Input area */}
                <div className="chat-input-area">
                    <button
                        className={`mic-button ${recording ? "recording" : ""}`}
                        onClick={recording ? stopRecording : startRecording}
                        title={t("chat.voiceInput", "Voice input")}
                        disabled={transcribing}
                    >
                        {transcribing ? <RefreshCw size={20} className="spin" /> : recording ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                    <input
                        className="form-input"
                        style={{ flex: 1, borderRadius: "var(--radius-full)", padding: "0.7rem 1.25rem" }}
                        placeholder={t("chat.placeholder", "Ask about crops, fertilizer, disease, prices…")}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                    <button className="btn btn-primary" onClick={handleSend} disabled={!input.trim()} style={{ borderRadius: "var(--radius-full)", width: "50px", height: "50px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Send size={20} />
                    </button>
                </div>
            </div>

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
