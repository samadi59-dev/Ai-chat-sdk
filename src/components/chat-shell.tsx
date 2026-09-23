"use client";

import { useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import {
  ChevronDown,
  Menu,
  MessageSquare,
  MessageSquarePlus,
  MoreHorizontal,
  PanelLeft,
  Sparkles,
} from "lucide-react";
import { ChatThread } from "@/components/chat-thread";

type ChatSummary = { id: string; title: string; updatedAt: string };
type ChatRecord = ChatSummary & { messages: UIMessage[] };

function formatDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function groupLabel(value: string) {
  const date = new Date(value);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.floor((startToday - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days <= 7) return "Previous 7 days";
  return "Older";
}

let bootLock: Promise<ChatSummary[]> | null = null;

async function fetchChatList() {
  const res = await fetch("/api/chats", { cache: "no-store" });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Could not load chats",
    );
  }
  return payload as ChatSummary[];
}

export function ChatShell() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatId, setChatId] = useState("");
  const [activeThreadId, setActiveThreadId] = useState("");
  const [thread, setThread] = useState<{ messages: UIMessage[]; images: Record<string, string> }>({
    messages: [],
    images: {},
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [booting, setBooting] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [bootError, setBootError] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  const [model, setModel] = useState(process.env.NEXT_PUBLIC_CHAT_MODEL || "gpt-5-mini");
  const loadAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("sidebar-open");
    if (stored !== null) setSidebarOpen(stored === "1");
    else setSidebarOpen(window.innerWidth > 800);
    void boot();
  }, []);

  useEffect(() => {
    window.localStorage.setItem("sidebar-open", sidebarOpen ? "1" : "0");
  }, [sidebarOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        void newChat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function boot() {
    try {
      setBootError("");
      if (!bootLock) {
        bootLock = (async () => {
          const data = await fetchChatList();
          if (data.length) return data;
          const created = await createNewChat();
          return [created];
        })();
      }
      const data = await bootLock;
      setChats(data);
      setBooting(false);
      await loadChat(data[0].id);
    } catch (e) {
      bootLock = null;
      setBootError(e instanceof Error ? e.message : "Could not load chats.");
      setBooting(false);
    }
  }

  async function createNewChat() {
    const res = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Could not create chat");
    return payload as ChatSummary;
  }

  async function newChat() {
    const created = await createNewChat();
    setChats((prev) => [created, ...prev]);
    setChatId(created.id);
    setActiveThreadId(created.id);
    setThread({ messages: [], images: {} });
    setSwitching(false);
    if (window.innerWidth <= 800) setSidebarOpen(false);
  }

  async function loadChat(id: string) {
    if (id === chatId && activeThreadId === id && !switching) return;

    loadAbort.current?.abort();
    const controller = new AbortController();
    loadAbort.current = controller;

    setChatId(id);
    setSwitching(true);
    if (window.innerWidth <= 800) setSidebarOpen(false);

    try {
      const res = await fetch(`/api/chats/${id}`, { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error("Could not load chat");
      const data = (await res.json()) as ChatRecord;
      if (controller.signal.aborted) return;

      setThread({ messages: data.messages, images: {} });
      setActiveThreadId(data.id);
      setSwitching(false);

      const imageRes = await fetch(`/api/chats/${id}/images`, { cache: "no-store", signal: controller.signal });
      if (imageRes.ok) {
        const images = (await imageRes.json()) as Record<string, string>;
        if (!controller.signal.aborted) setThread((prev) => ({ ...prev, images }));
      }
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError") return;
      setSwitching(false);
    }
  }

  if (bootError && !chats.length) {
    return (
      <div className="loading-screen error-screen">
        <strong>Could not start the chat</strong>
        <p>{bootError}</p>
        <button className="retry-button" onClick={() => { setBooting(true); void boot(); }}>Retry</button>
      </div>
    );
  }

  const groupedChats = chats.reduce<Record<string, ChatSummary[]>>((groups, chat) => {
    const label = groupLabel(chat.updatedAt);
    (groups[label] ||= []).push(chat);
    return groups;
  }, {});

  return (
    <main className="app-shell">
      {sidebarOpen && <button className="mobile-scrim" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="sidebar-top">
          <div className="brand-row">
            <div className="brand-mark"><Sparkles size={16} /></div>
            <span>AI Conversation</span>
          </div>
          <button className="icon-button" onClick={() => setSidebarOpen(false)} aria-label="Collapse sidebar"><PanelLeft size={18} /></button>
        </div>

        <button className="new-chat" onClick={() => void newChat()}>
          <MessageSquarePlus size={18} />
          <span>New chat</span>
          <kbd>Ctrl K</kbd>
        </button>

        <div className="history-label">Chats</div>
        <div className="history-list">
          {booting && !chats.length && <div className="history-placeholder">Loading chats…</div>}
          {Object.entries(groupedChats).map(([label, items]) => (
            <div key={label}>
              <div className="history-group-label">{label}</div>
              {items.map((chat) => (
                <button
                  key={chat.id}
                  className={`history-item ${chat.id === chatId ? "active" : ""}`}
                  onClick={() => void loadChat(chat.id)}
                >
                  <MessageSquare size={15} className="history-icon" />
                  <span>{chat.title || "New chat"}</span>
                  <em>{formatDate(chat.updatedAt)}</em>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="sdk-chip"><span className="dot" /> AI SDK</div>
          <div className="stack-note">Next.js · TypeScript · Neon · Drizzle</div>
        </div>
      </aside>

      <section className="chat-panel">
        <header className="chat-header">
          <button
            className="icon-button sidebar-toggle"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Open sidebar"}
          >
            {sidebarOpen ? <PanelLeft size={19} /> : <Menu size={19} />}
          </button>
          <div className="model-picker">
            <button className="model-button" onClick={() => setModelOpen((v) => !v)}>
              <span className="model-icon"><Sparkles size={14} /></span>
              <span>{model}</span>
              <ChevronDown size={15} />
            </button>
            {modelOpen && (
              <div className="model-menu">
                {["gpt-5-mini", "gpt-4o-mini"].map((name) => (
                  <button key={name} className={name === model ? "selected" : ""} onClick={() => { setModel(name); setModelOpen(false); }}>
                    <span><Sparkles size={14} /> {name}</span>
                    {name === model && <span>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="icon-button" aria-label="More options"><MoreHorizontal size={20} /></button>
        </header>

        {switching && !activeThreadId && (
          <div className="thread-loading"><div className="loader" /><span>Loading conversation…</span></div>
        )}

        {activeThreadId && (
          <div className={`thread-frame ${switching ? "is-switching" : ""}`}>
            {switching && <div className="thread-loading overlay"><div className="loader" /><span>Loading conversation…</span></div>}
            <ChatThread
              key={activeThreadId}
              chatId={activeThreadId}
              model={model}
              initialMessages={thread.messages}
              initialImages={thread.images}
              onConversationTouch={(title) => {
                setChats((prev) =>
                  prev.map((chat) =>
                    chat.id === activeThreadId
                      ? { ...chat, title: title || chat.title, updatedAt: new Date().toISOString() }
                      : chat,
                  ),
                );
              }}
            />
          </div>
        )}
      </section>
    </main>
  );
}
