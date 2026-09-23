import { getChatImages } from "@/lib/chat-store";
import { isUuid } from "@/lib/ids";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Invalid chat id" }, { status: 400 });
  return Response.json(await getChatImages(id));
}
