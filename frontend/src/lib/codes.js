// Default shift codes seeded into the side panel.
// Pre-configured with the actual SP/Sata schedule codes as provided by the user
// (compiled from CARGA, OAE'S, SUPERVISÃO, PLACA and TTAE PDFs — May 2026).
// Ordered by entry time (earliest first), off-codes and vacation at the bottom.
// Times use HH:MM (24h). User can edit/add/remove inside the app and hit "Guardar".
// `kind`: "manha" (morning, green), "intermedio" (yellow), "tarde" (afternoon, red),
//         "folga" (off, white) or "ferias" (vacation, blue striped).
export const DEFAULT_CODES = [
  // ───────── Manhã (entrada ≤ 08:30) ─────────
  { code: "M7",   entry: "07:30", lunchStart: "12:00", lunchEnd: "13:00", exit: "16:00", kind: "manha", label: "SP M7" },
  { code: "M8",   entry: "07:30", lunchStart: "12:30", lunchEnd: "13:30", exit: "16:00", kind: "manha", label: "SP M8" },
  { code: "M9",   entry: "07:30", lunchStart: "13:00", lunchEnd: "14:00", exit: "16:00", kind: "manha", label: "SP M9" },
  { code: "M13",  entry: "08:00", lunchStart: "12:00", lunchEnd: "13:00", exit: "16:30", kind: "manha", label: "SP M13" },
  { code: "M14",  entry: "08:00", lunchStart: "12:30", lunchEnd: "13:30", exit: "16:30", kind: "manha", label: "SP M14" },
  { code: "M15",  entry: "08:00", lunchStart: "13:00", lunchEnd: "14:00", exit: "16:30", kind: "manha", label: "SP M15" },
  { code: "M16",  entry: "08:00", lunchStart: "13:30", lunchEnd: "14:30", exit: "16:30", kind: "manha", label: "SP M16" },
  { code: "H002", entry: "08:15", lunchStart: "12:30", lunchEnd: "14:00", exit: "17:45", kind: "manha", label: "SP H002" },
  { code: "M24",  entry: "08:30", lunchStart: "12:30", lunchEnd: "13:30", exit: "17:00", kind: "manha", label: "SP M24" },
  { code: "M25",  entry: "08:30", lunchStart: "13:00", lunchEnd: "14:00", exit: "17:00", kind: "manha", label: "SP M25" },
  { code: "M26",  entry: "08:30", lunchStart: "13:30", lunchEnd: "14:30", exit: "17:00", kind: "manha", label: "SP M26" },
  { code: "M28",  entry: "08:30", lunchStart: "12:00", lunchEnd: "13:30", exit: "17:30", kind: "manha", label: "SP M28" },
  { code: "M29",  entry: "08:30", lunchStart: "13:00", lunchEnd: "14:30", exit: "17:30", kind: "manha", label: "SP M29" },
  { code: "M29A", entry: "08:30", lunchStart: "13:00", lunchEnd: "15:00", exit: "18:00", kind: "manha", label: "SP M29A" },
  { code: "M29B", entry: "08:30", lunchStart: "11:30", lunchEnd: "13:00", exit: "18:00", kind: "manha", label: "SP M29B" },

  // ───────── Intermédio (08:31 – 09:30) ─────────
  { code: "M37",  entry: "09:00", lunchStart: "13:00", lunchEnd: "14:00", exit: "17:30", kind: "intermedio", label: "SP M37" },
  { code: "M40",  entry: "09:00", lunchStart: "11:30", lunchEnd: "13:00", exit: "18:00", kind: "intermedio", label: "SP M40" },
  { code: "M41",  entry: "09:00", lunchStart: "12:00", lunchEnd: "13:30", exit: "18:00", kind: "intermedio", label: "SP M41" },
  { code: "M42",  entry: "09:00", lunchStart: "12:30", lunchEnd: "14:00", exit: "18:00", kind: "intermedio", label: "SP M42" },
  { code: "M44",  entry: "09:00", lunchStart: "13:30", lunchEnd: "15:00", exit: "18:00", kind: "intermedio", label: "SP M44" },
  { code: "M45",  entry: "09:00", lunchStart: "12:00", lunchEnd: "14:00", exit: "18:30", kind: "intermedio", label: "SP M45" },
  { code: "M45A", entry: "09:00", lunchStart: "13:00", lunchEnd: "15:00", exit: "18:30", kind: "intermedio", label: "SP M45A" },
  { code: "M49",  entry: "09:30", lunchStart: "12:30", lunchEnd: "14:00", exit: "18:30", kind: "intermedio", label: "SP M49" },
  { code: "M50",  entry: "09:30", lunchStart: "13:30", lunchEnd: "15:00", exit: "18:30", kind: "intermedio", label: "SP M50" },
  { code: "50A",  entry: "09:30", lunchStart: "13:00", lunchEnd: "15:00", exit: "19:00", kind: "intermedio", label: "SP M50A" },

  // ───────── Tarde (entrada ≥ 09:31) ─────────
  { code: "M63",  entry: "10:30", lunchStart: "12:30", lunchEnd: "13:30", exit: "19:00", kind: "tarde", label: "SP M63" },
  { code: "M76",  entry: "11:30", lunchStart: "13:30", lunchEnd: "15:00", exit: "20:30", kind: "tarde", label: "SP M76" },
  { code: "M76A", entry: "11:30", lunchStart: "13:00", lunchEnd: "14:30", exit: "20:00", kind: "tarde", label: "SP M76A" },
  { code: "IT2",  entry: "12:00", lunchStart: "14:00", lunchEnd: "15:00", exit: "20:30", kind: "tarde", label: "SP T2" },
  { code: "T6",   entry: "13:00", lunchStart: "18:00", lunchEnd: "19:00", exit: "21:30", kind: "tarde", label: "SP T6" },
  { code: "T7",   entry: "13:00", lunchStart: "18:30", lunchEnd: "19:30", exit: "21:30", kind: "tarde", label: "SP T7" },

  // ───────── Part-time / turnos curtos (sem almoço) ─────────
  { code: "P16",  entry: "08:00", lunchStart: "", lunchEnd: "", exit: "13:00", kind: "manha",      label: "SP PT16" },
  { code: "P41",  entry: "07:30", lunchStart: "", lunchEnd: "", exit: "12:30", kind: "manha",      label: "SP PT41" },
  { code: "P36",  entry: "10:30", lunchStart: "13:00", lunchEnd: "14:00", exit: "16:30", kind: "tarde", label: "SP PT36" },
  { code: "P34",  entry: "15:00", lunchStart: "", lunchEnd: "", exit: "20:00", kind: "tarde",      label: "SP PT34" },
  { code: "P24",  entry: "16:00", lunchStart: "", lunchEnd: "", exit: "21:00", kind: "tarde",      label: "SP PT24" },

  // ───────── Eventos / sem horas fixas (contam como turno) ─────────
  { code: "720",  entry: "", lunchStart: "", lunchEnd: "", exit: "", kind: "tarde", label: "Deslocações" },
  { code: "796",  entry: "", lunchStart: "", lunchEnd: "", exit: "", kind: "tarde", label: "Formação" },

  // ───────── Folgas / off (sem alarmes, branco) ─────────
  { code: "D",    entry: "", lunchStart: "", lunchEnd: "", exit: "", kind: "folga", label: "Folga (DE/Folga/FE)" },
  { code: "DF",   entry: "", lunchStart: "", lunchEnd: "", exit: "", kind: "folga", label: "Dispensa em Feriado" },
  { code: "FCD",  entry: "", lunchStart: "", lunchEnd: "", exit: "", kind: "folga", label: "Folga de Compensação" },
  { code: "704",  entry: "", lunchStart: "", lunchEnd: "", exit: "", kind: "folga", label: "Casamento" },
  { code: "MAT",  entry: "", lunchStart: "", lunchEnd: "", exit: "", kind: "folga", label: "Maternidade" },

  // ───────── Férias ─────────
  { code: "F",    entry: "", lunchStart: "", lunchEnd: "", exit: "", kind: "ferias", label: "Férias" },
  { code: "791",  entry: "", lunchStart: "", lunchEnd: "", exit: "", kind: "ferias", label: "Férias Ano Anterior" },
];

// Resolve a code (e.g. "M76") to its config + its kind.
// Falls back to inferring kind from the code prefix or entry hour.
export function resolveCode(code, codes) {
  if (!code) return null;
  const upper = code.toUpperCase();
  const found = codes.find((c) => c.code.toUpperCase() === upper);
  if (found) return { ...found, code: found.code.toUpperCase() };
  // Heuristic fallback for unknown codes
  if (/^F$|^FER/i.test(upper)) {
    return { code: upper, entry: "", lunchStart: "", lunchEnd: "", exit: "", kind: "ferias", label: "Férias" };
  }
  if (/^(D|DF|FCD|MAT|FOL)$/i.test(upper)) {
    return { code: upper, entry: "", lunchStart: "", lunchEnd: "", exit: "", kind: "folga", label: "Folga" };
  }
  // M-prefixed codes are morning by default; everything else (T, P, IT, S, N, etc.)
  // defaults to "tarde" — safer for airline-style rosters.
  if (/^M/.test(upper)) {
    return { code: upper, entry: "", lunchStart: "", lunchEnd: "", exit: "", kind: "manha", unknown: true };
  }
  return { code: upper, entry: "", lunchStart: "", lunchEnd: "", exit: "", kind: "tarde", unknown: true };
}

// Returns one of: "manha" | "intermedio" | "tarde" | "folga" | "ferias" | "vazio"
// Time-based rules:
//   entry <= 08:30           -> manha (verde)        [07:00–08:30]
//   08:31 <= entry <= 09:30  -> intermedio (amarelo) [08:31–09:30]
//   entry >= 09:31           -> tarde (vermelho)    [09:31+]
export function inferKind(cfg) {
  if (!cfg) return "vazio";
  if (cfg.kind === "ferias") return "ferias";
  if (cfg.kind === "folga") return "folga";

  if (cfg.entry) {
    const parts = cfg.entry.split(":");
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!Number.isNaN(h)) {
      const minutes = h * 60 + (Number.isNaN(m) ? 0 : m);
      if (minutes <= 8 * 60 + 30) return "manha";       // <= 08:30
      if (minutes <= 9 * 60 + 30) return "intermedio";  // 08:31 – 09:30
      return "tarde";                                    // >= 09:31
    }
  }

  const code = (cfg.code || "").toUpperCase();
  if (/^F$|^FER/.test(code)) return "ferias";
  if (/^(D|DF|FCD|MAT)$/.test(code)) return "folga";
  if (/^M/.test(code)) return "manha";
  if (cfg.kind === "intermedio") return "intermedio";
  return "tarde";
}
