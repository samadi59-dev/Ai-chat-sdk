import { createChat, listChats } from "@/lib/chat-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await listChats());
  } catch (error) {
    console.error("/api/chats GET", error);
    const message = error instanceof Error ? error.message : "Could not load chats";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 80) : "New chat";
    const chat = await createChat(title);
    return Response.json(chat, { status: 201 });
  } catch (error) {
    console.error("/api/chats POST", error);
    const message = error instanceof Error ? error.message : "Could not create chat";
    return Response.json({ error: message }, { status: 500 });
  }
}
