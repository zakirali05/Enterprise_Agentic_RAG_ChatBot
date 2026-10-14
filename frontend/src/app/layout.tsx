import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Enterprise Agentic RAG Copilot | LangGraph & Qdrant Cloud",
  description:
    "Full-stack enterprise AI copilot with Corrective RAG (CRAG), real-time SSE streaming, LangGraph state machine, Qdrant Cloud vector store, Hugging Face embeddings, and Supabase Storage.",
  keywords: [
    "Agentic RAG",
    "LangGraph",
    "FastAPI",
    "Next.js",
    "Qdrant Cloud",
    "Hugging Face",
    "BAAI/bge-small-en-v1.5",
    "Supabase Storage",
    "Groq LPU",
    "Enterprise AI",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#090d16] text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200">
        {children}
      </body>
    </html>
  );
}
