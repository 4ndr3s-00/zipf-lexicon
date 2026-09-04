import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Bookmark,
  BookmarkCheck,
  CheckCircle,
  CheckCircle2,
} from "lucide-react";
import { MODES } from "../config/modes";

const CAT_LABELS = {
  n: "noun",
  v: "verb",
  adj: "adjective",
  adv: "adverb",
  con: "conjunction",
};

function speak(text, lang = "en-US") {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

function AudioButton({ text, className = "" }) {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const check = () => setSpeaking(window.speechSynthesis.speaking);
    const id = setInterval(check, 150);
    return () => clearInterval(id);
  }, []);

  const handleSpeak = () => {
    speak(text);
    setSpeaking(true);
  };

  return (
    <button
      onClick={handleSpeak}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors cursor-pointer ${
        speaking
          ? "border-amber-accent/40 bg-amber-accent/10 text-amber-accent"
          : "border-white/10 bg-white/5 text-neutral-400 hover:text-white hover:border-white/20"
      } ${className}`}
      title="Listen"
    >
      {speaking ? (
        <Volume2 className="w-3.5 h-3.5 animate-pulse" />
      ) : (
        <VolumeX className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function Shimmer({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded bg-white/5 ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
        backgroundSize: "200% 100%",
      }}
    />
  );
}

function ExampleCard({ ex, index }) {
  const [showTr, setShowTr] = useState(false);

  if (typeof ex === "string") {
    return (
      <div className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
        <span className="text-[11px] font-mono text-neutral-600 mt-0.5 shrink-0">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-neutral-300 leading-relaxed">{ex}</p>
        </div>
        <AudioButton text={ex} />
      </div>
    );
  }

  return (
    <div className="py-3 border-b border-white/5 last:border-0">
      <div className="flex items-start gap-3">
        <span className="text-[11px] font-mono text-neutral-600 mt-0.5 shrink-0">
          {index + 1}
        </span>
        <p className="text-sm text-neutral-300 leading-relaxed flex-1">
          {ex.en}
        </p>
        <AudioButton text={ex.en} />
      </div>
      {ex.es && (
        <div className="ml-5 mt-1.5">
          <button
            onClick={() => setShowTr((v) => !v)}
            className="text-[11px] font-mono text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer flex items-center gap-1"
          >
            {showTr ? (
              <EyeOff className="w-3 h-3" />
            ) : (
              <Eye className="w-3 h-3" />
            )}
            {showTr ? "Hide" : "ES"}
          </button>
          <AnimatePresence>
            {showTr && (
              <motion.p
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="text-xs text-neutral-500 mt-1 overflow-hidden"
              >
                {ex.es}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default function FlashCard({
  word,
  mode,
  bookmarked,
  learned,
  onToggleBookmark,
  onToggleLearned,
}) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(true);

  useEffect(() => {
    const handler = (e) => {
      if (e.code === "KeyP" || e.code === "KeyV") {
        e.preventDefault();
        if (word?.word) speak(word.word);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [word?.word]);

  if (!word) return null;

  const cfg = MODES[mode];
  let examples = [];
  try {
    examples = typeof word.examples === "string" ? JSON.parse(word.examples) : word.examples || [];
  } catch {
    examples = [];
  }

  const hasDefinition = !!word.definition_en;
  const hasTranslation = !!word.translation_es;
  const hasExamples = examples.length > 0;
  const needsEnrichment = !hasDefinition && !hasTranslation && !hasExamples;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={word.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.25 }}
        className={`rounded-xl border border-white/10 bg-[#121212] p-6 transition-shadow duration-300 ${cfg.glowClass}`}
      >
        {/* Header: category + zipf + rank */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          {word.category && (
            <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 border border-white/10 text-neutral-400">
              {CAT_LABELS[word.category] || word.category}
            </span>
          )}
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-accent/10 border border-amber-accent/30 text-amber-accent">
            Zipf: {word.zipf}
          </span>
          <span className="text-[11px] font-mono text-neutral-500">
            #{word.rank}
          </span>
          {word.sub_list && (
            <span className="text-[11px] font-mono text-neutral-600 ml-auto">
              {word.sub_list}
            </span>
          )}
          {/* Bookmark + Learned buttons */}
          <button
            onClick={() => onToggleBookmark?.(word)}
            className={`inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors cursor-pointer ${
              bookmarked
                ? "border-amber-accent/40 bg-amber-accent/10 text-amber-accent"
                : "border-white/10 bg-white/5 text-neutral-400 hover:text-white hover:border-white/20"
            }`}
            title={bookmarked ? "Remove bookmark" : "Bookmark word"}
          >
            {bookmarked ? (
              <BookmarkCheck className="w-3.5 h-3.5" />
            ) : (
              <Bookmark className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={() => onToggleLearned?.(word)}
            className={`inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors cursor-pointer ${
              learned
                ? "border-emerald-accent/40 bg-emerald-accent/10 text-emerald-accent"
                : "border-white/10 bg-white/5 text-neutral-400 hover:text-white hover:border-white/20"
            }`}
            title={learned ? "Unmark as learned" : "Mark as learned"}
          >
            {learned ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Word + audio */}
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-4xl font-bold text-white tracking-tight">
            {word.word}
          </h2>
          <AudioButton text={word.word} />
        </div>

        {/* Definition */}
        <div className="mb-5">
          {hasDefinition ? (
            <p className="text-sm text-neutral-400 leading-relaxed">
              {word.definition_en}
            </p>
          ) : (
            <div className="flex items-center gap-2 text-neutral-600">
              <Shimmer className="h-3 w-48" />
            </div>
          )}
        </div>

        {/* Translation toggle */}
        <div className="mb-5">
          <button
            onClick={() => setShowTranslation((v) => !v)}
            className={`flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${cfg.btnClass}`}
          >
            {showTranslation ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            {showTranslation ? "Ocultar traducción" : "Mostrar traducción"}
          </button>

          <AnimatePresence>
            {showTranslation && (
              <motion.p
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="text-sm text-neutral-300 mt-3 overflow-hidden"
              >
                {hasTranslation ? word.translation_es : (
                  <span className="italic text-neutral-600">
                    Translation coming soon...
                  </span>
                )}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Examples section */}
        <div className="border-t border-white/5 pt-4">
          <button
            onClick={() => setExamplesOpen((v) => !v)}
            className="flex items-center gap-2 text-xs font-mono text-neutral-400 hover:text-white transition-colors cursor-pointer w-full mb-2"
          >
            {examplesOpen ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            Examples in Context
            {hasExamples && (
              <span className="text-neutral-600 ml-1">({examples.length})</span>
            )}
          </button>

          <AnimatePresence>
            {examplesOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                {hasExamples ? (
                  <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3">
                    {examples.slice(0, 5).map((ex, i) => (
                      <ExampleCard key={i} ex={ex} index={i} />
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-4">
                    <Sparkles className="w-4 h-4 text-neutral-700 shrink-0" />
                    <div>
                      <p className="text-xs text-neutral-500">
                        Enrichment pipeline pending for this term
                      </p>
                      <p className="text-[11px] text-neutral-700 mt-0.5">
                        Examples and definitions will appear once the corpus is
                        enriched.
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Enrichment badge (only when everything is missing) */}
        {needsEnrichment && (
          <div className="mt-4 flex justify-end">
            <span className="text-[10px] font-mono text-neutral-700 px-2 py-0.5 rounded bg-white/[0.02] border border-white/5">
              awaiting enrichment
            </span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
