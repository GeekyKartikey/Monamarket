import { HermesClient } from "@pythnetwork/hermes-client";

const HERMES_MAIN =
  process.env.NEXT_PUBLIC_PYTH_HERMES ?? "https://hermes.pyth.network";
const HERMES_BETA =
  process.env.NEXT_PUBLIC_PYTH_HERMES_BETA ?? "https://hermes-beta.pyth.network";

let mainClient: HermesClient | null = null;
let betaClient: HermesClient | null = null;

export function getMainClient(): HermesClient {
  if (!mainClient) mainClient = new HermesClient(HERMES_MAIN);
  return mainClient;
}

export function getBetaClient(): HermesClient {
  if (!betaClient) betaClient = new HermesClient(HERMES_BETA);
  return betaClient;
}

/// Fetch the latest VAA for a feed, using the appropriate Hermes endpoint.
/// `useBeta` should be true for MON/USD (beta feed).
export async function fetchPriceUpdateData(
  feedId: string,
  useBeta = false
): Promise<`0x${string}`[]> {
  const client = useBeta ? getBetaClient() : getMainClient();
  const updates = await client.getLatestPriceUpdates([feedId]);
  return updates.binary.data.map((d) => `0x${d}` as `0x${string}`);
}

/// Fetch VAA for a specific publish-time window around `targetTimestamp` (Unix seconds).
/// Used by ResolveButton to get the price that was valid at resolveTime.
export async function fetchPriceUpdateDataAtTime(
  feedId: string,
  targetTimestamp: number,
  useBeta = false
): Promise<`0x${string}`[]> {
  const client = useBeta ? getBetaClient() : getMainClient();
  const updates = await client.getPriceUpdatesAtTimestamp(targetTimestamp, [
    feedId,
  ]);
  return updates.binary.data.map((d) => `0x${d}` as `0x${string}`);
}

/// BETA feed IDs that require the beta Hermes endpoint + beta Pyth contract.
export const BETA_FEED_IDS = new Set([
  "0xe786153cc54abd4b0e53b4c246d54d9f8eb3f3b5a34d4fc5a2e9a423b0ba5d6b",
]);

export function isBetaFeed(feedId: string): boolean {
  return BETA_FEED_IDS.has(feedId.toLowerCase());
}
