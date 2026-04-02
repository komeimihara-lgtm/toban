"use client";

import {
  acceptAiInterviewRequest,
  completeAiInterview,
} from "@/app/actions/ai-interview-actions";
import type { HrChatTurn } from "@/lib/hr-ai-messages";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { HrAssistantChat } from "./hr-assistant-chat";

type ChatLine = { role: "user" | "assistant"; text: string };

function interviewReply(userText: string): string {
  const t = userText.toLowerCase();
  if (/疲|つら|困|ストレス|不安/.test(t)) {
    return "お疲れさまです。その状況が続くと負担が大きいですね。いま一番しんどいのは業務量でしょうか、人間関係でしょうか。短く教えてください。";
  }
  if (/休|有給|休み/.test(t)) {
    return "休養を取ることは大切です。有給や相談窓口の利用も検討できます。人事に詳しく相談したい topics はありますか？";
  }
  return "ありがとうございます。ほかに話しておきたいことはありますか。よければ、仕事の希望や不安を一文で教えてください。";
}

export type HrAiClientProps = {
  hrInitialConversationId?: string | null;
  hrInitialMessages?: HrChatTurn[];
};

export function HrAiClient({
  hrInitialConversationId = null,
  hrInitialMessages = [],
}: HrAiClientProps) {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const requestId = searchParams.get("request");
  const isInterview = mode === "interview" && Boolean(requestId);

  const [accepted, setAccepted] = useState(false);
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [input, setInput] = useState("");
  const [summary, setSummary] = useState("");
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const acceptOnce = useRef(false);

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
          text: "こんにちは。今日の面談では、お仕事の様子やご不安な点を自由にお聞かせください。内容は厳重に取り扱い、外部には出しません。",
        },
      ]);
    });
  }, [isInterview, requestId]);

  const appendSummaryLine = useCallback((line: string) => {
    setSummary((prev) => (prev ? `${prev}\n${line}` : line));
  }, []);

  const send = () => {
    const t = input.trim();
    if (!t) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: t }]);
    const reply = interviewReply(t);
    setMessages((m) => [...m, { role: "assistant", text: reply }]);
    appendSummaryLine(`自分: ${t}`);
    appendSummaryLine(`AI: ${reply}`);
  };

  const finish = () => {
    if (!requestId) return;
    start(async () => {
      setErr(null);
      const body =
        summary.trim() ||
        messages.map((m) => `${m.role === "user" ? "自分" : "AI"}: ${m.text}`).join("\n");
      const r = await completeAiInterview(requestId, body);
      if (!r.ok) {
        setErr("message" in r ? r.message : "保存に失敗しました");
        return;
      }
      setDoneMsg("面談を記録しました。担当へ通知を送りました（LINE 設定時）。");
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
            プライバシーに配慮し、会話の要点は要約として人事担当へ共有されます。
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
                  key={`${i}-${m.role}`}
                  className={`text-sm ${
                    m.role === "user"
                      ? "ml-8 text-right text-zinc-900 dark:text-zinc-100"
                      : "mr-8 text-left text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <span className="inline-block rounded-2xl bg-white px-3 py-2 shadow-sm dark:bg-zinc-800">
                    {m.text}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="メッセージを入力…"
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                disabled={Boolean(doneMsg)}
              />
              <button
                type="button"
                onClick={send}
                disabled={Boolean(doneMsg) || pending}
                className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
              >
                送信
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500">
                要約（編集可・終了時に保存）
              </label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-zinc-300 p-3 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                disabled={Boolean(doneMsg)}
              />
              <button
                type="button"
                onClick={finish}
                disabled={Boolean(doneMsg) || pending}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                面談を終了して保存
              </button>
            </div>
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
