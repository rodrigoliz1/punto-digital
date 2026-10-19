/** Enlaces de demo: token aleatorio de 256 bits; en base de datos solo se guarda su SHA-256. */
export const DEMO_LINK_DAYS = 14;

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function createAccessToken() {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isWellFormedToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function expiresAt(now: Date, days = DEMO_LINK_DAYS) {
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}
