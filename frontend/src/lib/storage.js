const KEYS = {
  CODES: "fazes:codes:v3",
  SCHEDULE: "fazes:schedule:v1",
  SELECTED: "fazes:selected:v1",
  REGION: "fazes:region:v1",
};

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export const Storage = {
  loadCodes: (fallback) => loadJSON(KEYS.CODES, fallback),
  saveCodes: (v) => saveJSON(KEYS.CODES, v),
  loadSchedule: () => loadJSON(KEYS.SCHEDULE, null),
  saveSchedule: (v) => saveJSON(KEYS.SCHEDULE, v),
  loadSelected: () => loadJSON(KEYS.SELECTED, null),
  saveSelected: (v) => saveJSON(KEYS.SELECTED, v),
  loadRegion: () => loadJSON(KEYS.REGION, "acores"),
  saveRegion: (v) => saveJSON(KEYS.REGION, v),
};
