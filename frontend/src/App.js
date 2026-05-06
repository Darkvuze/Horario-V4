import React, { useEffect, useMemo, useRef, useState } from "react";
import { MoreVertical, Upload, Calendar, Download, Sun, Moon, CircleDashed, ChevronLeft, ChevronRight, X, Clock, Users, Repeat, ListChecks, UserCheck, Plus, Search } from "lucide-react";
import "@/App.css";
import MonthCalendar from "@/components/MonthCalendar";
import CodesDrawer from "@/components/CodesDrawer";
import { DEFAULT_CODES, resolveCode, inferKind } from "@/lib/codes";
import { Storage } from "@/lib/storage";
import { buildIcs, downloadIcs } from "@/lib/ics";
import { getHolidays, holidayFor } from "@/lib/holidays";
import { parseSchedulePdf } from "@/lib/pdfParser";

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const TZ = "Atlantic/Azores";

function ThemeSwitcher({ theme, setTheme }) {
  const opts = [
    { id: "dark", icon: Moon, label: "Escuro" },
    { id: "soft", icon: CircleDashed, label: "Cinzento" },
    { id: "light", icon: Sun, label: "Claro" },
  ];
  return (
    <div className="inline-flex panel p-1" data-testid="theme-switcher" style={{ borderRadius: "999px" }}>
      {opts.map(({ id, icon: Icon, label }) => (
        <button key={id} onClick={() => setTheme(id)} data-testid={`theme-${id}`} aria-label={label}
          className={`px-2.5 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-semibold transition-all ${theme === id ? "btn-accent" : "text-muted-c hover:text-main"}`}>
          <Icon size={14} /><span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

function MoreMenu({ open, onClose, onPick }) {
  if (!open) return null;
  const items = [
    { id: "pdf", icon: Upload, label: "Carregar / Mudar PDF" },
    { id: "pessoas", icon: Users, label: "Pessoas" },
    { id: "horarios", icon: ListChecks, label: "Horários" },
    { id: "trocas", icon: Repeat, label: "Trocas" },
    { id: "relogio", icon: Clock, label: "Despertador / Relógio" },
  ];
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} data-testid="more-menu-overlay" />
      <div className="absolute right-4 top-16 z-40 panel-solid rounded-xl shadow-2xl py-2 w-64 fz-rise" data-testid="more-menu" style={{ border: "1px solid var(--border)" }}>
        {items.map(({ id, icon: Icon, label }) => (
          <button key={id} data-testid={`more-${id}`} onClick={() => { onPick(id); onClose(); }}
            className="w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm font-semibold text-main hover:bg-[color:var(--card)] transition-colors">
            <Icon size={16} style={{ color: "var(--accent)" }} /> {label}
          </button>
        ))}
      </div>
    </>
  );
}

function Drawer({ open, onClose, title, children, testid }) {
  return (
    <>
      <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`} onClick={onClose} />
      <aside data-testid={testid} className={`fixed top-0 right-0 h-full w-full sm:w-[480px] panel-solid z-50 shadow-2xl transition-transform duration-300 flex flex-col ${open ? "translate-x-0" : "translate-x-full"}`} style={{ borderLeft: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-c">
          <h2 className="text-lg font-bold text-main">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg btn-ghost" data-testid="drawer-close"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto fz-scroll p-4">{children}</div>
      </aside>
    </>
  );
}

function PeopleDrawer({ open, onClose, employees, selectedRow, setSelectedRow, me, setMe, onReupload }) {
  const [q, setQ] = useState("");
  const list = employees.filter(e => !q || e.name.toLowerCase().includes(q.toLowerCase()) || e.employee_id.includes(q));
  return (
    <Drawer open={open} onClose={onClose} title="Pessoas" testid="people-drawer">
      <div className="space-y-3">
        <button onClick={onReupload} data-testid="people-reupload" className="w-full btn-ghost rounded-lg px-3 py-2 text-sm flex items-center justify-center gap-2">
          <Upload size={14}/> Carregar/Mudar PDF
        </button>
        <input className="w-full input-c rounded-lg px-3 py-2 text-sm" placeholder="Procurar nome ou nº..." value={q} onChange={e=>setQ(e.target.value)} data-testid="people-search"/>
        <div className="text-[11px] uppercase tracking-wider text-soft px-1">Quem és tu? (memorizado)</div>
        <div className="space-y-1">
          {list.map(emp => {
            const isMe = me === emp.row;
            const active = selectedRow === emp.row;
            return (
              <div key={emp.row} className={`flex items-center gap-2 rounded-lg ${active ? "btn-accent" : "btn-ghost"}`}>
                <button onClick={()=>setSelectedRow(emp.row)} data-testid={`pick-emp-${emp.row}`} className="flex-1 text-left px-3 py-2 flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[10px] opacity-70 w-6">{String(emp.row).padStart(2,"0")}</span>
                  <span className="flex-1 truncate text-sm font-semibold">{emp.name}</span>
                  <span className="font-mono text-[10px] opacity-70">{emp.employee_id}</span>
                </button>
                <button onClick={()=>setMe(emp.row)} data-testid={`set-me-${emp.row}`} title="Sou eu" className={`p-2 mr-1 rounded ${isMe ? "btn-accent" : "btn-ghost"}`}>
                  <UserCheck size={14}/>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Drawer>
  );
}

function TradesDrawer({ open, onClose, employees, codes, year, month, me }) {
  const days = new Date(year, month, 0).getDate();
  const [day, setDay] = useState(1);
  const [filter, setFilter] = useState("all"); // all|folga|manha|tarde
  const myEmp = employees.find(e => e.row === me);
  const myShift = myEmp?.days.find(d => d.day === day)?.code || "—";

  const candidates = employees.filter(e => e.row !== me).map(e => {
    const code = e.days.find(d => d.day === day)?.code || "";
    const cfg = code ? resolveCode(code, codes) : null;
    const kind = inferKind(cfg);
    return { ...e, code, kind };
  }).filter(e => {
    if (filter === "all") return e.code;
    if (filter === "folga") return e.kind === "folga"; // exclui férias
    if (filter === "ferias") return e.kind === "ferias";
    return e.kind === filter;
  });

  return (
    <Drawer open={open} onClose={onClose} title="Trocas (Opção B)" testid="trades-drawer">
      <div className="space-y-4">
        <div className="panel p-3 text-sm">
          <div className="text-soft text-xs">No dia <b>{day}/{month}/{year}</b> tu tens:</div>
          <div className="font-mono font-extrabold text-xl mt-1">{myShift}</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-soft">Dia
            <select value={day} onChange={e=>setDay(parseInt(e.target.value))} data-testid="trade-day" className="w-full input-c rounded px-2 py-2 mt-1 text-sm">
              {Array.from({length: days}, (_,i)=>i+1).map(d=> <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="text-xs text-soft">Quero ver
            <select value={filter} onChange={e=>setFilter(e.target.value)} data-testid="trade-filter" className="w-full input-c rounded px-2 py-2 mt-1 text-sm">
              <option value="all">Todos</option>
              <option value="folga">Quem tem folga (D/DF)</option>
              <option value="ferias">Quem está de férias (F)</option>
              <option value="manha">Quem está de manhã</option>
              <option value="tarde">Quem está de tarde</option>
            </select>
          </label>
        </div>
        <div className="text-[11px] uppercase tracking-wider text-soft">Candidatos ({candidates.length})</div>
        <div className="space-y-1">
          {candidates.map(c => (
            <div key={c.row} className="flex items-center gap-2 panel p-2" data-testid={`trade-cand-${c.row}`}>
              <span className={`shift-${c.kind === 'vazio' ? 'folga' : c.kind} font-mono text-xs font-bold rounded px-2 py-1 min-w-[44px] text-center`}>{c.code || "—"}</span>
              <span className="flex-1 truncate text-sm font-semibold text-main">{c.name}</span>
              <span className="font-mono text-[10px] text-soft">{c.employee_id}</span>
            </div>
          ))}
          {candidates.length===0 && <p className="text-soft text-sm text-center py-4">Sem resultados.</p>}
        </div>
      </div>
    </Drawer>
  );
}

function ClockDrawer({ open, onClose }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [open]);
  const fmt = new Intl.DateTimeFormat("pt-PT", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const fmtDate = new Intl.DateTimeFormat("pt-PT", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <Drawer open={open} onClose={onClose} title="Despertador & Relógio" testid="clock-drawer">
      <div className="space-y-4 text-center">
        <div className="panel p-6 fz-rise">
          <div className="text-xs text-soft uppercase tracking-widest">Açores · {TZ}</div>
          <div className="font-mono font-extrabold text-5xl my-3 text-main" data-testid="clock-time">{fmt.format(now)}</div>
          <div className="text-sm text-muted-c capitalize">{fmtDate.format(now)}</div>
        </div>
        <div className="panel p-4 text-left text-sm space-y-2">
          <div className="font-bold text-main">Como ajustar os alarmes</div>
          <p className="text-muted-c text-xs leading-relaxed">
            Os alarmes são gerados no ficheiro <code className="font-mono">.ics</code> (30 e 40 min antes de cada turno).
            Para mudares para outros tempos: abre <b>Horários</b> no menu, edita as horas de entrada/saída — os alarmes
            recalculam automaticamente. Depois exporta o <code className="font-mono">.ics</code> e importa no calendário do telemóvel.
          </p>
          <p className="text-muted-c text-xs leading-relaxed">
            <b>iPhone:</b> abrir o ficheiro .ics → "Adicionar Tudo". <br/>
            <b>Android:</b> abrir com Google Calendar → confirmar.
          </p>
        </div>
      </div>
    </Drawer>
  );
}

function MeModal({ employees, onPick, onSkip }) {
  const [q, setQ] = useState("");
  const list = employees.filter(e => !q || e.name.toLowerCase().includes(q.toLowerCase()) || e.employee_id.includes(q));
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" data-testid="me-modal">
      <div className="panel-solid rounded-2xl max-w-md w-full p-5 fz-rise" style={{ border: "1px solid var(--border)" }}>
        <h3 className="text-xl font-extrabold text-main mb-1">Quem és tu?</h3>
        <p className="text-soft text-sm mb-4">Escolhe o teu nome para a app abrir sempre na tua escala.</p>
        <input className="w-full input-c rounded-lg px-3 py-2 text-sm mb-3" placeholder="Procurar..." value={q} onChange={e=>setQ(e.target.value)} data-testid="me-search" autoFocus/>
        <div className="max-h-72 overflow-y-auto fz-scroll space-y-1">
          {list.map(emp => (
            <button key={emp.row} onClick={()=>onPick(emp.row)} data-testid={`me-pick-${emp.row}`} className="w-full text-left btn-ghost rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="font-mono text-[10px] opacity-70 w-6">{String(emp.row).padStart(2,"0")}</span>
              <span className="flex-1 truncate text-sm font-semibold">{emp.name}</span>
              <span className="font-mono text-[10px] opacity-70">{emp.employee_id}</span>
            </button>
          ))}
        </div>
        <button onClick={onSkip} data-testid="me-skip" className="mt-3 text-xs text-soft hover:text-main w-full text-center">Saltar (escolher mais tarde)</button>
      </div>
    </div>
  );
}

function DayDetailModal({ cell, codes, employee, year, month, onClose, onChangeRequest }) {
  if (!cell) return null;
  const cfg = cell.current ? resolveCode(cell.current, codes) : null;
  const kind = inferKind(cfg);
  const date = new Date(year, month - 1, cell.day);
  const weekdays = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
  const weekday = weekdays[date.getDay()];
  const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose} data-testid="day-detail-modal">
      <div className="panel-solid rounded-2xl max-w-sm w-full p-5 fz-rise relative overflow-visible" onClick={e=>e.stopPropagation()} style={{border:"1px solid var(--border)"}}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs text-soft uppercase tracking-wider capitalize">{weekday}</div>
            <h3 className="text-2xl font-extrabold text-main leading-tight">Dia {cell.day} · {months[month-1]}</h3>
            {employee && (
              <div className="text-[11px] text-soft mt-1 truncate">{employee.name}</div>
            )}
          </div>
          <button onClick={onClose} className="btn-ghost rounded-lg p-1.5" data-testid="day-detail-close"><X size={18}/></button>
        </div>

        <div className="text-[11px] text-soft uppercase tracking-wider mb-2 font-semibold">O teu horário</div>

        {cell.current ? (
          <div className={`shift-${kind === 'vazio' ? 'folga' : kind} rounded-xl p-5 text-center`} data-testid="day-detail-shift">
            <div className="font-mono text-4xl font-extrabold tracking-tight">{cell.current}</div>
            {cfg?.label && <div className="text-sm font-semibold opacity-80 mt-1">{cfg.label}</div>}
            {(cfg?.entry || cfg?.exit) ? (
              <div className="mt-3 space-y-1">
                <div className="font-mono text-lg font-bold">
                  {cfg.entry || "—"} <span className="opacity-60">→</span> {cfg.exit || "—"}
                </div>
                {cfg?.lunchStart && cfg?.lunchEnd && (
                  <div className="text-xs font-mono opacity-80">Almoço: {cfg.lunchStart} – {cfg.lunchEnd}</div>
                )}
              </div>
            ) : (
              <div className="mt-3 text-xs font-semibold opacity-80">
                {kind === "folga" ? "Dia de folga" : kind === "ferias" ? "Dia de férias" : "Sem horas definidas"}
              </div>
            )}
          </div>
        ) : (
          <div className="panel p-6 text-center text-soft rounded-xl" data-testid="day-detail-empty">
            <div className="text-sm">Sem código atribuído a este dia.</div>
          </div>
        )}

        {/* Floating + button bottom-right to swap/change the shift */}
        <button
          onClick={onChangeRequest}
          data-testid="day-detail-swap-btn"
          aria-label="Trocar horário"
          title="Trocar horário"
          className="absolute -bottom-5 -right-5 w-14 h-14 rounded-full btn-accent shadow-2xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          style={{ boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5), 0 0 0 4px var(--panel-solid)" }}
        >
          <Plus size={26} strokeWidth={2.75}/>
        </button>
      </div>
    </div>
  );
}

function CellEditModal({ cell, codes, onClose, onSave }) {
  const [q, setQ] = useState("");
  if (!cell) return null;
  const sorted = [...codes].sort((a,b) => a.code.localeCompare(b.code));
  const query = q.trim().toLowerCase();
  const filtered = !query ? sorted : sorted.filter(c => {
    const code = (c.code || "").toLowerCase();
    const label = (c.label || "").toLowerCase();
    const entry = (c.entry || "").toLowerCase();
    const exit = (c.exit || "").toLowerCase();
    return code.includes(query) || label.includes(query) || entry.includes(query) || exit.includes(query);
  });
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose} data-testid="cell-edit-modal">
      <div className="panel-solid rounded-2xl max-w-lg w-full p-5 fz-rise" style={{ border: "1px solid var(--border)" }} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-extrabold text-main">Editar dia {cell.day}</h3>
          <button onClick={onClose} className="btn-ghost rounded p-1.5"><X size={18}/></button>
        </div>
        <p className="text-soft text-xs mb-3">Atual: <span className="font-mono font-bold">{cell.current || "—"}</span> · Escolhe o novo código:</p>
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-soft pointer-events-none"/>
          <input
            value={q}
            onChange={e=>setQ(e.target.value)}
            placeholder="Procurar código ou hora (ex: M14, 09:00, T6)..."
            data-testid="cell-edit-search"
            autoFocus
            className="w-full input-c rounded-lg pl-9 pr-9 py-2 text-sm"
          />
          {q && (
            <button
              onClick={()=>setQ("")}
              data-testid="cell-edit-search-clear"
              className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost rounded p-1"
              aria-label="Limpar pesquisa"
            >
              <X size={14}/>
            </button>
          )}
        </div>
        <div className="max-h-[55vh] overflow-y-auto fz-scroll grid grid-cols-1 gap-1" data-testid="cell-edit-list">
          {!query && (
            <button onClick={()=>onSave("")} data-testid="cell-set-empty" className="btn-ghost rounded-lg px-3 py-2 text-left text-sm">— Limpar —</button>
          )}
          {filtered.length === 0 ? (
            <div className="panel p-6 text-center text-soft text-xs rounded-lg" data-testid="cell-edit-empty">
              Sem resultados para "{q}".
            </div>
          ) : filtered.map(c => {
            const k = inferKind(c);
            return (
              <button key={c.code} onClick={()=>onSave(c.code)} data-testid={`cell-set-${c.code}`} className="rounded-lg px-3 py-2 flex items-center gap-3 hover:opacity-90 transition-opacity" style={{background:"var(--card)"}}>
                <span className={`shift-${k === 'vazio' ? 'folga' : k} font-mono text-sm font-extrabold rounded px-2 py-1 min-w-[56px] text-center`}>{c.code}</span>
                <span className="flex-1 text-left text-xs text-muted-c font-mono truncate">
                  {c.label && <span className="font-semibold mr-2">{c.label}</span>}
                  {c.entry || "—"} → {c.exit || "—"} {c.lunchStart && `(almoço ${c.lunchStart}-${c.lunchEnd})`}
                </span>
              </button>
            );
          })}
        </div>
        <div className="text-[10px] text-soft text-center mt-2">
          {filtered.length} {filtered.length === 1 ? "código" : "códigos"}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onUploadClick, uploading, error }) {
  return (
    <div className="panel p-8 sm:p-12 text-center fz-rise" data-testid="empty-state">
      <div className="mx-auto mb-5 w-16 h-16 rounded-2xl flex items-center justify-center" style={{background:"color-mix(in srgb, var(--accent) 18%, transparent)"}}>
        <Calendar size={28} style={{color:"var(--accent)"}}/>
      </div>
      <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-main mb-2">Carrega a tua escala</h2>
      <p className="text-muted-c max-w-md mx-auto mb-6 text-sm sm:text-base">
        Faz upload do PDF da escala. Depois escolhe quem és e a app abre sempre na tua linha.
      </p>
      <button onClick={onUploadClick} data-testid="upload-cta-btn" disabled={uploading}
        className="btn-accent rounded-full px-6 py-3 inline-flex items-center gap-2 font-semibold shadow-lg disabled:opacity-60">
        <Upload size={18}/>{uploading ? "A processar..." : "Selecionar PDF"}
      </button>
      {error && <p className="mt-4 text-sm text-rose-400 max-w-md mx-auto" data-testid="upload-error">{error}</p>}
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("fazes:theme") || "dark");
  const [schedule, setSchedule] = useState(() => Storage.loadSchedule());
  const [codes, setCodes] = useState(() => Storage.loadCodes(DEFAULT_CODES));
  const [region, setRegion] = useState(() => Storage.loadRegion());
  const [me, setMe] = useState(() => { try { return JSON.parse(localStorage.getItem("fazes:me")||"null"); } catch { return null; }});
  const [selectedRow, setSelectedRow] = useState(() => Storage.loadSelected());
  const [year, setYear] = useState(() => Storage.loadSchedule()?.year || new Date().getFullYear());
  const [month, setMonth] = useState(() => Storage.loadSchedule()?.month || new Date().getMonth()+1);
  const [overrides, setOverrides] = useState(() => { try { return JSON.parse(localStorage.getItem("fazes:overrides")||"{}"); } catch { return {}; }});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawer, setDrawer] = useState(null); // pessoas|horarios|trocas|relogio
  const [needsMe, setNeedsMe] = useState(false);
  const [editCell, setEditCell] = useState(null);
  const [pickCodeCell, setPickCodeCell] = useState(null);
  const fileInput = useRef(null);

  // Theme application + dynamic browser status bar color
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("fazes:theme", theme);
    const colors = { dark: "#09090b", soft: "#d4d4d8", light: "#ffffff" };
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", colors[theme] || "#09090b");
  }, [theme]);
  useEffect(() => { Storage.saveCodes(codes); }, [codes]);
  useEffect(() => { Storage.saveSelected(selectedRow); }, [selectedRow]);
  useEffect(() => { Storage.saveRegion(region); }, [region]);
  useEffect(() => { localStorage.setItem("fazes:me", JSON.stringify(me)); }, [me]);
  useEffect(() => { localStorage.setItem("fazes:overrides", JSON.stringify(overrides)); }, [overrides]);
  useEffect(() => { if (schedule) { Storage.saveSchedule(schedule); if (schedule.year) setYear(schedule.year); if (schedule.month) setMonth(schedule.month); } }, [schedule]);

  const employees = useMemo(() => schedule?.employees || [], [schedule]);
  const overrideKey = `${year}-${month}-${selectedRow}`;
  const employeeWithOverrides = useMemo(() => {
    const emp = employees.find(e => e.row === selectedRow);
    if (!emp) return null;
    const ov = overrides[overrideKey] || {};
    return { ...emp, days: emp.days.map(d => Object.prototype.hasOwnProperty.call(ov, d.day) ? { ...d, code: ov[d.day] } : d) };
  }, [employees, selectedRow, overrides, overrideKey]);

  // Auto-select "me" when schedule loads
  useEffect(() => {
    if (employees.length === 0) return;
    if (me && employees.some(e => e.row === me)) {
      if (selectedRow !== me) setSelectedRow(me);
    } else if (!me) {
      setNeedsMe(true);
    }
  }, [employees.length, me]); // eslint-disable-line

  async function handleFile(file) {
    setError(null); setUploading(true);
    try {
      // 100% offline — PDF parsed in the browser, no backend required.
      const data = await parseSchedulePdf(file);
      setSchedule(data);
      if (data.year) setYear(data.year);
      if (data.month) setMonth(data.month);
      if (Array.isArray(data.raw_codes)) {
        const legend = data.legend || {};
        setCodes(prev => {
          // First pass: enrich existing codes if the user hasn't customised them
          // and the PDF legend has more accurate info.
          const corrected = prev.map(c => {
            const u = (c.code||"").toUpperCase();
            const fromLegend = legend[u];
            if (fromLegend) {
              // Merge: keep user-edited times if present, otherwise fill from legend.
              return {
                ...c,
                entry: c.entry || fromLegend.entry || "",
                exit: c.exit || fromLegend.exit || "",
                lunchStart: c.lunchStart || fromLegend.lunchStart || "",
                lunchEnd: c.lunchEnd || fromLegend.lunchEnd || "",
                label: c.label || fromLegend.label || "",
                // Only override kind if user kept the default heuristic and the
                // legend gives a clearer answer.
                kind: c.entry ? c.kind : (fromLegend.kind || c.kind),
              };
            }
            // No legend info — keep heuristic clean-up from before.
            if (c.entry) return c;
            if (/^F$|^FER/.test(u)) return { ...c, kind: "ferias" };
            if (/^(D|DF)$/.test(u)) return { ...c, kind: "folga" };
            if (/^M/.test(u) && c.kind !== "manha" && c.kind !== "intermedio") return { ...c, kind: "manha" };
            if (!/^M/.test(u) && c.kind !== "tarde" && c.kind !== "folga" && c.kind !== "ferias") return { ...c, kind: "tarde" };
            return c;
          });
          // Second pass: add codes from the PDF that weren't in the user's list.
          // Merge raw_codes (actually used in the grid) with legend keys
          // (codes defined at the bottom of the PDF, even if unused this month).
          const existing = new Set(corrected.map(c => c.code.toUpperCase()));
          const fromGrid = (data.raw_codes || []).map(c => c.toUpperCase());
          const fromLegendKeys = Object.keys(legend);
          const allCandidates = Array.from(new Set([...fromGrid, ...fromLegendKeys]));
          const adds = allCandidates
            .filter(rc => !existing.has(rc))
            .map(rc => {
              const fromLegend = legend[rc];
              if (fromLegend) {
                return {
                  code: rc,
                  entry: fromLegend.entry || "",
                  lunchStart: fromLegend.lunchStart || "",
                  lunchEnd: fromLegend.lunchEnd || "",
                  exit: fromLegend.exit || "",
                  label: fromLegend.label || "",
                  kind: fromLegend.kind || "manha",
                };
              }
              return {
                code: rc, entry: "", lunchStart: "", lunchEnd: "", exit: "",
                kind: /^F$|^FER/i.test(rc) ? "ferias" : /^(D|DF)$/i.test(rc) ? "folga" : /^M/i.test(rc) ? "manha" : "tarde",
              };
            });
          return adds.length ? [...corrected, ...adds] : corrected;
        });
      }
      // Pre-select me if known
      if (me && data.employees.some(e=>e.row===me)) {
        setSelectedRow(me);
      } else {
        setSelectedRow(data.employees?.[0]?.row || null);
        setNeedsMe(true);
      }
    } catch (e) {
      setError(e.message || "Erro a ler o PDF");
    } finally { setUploading(false); }
  }

  function exportIcs() {
    if (!employeeWithOverrides) return;
    const events = []; const holidays = getHolidays(year);
    for (const d of employeeWithOverrides.days) {
      const cfg = resolveCode(d.code, codes);
      if (!cfg || inferKind(cfg) === "folga" || !cfg.entry || !cfg.exit) continue;
      const date = new Date(year, month-1, d.day); const hol = holidayFor(date, holidays);
      events.push({
        uid: `fazes-${employeeWithOverrides.employee_id}-${year}${String(month).padStart(2,"0")}${String(d.day).padStart(2,"0")}@fazes`,
        summary: `${cfg.code} · ${cfg.entry}-${cfg.exit}`,
        description: `Funcionário: ${employeeWithOverrides.name} (${employeeWithOverrides.employee_id})${cfg.lunchStart && cfg.lunchEnd ? ` · Almoço ${cfg.lunchStart}-${cfg.lunchEnd}` : ""}${hol ? ` · Feriado: ${hol.name}` : ""}`,
        date, entry: cfg.entry, exit: cfg.exit,
      });
    }
    if (events.length === 0) { setError("Nenhum turno com horas definidas. Edita os códigos primeiro."); return; }
    downloadIcs(`fazes-${employeeWithOverrides.employee_id}-${year}-${String(month).padStart(2,"0")}.ics`,
      buildIcs(events, `FaZes - ${employeeWithOverrides.name} ${MONTH_NAMES[month-1]}/${year}`));
  }

  function setCellCode(day, newCode) {
    setOverrides(prev => {
      const next = { ...prev };
      const k = overrideKey; const ov = { ...(next[k]||{}) };
      if (newCode === "" || newCode === null) delete ov[day]; else ov[day] = newCode;
      if (Object.keys(ov).length === 0) delete next[k]; else next[k] = ov;
      return next;
    });
    setPickCodeCell(null);
    setEditCell(null);
  }

  // Build holidays-of-month for the side legend
  const monthHolidays = useMemo(() => {
    const all = getHolidays(year);
    const out = [];
    Object.entries(all).forEach(([key, info]) => {
      const [, m, d] = key.split("-").map(Number);
      if (m === month) out.push({ day: d, name: info.name, regions: info.regions });
    });
    return out.sort((a,b)=>a.day-b.day);
  }, [year, month]);

  // Build per-code counts for the selected employee (uses raw PDF codes)
  const codeSummary = useMemo(() => {
    if (!employeeWithOverrides) return [];
    const counts = {};
    for (const d of employeeWithOverrides.days) {
      const c = (d.code || "").trim();
      if (!c) continue;
      counts[c] = (counts[c] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([code, count]) => {
        const cfg = resolveCode(code, codes);
        return { code, count, kind: inferKind(cfg) };
      })
      .sort((a, b) => b.count - a.count);
  }, [employeeWithOverrides, codes]);

  return (
    <div className="App min-h-screen">
      <header className="sticky top-0 z-20 panel" style={{borderRadius:0, borderLeft:"none", borderRight:"none", borderTop:"none"}}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3 relative">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-base" style={{background:"var(--accent)", color:"var(--accent-fg)"}}>HT</div>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-main leading-none">Horário Trabalho</h1>
              <p className="text-[10px] sm:text-xs text-soft leading-tight">{me && employees.find(e=>e.row===me)?.name ? `Olá, ${employees.find(e=>e.row===me).name.split(' ')[0]}` : "Escalas · Calendário"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSwitcher theme={theme} setTheme={setTheme}/>
            <button onClick={()=>setMenuOpen(o=>!o)} data-testid="open-menu-btn" className="p-2.5 rounded-xl btn-ghost"><MoreVertical size={20}/></button>
          </div>
          <MoreMenu open={menuOpen} onClose={()=>setMenuOpen(false)} onPick={(id)=>{
            if (id === "pdf") { fileInput.current?.click(); return; }
            setDrawer(id);
          }}/>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <input ref={fileInput} type="file" accept="application/pdf" className="hidden" data-testid="file-input" onChange={e=>e.target.files?.[0] && handleFile(e.target.files[0])}/>
        {!schedule ? (
          <EmptyState onUploadClick={()=>fileInput.current?.click()} uploading={uploading} error={error}/>
        ) : (
          <div className="space-y-4 fz-rise">
            <div className="panel p-3 sm:p-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <button onClick={()=>{ if(month===1){setMonth(12);setYear(year-1);} else setMonth(month-1); }} data-testid="prev-month-btn" className="btn-ghost rounded-lg p-2"><ChevronLeft size={16}/></button>
                <div className="px-3 min-w-[140px] text-center">
                  <div className="font-extrabold text-main text-lg leading-tight">{MONTH_NAMES[month-1]}</div>
                  <div className="text-xs text-soft">{year}</div>
                </div>
                <button onClick={()=>{ if(month===12){setMonth(1);setYear(year+1);} else setMonth(month+1); }} data-testid="next-month-btn" className="btn-ghost rounded-lg p-2"><ChevronRight size={16}/></button>
              </div>
              <div className="flex-1 min-w-[160px]">
                {employeeWithOverrides && (
                  <div className="text-sm">
                    <div className="font-bold text-main truncate flex items-center gap-1">{employeeWithOverrides.name}{me===employeeWithOverrides.row && <UserCheck size={14} style={{color:"var(--accent)"}}/>}</div>
                    <div className="text-xs text-soft font-mono">Linha {String(employeeWithOverrides.row).padStart(2,"0")} · {employeeWithOverrides.employee_id}</div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select value={region} onChange={e=>setRegion(e.target.value)} data-testid="region-select" className="input-c rounded-lg px-2 py-2 text-xs font-semibold">
                  <option value="acores">Açores</option><option value="continental">Continental</option><option value="ambos">Ambos</option>
                </select>
                <button onClick={exportIcs} data-testid="export-ics-btn" className="btn-accent rounded-lg px-3 py-2 inline-flex items-center gap-1.5 text-sm font-semibold"><Download size={14}/> .ics</button>
              </div>
            </div>
            {error && <div className="panel p-3 text-sm text-rose-400" data-testid="main-error">{error}</div>}

            {employeeWithOverrides && codeSummary.length > 0 && (
              <div className="panel p-3 sm:p-4" data-testid="code-summary">
                <div className="text-xs font-bold uppercase tracking-wider text-soft mb-2">
                  Resumo de {MONTH_NAMES[month-1]} · {employeeWithOverrides.days.filter(d=>d.code).length} dias com código
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {codeSummary.map(({ code, count, kind }) => (
                    <span
                      key={code}
                      data-testid={`summary-${code}`}
                      className={`shift-${kind === 'vazio' ? 'folga' : kind} rounded-lg px-2.5 py-1 text-xs font-bold inline-flex items-center gap-1.5`}
                    >
                      <span className="font-mono">{code}</span>
                      <span className="opacity-70">×</span>
                      <span>{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {employeeWithOverrides ? (
              <MonthCalendar year={year} month={month} employee={employeeWithOverrides} codes={codes} region={region}
                onCellClick={(day, code) => setEditCell({ day, current: code })}/>
            ) : (
              <div className="panel p-8 text-center text-soft">Escolhe quem és no menu (3 pontinhos).</div>
            )}

            {monthHolidays.length > 0 && (
              <div className="panel p-3 sm:p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-soft mb-2">Feriados em {MONTH_NAMES[month-1]}</div>
                <ul className="space-y-1.5">
                  {monthHolidays.map(h => (
                    <li key={h.day} className="flex items-center gap-2 text-sm" data-testid={`hol-${h.day}`}>
                      <span className="font-mono font-bold text-main w-7">{String(h.day).padStart(2,"0")}</span>
                      <span className="flex-1 text-main">{h.name}</span>
                      <span className="flex gap-1">
                        {h.regions.includes("acores") && <span className="text-[10px] uppercase font-bold rounded-full px-2 py-0.5 bg-sky-500/20 text-sky-500">Açores</span>}
                        {h.regions.includes("continental") && <span className="text-[10px] uppercase font-bold rounded-full px-2 py-0.5 bg-pink-500/20 text-pink-500">Continental</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="panel p-3 text-xs text-muted-c flex flex-wrap gap-x-4 gap-y-1 items-center">
              <span><span className="inline-block w-3 h-3 rounded shift-manha mr-1 align-middle"/> Manhã (≤08:30)</span>
              <span><span className="inline-block w-3 h-3 rounded shift-intermedio mr-1 align-middle"/> Intermédio (08:31–09:30)</span>
              <span><span className="inline-block w-3 h-3 rounded shift-tarde mr-1 align-middle"/> Tarde (≥09:31)</span>
              <span><span className="inline-block w-3 h-3 rounded shift-folga mr-1 border border-c align-middle"/> Folga</span>
              <span><span className="inline-block w-3 h-3 rounded shift-ferias mr-1 align-middle"/> Férias</span>
              <span className="opacity-60">· Toca num dia para ver o teu horário · + para trocar</span>
            </div>
          </div>
        )}
      </main>

      {/* Drawers */}
      <PeopleDrawer open={drawer==="pessoas"} onClose={()=>setDrawer(null)} employees={employees} selectedRow={selectedRow} setSelectedRow={setSelectedRow} me={me} setMe={setMe} onReupload={()=>{setDrawer(null); fileInput.current?.click();}}/>
      <CodesDrawer open={drawer==="horarios"} onClose={()=>setDrawer(null)} codes={codes} setCodes={setCodes}/>
      <TradesDrawer open={drawer==="trocas"} onClose={()=>setDrawer(null)} employees={employees} codes={codes} year={year} month={month} me={me}/>
      <ClockDrawer open={drawer==="relogio"} onClose={()=>setDrawer(null)}/>

      {needsMe && employees.length > 0 && (
        <MeModal employees={employees} onPick={(row)=>{setMe(row); setSelectedRow(row); setNeedsMe(false);}} onSkip={()=>setNeedsMe(false)}/>
      )}

      {editCell && (
        <DayDetailModal
          cell={editCell}
          codes={codes}
          employee={employeeWithOverrides}
          year={year}
          month={month}
          onClose={()=>setEditCell(null)}
          onChangeRequest={()=>{ setPickCodeCell(editCell); setEditCell(null); }}
        />
      )}
      {pickCodeCell && (
        <CellEditModal
          cell={pickCodeCell}
          codes={codes}
          onClose={()=>setPickCodeCell(null)}
          onSave={(code)=>setCellCode(pickCodeCell.day, code)}
        />
      )}
    </div>
  );
}
