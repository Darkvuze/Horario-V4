// Browser-side parser for Sata-style work-schedule PDFs.
// Port of backend/server.py::parse_schedule_pdf — keeps the same output shape
// so App.js can use it as a drop-in replacement (no backend needed).
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
// Use the worker copy that lives in /public so the browser fetches it from the
// site's root with the correct MIME type. Bundling via `new URL(..., import.meta.url)`
// works in dev but breaks on some static hosts (e.g. Vercel returns the file but
// the dynamic ESM import fails). A plain static URL is the most reliable path.
pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL || ""}/pdf.worker.min.mjs`;

const MONTH_TOKENS = {
  JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6,
  JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
};

function detectMonthYear(text, filename = "") {
  const haystack = (`${filename} ${text}`).toUpperCase();
  // "2026043-MAI"
  let m = haystack.match(
    /(20\d{2})\s*0?(\d{1,2})\s*[-_ ]?\s*(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)/
  );
  if (m) return { month: MONTH_TOKENS[m[3]], year: parseInt(m[1], 10) };

  m = haystack.match(
    /(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\D{0,5}(20\d{2})/
  );
  if (m) return { month: MONTH_TOKENS[m[1]], year: parseInt(m[2], 10) };

  m = haystack.match(/(20\d{2})/);
  return { month: null, year: m ? parseInt(m[1], 10) : null };
}

// pdfjs returns items with a transform matrix [a,b,c,d,e,f] where e,f are the
// page-coordinates of the baseline (origin = bottom-left). We convert those to
// a top-left coordinate system similar to pdfplumber's `top` / `x0`.
// item.width/height are already in pixels at scale=1.
function itemsToWords(items, pageHeight) {
  const words = [];
  for (const it of items) {
    const raw = (it.str || "").trim();
    if (!raw) continue;
    const [, , , , e, f] = it.transform;
    const x0 = e;
    const x1 = e + (it.width || 0);
    const fontH = it.height || 10;
    const top = pageHeight - f - fontH; // convert baseline → top
    // pdfjs already splits at major spaces, but a single item can still contain
    // a short run like "M76". We further split on internal spaces to mimic
    // pdfplumber.extract_words() behaviour.
    const parts = raw.split(/\s+/);
    if (parts.length === 1) {
      words.push({ text: raw, x0, x1, top });
    } else {
      const perChar = (x1 - x0) / raw.length;
      let cursor = 0;
      for (const p of parts) {
        const start = raw.indexOf(p, cursor);
        const sx0 = x0 + start * perChar;
        const sx1 = sx0 + p.length * perChar;
        words.push({ text: p, x0: sx0, x1: sx1, top });
        cursor = start + p.length;
      }
    }
  }
  return words;
}

function groupWordsIntoLines(words, yTol = 4.0) {
  const sorted = [...words].sort((a, b) =>
    a.top !== b.top ? a.top - b.top : a.x0 - b.x0
  );
  const lines = [];
  for (const w of sorted) {
    let placed = false;
    for (const line of lines) {
      if (Math.abs(line.top - w.top) <= yTol) {
        line.words.push(w);
        line.top =
          (line.top * (line.words.length - 1) + w.top) / line.words.length;
        placed = true;
        break;
      }
    }
    if (!placed) lines.push({ top: w.top, words: [w] });
  }
  for (const ln of lines) ln.words.sort((a, b) => a.x0 - b.x0);
  lines.sort((a, b) => a.top - b.top);
  return lines;
}

// Employee row patterns — generic enough to work across different workplaces.
// We accept any numeric ID with 4-10 digits (covers SATA's 5XXXXXXX, OAEs,
// restaurant chains, retail, etc.) and any reasonable name. We require either
// a dash separator or an obvious "Name LastName" pattern to avoid matching
// random rows like footers or totals.
const NAME_CHARS = "A-Za-zÀ-ÿ\\u00C0-\\u017F";
//   "12345678 - João Silva" / "12345678 – João Silva" / "12345678 — João Silva"
const EMPLOYEE_RE = new RegExp(
  `^(\\d{4,10})\\s*[-–—]\\s*([${NAME_CHARS}].*?)$`
);
//   "João Silva 12345678" — name first, ID at the very end
const EMPLOYEE_RE_REVERSE = new RegExp(
  `^([${NAME_CHARS}][${NAME_CHARS}\\s.'\\-]{2,})\\s+(\\d{4,10})$`
);

function matchEmployeeRow(rowText) {
  let m = rowText.match(EMPLOYEE_RE);
  if (m) return { id: m[1], name: m[2].trim() };
  m = rowText.match(EMPLOYEE_RE_REVERSE);
  if (m) return { id: m[2], name: m[1].trim() };
  return null;
}

export async function parseSchedulePdf(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  const employees = [];
  const rawCodesSet = new Set();
  const title = file.name || "";
  let fullText = "";

  for (let pno = 1; pno <= pdf.numPages; pno++) {
    const page = await pdf.getPage(pno);
    const viewport = page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height;
    const tc = await page.getTextContent();

    const items = tc.items || [];
    // Re-construct a flat page text for month/year detection.
    fullText += items.map((it) => it.str || "").join(" ") + "\n";

    const words = itemsToWords(items, pageHeight);
    if (words.length === 0) continue;

    const lines = groupWordsIntoLines(words, 4.0);

    // Find the day-number header line: a line with many small integers 1..31
    // that are mostly increasing.
    let dayHeaderIdx = -1;
    let dayPositions = []; // [day, xCenter]
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      const ints = [];
      for (const w of ln.words) {
        const t = w.text.trim();
        if (/^\d+$/.test(t)) {
          const v = parseInt(t, 10);
          if (v >= 1 && v <= 31) {
            ints.push([v, (w.x0 + w.x1) / 2]);
          }
        }
      }
      if (ints.length >= 10) {
        let inc = 0;
        for (let k = 0; k < ints.length - 1; k++) {
          const a = ints[k][0], b = ints[k + 1][0];
          if (b === a + 1 || b === a) inc++;
        }
        if (inc >= ints.length - 3) {
          dayHeaderIdx = i;
          dayPositions = ints;
          break;
        }
      }
    }

    if (dayHeaderIdx < 0 || dayPositions.length === 0) continue;

    // Weekday header (line above)
    const weekdayMap = {};
    if (dayHeaderIdx > 0) {
      const wkLine = lines[dayHeaderIdx - 1];
      for (const [d, x] of dayPositions) {
        let nearest = null;
        let bestDist = Infinity;
        for (const w of wkLine.words) {
          const cx = (w.x0 + w.x1) / 2;
          const dist = Math.abs(cx - x);
          if (dist < bestDist) {
            bestDist = dist;
            nearest = w;
          }
        }
        if (nearest) {
          const t = nearest.text.trim().toUpperCase();
          if (["S", "D", "2", "3", "4", "5", "6"].includes(t)) {
            weekdayMap[d] = t;
          }
        }
      }
    }

    // Iterate over data rows after the header
    for (let i = dayHeaderIdx + 1; i < lines.length; i++) {
      const ln = lines[i];

      const firstDayX = dayPositions[0][1];
      const colWidth =
        dayPositions.length > 1
          ? dayPositions[1][1] - dayPositions[0][1]
          : 20;
      const cutoffX = firstDayX - colWidth * 0.6;

      const nameWords = [];
      const codeWords = [];
      for (const w of ln.words) {
        if (w.x0 < cutoffX) nameWords.push(w);
        else codeWords.push(w);
      }

      // Try matching only on the LEFT block (name + ID), not the full row.
      // This is what lets us recognise reverse-format rows like
      // "João Silva  50001234" because the ID is the last token of the
      // name block (the codes that come next live in the right block).
      const leftText = nameWords.map((w) => w.text).join(" ").trim();
      if (!leftText) continue;
      const emp = matchEmployeeRow(leftText);
      if (!emp) continue;

      const empId = emp.id;
      // Strip the ID + separator at start OR end of the name area to keep only the human name.
      const nameClean = leftText
        .replace(/^\d{4,10}\s*[-–—]\s*/, "")
        .replace(/\s*[-–—]?\s*\d{4,10}\s*$/, "")
        .trim() || emp.name;

      const dayToCode = {};
      for (const w of codeWords) {
        const cx = (w.x0 + w.x1) / 2;
        let nearestDay = dayPositions[0][0];
        let best = Infinity;
        for (const [d, dx] of dayPositions) {
          const dist = Math.abs(dx - cx);
          if (dist < best) {
            best = dist;
            nearestDay = d;
          }
        }
        const t = w.text.trim();
        if (!t) continue;
        dayToCode[nearestDay] =
          (dayToCode[nearestDay] || "") + t;
      }

      const days = [];
      for (const [d] of dayPositions) {
        const code = (dayToCode[d] || "").trim();
        if (code) rawCodesSet.add(code);
        days.push({
          day: d,
          weekday: weekdayMap[d] || null,
          code,
        });
      }

      employees.push({
        row: employees.length + 1,
        employee_id: empId,
        name: nameClean || empId,
        days,
      });
    }
  }

  if (employees.length === 0) {
    throw new Error(
      "Não foram detetados funcionários no PDF. Confirma o formato."
    );
  }

  const { month, year } = detectMonthYear(fullText, title);
  return {
    month,
    year,
    title,
    employees,
    raw_codes: Array.from(rawCodesSet).sort(),
  };
}
