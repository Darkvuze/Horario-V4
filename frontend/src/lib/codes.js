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
  if (found) return found;
  // Heuristic fallback for unknown codes
  if (/^(D|DF|F|FER|FOL)/i.test(upper)) {
    return { code: upper, entry: "", lunchStart: "", lunchEnd: "", exit: "", kind: "folga", label: "Folga" };
  }
  return { code: upper, entry: "", lunchStart: "", lunchEnd: "", exit: "", kind: "manha", unknown: true };
}

export function inferKind(cfg) {
  if (!cfg) return "vazio";
  if (cfg.kind === "folga") return "folga";
  if (cfg.entry) {
    const h = parseInt(cfg.entry.split(":")[0], 10);
    if (!Number.isNaN(h)) return h < 12 ? "manha" : "tarde";
  }
  return cfg.kind || "manha";
}
