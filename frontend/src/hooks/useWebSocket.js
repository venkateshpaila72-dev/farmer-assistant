import { useState, useRef, useEffect, useCallback } from "react";
import { getChatHistory } from "../api/chat";

const WS_BASE = import.meta.env.VITE_WS_BASE_URL || "ws://localhost:8000";
const MAX_RECONNECT_DELAY_MS = 10000;

// Owns the farmer <-> AI agent chat end to end: hydrates past history over
// REST on mount, then opens the live WebSocket (backend's ws.py — a
// RAG + tool-calling agent, not a plain completion) and reconnects with
// backoff on unexpected drops. Pages just render whatever this returns.
export function useWebSocket(username) {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | connecting | open | closed | error
  const [thinking, setThinking] = useState(false);
  const [meta, setMeta] = useState(null); // { language, season } from the "connected" greeting

  const socketRef = useRef(null);
  const attemptRef = useRef(0);
  const idRef = useRef(0);
  const mountedRef = useRef(true);
  const manualCloseRef = useRef(false);
  const welcomedRef = useRef(false);

  const nextId = () => `m${++idRef.current}`;

  const connect = useCallback(() => {
    if (!username) return;
    // React StrictMode double-invokes effects in dev (mount → cleanup →
    // mount again), and our cleanup can't close a socket that hasn't been
    // created yet (the history fetch it's waiting on is still in flight).
    // Without this guard that leaves two real, live sockets on the server —
    // exactly the paired "connection open"/"connection open" you'd see in
    // the backend log. Bail out if one's already up or coming up.
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
    const ws = new WebSocket(`${WS_BASE}/ws/chat/${username}?token=${token}`);
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
        // Only show the welcome bubble once per page visit — a reconnect
        // after a dropped connection shouldn't repeat it mid-conversation.
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

      // Bad/expired token (4401) or username mismatch (4403) — retrying
      // won't fix either, so surface it plainly instead of looping forever.
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
      // onclose fires right after in browsers — that's what drives reconnect.
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
        // The StrictMode cleanup can fire while this fetch is still in
        // flight — if it did, don't open a socket for an instance that's
        // already been torn down.
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
    connect();
  }, [connect]);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, status, thinking, meta, sendMessage, reconnect, clearMessages };
}