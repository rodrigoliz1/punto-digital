/** TOTP (RFC 6238, HMAC-SHA1, 6 dígitos, 30 s), compatible con Google Authenticator, 1Password, Authy, etc. */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_PERIOD = 30;

export function base32Encode(bytes: Uint8Array) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string) {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Base32 inválido");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

export function generateTotpSecret() {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}

export async function hotp(secret: Uint8Array, counter: number, digits = 6) {
  const message = new Uint8Array(8);
  let remaining = counter;
  for (let i = 7; i >= 0; i -= 1) {
    message[i] = remaining & 255;
    remaining = Math.floor(remaining / 256);
  }
  const key = await crypto.subtle.importKey("raw", secret as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
  const offset = mac[mac.length - 1] & 15;
  const code = ((mac[offset] & 127) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(code % 10 ** digits).padStart(digits, "0");
}

export function totpCounter(at: Date) {
  return Math.floor(at.getTime() / 1000 / TOTP_PERIOD);
}

/**
 * Verifica un código con tolerancia de ±1 periodo. Devuelve el contador usado para impedir
 * reutilizar el mismo código (el llamador debe exigir un contador mayor al último aceptado).
 */
export async function verifyTotp(secretBase32: string, code: string, at: Date, lastCounter: number | null = null) {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretBase32);
  const current = totpCounter(at);
  for (const counter of [current - 1, current, current + 1]) {
    if (lastCounter !== null && counter <= lastCounter) continue;
    if ((await hotp(secret, counter)) === code) return counter;
  }
  return null;
}

export function otpauthUri(secret: string, email: string, issuer = "Punto Digital") {
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${email}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${TOTP_PERIOD}`;
}
