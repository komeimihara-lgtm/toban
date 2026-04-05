export default function AppShellLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl animate-pulse space-y-6 px-0 md:px-0">
      <div className="h-8 w-40 rounded-lg bg-zinc-200" />
      <div className="h-40 rounded-2xl bg-zinc-200" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-36 rounded-2xl bg-zinc-200" />
        <div className="h-36 rounded-2xl bg-zinc-200" />
      </div>
      <div className="h-48 rounded-2xl bg-zinc-200" />
    </div>
  );
}
