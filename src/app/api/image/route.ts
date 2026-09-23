import { openai } from "@ai-sdk/openai";
import { generateImage } from "ai";
import { saveImageGeneration } from "@/lib/chat-store";
import { isUuid } from "@/lib/ids";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const chatId = typeof body.chatId === "string" ? body.chatId : "";
    const messageId = typeof body.messageId === "string" ? body.messageId : undefined;
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!isUuid(chatId) || !prompt) {
      return Response.json({ error: "chatId and prompt are required" }, { status: 400 });
    }

    const { image } = await generateImage({
      model: openai.image(process.env.OPENAI_IMAGE_MODEL || "gpt-image-1"),
      prompt,
      size: "1024x1024",
      providerOptions: {
        openai: {
          quality: "medium",
          output_format: "webp",
        },
      },
    });

    const dataUri = `data:${image.mediaType};base64,${image.base64}`;
    await saveImageGeneration({ chatId, messageId, prompt, dataUri });

    return Response.json({ dataUri });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Image generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
