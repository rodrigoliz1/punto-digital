import { ProspectError } from "./types";

export function normalizeText(value: string) {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Valida URLs http(s) públicas sin credenciales embebidas. Devuelve la URL normalizada o null. */
export function parseHttpUrl(value: string | null | undefined): URL | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
  return url;
}

export function requireHttpUrl(value: string | null | undefined, field: string) {
  const url = parseHttpUrl(value);
  if (!url) throw new ProspectError(`El campo ${field} debe ser una URL http(s) válida.`, 422, "invalid_url");
  return url.toString();
}

export function registrableDomain(value: string | null | undefined) {
  const url = parseHttpUrl(value);
  if (!url) return null;
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

export function normalizeEmail(value: string | null | undefined) {
  if (!value) return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function emailDomain(email: string) {
  return email.split("@")[1] ?? "";
}

/** Proveedores de correo personal: no se tratan como correo comercial verificado. */
const PERSONAL_EMAIL_DOMAINS = new Set(["gmail.com", "hotmail.com", "outlook.com", "live.com", "yahoo.com", "yahoo.com.mx", "icloud.com", "me.com", "prodigy.net.mx", "aol.com", "protonmail.com", "proton.me"]);

export function isPersonalEmailDomain(email: string) {
  return PERSONAL_EMAIL_DOMAINS.has(emailDomain(email));
}

export function normalizePhone(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

export function instagramHandle(value: string | null | undefined) {
  const url = parseHttpUrl(value);
  if (!url || !/(^|\.)instagram\.com$/i.test(url.hostname)) return null;
  const handle = url.pathname.split("/").filter(Boolean)[0];
  if (!handle || ["p", "reel", "explore", "stories"].includes(handle)) return null;
  return handle.toLowerCase();
}

export function dedupeKey(input: { name: string; city: string; website?: string | null; googlePlaceId?: string | null }) {
  if (input.googlePlaceId) return `place:${input.googlePlaceId}`;
  return `name:${normalizeText(input.name)}|${normalizeText(input.city)}|${registrableDomain(input.website) ?? ""}`;
}
