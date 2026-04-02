import { LoginForm } from "./login-form";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-zinc-500">
          読み込み中…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
