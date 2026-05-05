// Portuguese public holidays (Continental + Açores).
// Açores has all national holidays + regional ones (Dia da Região = Whit Monday)
// and Espírito Santo (Whit Sunday) is also commonly observed.

function easterSunday(year) {
  // Anonymous Gregorian algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d, n) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function key(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Returns map: { "YYYY-MM-DD": { name, regions: ["continental"|"acores"] } }
export function getHolidays(year) {
  const easter = easterSunday(year);
  const goodFriday = addDays(easter, -2);
  const corpusChristi = addDays(easter, 60);
  const whitSunday = addDays(easter, 49); // Pentecostes
  const whitMonday = addDays(easter, 50); // Dia da Região Açores

  const fixedNational = [
    { d: new Date(year, 0, 1), name: "Ano Novo" },
    { d: new Date(year, 3, 25), name: "Dia da Liberdade" },
    { d: new Date(year, 4, 1), name: "Dia do Trabalhador" },
    { d: new Date(year, 5, 10), name: "Dia de Portugal" },
    { d: new Date(year, 7, 15), name: "Assunção de N. Senhora" },
    { d: new Date(year, 9, 5), name: "Implantação da República" },
    { d: new Date(year, 10, 1), name: "Todos os Santos" },
    { d: new Date(year, 11, 1), name: "Restauração da Indep." },
    { d: new Date(year, 11, 8), name: "Imaculada Conceição" },
    { d: new Date(year, 11, 25), name: "Natal" },
  ];

  const movableNational = [
    { d: goodFriday, name: "Sexta-feira Santa" },
    { d: easter, name: "Páscoa" },
    { d: corpusChristi, name: "Corpo de Deus" },
  ];

  const map = {};
  const addEntry = (date, name, regions) => {
    const k = key(date);
    if (!map[k]) map[k] = { name, regions: [] };
    for (const r of regions) {
      if (!map[k].regions.includes(r)) map[k].regions.push(r);
    }
  };

  for (const h of [...fixedNational, ...movableNational]) {
    addEntry(h.d, h.name, ["continental", "acores"]);
  }

  // Açores-only
  addEntry(whitSunday, "Domingo do Espírito Santo", ["acores"]);
  addEntry(whitMonday, "Dia da Região Autónoma dos Açores", ["acores"]);

  return map;
}

export function holidayFor(date, holidaysMap) {
  return holidaysMap[key(date)] || null;
}
