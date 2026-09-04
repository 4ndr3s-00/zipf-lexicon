import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, ChevronRight, CheckCircle2, Zap } from "lucide-react";

const EXPRESSIONS_API = "http://localhost:8001/api/expressions";

const SUGGESTIONS = {
  yesterday: [
    "I managed to finish...",
    "Yesterday I worked on...",
    "We shipped...",
    "I got blocked by..., so I...",
  ],
  today: [
    "I'm currently working on...",
    "Today I'm planning to...",
    "I'm going to pick up...",
    "I'll continue with...",
  ],
  blockers: [
    "I got blocked by...",
    "I'm waiting on...",
    "I need help with...",
    "No blockers so far.",
  ],
};

const FIELDS = [
  { key: "yesterday", label: "Yesterday", hint: "What did you complete?" },
  { key: "today", label: "Today", hint: "What are you working on?" },
  { key: "blockers", label: "Blockers", hint: "Anything blocking you?" },
];

function normalize(text) {
  return String(text || "").toLowerCase();
}

export default function StandupSimulator() {
  const [values, setValues] = useState({ yesterday: "", today: "", blockers: "" });
  const [expressions, setExpressions] = useState([]);

  useEffect(() => {
    fetch(EXPRESSIONS_API)
      .then((r) => r.json())
      .then(setExpressions)
      .catch(() => setExpressions([]));
  }, []);

  const setField = (key, value) => setValues((v) => ({ ...v, [key]: value }));

  // Detect tech expressions present across all three fields (multi-word first).
  const detected = useMemo(() => {
    const full = normalize(Object.values(values).join(" "));
    const found = [];
    const sorted = [...expressions].sort((a, b) => b.expression.length - a.expression.length);
    for (const e of sorted) {
      if (found.includes(e.expression)) continue;
      if (full.includes(normalize(e.expression))) {
        found.push(e.expression);
      }
    }
    return found;
  }, [values, expressions]);

  const totalChars = Object.values(values).reduce((s, v) => s + v.trim().length, 0);

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="rounded-xl border border-white/10 bg-[#121212] p-6">
        <div className="flex items-center gap-2 mb-1">
          <Wand2 className="w-4 h-4 text-amber-accent" />
          <h2 className="text-lg font-semibold text-white">Daily Standup Simulator</h2>
        </div>
        <p className="text-xs text-neutral-500 mb-5">
          Write your standup update. Use the connectors and try to include the tech
          expressions you&apos;re learning.
        </p>

        <div className="space-y-4">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-mono text-neutral-400">{f.label}</label>
                <span className="text-[10px] font-mono text-neutral-600">{f.hint}</span>
              </div>
              <textarea
                value={values[f.key]}
                onChange={(e) => setField(f.key, e.target.value)}
                rows={2}
                placeholder={SUGGESTIONS[f.key][0]}
                className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-white/25 transition-colors resize-none"
              />
              {/* Dynamic connector suggestions */}
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {SUGGESTIONS[f.key].map((s) => (
                  <button
                    key={s}
                    onClick={() => setField(f.key, s)}
                    className="text-[11px] font-mono text-neutral-500 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded px-2 py-1 transition-colors cursor-pointer"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Feedback panel */}
        <div className="mt-5 rounded-lg border border-white/5 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-neutral-400">Expression check</span>
            <span className="text-neutral-500">{totalChars} chars</span>
          </div>

          {totalChars === 0 ? (
            <p className="text-[11px] text-neutral-600 mt-2">
              Start typing or tap a connector to see which tech expressions you used.
            </p>
          ) : detected.length === 0 ? (
            <p className="text-[11px] text-neutral-600 mt-2">
              No tech expressions detected yet. Try one like{" "}
              <span className="text-amber-accent">"I got blocked by..."</span> or{" "}
              <span className="text-amber-accent">"I'm currently working on..."</span>
            </p>
          ) : (
            <div className="mt-2 space-y-1">
              {detected.map((expr) => {
                const meta = expressions.find((e) => e.expression === expr);
                return (
                  <div
                    key={expr}
                    className="flex items-center gap-2 text-[11px] font-mono text-emerald-accent"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-amber-accent">{expr}</span>
                    <span className="text-neutral-600">—</span>
                    <span className="text-neutral-400 truncate">{meta?.definition_en}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Progress to full update */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 mb-1">
            <span>Coverage</span>
            <span>
              {detected.length} / {expressions.length} expressions
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-amber-accent">
            <Zap className="w-3.5 h-3.5" />
            {detected.length > 0 ? "Great — your standup uses tech vocabulary!" : "Keep practicing!"}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {totalChars > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-lg border border-white/5 bg-[#121212] p-4"
          >
            <div className="flex items-center gap-1.5 text-xs font-mono text-neutral-500">
              <ChevronRight className="w-3.5 h-3.5" />
              <span>Copy-paste your standup</span>
            </div>
            <p className="text-sm text-neutral-300 mt-2 whitespace-pre-wrap">
              <span className="text-neutral-500">Yesterday:</span> {values.yesterday}
            </p>
            <p className="text-sm text-neutral-300 mt-1 whitespace-pre-wrap">
              <span className="text-neutral-500">Today:</span> {values.today}
            </p>
            <p className="text-sm text-neutral-300 mt-1 whitespace-pre-wrap">
              <span className="text-neutral-500">Blockers:</span> {values.blockers}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
