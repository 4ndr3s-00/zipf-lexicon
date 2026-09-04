import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ArrowUp, ArrowDown } from "lucide-react";
import { MODES } from "../config/modes";

const API = "http://localhost:8001/api/words/search";

const CAT_LABELS = {
  n: "noun",
  v: "verb",
  adj: "adj",
  adv: "adv",
};

export default function SearchModal({ open, onClose, mode, onModeChange, onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const timerRef = useRef(null);

  // Auto-focus input on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced fetch
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${API}?q=${encodeURIComponent(query)}&mode=${mode}&limit=20`
        );
        setResults(await res.json());
        setActiveIdx(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query, mode]);

  const selectAndClose = useCallback(
    (word) => {
      onSelect(word);
      onClose();
    },
    [onSelect, onClose],
  );

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[activeIdx]) {
        e.preventDefault();
        selectAndClose(results[activeIdx]);
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, activeIdx, selectAndClose, onClose]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIdx];
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 backdrop-blur-sm bg-black/60" />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg mx-4 bg-[#121212] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b border-white/10">
            <Search className="w-4 h-4 text-neutral-500 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vocabulary..."
              className="flex-1 py-3.5 bg-transparent text-sm text-white placeholder-neutral-600 outline-none"
            />

            {/* Mode toggle inside modal */}
            <div className="flex items-center bg-white/5 rounded-md border border-white/10 p-0.5 shrink-0">
              {Object.entries(MODES).map(([key, m]) => (
                <button
                  key={key}
                  onClick={() => onModeChange(key)}
                  className={`px-2 py-1 text-[10px] font-medium rounded transition-colors cursor-pointer ${
                    mode === key
                      ? `${m.textClass} bg-white/5`
                      : "text-neutral-600 hover:text-neutral-400"
                  }`}
                >
                  {m.icon}
                </button>
              ))}
            </div>

            <kbd className="text-[10px] font-mono text-neutral-600 px-1.5 py-0.5 border border-white/10 rounded shrink-0">
              esc
            </kbd>
          </div>

          {/* Results */}
          <div
            ref={listRef}
            className="max-h-[50vh] overflow-y-auto overscroll-contain"
          >
            {loading && (
              <div className="px-4 py-6 text-center text-xs text-neutral-600 font-mono">
                Searching...
              </div>
            )}

            {!loading && query && results.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-neutral-600">
                No results for "{query}"
              </div>
            )}

            {!loading && results.map((w, i) => (
              <button
                key={w.id}
                onClick={() => selectAndClose(w)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer border-b border-white/5 last:border-0 ${
                  i === activeIdx ? "bg-white/5" : "hover:bg-white/[0.03]"
                }`}
              >
                {/* Word + category */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {w.word}
                    </span>
                    {w.category && (
                      <span className="text-[10px] font-mono text-neutral-600 px-1 py-px bg-white/5 rounded">
                        {CAT_LABELS[w.category] || w.category}
                      </span>
                    )}
                  </div>
                  {w.definition_en && (
                    <p className="text-[11px] text-neutral-600 truncate mt-0.5">
                      {w.definition_en}
                    </p>
                  )}
                </div>

                {/* Zipf + rank */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-accent/10 border border-amber-accent/30 text-amber-accent">
                    {w.zipf}
                  </span>
                  <span className="text-[10px] font-mono text-neutral-600">
                    #{w.rank}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Footer hints */}
          <div className="px-4 py-2 border-t border-white/5 flex items-center gap-4 text-[10px] font-mono text-neutral-700">
            <span className="flex items-center gap-1">
              <ArrowUp className="w-3 h-3" />
              <ArrowDown className="w-3 h-3" />
              navigate
            </span>
            <span>
              <kbd className="px-1 py-px border border-white/10 rounded">↵</kbd> select
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
