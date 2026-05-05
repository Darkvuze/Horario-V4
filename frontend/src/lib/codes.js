// Default shift codes seeded into the side panel.
// Times use HH:MM (24h). User can edit/add/remove inside the app.
// `kind`: "manha" (morning), "tarde" (afternoon), "folga" (off).
export const DEFAULT_CODES = [
  { code: "M76", entry: "07:00", lunchStart: "11:00", lunchEnd: "12:00", exit: "15:00", kind: "manha" },
  { code: "M50", entry: "06:00", lunchStart: "10:00", lunchEnd: "11:00", exit: "14:00", kind: "manha" },
  { code: "M14", entry: "08:00", lunchStart: "12:00", lunchEnd: "13:00", exit: "16:00", kind: "manha" },
  { code: "M13", entry: "08:30", lunchStart: "12:30", lunchEnd: "13:30", exit: "16:30", kind: "manha" },
  { code: "M7",  entry: "07:00", lunchStart: "11:00", lunchEnd: "12:00", exit: "15:00", kind: "manha" },
  { code: "M42", entry: "09:00", lunchStart: "13:00", lunchEnd: "14:00", exit: "17:00", kind: "manha" },
  { code: "P16", entry: "13:00", lunchStart: "17:00", lunchEnd: "18:00", exit: "21:00", kind: "tarde" },
  { code: "P24", entry: "14:00", lunchStart: "18:00", lunchEnd: "19:00", exit: "22:00", kind: "tarde" },
  { code: "P34", entry: "15:00", lunchStart: "19:00", lunchEnd: "20:00", exit: "23:00", kind: "tarde" },
  { code: "50A", entry: "13:30", lunchStart: "17:30", lunchEnd: "18:30", exit: "21:30", kind: "tarde" },
  { code: "796", entry: "12:00", lunchStart: "16:00", lunchEnd: "17:00", exit: "20:00", kind: "tarde" },
  { code: "D",   entry: "",      lunchStart: "",      lunchEnd: "",      exit: "",      kind: "folga", label: "Folga" },
  { code: "DF",  entry: "",      lunchStart: "",      lunchEnd: "",      exit: "",      kind: "folga", label: "Folga" },
  { code: "F",   entry: "",      lunchStart: "",      lunchEnd: "",      exit: "",      kind: "folga", label: "Férias" },
];

// Resolve a code (e.g. "M76") to its config + its kind.
// Falls back to inferring kind from the code prefix or entry hour.
export function resolveCode(code, codes) {
  if (!code) return null;
  const upper = code.toUpperCase();
  const found = codes.find((c) => c.code.toUpperCase() === upper);
  if (found) return { ...found, code: found.code.toUpperCase() };
  // Heuristic fallback for unknown codes
  if (/^(D|DF|F|FER|FOL)$/i.test(upper)) {
    return { code: upper, entry: "", lunchStart: "", lunchEnd: "", exit: "", kind: "folga", label: "Folga" };
  }
  // M-prefixed codes are morning by default; everything else (T, P, IT, S, N, etc.)
  // defaults to "tarde" — safer for airline-style rosters.
  if (/^M/.test(upper)) {
    return { code: upper, entry: "", lunchStart: "", lunchEnd: "", exit: "", kind: "manha", unknown: true };
  }
  return { code: upper, entry: "", lunchStart: "", lunchEnd: "", exit: "", kind: "tarde", unknown: true };
}

// Returns one of: "manha" | "intermedio" | "tarde" | "folga" | "vazio"
// Time-based rules (most reliable):
//   entry < 08:30          -> manha (green)
//   08:30 <= entry < 09:30 -> intermedio (yellow)
//   entry >= 09:30         -> tarde (red)
// Without entry hour, code-prefix rules:
//   M*   -> manha
//   D/DF/F -> folga (handled by cfg.kind)
//   anything else (T, P, IT, S, etc.) -> tarde
export function inferKind(cfg) {
  if (!cfg) return "vazio";
  if (cfg.kind === "folga") return "folga";

  if (cfg.entry) {
    const parts = cfg.entry.split(":");
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!Number.isNaN(h)) {
      const minutes = h * 60 + (Number.isNaN(m) ? 0 : m);
      if (minutes < 8 * 60 + 30) return "manha";
      if (minutes < 9 * 60 + 30) return "intermedio";
      return "tarde";
    }
  }

  const code = (cfg.code || "").toUpperCase();
  if (/^(D|DF|F)$/.test(code)) return "folga";
  if (/^M/.test(code)) return "manha";
  if (cfg.kind === "intermedio") return "intermedio";
  // Default for unknown / non-M codes: tarde (T, P, IT, S, N, etc.)
  return "tarde";
}
