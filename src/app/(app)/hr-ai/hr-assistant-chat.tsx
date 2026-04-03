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
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);
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

  async function summarizeToOwner() {
    if (!conversationId || notifyBusy || loading) return;
    const userMsgs = messages.filter((m) => m.role === "user");
    if (userMsgs.length === 0) {
      setErr("送信できる会話がありません");
      return;
    }
    setNotifyMsg(null);
    setErr(null);
    setNotifyBusy(true);
    try {
      const res = await fetch("/api/hr-ai/summarize-to-owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId }),
      });
      const j = (await res.json()) as {
        error?: string;
        summary?: string;
        message?: string;
        notified?: boolean;
      };
      if (!res.ok) {
        setErr(j.error ?? "送信に失敗しました");
        return;
      }
      setNotifyMsg(j.message ?? "処理しました。");
      if (j.summary && !j.notified) {
        setNotifyMsg(`${j.message ?? ""}\n\n【要約プレビュー】\n${j.summary}`);
      }
    } catch {
      setErr("通信エラー");
    } finally {
      setNotifyBusy(false);
    }
  }

  const canNotifyOwner =
    Boolean(conversationId) && messages.some((m) => m.role === "user");

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          AI 人事アシスタント
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          人事・労務・キャリアについて自然な日本語でご相談ください。会話はあなた本人のみが参照できます。
        </p>
        <p className="mt-3 rounded-lg border border-violet-200 bg-violet-50/70 px-3 py-2 text-xs leading-relaxed text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-100">
          相談の内容が、他のスタッフへ自動では共有されません。必要なときだけ、代表（三原）向けに
          <strong className="font-medium">要約テキスト</strong>
          をLINE通知キューへ載せることができます（チャット原文は送りません）。
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
            {notifyMsg && (
              <p className="mb-2 whitespace-pre-wrap rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                {notifyMsg}
              </p>
            )}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!canNotifyOwner || notifyBusy || loading}
                onClick={() => void summarizeToOwner()}
                className="rounded-lg border border-violet-400 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-900/60"
              >
                {notifyBusy ? "送信中…" : "三原代表に要約を送信"}
              </button>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                1往復以上チャット後・会話が保存されているときに利用できます
              </span>
            </div>
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
                className="min-h-[44px] flex-1 resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
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
