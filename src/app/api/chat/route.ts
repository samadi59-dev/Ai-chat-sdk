import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, generateId, streamText, type UIMessage } from "ai";
import { chatExists, saveUiMessages } from "@/lib/chat-store";
import { isUuid } from "@/lib/ids";

const allowedModels = new Set(["gpt-5-mini", "gpt-4o-mini"]);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const chatId = typeof body.id === "string" ? body.id : "";
    const messages = body.messages as UIMessage[];
    const requestedModel = typeof body.model === "string" ? body.model : process.env.OPENAI_CHAT_MODEL || "gpt-5-mini";
    const modelName = allowedModels.has(requestedModel) ? requestedModel : "gpt-5-mini";

    if (!isUuid(chatId) || !Array.isArray(messages)) {
      return Response.json({ error: "Invalid chat request" }, { status: 400 });
    }

    const sanitized = messages.map((message) => {
      const metadata = message.metadata as Record<string, unknown> | undefined;
      if (!metadata || !("imageUrl" in metadata)) return message;
      const { imageUrl: _imageUrl, ...rest } = metadata;
      return { ...message, metadata: Object.keys(rest).length ? rest : undefined };
    });

    if (!(await chatExists(chatId))) {
      return Response.json({ error: "Chat not found" }, { status: 404 });
    }

    const result = streamText({
      model: openai(modelName),
      system: "You are a concise, practical AI assistant. Answer naturally. Use GitHub-flavored Markdown when useful. For code, use fenced code blocks with a language. Avoid filler.",
      messages: await convertToModelMessages(sanitized),
      abortSignal: req.signal,
    });

    return result.toUIMessageStreamResponse({
      originalMessages: sanitized,
      generateMessageId: generateId,
      onFinish: async ({ messages: finalMessages }) => {
        await saveUiMessages(chatId, finalMessages);
      },
    });
  } catch (error) {
    console.error("/api/chat", error);
    const message = error instanceof Error ? error.message : "Chat request failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
