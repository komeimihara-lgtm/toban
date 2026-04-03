"use client";

import {
  acceptAiInterviewRequest,
  completeAiInterview,
} from "@/app/actions/ai-interview-actions";
import type { HrChatTurn } from "@/lib/hr-ai-messages";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { HrAssistantChat } from "./hr-assistant-chat";

export type HrAiClientProps = {
  hrInitialConversationId?: string | null;
  hrInitialMessages?: HrChatTurn[];
};

export function HrAiClient({
  hrInitialConversationId = null,
  hrInitialMessages = [],
}: HrAiClientProps) {
  const searchParams = useSearchParams();
  const requestId = searchParams.get("request");
  const interviewModeFlag =
    searchParams.get("interview_mode") === "true" ||
    searchParams.get("mode") === "interview";
  const isInterview = interviewModeFlag && Boolean(requestId);

  const [accepted, setAccepted] = useState(false);
  const [messages, setMessages] = useState<HrChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, start] = useTransition();
  const acceptOnce = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, accepted]);

  useEffect(() => {
    if (!isInterview || !requestId || acceptOnce.current) return;
    acceptOnce.current = true;
    start(async () => {
      const r = await acceptAiInterviewRequest(requestId);
      if (!r.ok) {
        acceptOnce.current = false;
        setErr("この面談を開始できません。招待が無効か、すでに終了しています。");
        return;
      }
      setAccepted(true);
      setMessages([
        {
          role: "assistant",
          content:
            "こんにちは。今日は、お仕事のことやお気持ちになっていることを、焦らずお聞かせください。ここでの会話の内容が、具体的な文面として上司に伝わることはありません。",
        },
      ]);
    });
  }, [isInterview, requestId]);

  const sendInterviewMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || !accepted || doneMsg) return;
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
          interview_mode: true,
          conversation_history: prior,
        }),
      });
      const j = (await res.json()) as { error?: string; reply?: string };
      if (!res.ok) {
        setMessages(prior);
        setErr(j.error ?? "エラーが発生しました");
        return;
      }
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
  }, [input, loading, accepted, doneMsg, messages]);

  const finish = () => {
    if (!requestId) return;
    start(async () => {
      setErr(null);
      const r = await completeAiInterview(requestId);
      if (!r.ok) {
        setErr(r.message ?? "保存に失敗しました");
        return;
      }
      setDoneMsg(
        "面談を終了しました。担当へ「面談が行われた事実」のみ通知しました（内容は伝えていません）。",
      );
    });
  };

  if (isInterview) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            AI 面談
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            会話は通常のAI相談履歴には保存されません。終了後、上司には「面談があった事実」だけが届きます。
          </p>
        </div>

        {!accepted && (
          <p className="text-sm text-zinc-500">面談を初期化しています…</p>
        )}

        {accepted && (
          <>
            <div className="max-h-80 space-y-3 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              {messages.map((m, i) => (
                <div
                  key={`${i}-${m.role}-${m.content.slice(0, 12)}`}
                  className={`text-sm ${
                    m.role === "user"
                      ? "ml-8 text-right text-zinc-900 dark:text-zinc-100"
                      : "mr-8 text-left text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <span className="inline-block rounded-2xl bg-white px-3 py-2 shadow-sm dark:bg-zinc-800">
                    {m.content}
                  </span>
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  応答を生成しています…
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendInterviewMessage();
                  }
                }}
                placeholder="メッセージを入力…"
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                disabled={Boolean(doneMsg)}
              />
              <button
                type="button"
                onClick={() => void sendInterviewMessage()}
                disabled={Boolean(doneMsg) || loading || pending}
                className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
              >
                送信
              </button>
            </div>

            <button
              type="button"
              onClick={finish}
              disabled={Boolean(doneMsg) || pending}
              className="w-full rounded-lg border border-zinc-400 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              面談を終了する
            </button>
          </>
        )}

        {err && <p className="text-sm text-red-600">{err}</p>}
        {doneMsg && <p className="text-sm text-emerald-700 dark:text-emerald-400">{doneMsg}</p>}
      </div>
    );
  }

  return (
    <HrAssistantChat
      initialConversationId={hrInitialConversationId}
      initialMessages={hrInitialMessages}
    />
  );
}
