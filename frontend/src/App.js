import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Menu, Upload, Calendar, Download, Sun, Moon, CircleDashed, ChevronLeft, ChevronRight, Search } from "lucide-react";
import "@/App.css";
import MonthCalendar from "@/components/MonthCalendar";
import CodesDrawer from "@/components/CodesDrawer";
import { DEFAULT_CODES, resolveCode, inferKind } from "@/lib/codes";
import { Storage } from "@/lib/storage";
import { buildIcs, downloadIcs } from "@/lib/ics";
import { getHolidays, holidayFor } from "@/lib/holidays";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function ThemeSwitcher({ theme, setTheme }) {
  const opts = [
    { id: "dark", icon: Moon, label: "Escuro" },
    { id: "soft", icon: CircleDashed, label: "Cinzento" },
    { id: "light", icon: Sun, label: "Claro" },
  ];
  return (
    <div className="inline-flex panel p-1" data-testid="theme-switcher" style={{ borderRadius: "999px" }}>
      {opts.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => setTheme(id)}
          data-testid={`theme-${id}`}
          aria-label={label}
          className={`px-2.5 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-semibold transition-all ${
            theme === id ? "btn-accent" : "text-muted-c hover:text-main"
          }`}
        >
          <Icon size={14} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

function EmptyState({ onUploadClick, uploading, error }) {
  return (
    <div className="panel p-8 sm:p-12 text-center fz-rise" data-testid="empty-state">
      <div
        className="mx-auto mb-5 w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: "color-mix(in srgb, var(--accent) 18%, transparent)" }}
      >
        <Calendar size={28} style={{ color: "var(--accent)" }} />
      </div>
      <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-main mb-2">
        Carrega a tua escala
      </h2>
      <p className="text-muted-c max-w-md mx-auto mb-6 text-sm sm:text-base">
        Faz upload do PDF da escala (ex.: <span className="font-mono">Esc_Hor 2026043-MAI.pdf</span>),
        escolhe a tua linha e tens o calendário com horários, feriados e alarmes prontos a exportar.
      </p>
      <button
        onClick={onUploadClick}
        data-testid="upload-cta-btn"
        disabled={uploading}
        className="btn-accent rounded-full px-6 py-3 inline-flex items-center gap-2 font-semibold shadow-lg disabled:opacity-60"
      >
        <Upload size={18} />
        {uploading ? "A processar..." : "Selecionar PDF"}
      </button>
      {error && (
        <p className="mt-4 text-sm text-rose-400 max-w-md mx-auto" data-testid="upload-error">
          {error}
        </p>
      )}
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("fazes:theme") || "dark");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [schedule, setSchedule] = useState(() => Storage.loadSchedule());
  const [selectedRow, setSelectedRow] = useState(() => Storage.loadSelected());
  const [codes, setCodes] = useState(() => Storage.loadCodes(DEFAULT_CODES));
  const [region, setRegion] = useState(() => Storage.loadRegion());
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(() => Storage.loadSchedule()?.year || new Date().getFullYear());
  const [month, setMonth] = useState(() => Storage.loadSchedule()?.month || new Date().getMonth() + 1);
  const fileInput = useRef(null);

  // Theme application
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("fazes:theme", theme);
  }, [theme]);

  useEffect(() => { Storage.saveCodes(codes); }, [codes]);
  useEffect(() => { Storage.saveSelected(selectedRow); }, [selectedRow]);
  useEffect(() => { Storage.saveRegion(region); }, [region]);
  useEffect(() => {
    if (schedule) {
      Storage.saveSchedule(schedule);
      if (schedule.year) setYear(schedule.year);
      if (schedule.month) setMonth(schedule.month);
    }
  }, [schedule]);

  const employees = schedule?.employees || [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      e.name.toLowerCase().includes(q) ||
      e.employee_id.includes(q) ||
      String(e.row).padStart(2, "0").includes(q)
    );
  }, [employees, search]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.row === selectedRow) || null,
    [employees, selectedRow]
  );

  async function handleFile(file) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post(`${API}/parse-schedule`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      });
      const data = res.data;
      setSchedule(data);
      setSelectedRow(data.employees?.[0]?.row || null);
      if (data.year) setYear(data.year);
      if (data.month) setMonth(data.month);
      // Add any new raw codes to the codes table (with empty times)
      if (Array.isArray(data.raw_codes)) {
        setCodes((prev) => {
          // Also auto-correct previously-saved entries that have empty entry hour
          // and a wrongly inferred kind based on prefix (e.g. T2 saved as "manha").
          const corrected = prev.map((c) => {
            if (c.entry) return c; // user-defined hours win
            const u = (c.code || "").toUpperCase();
            if (/^[PT]/.test(u) && c.kind !== "tarde" && c.kind !== "folga") {
              return { ...c, kind: "tarde" };
            }
            if (/^M/.test(u) && c.kind !== "manha" && c.kind !== "folga" && c.kind !== "intermedio") {
              return { ...c, kind: "manha" };
            }
            return c;
          });
          const existing = new Set(corrected.map((c) => c.code.toUpperCase()));
          const additions = data.raw_codes
            .filter((rc) => !existing.has(rc.toUpperCase()))
            .map((rc) => ({
              code: rc.toUpperCase(),
              entry: "",
              lunchStart: "",
              lunchEnd: "",
              exit: "",
              kind: /^(D|DF|F)$/i.test(rc) ? "folga" : /^[PT]/i.test(rc) ? "tarde" : /^M/i.test(rc) ? "manha" : "manha",
            }));
          return additions.length || corrected !== prev ? [...corrected, ...additions] : prev;
        });
      }
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || "Erro a ler o PDF";
      setError(typeof msg === "string" ? msg : "Erro a ler o PDF");
    } finally {
      setUploading(false);
    }
  }

  function exportIcs() {
    if (!selectedEmployee) return;
    const events = [];
    const holidays = getHolidays(year);
    for (const d of selectedEmployee.days) {
      const cfg = resolveCode(d.code, codes);
      if (!cfg || inferKind(cfg) === "folga" || !cfg.entry || !cfg.exit) continue;
      const date = new Date(year, month - 1, d.day);
      const hol = holidayFor(date, holidays);
      const lunchTxt = cfg.lunchStart && cfg.lunchEnd ? ` · Almoço ${cfg.lunchStart}-${cfg.lunchEnd}` : "";
      const holTxt = hol ? ` · Feriado: ${hol.name}` : "";
      events.push({
        uid: `fazes-${selectedEmployee.employee_id}-${year}${String(month).padStart(2, "0")}${String(d.day).padStart(2, "0")}@fazes`,
        summary: `${cfg.code} · ${cfg.entry}-${cfg.exit}`,
        description: `Funcionário: ${selectedEmployee.name} (${selectedEmployee.employee_id})${lunchTxt}${holTxt}`,
        date,
        entry: cfg.entry,
        exit: cfg.exit,
      });
    }
    if (events.length === 0) {
      setError("Nenhum turno com horas definidas. Edita os códigos no painel lateral primeiro.");
      return;
    }
    const ics = buildIcs(events, `FaZes - ${selectedEmployee.name} ${MONTH_NAMES[month - 1]}/${year}`);
    downloadIcs(`fazes-${selectedEmployee.employee_id}-${year}-${String(month).padStart(2, "0")}.ics`, ics);
  }

  function clearAll() {
    if (!window.confirm("Apagar a escala carregada?")) return;
    setSchedule(null);
    setSelectedRow(null);
    Storage.saveSchedule(null);
  }

  return (
    <div className="App min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 panel" style={{ borderRadius: 0, borderLeft: "none", borderRight: "none", borderTop: "none" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-lg"
              style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
            >
              Fz
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-main leading-none">FaZes</h1>
              <p className="text-[10px] sm:text-xs text-soft leading-tight">Escalas · Calendário · Alarmes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSwitcher theme={theme} setTheme={setTheme} />
            <button
              onClick={() => setDrawerOpen(true)}
              data-testid="open-drawer-btn"
              aria-label="Abrir códigos de horário"
              className="p-2.5 rounded-xl btn-ghost relative"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf"
          className="hidden"
          data-testid="file-input"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {!schedule ? (
          <EmptyState
            onUploadClick={() => fileInput.current?.click()}
            uploading={uploading}
            error={error}
          />
        ) : (
          <div className="grid lg:grid-cols-[320px_1fr] gap-4 sm:gap-6">
            {/* Sidebar: employee list */}
            <aside className="panel p-3 sm:p-4 fz-rise lg:max-h-[calc(100vh-140px)] flex flex-col" data-testid="employee-sidebar">
              <div className="flex items-center justify-between mb-3 gap-2">
                <h2 className="text-sm font-bold text-main">Funcionários</h2>
                <button
                  onClick={() => fileInput.current?.click()}
                  data-testid="reupload-btn"
                  className="text-[11px] btn-ghost rounded-full px-3 py-1 inline-flex items-center gap-1"
                >
                  <Upload size={12} /> Mudar
                </button>
              </div>

              <div className="relative mb-3">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-soft" />
                <input
                  type="text"
                  placeholder="Procurar por nome, nº ou linha..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="employee-search"
                  className="w-full input-c rounded-lg pl-8 pr-3 py-2 text-sm"
                />
              </div>

              <div className="flex-1 overflow-y-auto fz-scroll space-y-1 pr-1">
                {filtered.map((emp) => {
                  const active = emp.row === selectedRow;
                  return (
                    <button
                      key={emp.row}
                      onClick={() => setSelectedRow(emp.row)}
                      data-testid={`employee-${emp.row}`}
                      className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${
                        active ? "btn-accent" : "btn-ghost"
                      }`}
                    >
                      <span className="font-mono text-[10px] opacity-70 w-6">
                        {String(emp.row).padStart(2, "0")}
                      </span>
                      <span className="flex-1 truncate text-sm font-semibold">{emp.name}</span>
                      <span className="font-mono text-[10px] opacity-70">{emp.employee_id}</span>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="text-soft text-sm text-center py-6">Sem resultados.</p>
                )}
              </div>

              <button
                onClick={clearAll}
                data-testid="clear-all-btn"
                className="mt-3 text-[11px] text-soft hover:text-rose-400 transition-colors"
              >
                Apagar escala carregada
              </button>
            </aside>

            {/* Main: calendar */}
            <section className="space-y-4 fz-rise">
              <div className="panel p-3 sm:p-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1);
                    }}
                    data-testid="prev-month-btn"
                    className="btn-ghost rounded-lg p-2"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div className="px-3 min-w-[160px] text-center">
                    <div className="font-extrabold text-main text-lg leading-tight">
                      {MONTH_NAMES[month - 1]}
                    </div>
                    <div className="text-xs text-soft">{year}</div>
                  </div>
                  <button
                    onClick={() => {
                      if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1);
                    }}
                    data-testid="next-month-btn"
                    className="btn-ghost rounded-lg p-2"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="flex-1 min-w-[180px]">
                  {selectedEmployee && (
                    <div className="text-sm">
                      <div className="font-bold text-main truncate">{selectedEmployee.name}</div>
                      <div className="text-xs text-soft font-mono">
                        Linha {String(selectedEmployee.row).padStart(2, "0")} · {selectedEmployee.employee_id}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    data-testid="region-select"
                    className="input-c rounded-lg px-2 py-2 text-xs font-semibold"
                  >
                    <option value="acores">Açores</option>
                    <option value="continental">Continental</option>
                    <option value="ambos">Ambos</option>
                  </select>

                  <button
                    onClick={exportIcs}
                    data-testid="export-ics-btn"
                    className="btn-accent rounded-lg px-3 py-2 inline-flex items-center gap-1.5 text-sm font-semibold"
                  >
                    <Download size={14} /> .ics
                  </button>
                </div>
              </div>

              {error && (
                <div className="panel p-3 text-sm text-rose-400" data-testid="main-error">{error}</div>
              )}

              {selectedEmployee ? (
                <MonthCalendar
                  year={year}
                  month={month}
                  employee={selectedEmployee}
                  codes={codes}
                  region={region}
                />
              ) : (
                <div className="panel p-8 text-center text-soft">
                  Seleciona um funcionário à esquerda.
                </div>
              )}

              <div className="panel p-3 text-xs text-muted-c flex flex-wrap gap-x-4 gap-y-1 items-center">
                <span><span className="inline-block w-3 h-3 rounded shift-manha mr-1 align-middle" /> Manhã (&lt;08:30)</span>
                <span><span className="inline-block w-3 h-3 rounded shift-intermedio mr-1 align-middle" /> Intermédio (08:30–09:30)</span>
                <span><span className="inline-block w-3 h-3 rounded shift-tarde mr-1 align-middle" /> Tarde (≥09:30)</span>
                <span><span className="inline-block w-3 h-3 rounded shift-folga mr-1 border border-c align-middle" /> Folga</span>
                <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-sky-500 mr-1 align-middle" /> Feriado Açores</span>
                <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-pink-500 mr-1 align-middle" /> Feriado Continental</span>
                <span className="opacity-60">· Alarmes 30 e 40 min antes da entrada (no .ics)</span>
              </div>
            </section>
          </div>
        )}
      </main>

      <CodesDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        codes={codes}
        setCodes={setCodes}
      />
    </div>
  );
}
