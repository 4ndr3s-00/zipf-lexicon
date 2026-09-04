import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Search, Bookmark, Zap } from "lucide-react";
import { MODES } from "./config/modes";

const API = "http://localhost:8001/api/health";

export default function Shell({ mode, onModeChange, onSearchOpen, bookmarksCount, onBookmarksOpen, children }) {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    fetch(API)
      .then((r) => r.json())
      .then((d) => setStatus(d.status === "ok" ? "online" : "error"))
      .catch(() => setStatus("offline"));
  }, []);

  const statusColor = {
    online: "bg-emerald-accent",
    offline: "bg-red-500",
    error: "bg-amber-accent",
    checking: "bg-neutral-600",
  }[status];

  const cfg = MODES[mode];

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className={`w-5 h-5 ${cfg.textClass}`} />
          <span className="text-white font-medium text-sm tracking-wide">
            zipf-lexicon
          </span>
        </div>

        {/* Mode switcher */}
        <div className="flex items-center bg-white/5 rounded-lg border border-white/10 p-0.5">
          {Object.entries(MODES).map(([key, m]) => (
            <button
              key={key}
              onClick={() => onModeChange(key)}
              className={`relative px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                mode === key
                  ? "text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {mode === key && (
                <motion.div
                  layoutId="mode-pill"
                  className={`absolute inset-0 rounded-md ${m.bgClass}/20 border ${m.borderClass}`}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </span>
            </button>
          ))}
        </div>

        {/* Search trigger */}
        <button
          onClick={onSearchOpen}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-neutral-500 bg-white/5 border border-white/10 rounded-lg hover:text-neutral-300 hover:border-white/20 transition-colors cursor-pointer"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="text-[10px] px-1 py-px border border-white/10 rounded text-neutral-600">
            ⌘K
          </kbd>
        </button>

        {/* Bookmarks button */}
        <button
          onClick={onBookmarksOpen}
          className="relative flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-neutral-500 bg-white/5 border border-white/10 rounded-lg hover:text-neutral-300 hover:border-white/20 transition-colors cursor-pointer"
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Bookmarks</span>
          {bookmarksCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold text-[#050505] bg-amber-accent rounded-full">
              {bookmarksCount > 99 ? "99" : bookmarksCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
          <span className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span>{status}</span>
          <Zap className="w-3 h-3 text-amber-accent ml-1" />
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center p-6">
        <div className="w-full max-w-3xl min-h-[60vh] p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
