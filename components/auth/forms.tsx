"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";

async function post(path: string, body: unknown) {
  try {
    const response = await fetch(`/api/auth/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
    const data = (await response.json().catch(() => ({}))) as Record<string, string>;
    return response.ok ? { ok: true as const, data } : { ok: false as const, error: data.error ?? `Error ${response.status}` };
  } catch {
    return { ok: false as const, error: "No se pudo conectar. Intenta de nuevo." };
  }
}

function field(form: HTMLFormElement, name: string) {
  return String(new FormData(form).get(name) ?? "").trim();
}

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError(null);
    const result = await post("login", { email: field(form, "email"), password: String(new FormData(form).get("password") ?? ""), code: field(form, "code") });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    router.replace(next);
    router.refresh();
  };
  return (
    <form className="po-form" onSubmit={submit}>
      <label className="po-field po-field--wide"><span>Correo</span><input name="email" type="email" autoComplete="username" required /></label>
      <label className="po-field po-field--wide"><span>Contraseña</span><input name="password" type="password" autoComplete="current-password" required /></label>
      <label className="po-field po-field--wide"><span>Código del autenticador</span><input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} placeholder="000000" required /></label>
      <div className="po-form__footer"><button className="po-btn po-btn--primary" disabled={busy}>{busy ? <Loader2 size={14} className="po-spin" /> : null}Entrar</button>{error ? <small role="alert" className="po-error">{error}</small> : null}</div>
    </form>
  );
}

export function EnrollForm({ email: initialEmail, token: initialToken }: { email: string; token: string }) {
  const router = useRouter();
  const [step, setStep] = useState<{ email: string; token: string; secret: string; uri: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const start = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = field(form, "email");
    const token = field(form, "token");
    setBusy(true);
    setError(null);
    const result = await post("enroll-start", { email, token });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setStep({ email, token, secret: result.data.secret, uri: result.data.otpauthUri });
  };
  const finish = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!step) return;
    const form = event.currentTarget;
    const password = String(new FormData(form).get("password") ?? "");
    if (password !== String(new FormData(form).get("confirm") ?? "")) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    setError(null);
    const result = await post("enroll-finish", { email: step.email, token: step.token, password, secret: step.secret, code: field(form, "code") });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    router.replace("/admin");
    router.refresh();
  };
  if (!step) return (
    <form className="po-form" onSubmit={start}>
      <label className="po-field po-field--wide"><span>Correo</span><input name="email" type="email" defaultValue={initialEmail} autoComplete="username" required /></label>
      <label className="po-field po-field--wide"><span>Token de activación</span><input name="token" defaultValue={initialToken} autoComplete="off" required /><small>Viene en tu invitación, o es AUTH_SETUP_TOKEN para la primera cuenta de propietario.</small></label>
      <div className="po-form__footer"><button className="po-btn po-btn--primary" disabled={busy}>{busy ? <Loader2 size={14} className="po-spin" /> : null}Continuar</button>{error ? <small role="alert" className="po-error">{error}</small> : null}</div>
    </form>
  );
  return (
    <form className="po-form" onSubmit={finish}>
      <div className="po-notice"><strong>1. Agrega la cuenta a tu app de autenticación</strong> (1Password, Google Authenticator, Authy…). En el teléfono puedes <a className="po-link" href={step.uri}>abrir el enlace</a>, o captura la clave manualmente:<pre className="po-secret">{step.secret.match(/.{1,4}/g)?.join(" ")}</pre></div>
      <label className="po-field po-field--wide"><span>2. Contraseña nueva (mínimo 12 caracteres)</span><input name="password" type="password" autoComplete="new-password" minLength={12} required /></label>
      <label className="po-field po-field--wide"><span>Confirma la contraseña</span><input name="confirm" type="password" autoComplete="new-password" minLength={12} required /></label>
      <label className="po-field po-field--wide"><span>3. Código de 6 dígitos que muestra la app</span><input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required /></label>
      <div className="po-form__footer"><button className="po-btn po-btn--primary" disabled={busy}>{busy ? <Loader2 size={14} className="po-spin" /> : null}Activar acceso</button>{error ? <small role="alert" className="po-error">{error}</small> : null}</div>
    </form>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    await post("logout", {});
    router.replace("/admin/acceso");
    router.refresh();
  };
  return <button type="button" className="po-btn po-btn--ghost" onClick={run} disabled={busy} aria-label="Cerrar sesión"><LogOut size={15} />Salir</button>;
}
