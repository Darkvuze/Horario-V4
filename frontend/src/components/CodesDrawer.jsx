import React, { useEffect, useMemo, useState } from "react";
import { X, Plus, Trash2, Save, Undo2 } from "lucide-react";
import { inferKind } from "@/lib/codes";

// Infer the "kind" (color bucket) from an entry time, preserving explicit
// off-kinds (folga/ferias) if that's what the user picked.
function kindFromEntry(entry, currentKind) {
  if (currentKind === "folga" || currentKind === "ferias") return currentKind;
  if (!entry) return currentKind || "manha";
  const parts = entry.split(":");
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h)) return currentKind || "manha";
  const mins = h * 60 + (Number.isNaN(m) ? 0 : m);
  if (mins <= 8 * 60 + 30) return "manha";
  if (mins <= 9 * 60 + 30) return "intermedio";
  return "tarde";
}

function areEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (
      x.code !== y.code ||
      x.entry !== y.entry ||
      x.lunchStart !== y.lunchStart ||
      x.lunchEnd !== y.lunchEnd ||
      x.exit !== y.exit ||
      x.kind !== y.kind ||
      (x.label || "") !== (y.label || "")
    )
      return false;
  }
  return true;
}

export default function CodesDrawer({ open, onClose, codes, setCodes }) {
  // Local draft — nothing persists until the user hits "Guardar".
  const [draft, setDraft] = useState(codes);
  const [newCode, setNewCode] = useState(null);

  // Reset draft whenever the drawer re-opens, or when external codes change
  // while closed.
  useEffect(() => {
    if (open) {
      setDraft(codes);
      setNewCode(null);
    }
  }, [open, codes]);

  const dirty = useMemo(() => !areEqual(draft, codes), [draft, codes]);

  function update(idx, key, val) {
    setDraft((prev) =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        const next = { ...c, [key]: val };
        // Auto-update the kind based on the new entry time, so colors
        // reflect the new shift window immediately on save.
        if (key === "entry") {
          next.kind = kindFromEntry(val, c.kind);
        }
        return next;
      })
    );
  }

  function remove(idx) {
    setDraft((prev) => prev.filter((_, i) => i !== idx));
  }

  function addNew() {
    if (!newCode || !newCode.code.trim()) return;
    const toAdd = {
      code: newCode.code.trim().toUpperCase(),
      entry: newCode.entry || "",
      lunchStart: newCode.lunchStart || "",
      lunchEnd: newCode.lunchEnd || "",
      exit: newCode.exit || "",
      kind: kindFromEntry(newCode.entry || "", newCode.kind || "manha"),
    };
    setDraft((prev) => [...prev, toAdd]);
    setNewCode(null);
  }

  function save() {
    setCodes(draft);
  }

  function discard() {
    setDraft(codes);
    setNewCode(null);
  }

  function handleClose() {
    if (dirty) {
      const ok = window.confirm(
        "Tens alterações por guardar. Queres descartá-las?"
      );
      if (!ok) return;
      setDraft(codes);
      setNewCode(null);
    }
    onClose();
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={handleClose}
        data-testid="drawer-overlay"
      />
      <aside
        data-testid="codes-drawer"
        className={`fixed top-0 right-0 h-full w-full sm:w-[480px] panel-solid z-50 shadow-2xl transition-transform duration-300 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ borderLeft: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-c">
          <div>
            <h2 className="text-lg font-bold text-main">Códigos de Horário</h2>
            <p className="text-xs text-soft">
              {dirty ? (
                <span className="text-amber-500 font-semibold">
                  ● Alterações por guardar
                </span>
              ) : (
                "Editáveis · guardados no teu dispositivo"
              )}
            </p>
          </div>
          <button
            onClick={handleClose}
            data-testid="drawer-close-btn"
            className="p-2 rounded-lg btn-ghost"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto fz-scroll px-3 py-3 space-y-2">
          <div className="grid grid-cols-12 gap-1 text-[10px] uppercase tracking-wider text-soft px-2">
            <div className="col-span-2">Código</div>
            <div className="col-span-2">Entrada</div>
            <div className="col-span-3">Almoço</div>
            <div className="col-span-2">Saída</div>
            <div className="col-span-2">Tipo</div>
            <div className="col-span-1" />
          </div>

          {draft.map((c, idx) => {
            // Preview color reflects the CURRENT draft entry time.
            const kind = inferKind(c);
            return (
              <div
                key={idx}
                data-testid={`code-row-${c.code}`}
                className="grid grid-cols-12 gap-1 items-center panel p-2"
                style={{ borderRadius: "0.625rem" }}
              >
                <input
                  className={`col-span-2 rounded px-2 py-1.5 text-sm font-mono font-extrabold text-center shift-${
                    kind === "vazio" ? "folga" : kind
                  }`}
                  style={{ border: "1px solid var(--border)" }}
                  value={c.code}
                  onChange={(e) =>
                    update(idx, "code", e.target.value.toUpperCase())
                  }
                />
                <input
                  className="col-span-2 input-c rounded px-2 py-1.5 text-xs"
                  placeholder="07:00"
                  value={c.entry}
                  onChange={(e) => update(idx, "entry", e.target.value)}
                  data-testid={`code-entry-${c.code}`}
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
                  data-testid={`code-kind-${c.code}`}
                >
                  <option value="manha">Manhã</option>
                  <option value="intermedio">Intermédio</option>
                  <option value="tarde">Tarde</option>
                  <option value="folga">Folga</option>
                  <option value="ferias">Férias</option>
                </select>
                <button
                  onClick={() => remove(idx)}
                  data-testid={`code-delete-${c.code}`}
                  className="col-span-1 p-1.5 rounded hover:bg-rose-500/20 text-rose-500 justify-self-end"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}

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
              value={newCode?.code || ""}
              onChange={(e) =>
                setNewCode({
                  code: e.target.value.toUpperCase(),
                  entry: newCode?.entry || "",
                  lunchStart: newCode?.lunchStart || "",
                  lunchEnd: newCode?.lunchEnd || "",
                  exit: newCode?.exit || "",
                  kind: newCode?.kind || "manha",
                })
              }
              data-testid="new-code-input"
            />
            <input
              className="col-span-2 input-c rounded px-2 py-1.5 text-xs"
              placeholder="00:00"
              value={newCode?.entry || ""}
              onChange={(e) =>
                setNewCode({ ...(newCode || {}), entry: e.target.value })
              }
            />
            <div className="col-span-3 flex gap-1">
              <input
                className="w-full input-c rounded px-1.5 py-1.5 text-xs"
                placeholder="início"
                value={newCode?.lunchStart || ""}
                onChange={(e) =>
                  setNewCode({ ...(newCode || {}), lunchStart: e.target.value })
                }
              />
              <input
                className="w-full input-c rounded px-1.5 py-1.5 text-xs"
                placeholder="fim"
                value={newCode?.lunchEnd || ""}
                onChange={(e) =>
                  setNewCode({ ...(newCode || {}), lunchEnd: e.target.value })
                }
              />
            </div>
            <input
              className="col-span-2 input-c rounded px-2 py-1.5 text-xs"
              placeholder="00:00"
              value={newCode?.exit || ""}
              onChange={(e) =>
                setNewCode({ ...(newCode || {}), exit: e.target.value })
              }
            />
            <select
              className="col-span-2 input-c rounded px-1 py-1.5 text-xs"
              value={newCode?.kind || "manha"}
              onChange={(e) =>
                setNewCode({ ...(newCode || {}), kind: e.target.value })
              }
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

        <div className="px-5 py-3 border-t border-c panel-solid space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={!dirty}
              data-testid="codes-save-btn"
              className={`flex-1 rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-bold transition-opacity ${
                dirty ? "btn-accent" : "btn-ghost opacity-50 cursor-not-allowed"
              }`}
            >
              <Save size={16} /> Guardar alterações
            </button>
            <button
              onClick={discard}
              disabled={!dirty}
              data-testid="codes-discard-btn"
              className="btn-ghost rounded-lg px-3 py-2.5 flex items-center gap-1.5 text-xs font-semibold disabled:opacity-40"
              title="Descartar alterações"
            >
              <Undo2 size={14} /> Descartar
            </button>
          </div>
          <div className="text-[11px] text-soft leading-relaxed flex flex-wrap gap-x-3 gap-y-1 items-center">
            <span>
              <span className="inline-block w-3 h-3 rounded shift-manha mr-1 align-middle" />{" "}
              Manhã (≤08:30)
            </span>
            <span>
              <span className="inline-block w-3 h-3 rounded shift-intermedio mr-1 align-middle" />{" "}
              Intermédio (08:31–09:30)
            </span>
            <span>
              <span className="inline-block w-3 h-3 rounded shift-tarde mr-1 align-middle" />{" "}
              Tarde (≥09:31)
            </span>
            <span>
              <span className="inline-block w-3 h-3 rounded shift-folga mr-1 border border-c align-middle" />{" "}
              Folga
            </span>
            <span>
              <span className="inline-block w-3 h-3 rounded shift-ferias mr-1 align-middle" />{" "}
              Férias
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
