import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { chats, imageGenerations, messages } from "@/db/schema";
import type { UIMessage } from "ai";

function stripImageMetadata(metadata: UIMessage["metadata"]) {
  if (!metadata || typeof metadata !== "object") return metadata ?? null;
  const { imageUrl: _imageUrl, ...rest } = metadata as Record<string, unknown>;
  return Object.keys(rest).length ? rest : null;
}

export async function listChats() {
  return db.select({ id: chats.id, title: chats.title, updatedAt: chats.updatedAt })
    .from(chats)
    .orderBy(desc(chats.updatedAt));
}

export async function createChat(title = "New chat") {
  const [chat] = await db.insert(chats).values({ title }).returning();
  return chat;
}

export async function chatExists(chatId: string) {
  const rows = await db.select({ id: chats.id }).from(chats).where(eq(chats.id, chatId)).limit(1);
  return Boolean(rows[0]);
}

export async function getChat(chatId: string) {
  const [chatRows, rows] = await Promise.all([
    db.select().from(chats).where(eq(chats.id, chatId)).limit(1),
    db.select().from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(asc(messages.createdAt)),
  ]);

  const chat = chatRows[0];
  if (!chat) return null;

  const uiMessages: UIMessage[] = rows.map((row) => ({
    id: row.id,
    role: row.role as UIMessage["role"],
    parts: row.parts as UIMessage["parts"],
    ...(row.metadata ? { metadata: stripImageMetadata(row.metadata as UIMessage["metadata"]) ?? undefined } : {}),
  }));

  return { ...chat, messages: uiMessages };
}

export async function getChatImages(chatId: string) {
  const generated = await db.select({
    messageId: imageGenerations.messageId,
    dataUri: imageGenerations.dataUri,
  })
    .from(imageGenerations)
    .where(eq(imageGenerations.chatId, chatId));

  return Object.fromEntries(
    generated.filter((row) => row.messageId).map((row) => [row.messageId!, row.dataUri]),
  ) as Record<string, string>;
}

export async function saveUiMessages(chatId: string, uiMessages: UIMessage[]) {
  // AI SDK UIMessage IDs are not UUIDs (for example: DwJz9aZnVV3TjLJr),
  // so the database stores message IDs as text. Chat IDs remain UUIDs.
  if (uiMessages.length) {
    await db.insert(messages).values(
      uiMessages.map((message) => ({
        id: message.id,
        chatId,
        role: message.role,
        parts: message.parts,
        metadata: stripImageMetadata(message.metadata),
      })),
    ).onConflictDoUpdate({
      target: messages.id,
      set: {
        role: sql`excluded.role`,
        parts: sql`excluded.parts`,
        metadata: sql`excluded.metadata`,
      },
    });
  }

  const firstUser = uiMessages.find((m) => m.role === "user");
  const titlePart = firstUser?.parts.find((part) => part.type === "text");
  const title = titlePart?.type === "text" ? titlePart.text.slice(0, 56) || "New chat" : "New chat";

  await db.update(chats).set({ title, updatedAt: new Date() }).where(eq(chats.id, chatId));
  return title;
}

export async function saveImageGeneration({ chatId, messageId, prompt, dataUri }: {
  chatId: string;
  messageId?: string;
  prompt: string;
  dataUri: string;
}) {
  const [generation] = await db.insert(imageGenerations).values({ chatId, messageId, prompt, dataUri }).returning();
  await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, chatId));
  return generation;
}
