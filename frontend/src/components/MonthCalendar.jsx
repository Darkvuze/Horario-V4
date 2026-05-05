import React, { useMemo } from "react";
import { resolveCode, inferKind } from "@/lib/codes";
import { getHolidays, holidayFor } from "@/lib/holidays";

const WEEKDAYS_PT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function mondayIndex(date) {
  return (date.getDay() + 6) % 7;
}

export default function MonthCalendar({ year, month, employee, codes, region, onCellClick }) {
  const holidays = useMemo(() => getHolidays(year), [year]);

  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const startPad = mondayIndex(first);
    const daysInMonth = new Date(year, month, 0).getDate();
    const total = startPad + daysInMonth;
    const rows = Math.ceil(total / 7);
    const out = [];
    for (let i = 0; i < rows * 7; i++) {
      const dayNum = i - startPad + 1;
      out.push(dayNum < 1 || dayNum > daysInMonth ? null : dayNum);
    }
    return out;
  }, [year, month]);

  const dayCodeMap = useMemo(() => {
    const map = {};
    if (employee?.days) for (const d of employee.days) map[d.day] = d.code;
    return map;
  }, [employee]);

  return (
    <div className="panel overflow-hidden fz-rise" data-testid="month-calendar">
      <div className="grid grid-cols-7 text-[11px] uppercase tracking-widest text-muted-c border-b border-c">
        {WEEKDAYS_PT.map((w) => (
          <div key={w} className="px-3 py-2 text-center font-semibold">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((dayNum, idx) => {
          if (!dayNum) {
            return (
              <div key={idx} className="h-24 sm:h-28 border-r border-b border-c opacity-30" style={{ background: "var(--shift-empty)" }} />
            );
          }
          const date = new Date(year, month - 1, dayNum);
          const code = (dayCodeMap[dayNum] || "").trim();
          const cfg = code ? resolveCode(code, codes) : null;
          const kind = inferKind(cfg);
          const hol = holidayFor(date, holidays);
          const showAcores = hol && hol.regions.includes("acores") && (region === "acores" || region === "ambos");
          const showCont = hol && hol.regions.includes("continental") && (region === "continental" || region === "ambos");
          const cellCls = !code ? "shift-vazio"
            : kind === "manha" ? "shift-manha"
            : kind === "intermedio" ? "shift-intermedio"
            : kind === "tarde" ? "shift-tarde"
            : kind === "ferias" ? "shift-ferias"
            : "shift-folga";

          const handleClick = () => onCellClick?.(dayNum, code);

          return (
            <button
              key={idx}
              data-testid={`day-cell-${dayNum}`}
              onClick={handleClick}
              title={hol ? `${hol.name}` : undefined}
              className={`relative h-24 sm:h-28 border-r border-b border-c p-1.5 flex flex-col justify-between text-left ${cellCls} hover:opacity-90 active:opacity-75 transition-opacity cursor-pointer`}
            >
              <div className="flex items-start justify-between">
                <span className="text-[11px] font-bold opacity-70">{dayNum}</span>
                <div className="flex gap-1">
                  {showAcores && <span title={hol.name + " (Açores)"} data-testid={`holiday-acores-${dayNum}`} className="inline-block w-2.5 h-2.5 rounded-full bg-sky-500 ring-2 ring-white/80"/>}
                  {showCont && <span title={hol.name + " (Continental)"} data-testid={`holiday-cont-${dayNum}`} className="inline-block w-2.5 h-2.5 rounded-full bg-pink-500 ring-2 ring-white/80"/>}
                </div>
              </div>
              <div className="flex items-center justify-center flex-1">
                <span className="font-mono text-base sm:text-lg font-extrabold tracking-tight">{code || "·"}</span>
              </div>
              {hol && (showAcores || showCont) && (
                <div className="text-[10px] sm:text-[11px] font-semibold leading-tight line-clamp-2 text-center opacity-90">
                  {hol.name}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
