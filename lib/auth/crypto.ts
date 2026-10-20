/** Primitivas criptográficas sobre WebCrypto (disponible en Workers, Node y Vercel). */

const encoder = new TextEncoder();

export function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(value: string) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function randomToken(bytes = 32) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Comparación en tiempo constante para cadenas de igual longitud lógica. */
export function timingSafeEqual(a: string, b: string) {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Contraseñas: PBKDF2-SHA256. Workers limita PBKDF2 a 100 000 iteraciones;
// el formato guarda las iteraciones para poder subirlas en el futuro.
// ---------------------------------------------------------------------------

export const PASSWORD_ITERATIONS = 100_000;
export const PASSWORD_MIN_LENGTH = 12;

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password.normalize("NFKC")), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256));
}

export async function hashPassword(password: string, iterations = PASSWORD_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$${iterations}$${toBase64Url(salt)}$${toBase64Url(await pbkdf2(password, salt, iterations))}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, iterationsText, saltText, hashText] = stored.split("$");
  const iterations = Number(iterationsText);
  if (scheme !== "pbkdf2-sha256" || !Number.isInteger(iterations) || iterations < 10_000 || iterations > PASSWORD_ITERATIONS || !saltText || !hashText) return false;
  const derived = await pbkdf2(password, fromBase64Url(saltText), iterations);
  return timingSafeEqual(toBase64Url(derived), hashText);
}

/** Hash ficticio para igualar tiempos cuando la cuenta no existe (evita enumeración). */
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash() {
  dummyHash ??= hashPassword("contraseña-ficticia-para-igualar-tiempos");
  return dummyHash;
}

export function passwordProblems(password: string, email: string) {
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) problems.push(`Usa al menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  if (password.length > 200) problems.push("La contraseña es demasiado larga.");
  if (password.toLowerCase().includes(email.split("@")[0].toLowerCase())) problems.push("No incluyas tu correo en la contraseña.");
  if (/^(.)\1+$/.test(password)) problems.push("La contraseña es demasiado simple.");
  return problems;
}

// ---------------------------------------------------------------------------
// Cifrado del secreto TOTP: AES-256-GCM con clave derivada (HKDF) de AUTH_SECRET.
// ---------------------------------------------------------------------------

async function aesKey(secret: string) {
  const base = await crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: encoder.encode("punto-digital/staff-auth/v1"), info: encoder.encode("totp-secret") }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plaintext: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(secret), encoder.encode(plaintext)));
  return `v1.${toBase64Url(iv)}.${toBase64Url(ciphertext)}`;
}

export async function decryptSecret(payload: string, secret: string) {
  const [version, ivText, dataText] = payload.split(".");
  if (version !== "v1" || !ivText || !dataText) throw new Error("Formato de secreto inválido");
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64Url(ivText) as BufferSource }, await aesKey(secret), fromBase64Url(dataText) as BufferSource);
  return new TextDecoder().decode(plaintext);
}
