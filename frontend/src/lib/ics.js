// Generate an .ics (RFC 5545) file with VALARMs at 30 and 40 minutes before entry.

function pad(n) { return String(n).padStart(2, "0"); }

function fmtLocal(date) {
  return (
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    "00"
  );
}

function fmtUtc(date) {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    "00Z"
  );
}

function escapeText(s) {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// events: [{ uid, summary, description, date: Date(year,month,day), entry:"HH:MM", exit:"HH:MM" }]
export function buildIcs(events, calendarName = "FaZes Escala") {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FaZes//Escala//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    "X-WR-TIMEZONE:Atlantic/Azores",
  ];
  const now = fmtUtc(new Date());

  for (const ev of events) {
    if (!ev.entry || !ev.exit) continue;
    const [eh, em] = ev.entry.split(":").map(Number);
    const [xh, xm] = ev.exit.split(":").map(Number);
    const start = new Date(ev.date);
    start.setHours(eh, em, 0, 0);
    const end = new Date(ev.date);
    end.setHours(xh, xm, 0, 0);
    if (end <= start) end.setDate(end.getDate() + 1); // overnight safety

    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${fmtLocal(start)}`,
      `DTEND:${fmtLocal(end)}`,
      `SUMMARY:${escapeText(ev.summary)}`,
      `DESCRIPTION:${escapeText(ev.description || "")}`,
      // Alarm 1: 40 min before
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(ev.summary)} - 40 min`,
      "TRIGGER:-PT40M",
      "END:VALARM",
      // Alarm 2: 30 min before
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(ev.summary)} - 30 min`,
      "TRIGGER:-PT30M",
      "END:VALARM",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(filename, content) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
