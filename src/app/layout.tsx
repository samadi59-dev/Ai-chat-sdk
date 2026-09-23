import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Conversation",
  description: "A focused AI SDK chat with history and image generation.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
