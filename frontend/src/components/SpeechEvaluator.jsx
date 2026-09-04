import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, RotateCcw } from "lucide-react";

const REC_NAME = "SpeechRecognition" in window ? window.SpeechRecognition
  : "webkitSpeechRecognition" in window ? window.webkitSpeechRecognition
  : null;

function wordsOf(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

// Word-overlap accuracy: |expected ∩ recognized| / |expected|
function accuracy(expected, recognized) {
  const exp = wordsOf(expected);
  const rec = wordsOf(recognized);
  if (!exp.length) return 0;
  const recSet = new Set(rec);
  const hits = exp.filter((w) => recSet.has(w)).length;
  return Math.round((hits / exp.length) * 100);
}

export default function SpeechEvaluator({ text }) {
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState(null); // { recognized, score, supported }
  const recRef = useRef(null);
  const cleanupRef = useRef(null);

  const stop = useCallback(() => {
    cleanupRef.current?.(); // removes event handlers
    const rec = recRef.current;
    if (rec) {
      if (rec.onresult) rec.onresult = null;
      rec.abort();
      recRef.current = null;
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!REC_NAME) {
      setResult({ recognized: "", score: 0, supported: false });
      return;
    }
    stop();
    const rec = new REC_NAME();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      const recognized = e.results[0][0].transcript;
      setResult({ recognized, score: accuracy(text, recognized), supported: true });
      setListening(false);
    };
    rec.onerror = () => {
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      cleanupRef.current?.();
      if (recRef.current === rec) recRef.current = null;
    };
    rec.onstart = () => setListening(true);

    // wiring obj holds the handlers so we can null them on stop
    recRef.current = rec;
    rec.start();
  }, [text, stop]);

  // Cleanup on unmount / text change
  useEffect(() => {
    return () => {
      const rec = recRef.current;
      if (rec) {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.onstart = null;
        try { rec.abort(); } catch { /* noop */ }
      }
    };
  }, [text]);

  // R key toggles recording
  useEffect(() => {
    const handler = (e) => {
      if (e.code === "KeyR" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (listening) stop();
        else start();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [listening, start, stop]);

  const badge = result
    ? result.supported === false
      ? { label: "Unsupported", color: "text-neutral-500 border-white/15" }
      : result.score >= 90
        ? { label: `Excellent — ${result.score}%`, color: "text-emerald-accent border-emerald-accent/40 bg-emerald-accent/10" }
        : result.score >= 60
          ? { label: `Good — ${result.score}%`, color: "text-amber-accent border-amber-accent/40 bg-amber-accent/10" }
          : { label: `Keep trying — ${result.score}%`, color: "text-red-400 border-red-500/40 bg-red-500/10" }
    : null;

  return (
    <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={listening ? stop : start}
          className={`flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
            listening
              ? "border-red-500/50 bg-red-500/10 text-red-400 animate-pulse"
              : "border-white/10 bg-white/5 text-neutral-400 hover:text-white hover:border-white/20"
          }`}
          title="Press R to speak"
        >
          {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          {listening ? "Listening…" : "Say it"}
          <kbd className="text-[10px] px-1 py-px border border-white/10 rounded text-neutral-600">R</kbd>
        </button>

        <AnimatePresence>
          {badge && (
            <motion.span
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className={`text-[11px] font-mono px-2 py-1 rounded border ${badge.color}`}
            >
              {badge.label}
            </motion.span>
          )}
        </AnimatePresence>

        {result?.recognized && (
          <button
            onClick={() => setResult(null)}
            className="flex items-center gap-1 text-[11px] font-mono text-neutral-600 hover:text-neutral-300 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> retry
          </button>
        )}
      </div>

      {result?.supported === false && (
        <p className="text-[11px] text-neutral-500 mt-2">
          Speech recognition isn&apos;t supported in this browser (try Chrome/Edge).
        </p>
      )}

      {result?.recognized && (
        <div className="mt-2 text-[11px] font-mono">
          <div className="text-neutral-500">
            You said: <span className="text-neutral-300">{result.recognized}</span>
          </div>
          <div className={`mt-0.5 ${result.score >= 60 ? "text-emerald-accent" : "text-neutral-600"}`}>
            Expected: <span className="text-neutral-300">{text}</span>
          </div>
        </div>
      )}
    </div>
  );
}
