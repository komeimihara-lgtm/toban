export type TransitRouteInsight = {
  /** Google Distance Matrix transit の duration（秒） */
  durationSec: number;
  /** 路線距離（メートル） */
  distanceM: number;
};

/**
 * Google Maps Distance Matrix API（mode=transit）で所要時間・距離を取得。
 * 出発地・到着地の検証用。GOOGLE_MAPS_API_KEY 未設定時は null。
 */
export async function fetchTransitRouteInsight(
  origin: string,
  destination: string,
): Promise<TransitRouteInsight | null> {
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
    rows?: {
      elements?: {
        status?: string;
        duration?: { value: number };
        distance?: { value: number };
      }[];
    }[];
  };
  if (j.status !== "OK") return null;
  const el = j.rows?.[0]?.elements?.[0];
  if (!el || el.status !== "OK" || el.duration?.value == null) return null;
  const distanceM = el.distance?.value ?? 0;
  return { durationSec: el.duration.value, distanceM };
}

export async function fetchTransitDurationSeconds(
  origin: string,
  destination: string,
): Promise<number | null> {
  const r = await fetchTransitRouteInsight(origin, destination);
  return r?.durationSec ?? null;
}
