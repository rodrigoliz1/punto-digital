import { type Actor, type ProspectStatus, ProspectError, roleAtLeast } from "./types";

/**
 * Flujo: discovered -> qualified -> demo_ready -> approved -> contacted -> replied -> meeting -> won/lost.
 * `suppressed` es alcanzable desde cualquier estado y es terminal (opt-out).
 */
const TRANSITIONS: Record<ProspectStatus, ProspectStatus[]> = {
  discovered: ["qualified", "lost", "suppressed"],
  qualified: ["discovered", "demo_ready", "lost", "suppressed"],
  demo_ready: ["qualified", "approved", "lost", "suppressed"],
  approved: ["demo_ready", "contacted", "lost", "suppressed"],
  contacted: ["replied", "meeting", "won", "lost", "suppressed"],
  replied: ["meeting", "won", "lost", "suppressed"],
  meeting: ["won", "lost", "suppressed"],
  won: ["suppressed"],
  lost: ["discovered", "suppressed"],
  suppressed: [],
};

/** Transiciones que solo una persona con rol de revisión puede ejecutar. */
const HUMAN_REVIEW_TARGETS = new Set<ProspectStatus>(["approved", "contacted", "replied", "meeting", "won", "lost"]);
/** Salir de estados sensibles también exige revisión humana. */
const PROTECTED_SOURCES = new Set<ProspectStatus>(["approved", "contacted", "replied", "meeting", "won"]);

export function canTransition(from: ProspectStatus, to: ProspectStatus) {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ProspectStatus, to: ProspectStatus, actor: Actor) {
  if (!canTransition(from, to)) throw new ProspectError(`Transición no permitida: ${from} → ${to}.`);
  if (to === "suppressed") return;
  const needsHuman = HUMAN_REVIEW_TARGETS.has(to) || PROTECTED_SOURCES.has(from);
  if (!needsHuman) return;
  if (actor.kind !== "human") throw new ProspectError("Un agente no puede aprobar, registrar contactos ni cerrar oportunidades.", 403, "human_required");
  if (!roleAtLeast(actor.role, "reviewer")) throw new ProspectError("Esta transición requiere rol de revisor.", 403, "forbidden");
}

export function nextStatuses(from: ProspectStatus) {
  return TRANSITIONS[from];
}
