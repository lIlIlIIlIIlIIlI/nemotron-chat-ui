"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

type Message = { id: string; role: "user" | "assistant"; content: string };
type Thread = { id: string; title: string; updatedAt: number; messages: Message[] };

const STORAGE_KEY = "nemotron-chat-threads-v1";

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "compose": return <svg {...common}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/><path d="m15 5 4 4"/></svg>;
    case "search": return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
    case "library": return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5Z"/><path d="M4 5.5v16M8 7h8M8 11h8"/></svg>;
    case "menu": return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16"/></svg>;
    case "chevron": return <svg {...common}><path d="m9 18 6-6-6-6"/></svg>;
    case "send": return <svg {...common}><path d="M12 19V5M5 12l7-7 7 7"/></svg>;
    case "stop": return <svg {...common}><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/></svg>;
    case "logout": return <svg {...common}><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg>;
    case "spark": return <svg {...common}><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7Z"/></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="9"/></svg>;
  }
}

function relativeDate(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const age = dayStart - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (age === 0) return "오늘";
  if (age === 86_400_000) return "어제";
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export default function ChatApp() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Thread[];
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((thread) => thread && typeof thread.id === "string" && Array.isArray(thread.messages));
          setThreads(valid);
          if (valid[0]) setActiveId(valid[0].id);
        }
      }
    } catch {
      setThreads([]);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
  }, [threads, hydrated]);

  const activeThread = threads.find((thread) => thread.id === activeId);
  const messages = activeThread?.messages ?? [];
  const filteredThreads = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return [...threads]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .filter((thread) => !query || thread.title.toLocaleLowerCase().includes(query));
  }, [threads, searchQuery]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: sending ? "smooth" : "auto", block: "end" });
  }, [messages, sending]);

  function startNewChat() {
    controllerRef.current?.abort();
    const id = crypto.randomUUID();
    setThreads((current) => [{ id, title: "새 채팅", updatedAt: Date.now(), messages: [] }, ...current]);
    setActiveId(id);
    setInput("");
    setError("");
    setSending(false);
    setSidebarOpen(false);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function updateThread(threadId: string, transform: (thread: Thread) => Thread) {
    setThreads((current) => current.map((thread) => thread.id === threadId ? transform(thread) : thread));
  }

  async function sendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantMessage: Message = { id: crypto.randomUUID(), role: "assistant", content: "" };
    const threadId = activeId || crypto.randomUUID();
    const existing = threads.find((thread) => thread.id === threadId);
    const before = existing?.messages ?? [];
    const nextTitle = existing?.messages.length ? existing.title : text.slice(0, 34);
    const now = Date.now();

    if (existing) {
      updateThread(threadId, (thread) => ({
        ...thread,
        title: nextTitle,
        updatedAt: now,
        messages: [...thread.messages, userMessage, assistantMessage],
      }));
    } else {
      setThreads((current) => [{
        id: threadId,
        title: nextTitle,
        updatedAt: now,
        messages: [userMessage, assistantMessage],
      }, ...current]);
    }
    setActiveId(threadId);
    setInput("");
    setError("");
    setSending(true);
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...before, userMessage].map(({ role, content }) => ({ role, content })) }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(result.error || "답변을 가져오지 못했습니다.");
      }
      if (!response.body) throw new Error("스트리밍 응답을 받을 수 없습니다.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        updateThread(threadId, (thread) => ({
          ...thread,
          updatedAt: Date.now(),
          messages: thread.messages.map((message) =>
            message.id === assistantMessage.id ? { ...message, content: answer } : message,
          ),
        }));
      }
      answer += decoder.decode();
      if (answer) {
        updateThread(threadId, (thread) => ({
          ...thread,
          messages: thread.messages.map((message) =>
            message.id === assistantMessage.id ? { ...message, content: answer } : message,
          ),
        }));
      }
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "알 수 없는 오류가 발생했습니다.");
      updateThread(threadId, (thread) => ({
        ...thread,
        messages: thread.messages.filter((message) => message.id !== assistantMessage.id),
      }));
    } finally {
      controllerRef.current = null;
      setSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  const showWelcome = messages.length === 0;

  return (
    <div className="chat-shell">
      {sidebarOpen && <button className="mobile-scrim" aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar${sidebarOpen ? " sidebar-open" : ""}`}>
        <div className="sidebar-top">
          <button className="workspace-brand" onClick={() => startNewChat()} aria-label="새 채팅 시작">
            <span className="brand-mark brand-mark-small">N</span>
            <span className="workspace-title">Nemotron Chat</span>
          </button>
          <button className="icon-button sidebar-collapse" onClick={() => setSidebarOpen(false)} aria-label="사이드바 닫기">
            <Icon name="menu" />
          </button>
        </div>

        <nav className="primary-nav" aria-label="기본 메뉴">
          <button className="nav-item nav-item-active" onClick={startNewChat}><Icon name="compose" /><span>새 채팅</span><kbd>⌘ K</kbd></button>
          <button className="nav-item" onClick={() => { setSearchOpen((open) => !open); setSearchQuery(""); }}><Icon name="search" /><span>채팅 검색</span></button>
          <button className="nav-item nav-item-disabled" type="button" disabled title="준비 중"><Icon name="library" /><span>라이브러리</span></button>
        </nav>

        {searchOpen && (
          <div className="sidebar-search">
            <input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="대화 검색" aria-label="대화 검색" />
          </div>
        )}

        <div className="history-area">
          <div className="section-label">최근</div>
          {filteredThreads.length ? (
            <div className="thread-list">
              {filteredThreads.map((thread) => (
                <button key={thread.id} className={`thread-item${thread.id === activeId ? " thread-item-active" : ""}`} onClick={() => { setActiveId(thread.id); setSidebarOpen(false); setError(""); }}>
                  <span className="thread-title">{thread.title}</span>
                  <span className="thread-date">{relativeDate(thread.updatedAt)}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="empty-history">{searchQuery ? "검색 결과가 없습니다." : "아직 대화가 없습니다."}</p>
          )}
        </div>

        <div className="sidebar-bottom">
          <div className="account-avatar">N</div>
          <div className="account-info"><strong>내 계정</strong><span>NVIDIA Nemotron</span></div>
          <button className="icon-button logout-button" title="로그아웃" onClick={logout} aria-label="로그아웃"><Icon name="logout" size={18} /></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기"><Icon name="menu" /></button>
          <div className="mobile-title"><span className="brand-mark brand-mark-tiny">N</span>Nemotron Chat</div>
          <button className="model-picker" type="button" title="현재 사용 중인 모델">
            <span className="model-name">Nemotron 3 Ultra</span><span className="model-vendor">NVIDIA</span>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div className="topbar-right"><span className="secure-label"><span className="secure-dot"/>세션 보호</span></div>
        </header>

        <section className={`conversation${showWelcome ? " conversation-welcome" : ""}`} aria-label="채팅">
          {showWelcome ? (
            <div className="welcome-area">
              <div className="welcome-spark"><Icon name="spark" size={24} /></div>
              <h1>어떤 작업을 할까요?</h1>
              <p>생각을 정리하고, 궁금한 점을 물어보세요.</p>
              <div className="suggestion-row">
                <button onClick={() => setInput("복잡한 개념을 쉽게 설명해줘")}>복잡한 개념 설명하기 <Icon name="chevron" size={15} /></button>
                <button onClick={() => setInput("아이디어를 함께 발전시켜줘")}>아이디어 발전시키기 <Icon name="chevron" size={15} /></button>
                <button onClick={() => setInput("이 코드의 문제를 찾아줘")}>코드 검토하기 <Icon name="chevron" size={15} /></button>
              </div>
            </div>
          ) : (
            <div className="message-list">
              {messages.map((message) => (
                <article key={message.id} className={`message-row message-${message.role}`}>
                  {message.role === "assistant" && <div className="assistant-avatar"><span className="brand-mark brand-mark-tiny">N</span></div>}
                  <div className={`message-content${message.role === "user" ? " user-bubble" : " assistant-content"}`}>
                    {message.content ? <div className="message-text">{message.content}</div> : message.role === "assistant" && sending ? <span className="typing-indicator"><i/><i/><i/></span> : null}
                  </div>
                </article>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </section>

        <div className="composer-wrap">
          {error && <div className="chat-error" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="오류 닫기">×</button></div>}
          <form className="composer" onSubmit={sendMessage}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nemotron에게 메시지 보내기"
              rows={1}
              aria-label="메시지 입력"
              disabled={sending}
            />
            <div className="composer-footer">
              <div className="composer-hint">Shift + Enter로 줄바꿈</div>
              {sending ? (
                <button type="button" className="send-button send-stop" aria-label="응답 중지" onClick={() => controllerRef.current?.abort()}><Icon name="stop" size={17} /></button>
              ) : (
                <button type="submit" className="send-button" aria-label="메시지 보내기" disabled={!input.trim()}><Icon name="send" size={18} /></button>
              )}
            </div>
          </form>
          <p className="composer-disclaimer">Nemotron은 실수할 수 있습니다. 중요한 정보는 한 번 더 확인해 주세요.</p>
        </div>
      </main>
    </div>
  );
}
