import { useState, useRef, useEffect, useCallback } from "react";
import { getChatHistory } from "../api/chat";

// Connects to the backend's agentic chat WebSocket (/ws/chat/{username}),
// hydrating past history over REST first, then live messages with
// reconnect-backoff on unexpected drops. Uses the same origin as the page
// (the Vite dev server proxies /ws to the FastAPI backend), so it works
// in local dev and in the hosted preview without extra config.
const MAX_RECONNECT_DELAY_MS = 10000;

function wsUrl(username, token) {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.host}/ws/chat/${encodeURIComponent(username)}?token=${encodeURIComponent(token)}`;
}

export function useWebSocket(username) {
    const [messages, setMessages] = useState([]);
    const [status, setStatus] = useState("idle"); // idle | connecting | open | closed | error
    const [thinking, setThinking] = useState(false);
    const [meta, setMeta] = useState(null); // { language, season } from "connected" greeting

    const socketRef = useRef(null);
    const attemptRef = useRef(0);
    const idRef = useRef(0);
    const mountedRef = useRef(true);
    const manualCloseRef = useRef(false);
    const welcomedRef = useRef(false);

    const nextId = () => `m${++idRef.current}`;

    const connect = useCallback(() => {
        if (!username) return;
        // Guard against React StrictMode double-mounting: never open two
        // live sockets for the same page instance.
        if (
            socketRef.current &&
            (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)
        ) {
            return;
        }

        const token = localStorage.getItem("token");
        if (!token) {
            setStatus("error");
            return;
        }

        setStatus("connecting");
        const ws = new WebSocket(wsUrl(username, token));
        socketRef.current = ws;

        ws.onopen = () => {
            if (!mountedRef.current) return;
            attemptRef.current = 0;
            setStatus("open");
        };

        ws.onmessage = (event) => {
            if (!mountedRef.current) return;
            let payload;
            try {
                payload = JSON.parse(event.data);
            } catch {
                return;
            }

            if (payload.type === "connected") {
                setMeta({ language: payload.language, season: payload.season });
                if (!welcomedRef.current) {
                    welcomedRef.current = true;
                    setMessages((prev) => [
                        ...prev,
                        { id: nextId(), role: "assistant", content: payload.message, isWelcome: true },
                    ]);
                }
                return;
            }

            if (payload.type === "message") {
                setThinking(false);
                setMessages((prev) => [
                    ...prev,
                    {
                        id: nextId(),
                        role: "assistant",
                        content: payload.response,
                        sources: payload.sources || [],
                        usedRag: !!payload.used_rag,
                    },
                ]);
                return;
            }

            if (payload.type === "error") {
                setThinking(false);
                setMessages((prev) => [
                    ...prev,
                    { id: nextId(), role: "assistant", content: payload.message, isError: true },
                ]);
            }
        };

        ws.onclose = (event) => {
            if (!mountedRef.current) return;
            socketRef.current = null;

            // Bad/expired token (4401) or username mismatch (4403) — retrying won't help.
            if (event.code === 4401 || event.code === 4403) {
                setStatus("error");
                return;
            }
            if (manualCloseRef.current) {
                setStatus("closed");
                return;
            }

            setStatus("closed");
            const delay = Math.min(1000 * 2 ** attemptRef.current, MAX_RECONNECT_DELAY_MS);
            attemptRef.current += 1;
            setTimeout(() => {
                if (mountedRef.current && !manualCloseRef.current) connect();
            }, delay);
        };

        ws.onerror = () => {
            // onclose fires right after in browsers — that drives reconnect.
        };
    }, [username]);

    useEffect(() => {
        mountedRef.current = true;
        manualCloseRef.current = false;
        if (!username) return;

        getChatHistory(username)
            .then((data) => {
                const past = (data.messages || []).map((m) => ({
                    id: nextId(),
                    role: m.role,
                    content: m.content,
                }));
                if (mountedRef.current) setMessages(past);
            })
            .catch(() => {})
            .finally(() => {
                if (mountedRef.current && !manualCloseRef.current) connect();
            });

        return () => {
            mountedRef.current = false;
            manualCloseRef.current = true;
            socketRef.current?.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [username]);

    const sendMessage = useCallback((text) => {
        const trimmed = text.trim();
        if (!trimmed || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return false;
        setMessages((prev) => [...prev, { id: nextId(), role: "user", content: trimmed }]);
        setThinking(true);
        socketRef.current.send(JSON.stringify({ message: trimmed }));
        return true;
    }, []);

    const reconnect = useCallback(() => {
        attemptRef.current = 0;
        manualCloseRef.current = false;
        welcomedRef.current = false;
        connect();
    }, [connect]);

    const clearMessages = useCallback(() => setMessages([]), []);

    // Photo analysis (soil/disease) is a REST call, but we render it in the
    // same thread so the conversation reads naturally.
    const addPhotoExchange = useCallback((userImageUrl, assistantContent, analysis) => {
        setMessages((prev) => [
            ...prev,
            { id: nextId(), role: "user", content: "", imageUrl: userImageUrl },
            { id: nextId(), role: "assistant", content: assistantContent, analysis },
        ]);
    }, []);

    return { messages, status, thinking, meta, sendMessage, reconnect, clearMessages, addPhotoExchange };
}
