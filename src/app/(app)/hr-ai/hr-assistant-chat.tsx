"use client";

import type { HrChatTurn } from "@/lib/hr-ai-messages";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const QUICK_QUESTIONS = [
  "有給残日数を確認",
  "評価を上げるには？",
  "インセンティブの確認",
  "キャリア相談したい",
  "悩みを聞いてほしい",
  "就業規則を確認",
] as const;

type Props = {
  initialConversationId: string | null;
  initialMessages: HrChatTurn[];
};

export function HrAssistantChat({
  initialConversationId,
  initialMessages,
}: Props) {
  const [messages, setMessages] = useState<HrChatTurn[]>(initialMessages);
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId,
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || loading) return;
    setErr(null);
    const prior = messages;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    setInput("");
    try {
      const res = await fetch("/api/hr-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversation_id: conversationId,
          conversation_history: conversationId ? undefined : prior,
        }),
      });
      const j = (await res.json()) as {
        error?: string;
        reply?: string;
        conversation_id?: string;
      };
      if (!res.ok) {
        setMessages(prior);
        setErr(j.error ?? "エラーが発生しました");
        return;
      }
      if (j.conversation_id) setConversationId(j.conversation_id);
      setMessages([
        ...prior,
        { role: "user", content: text },
        { role: "assistant", content: j.reply ?? "" },
      ]);
    } catch {
      setMessages(prior);
      setErr("通信エラー");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          AI 人事アシスタント
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          人事・労務・キャリアについて自然な日本语的でご相談ください。内容は保存され、あなた本人のみが参照できます。
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-start">
        <aside className="space-y-2 md:sticky md:top-4">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            クイック質問
          </p>
          <ul className="flex flex-col gap-2">
            {QUICK_QUESTIONS.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void send(q)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-left text-sm text-zinc-800 transition hover:border-violet-400 hover:bg-violet-50/80 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-violet-700 dark:hover:bg-violet-950/40"
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="flex min-h-[28rem] flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="max-h-[min(60vh,520px)] flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && !loading && (
              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                左のボタンか、下の入力欄から話しかけてください。
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={`${i}-${m.role}-${m.content.slice(0, 24)}`}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[min(100%,42rem)] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-violet-600 text-white"
                      : "border border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  回答を用意しています…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
            {err && (
              <p className="mb-2 text-sm text-red-600 dark:text-red-400">{err}</p>
            )}
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                placeholder="質問を日本語で入力…（Enter 送信 / Shift+Enter 改行）"
                rows={2}
                disabled={loading}
                className="min-h-[44px] flex-1 resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              />
              <button
                type="button"
                disabled={loading || !input.trim()}
                onClick={() => void send(input)}
                className="shrink-0 self-end rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
              >
                送信
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
