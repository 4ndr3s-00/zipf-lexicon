import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Bookmark,
  BarChart3,
  Trash2,
  ArrowUpRight,
  Globe,
  Cpu,
} from "lucide-react";
import { getBookmarked, getStats } from "../utils/storage";

const CAT_LABELS = {
  n: "noun",
  v: "verb",
  adj: "adj",
  adv: "adv",
};

export default function BookmarksModal({
  open,
  onClose,
  onSelect,
  onRefreshBookmarks,
}) {
  const [tab, setTab] = useState("saved");
  const [bookmarks, setBookmarks] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (open) {
      setBookmarks(getBookmarked());
      setStats(getStats());
      setTab("saved");
    }
  }, [open]);

  const removeBookmark = (id) => {
    const updated = bookmarks.filter((w) => w.id !== id);
    setBookmarks(updated);
    onRefreshBookmarks?.();
  };

  const loadWord = (w) => {
    onSelect?.(w);
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
        onClick={onClose}
      >
        <div className="absolute inset-0 backdrop-blur-sm bg-black/60" />

        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md mx-4 bg-[#121212] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-amber-accent" />
              <span className="text-sm font-medium text-white">
                Progress & Bookmarks
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded text-neutral-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/5">
            <button
              onClick={() => setTab("saved")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-mono transition-colors cursor-pointer border-b-2 ${
                tab === "saved"
                  ? "text-amber-accent border-amber-accent"
                  : "text-neutral-500 border-transparent hover:text-neutral-300"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              Saved ({bookmarks.length})
            </button>
            <button
              onClick={() => setTab("stats")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-mono transition-colors cursor-pointer border-b-2 ${
                tab === "stats"
                  ? "text-emerald-accent border-emerald-accent"
                  : "text-neutral-500 border-transparent hover:text-neutral-300"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Stats
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[55vh] overflow-y-auto overscroll-contain">
            {tab === "saved" && (
              <>
                {bookmarks.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <Bookmark className="w-6 h-6 text-neutral-700 mx-auto mb-2" />
                    <p className="text-xs text-neutral-600">
                      No bookmarked words yet
                    </p>
                    <p className="text-[11px] text-neutral-700 mt-1">
                      Click the bookmark icon on any flashcard to save it here.
                    </p>
                  </div>
                ) : (
                  <div>
                    {bookmarks.map((w) => (
                      <div
                        key={w.id}
                        className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors group"
                      >
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => loadWord(w)}>
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
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-accent/10 border border-amber-accent/30 text-amber-accent">
                              Zipf: {w.zipf}
                            </span>
                            <span className="text-[10px] font-mono text-neutral-600">
                              #{w.rank}
                            </span>
                            <span className={`text-[10px] font-mono ${w.mode === "tecnico" ? "text-violet-400" : "text-cyan-400"}`}>
                              {w.mode === "tecnico" ? "tech" : "daily"}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => loadWord(w)}
                          className="w-6 h-6 flex items-center justify-center rounded text-neutral-600 hover:text-emerald-accent transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                          title="Load in flashcard"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeBookmark(w.id)}
                          className="w-6 h-6 flex items-center justify-center rounded text-neutral-600 hover:text-red-400 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                          title="Remove bookmark"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === "stats" && stats && (
              <div className="p-4 space-y-4">
                {/* Total learned */}
                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
                  <div className="text-3xl font-bold text-white font-mono">
                    {stats.totalLearned}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    Total words learned
                  </div>
                </div>

                {/* Per-mode breakdown */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Globe className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-[11px] font-mono text-cyan-400">
                        Cotidiano
                      </span>
                    </div>
                    <div className="text-xl font-bold text-white font-mono">
                      {stats.cotidianoCount}
                    </div>
                  </div>
                  <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Cpu className="w-3.5 h-3.5 text-violet-400" />
                      <span className="text-[11px] font-mono text-violet-400">
                        Técnico
                      </span>
                    </div>
                    <div className="text-xl font-bold text-white font-mono">
                      {stats.tecnicoCount}
                    </div>
                  </div>
                </div>

                {/* Average Zipf */}
                <div className="rounded-lg border border-amber-accent/20 bg-amber-accent/5 p-3">
                  <div className="text-[11px] text-neutral-500 mb-1">
                    Avg Zipf of learned words
                  </div>
                  <div className="text-xl font-bold text-amber-accent font-mono">
                    {stats.avgZipf || "—"}
                  </div>
                </div>

                {stats.totalLearned === 0 && (
                  <p className="text-[11px] text-neutral-600 text-center mt-2">
                    Mark words as learned on flashcards to see your progress here.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-neutral-700">
            <span>{bookmarks.length} bookmarked</span>
            <span>
              <kbd className="px-1 py-px border border-white/10 rounded">esc</kbd> close
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
