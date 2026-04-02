/**
 * Google Maps Distance Matrix（transit）で概算所要時間（秒）を取得。
 * GOOGLE_MAPS_API_KEY 未設定時は null。
 */
export async function fetchTransitDurationSeconds(
  origin: string,
  destination: string,
): Promise<number | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key || !origin.trim() || !destination.trim()) return null;

  const u = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  u.searchParams.set("origins", origin);
  u.searchParams.set("destinations", destination);
  u.searchParams.set("mode", "transit");
  u.searchParams.set("language", "ja");
  u.searchParams.set("departure_time", String(Math.floor(Date.now() / 1000)));
  u.searchParams.set("key", key);

  const res = await fetch(u.toString(), { next: { revalidate: 0 } });
  if (!res.ok) return null;
  const j = (await res.json()) as {
    status?: string;
    rows?: { elements?: { status?: string; duration?: { value: number } }[] }[];
  };
  if (j.status !== "OK") return null;
  const el = j.rows?.[0]?.elements?.[0];
  if (!el || el.status !== "OK" || el.duration?.value == null) return null;
  return el.duration.value;
}
