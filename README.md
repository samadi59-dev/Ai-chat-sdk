# AI Chat SDK Sample — Next.js + AI SDK + Neon + Drizzle

A clean ChatGPT-style sample app built with Next.js, TypeScript and AI SDK.

## Included

- AI SDK streaming chat
- ChatGPT-style collapsible sidebar
- Persistent chat history in Neon PostgreSQL
- Drizzle ORM
- Model picker (`gpt-5-mini` / `gpt-4o-mini`)
- Automatic scroll while assistant text streams
- Markdown + GFM rendering with `react-markdown` and `remark-gfm`
- Fenced code blocks, lists, links, blockquotes and tables
- Generate-image button on every user message
- OpenAI image generation through AI SDK
- Responsive mobile sidebar
- Clear startup/API errors instead of infinite loading
- Webpack dev script for Windows systems where Turbopack native bindings fail

## Setup

```bash
npm install
```

Copy `.env.example` to `.env.local` and fill in:

```env
DATABASE_URL="your-neon-connection-string"
OPENAI_API_KEY="your-openai-key"
OPENAI_CHAT_MODEL="gpt-5-mini"
OPENAI_IMAGE_MODEL="gpt-image-1"
NEXT_PUBLIC_CHAT_MODEL="gpt-5-mini"
```

Push the schema:

```bash
npm run db:push
```

Start development:

```bash
npm run dev
```

The dev script intentionally uses `next dev --webpack` because some Windows environments cannot load the native Next.js/Turbopack SWC binary.

Open `http://localhost:3000`.


### Database message ID note
AI SDK message IDs are string IDs and are not guaranteed to be UUIDs. The `messages.id` and `image_generations.message_id` columns therefore use PostgreSQL `text`, while chat IDs remain UUIDs. If you previously ran an older version of this project, run `npm run db:push` after updating the schema.
