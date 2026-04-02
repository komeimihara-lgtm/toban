import { redirect } from "next/navigation";

/** エントリは /hr-ai。本体は /my/hr-ai（クエリを引き継ぐ） */
export default async function HrAiLegacyRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [key, val] of Object.entries(sp)) {
    if (val == null) continue;
    if (Array.isArray(val)) {
      for (const v of val) q.append(key, v);
    } else {
      q.set(key, val);
    }
  }
  const suffix = q.toString() ? `?${q.toString()}` : "";
  redirect(`/my/hr-ai${suffix}`);
}
