"use client";

import { useState } from "react";
import { X, FlaskConical, Bug, Database, Lightbulb, ChevronRight } from "lucide-react";
import { IDEAS, FINDINGS, DATA_SOURCES_STATUS, countIdeasByStatus, REVIEW_SNAPSHOT } from "../ideasData";

const CAT_LABEL: Record<string, string> = {
  visual: "Visual",
  fisica: "Física",
  datos: "Datos",
  radio: "Radio",
  ux: "UX",
};
const CAT_COLOR: Record<string, string> = {
  visual: "text-fuchsia-300 bg-fuchsia-500/10 ring-fuchsia-400/30",
  fisica: "text-cyan-300 bg-cyan-500/10 ring-cyan-400/30",
  datos: "text-amber-300 bg-amber-500/10 ring-amber-400/30",
  radio: "text-emerald-300 bg-emerald-500/10 ring-emerald-400/30",
  ux: "text-sky-300 bg-sky-500/10 ring-sky-400/30",
};

/** Panel de análisis: ideas exploradas, hallazgos de la revisión y estado de fuentes */
export default function IdeasPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"ideas" | "hallazgos" | "fuentes">("ideas");
  if (!open) return null;

  const counts = countIdeasByStatus(IDEAS);
  const demos = IDEAS.filter((i) => i.status === "demo");
  const parciales = IDEAS.filter((i) => i.status === "parcial");
  const propuestas = IDEAS.filter((i) => i.status === "propuesta");
  const aplazadas = IDEAS.filter((i) => i.status === "aplazada");

  return (
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
      <div className="absolute inset-0 bg-black/50 pointer-events-auto" onClick={onClose} />
      <aside
        className="relative pointer-events-auto w-full max-w-2xl h-full bg-[#070b16]/95 backdrop-blur-xl border-l border-white/10 overflow-y-auto"
        style={{ fontFamily: "var(--font-display), ui-sans-serif, system-ui" }}
      >
        <header className="sticky top-0 z-10 bg-[#070b16]/95 backdrop-blur-xl border-b border-white/10 px-5 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-cyan-100 tracking-wide flex items-center gap-2">
              <FlaskConical size={15} className="text-cyan-300" />
              Exploración de ideas y evaluación
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Auditoría src/ drop 354 · {IDEAS.length} ideas · {counts.demo} demo · {counts.parcial} {counts.parcial === 1 ? "parcial" : "parciales"} · {counts.propuesta} {counts.propuesta === 1 ? "propuesta" : "propuestas"} · {counts.aplazada} {counts.aplazada === 1 ? "aplazada" : "aplazadas"}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100 transition-colors p-1.5">
            <X size={18} />
          </button>
        </header>

        <nav className="flex gap-1 px-5 pt-3 pb-2 sticky top-[57px] bg-[#070b16]/95 z-10 backdrop-blur-xl">
          {(
            [
              ["ideas", "Ideas", <Lightbulb key="i" size={12} />],
              ["hallazgos", "Hallazgos", <Bug key="b" size={12} />],
              ["fuentes", "Fuentes de datos", <Database key="d" size={12} />],
            ] as const
          ).map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                tab === id
                  ? "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/30"
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </nav>

        <div className="px-5 pb-10">
          {tab === "ideas" && (
            <>
              <SectionTitle>Implementadas en este explorador web</SectionTitle>
              {demos.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} />
              ))}
              {parciales.length > 0 && (
                <>
                  <SectionTitle>Parciales (con lo que falta)</SectionTitle>
                  {parciales.map((idea) => (
                    <IdeaCard key={idea.id} idea={idea} />
                  ))}
                </>
              )}
              <SectionTitle>Propuestas para la versión C++/OpenGL</SectionTitle>
              {propuestas.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} />
              ))}
              <SectionTitle>Aplazadas (fuera de paridad, sin ciclo propio)</SectionTitle>
              {aplazadas.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} />
              ))}
            </>
          )}

          {tab === "hallazgos" && (
            <>
              <p className="text-[11px] text-slate-500 mb-3">
                Snapshot de la revisión C++ ({REVIEW_SNAPSHOT}) — no describe el estado actual del explorador web.
              </p>
              {FINDINGS.map((f) => (
                <div key={f.title} className="mb-5">
                  <SectionTitle>{f.title}</SectionTitle>
                  <ul className="space-y-1.5">
                    {f.items.map((it) => (
                      <li key={it} className="flex gap-2 text-xs text-slate-300 leading-relaxed">
                        <ChevronRight size={13} className="mt-0.5 shrink-0 text-cyan-400/70" />
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="rounded-xl bg-amber-500/8 ring-1 ring-amber-400/20 p-3.5 mt-2">
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  <strong>Orden recomendado de ataque:</strong> primero los bugs baratos de alto valor (resize,
                  race de GIRO, join de threads, intensity² del bloom, CMake data/), después la atmósfera física
                  y la aurora volumétrica (mayor impacto visual), y por último ray-tracing HF e ionogramas
                  sintetizados (mayor valor funcional). El god object App::Impl y la UI inline se refactorizan
                  cuando se toquen las capas, no antes.
                </p>
              </div>
            </>
          )}

          {tab === "fuentes" && (
            <>
              <SectionTitle>Snapshot de la revisión/fuentes ({REVIEW_SNAPSHOT})</SectionTitle>
              <div className="space-y-1.5">
                {DATA_SOURCES_STATUS.map((s) => (
                  <div
                    key={s.name}
                    className="flex items-start gap-2.5 rounded-lg bg-white/[0.03] ring-1 ring-white/5 px-3 py-2"
                  >
                    <span
                      className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                        s.ok ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-red-400/80"
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs text-slate-200 font-medium">{s.name}</div>
                      <div className="text-[11px] text-slate-500">{s.note}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl bg-white/[0.03] ring-1 ring-white/5 p-3.5 text-[11px] text-slate-400 leading-relaxed">
                <p className="mb-1.5 text-slate-300 font-medium">Candidatas descartadas o diferidas</p>
                THEMIS all-sky (video, pesado), SuperMAG (requiere registro), GNSS S4 de IGS (formato RINEX
                demasiado pesado para polling), Dst en JSON (endpoint retirado — se puede derivar de
                SuperMAG/síntesis local). DIAS (ya integrada en el C++) queda como relleno europeo sin
                duplicación.
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mt-5 mb-2.5 first:mt-1">
      {children}
    </h3>
  );
}

function IdeaCard({ idea }: { idea: (typeof IDEAS)[number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/8 mb-2 overflow-hidden hover:ring-cyan-400/25 transition-all">
      <button onClick={() => setOpen(!open)} className="w-full text-left px-3.5 py-2.5 flex items-center gap-3">
        <span
          className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ring-1 shrink-0 ${
            idea.status === "demo"
              ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
              : idea.status === "parcial"
                ? "bg-cyan-500/15 text-cyan-300 ring-cyan-400/30"
                : idea.status === "aplazada"
                  ? "bg-amber-500/15 text-amber-300 ring-amber-400/30"
                  : "bg-slate-500/15 text-slate-400 ring-slate-400/20"
          }`}
        >
          {idea.status}
        </span>
        <span className="text-xs text-slate-100 font-medium flex-1 leading-snug">{idea.title}</span>
        <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded ring-1 shrink-0 ${CAT_COLOR[idea.category]}`}>
          {CAT_LABEL[idea.category]}
        </span>
        <span className="flex gap-0.5 shrink-0" title={`Impacto ${idea.impact}/5 · Esfuerzo ${idea.effort}/5`}>
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className={`w-1 h-2.5 rounded-sm ${
                i < idea.impact ? "bg-cyan-400" : "bg-white/10"
              }`}
            />
          ))}
          <span className="w-1.5" />
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={`w-1 h-2.5 rounded-sm ${i < idea.effort ? "bg-orange-400/70" : "bg-white/10"}`} />
          ))}
        </span>
        <ChevronRight
          size={14}
          className={`shrink-0 text-slate-600 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && (
        <div className="px-3.5 pb-3 pt-0.5 border-t border-white/5">
          <p className="text-[11px] text-slate-300 leading-relaxed mb-2">{idea.summary}</p>
          <p className="text-[11px] text-slate-400 leading-relaxed mb-2">{idea.detail}</p>
          {idea.missing && (
            <div className="rounded-lg bg-cyan-500/8 ring-1 ring-cyan-400/15 px-2.5 py-1.5 mb-2">
              <span className="text-[9px] uppercase tracking-wider text-cyan-300/80">Falta</span>
              <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">{idea.missing}</p>
            </div>
          )}
          {idea.port && (
            <div className="rounded-lg bg-cyan-500/8 ring-1 ring-cyan-400/15 px-2.5 py-1.5">
              <span className="text-[9px] uppercase tracking-wider text-cyan-300/80">Port al C++</span>
              <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">{idea.port}</p>
            </div>
          )}
          <div className="flex gap-3 mt-2 text-[9px] text-slate-600 uppercase tracking-wider">
            <span>impacto {idea.impact}/5</span>
            <span>esfuerzo {idea.effort}/5</span>
            <span>barra cian = impacto · barra naranja = esfuerzo</span>
          </div>
        </div>
      )}
    </div>
  );
}
