"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Image as ImageIcon, Send, Sparkles, WandSparkles } from "lucide-react";

function textFromMessage(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

export function ChatThread({
  chatId,
  model,
  initialMessages,
  initialImages,
  onConversationTouch,
}: {
  chatId: string;
  model: string;
  initialMessages: UIMessage[];
  initialImages: Record<string, string>;
  onConversationTouch: (title?: string) => void;
}) {
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [generatedImages, setGeneratedImages] = useState(initialImages);

  useEffect(() => {
    setGeneratedImages((prev) => ({ ...initialImages, ...prev }));
  }, [initialImages]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesWrapRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottom = useRef(true);
  const modelRef = useRef(model);
  modelRef.current = model;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: { id, messages, model: modelRef.current },
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, error } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    experimental_throttle: 50,
    onFinish: ({ messages: next }) => {
      const firstUser = next.find((m) => m.role === "user");
      const titlePart = firstUser?.parts.find((part) => part.type === "text");
      const title = titlePart?.type === "text" ? titlePart.text.slice(0, 56) : undefined;
      onConversationTouch(title);
    },
  });

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const el = messagesWrapRef.current;
    if (!el || !shouldStickToBottom.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  useLayoutEffect(() => {
    scrollToBottom("auto");
  }, [messages.length]);

  useEffect(() => {
    const el = messagesWrapRef.current;
    if (!el) return;

    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      shouldStickToBottom.current = distance < 120;
    };
    el.addEventListener("scroll", onScroll, { passive: true });

    const resizeObserver = new ResizeObserver(() => scrollToBottom("auto"));
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", onScroll);
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (status === "streaming" || status === "submitted") scrollToBottom("auto");
  }, [messages, status]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  async function submitMessage(event?: React.FormEvent) {
    event?.preventDefault();
    const value = input.trim();
    if (!value || status !== "ready") return;
    shouldStickToBottom.current = true;
    setInput("");
    onConversationTouch(value.slice(0, 56));
    await sendMessage({ text: value });
  }

  async function generateForMessage(message: UIMessage) {
    const prompt = textFromMessage(message).trim();
    if (!prompt || generating[message.id]) return;
    setGenerating((prev) => ({ ...prev, [message.id]: true }));
    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, messageId: message.id, prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Image generation failed");
      setGeneratedImages((prev) => ({ ...prev, [message.id]: data.dataUri }));
      onConversationTouch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Image generation failed");
    } finally {
      setGenerating((prev) => ({ ...prev, [message.id]: false }));
    }
  }

  return (
    <>
      <div className="messages-wrap" ref={messagesWrapRef}>
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-logo"><Sparkles size={25} /></div>
            <h1>What can I help you build?</h1>
            <p>Ask a question, write code, or turn any prompt into an image.</p>
            <div className="prompt-grid">
              {["Explain React state in a simple way", "Build a clean dashboard layout", "Create a cinematic Somali landscape"].map((prompt) => (
                <button key={prompt} onClick={() => { setInput(prompt); textareaRef.current?.focus(); }}>{prompt}<span>↗</span></button>
              ))}
            </div>
          </div>
        ) : (
          <div className="messages">
            {messages.map((message, index) => {
              const text = textFromMessage(message);
              const image = generatedImages[message.id];
              const streamingThis = (status === "streaming" || status === "submitted") && index === messages.length - 1 && message.role === "assistant";
              return (
                <article key={message.id} className={`message-row ${message.role}`}>
                  <div className="avatar">{message.role === "user" ? "S" : <Sparkles size={14} />}</div>
                  <div className="message-content">
                    <div className="message-meta">{message.role === "user" ? "You" : model}</div>
                    {text && (
                      <div className={`message-markdown ${message.role === "user" ? "user-markdown" : ""}`}>
                        {streamingThis ? text : <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>}
                      </div>
                    )}
                    {image && <img className="generated-image" src={image} alt="Generated from the user's prompt" />}
                    {message.role === "user" && (
                      <button className="image-action" onClick={() => generateForMessage(message)} disabled={generating[message.id]}>
                        {generating[message.id] ? <><span className="mini-loader" /> Generating image…</> : <><WandSparkles size={14} /> Generate image</>}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
            {status === "submitted" && <div className="thinking"><span /><span /><span /> Thinking</div>}
          </div>
        )}
      </div>

      <div className="composer-area">
        {error && <div className="error-banner">{error.message}</div>}
        <form className="composer" onSubmit={submitMessage}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submitMessage();
              }
            }}
            placeholder="Message AI Conversation…"
            rows={1}
          />
          <div className="composer-tools">
            <button type="button" className="composer-tool" onClick={() => setInput((v) => `${v}${v ? " " : ""}Create an image of `)} title="Prepare an image prompt"><ImageIcon size={17} /></button>
            <button className="send-button" type="submit" disabled={!input.trim() || status !== "ready"} aria-label="Send message"><Send size={17} /></button>
          </div>
        </form>
        <div className="composer-hint">AI can make mistakes. Markdown, code blocks, tables, links and lists are supported.</div>
      </div>
    </>
  );
}
