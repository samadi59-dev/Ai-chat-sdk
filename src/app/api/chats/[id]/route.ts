import { getChat } from "@/lib/chat-store";
import { isUuid } from "@/lib/ids";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return Response.json({ error: "Invalid chat id" }, { status: 400 });

    const chat = await getChat(id);
    if (!chat) return Response.json({ error: "Chat not found" }, { status: 404 });
    return Response.json(chat);
  } catch (error) {
    console.error("/api/chats/[id] GET", error);
    const message = error instanceof Error ? error.message : "Could not load chat";
    return Response.json({ error: message }, { status: 500 });
  }
}
