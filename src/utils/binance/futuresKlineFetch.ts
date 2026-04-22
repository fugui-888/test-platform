export const FAPI_BASE = 'https://fapi.binance.com';

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchJsonWith429Backoff(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  let delay = 1500;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, init);
    if (res.status === 429) {
      await sleep(delay);
      delay = Math.min(delay * 2, 20000);
      continue;
    }
    return res;
  }
  return fetch(url, init);
}
