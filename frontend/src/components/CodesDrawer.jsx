import React, { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";

export default function CodesDrawer({ open, onClose, codes, setCodes }) {
  const [draft, setDraft] = useState(null);

  function update(idx, key, val) {
    setCodes(codes.map((c, i) => (i === idx ? { ...c, [key]: val } : c)));
  }
  function remove(idx) {
    setCodes(codes.filter((_, i) => i !== idx));
  }
  function addNew() {
    if (!draft || !draft.code.trim()) return;
    setCodes([...codes, { ...draft, code: draft.code.trim().toUpperCase() }]);
    setDraft(null);
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        data-testid="drawer-overlay"
      />
      <aside
        data-testid="codes-drawer"
        className={`fixed top-0 right-0 h-full w-full sm:w-[480px] panel-solid z-50 shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ borderLeft: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-c">
          <div>
            <h2 className="text-lg font-bold text-main">Códigos de Horário</h2>
            <p className="text-xs text-soft">Editáveis · guardados no teu dispositivo</p>
          </div>
          <button
            onClick={onClose}
            data-testid="drawer-close-btn"
            className="p-2 rounded-lg btn-ghost"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto fz-scroll h-[calc(100%-128px)] px-3 py-3 space-y-2">
          <div className="grid grid-cols-12 gap-1 text-[10px] uppercase tracking-wider text-soft px-2">
            <div className="col-span-2">Código</div>
            <div className="col-span-2">Entrada</div>
            <div className="col-span-3">Almoço</div>
            <div className="col-span-2">Saída</div>
            <div className="col-span-2">Tipo</div>
            <div className="col-span-1" />
          </div>

          {codes.map((c, idx) => (
            <div
              key={idx}
              data-testid={`code-row-${c.code}`}
              className="grid grid-cols-12 gap-1 items-center panel p-2"
              style={{ borderRadius: "0.625rem" }}
            >
              <input
                className="col-span-2 input-c rounded px-2 py-1.5 text-sm font-mono"
                value={c.code}
                onChange={(e) => update(idx, "code", e.target.value.toUpperCase())}
              />
              <input
                className="col-span-2 input-c rounded px-2 py-1.5 text-xs"
                placeholder="07:00"
                value={c.entry}
                onChange={(e) => update(idx, "entry", e.target.value)}
              />
              <div className="col-span-3 flex gap-1">
                <input
                  className="w-full input-c rounded px-1.5 py-1.5 text-xs"
                  placeholder="início"
                  value={c.lunchStart}
                  onChange={(e) => update(idx, "lunchStart", e.target.value)}
                />
                <input
                  className="w-full input-c rounded px-1.5 py-1.5 text-xs"
                  placeholder="fim"
                  value={c.lunchEnd}
                  onChange={(e) => update(idx, "lunchEnd", e.target.value)}
                />
              </div>
              <input
                className="col-span-2 input-c rounded px-2 py-1.5 text-xs"
                placeholder="15:00"
                value={c.exit}
                onChange={(e) => update(idx, "exit", e.target.value)}
              />
              <select
                className="col-span-2 input-c rounded px-1 py-1.5 text-xs"
                value={c.kind}
                onChange={(e) => update(idx, "kind", e.target.value)}
              >
                <option value="manha">Manhã</option>
                <option value="intermedio">Intermédio</option>
                <option value="tarde">Tarde</option>
                <option value="folga">Folga</option>
              </select>
              <button
                onClick={() => remove(idx)}
                data-testid={`code-delete-${c.code}`}
                className="col-span-1 p-1.5 rounded hover:bg-rose-500/20 text-rose-500 justify-self-end"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          <div
            className="grid grid-cols-12 gap-1 items-center p-2"
            style={{
              background: "color-mix(in srgb, var(--accent) 12%, transparent)",
              border: "1px dashed var(--accent)",
              borderRadius: "0.625rem",
            }}
          >
            <input
              className="col-span-2 input-c rounded px-2 py-1.5 text-sm font-mono"
              placeholder="NOV"
              value={draft?.code || ""}
              onChange={(e) =>
                setDraft({
                  code: e.target.value.toUpperCase(),
                  entry: draft?.entry || "",
                  lunchStart: draft?.lunchStart || "",
                  lunchEnd: draft?.lunchEnd || "",
                  exit: draft?.exit || "",
                  kind: draft?.kind || "manha",
                })
              }
              data-testid="new-code-input"
            />
            <input
              className="col-span-2 input-c rounded px-2 py-1.5 text-xs"
              placeholder="00:00"
              value={draft?.entry || ""}
              onChange={(e) => setDraft({ ...(draft || {}), entry: e.target.value })}
            />
            <div className="col-span-3 flex gap-1">
              <input
                className="w-full input-c rounded px-1.5 py-1.5 text-xs"
                placeholder="início"
                value={draft?.lunchStart || ""}
                onChange={(e) => setDraft({ ...(draft || {}), lunchStart: e.target.value })}
              />
              <input
                className="w-full input-c rounded px-1.5 py-1.5 text-xs"
                placeholder="fim"
                value={draft?.lunchEnd || ""}
                onChange={(e) => setDraft({ ...(draft || {}), lunchEnd: e.target.value })}
              />
            </div>
            <input
              className="col-span-2 input-c rounded px-2 py-1.5 text-xs"
              placeholder="00:00"
              value={draft?.exit || ""}
              onChange={(e) => setDraft({ ...(draft || {}), exit: e.target.value })}
            />
            <select
              className="col-span-2 input-c rounded px-1 py-1.5 text-xs"
              value={draft?.kind || "manha"}
              onChange={(e) => setDraft({ ...(draft || {}), kind: e.target.value })}
            >
              <option value="manha">Manhã</option>
              <option value="intermedio">Intermédio</option>
              <option value="tarde">Tarde</option>
              <option value="folga">Folga</option>
              <option value="ferias">Férias</option>
            </select>
            <button
              onClick={addNew}
              data-testid="add-code-btn"
              className="col-span-1 p-1.5 rounded btn-accent justify-self-end"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-5 py-3 border-t border-c panel-solid">
          <div className="text-xs text-soft leading-relaxed flex flex-wrap gap-x-3 gap-y-1 items-center">
            <span><span className="inline-block w-3 h-3 rounded shift-manha mr-1 align-middle" /> Manhã (≤08:30)</span>
            <span><span className="inline-block w-3 h-3 rounded shift-intermedio mr-1 align-middle" /> Intermédio (08:31–09:30)</span>
            <span><span className="inline-block w-3 h-3 rounded shift-tarde mr-1 align-middle" /> Tarde (≥09:31)</span>
            <span><span className="inline-block w-3 h-3 rounded shift-folga mr-1 border border-c align-middle" /> Folga</span>
            <span><span className="inline-block w-3 h-3 rounded shift-ferias mr-1 align-middle" /> Férias</span>
          </div>
        </div>
      </aside>
    </>
  );
}
