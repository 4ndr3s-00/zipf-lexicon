import { useState, useEffect, useCallback } from "react";
import Shell from "./Shell";
import FlashCard from "./components/FlashCard";
import SearchModal from "./components/SearchModal";
import BookmarksModal from "./components/BookmarksModal";
import {
  getBookmarked,
  isBookmarked,
  toggleBookmark,
  isLearned,
  toggleLearned,
} from "./utils/storage";

const API = "http://localhost:8001/api/words/next";

function App() {
  const [mode, setMode] = useState("tecnico");
  const [word, setWord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [bookmarksCount, setBookmarksCount] = useState(
    () => getBookmarked().length,
  );
  // Force re-render keys for FlashCard bookmark/learned state
  const [bkTick, setBkTick] = useState(0);
  const [lrTick, setLrTick] = useState(0);

  const fetchWord = useCallback(
    async (m) => {
      setLoading(true);
      try {
        const res = await fetch(`${API}?mode=${m || mode}`);
        setWord(await res.json());
      } catch {
        setWord(null);
      } finally {
        setLoading(false);
      }
    },
    [mode],
  );

  useEffect(() => {
    fetchWord(mode);
  }, [mode]);

  // Space / ArrowRight → next word (only when modals are closed)
  useEffect(() => {
    const handler = (e) => {
      if (searchOpen || bookmarksOpen) return;
      if (e.code === "Space" || e.code === "ArrowRight") {
        e.preventDefault();
        fetchWord();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fetchWord, searchOpen, bookmarksOpen]);

  // Global ⌘K / Ctrl+K → open search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Global ⌘B / Ctrl+B → open bookmarks
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setBookmarksOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleToggleBookmark = (w) => {
    toggleBookmark(w);
    setBookmarksCount(getBookmarked().length);
    setBkTick((t) => t + 1);
  };

  const handleToggleLearned = (w) => {
    toggleLearned(w);
    setLrTick((t) => t + 1);
  };

  const reviewWord = useCallback(
    async (grade) => {
      if (!word || loading) return;
      setLoading(true);
      try {
        await fetch(`http://localhost:8001/api/words/${word.id}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grade }),
        });
      } catch {
        // non-fatal; still advance
      } finally {
        fetchWord();
      }
    },
    [word, loading, fetchWord],
  );

  // Keys 1-4 -> SM-2 grade (only when modals are closed)
  useEffect(() => {
    if (searchOpen || bookmarksOpen) return;
    const handler = (e) => {
      const g = parseInt(e.key, 10);
      if (!Number.isNaN(g) && g >= 1 && g <= 4) {
        reviewWord(g);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchOpen, bookmarksOpen, reviewWord]);

  return (
    <Shell
      mode={mode}
      onModeChange={setMode}
      onSearchOpen={() => setSearchOpen(true)}
      bookmarksCount={bookmarksCount}
      onBookmarksOpen={() => setBookmarksOpen(true)}
    >
      {word && (
        <FlashCard
          key={`${word.id}-${bkTick}-${lrTick}`}
          word={word}
          mode={mode}
          bookmarked={isBookmarked(word.id)}
          learned={isLearned(word.id)}
          onToggleBookmark={handleToggleBookmark}
          onToggleLearned={handleToggleLearned}
          onReview={reviewWord}
        />
      )}

      {/* SM-2 grading bar */}
      <div className="mt-6 grid grid-cols-4 gap-2">
        {[
          { g: 1, label: "Again", kbd: "1", cls: "text-red-400 border-red-500/30 hover:border-red-400/60" },
          { g: 2, label: "Hard", kbd: "2", cls: "text-amber-accent border-amber-accent/30 hover:border-amber-accent/60" },
          { g: 3, label: "Good", kbd: "3", cls: "text-emerald-accent border-emerald-accent/30 hover:border-emerald-accent/60" },
          { g: 4, label: "Easy", kbd: "4", cls: "text-cyan-400 border-cyan-400/30 hover:border-cyan-400/60" },
        ].map((b) => (
          <button
            key={b.g}
            onClick={() => reviewWord(b.g)}
            disabled={loading}
            className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border bg-white/[0.03] text-sm font-medium transition-all cursor-pointer disabled:opacity-40 hover:bg-white/[0.06] ${b.cls}`}
          >
            <span>{b.label}</span>
            <kbd className="text-[10px] px-1 py-px border border-white/10 rounded text-neutral-600">{b.kbd}</kbd>
          </button>
        ))}
      </div>

      <p className="text-center text-[11px] font-mono text-neutral-600 mt-3">
        <kbd className="px-1 py-0.5 bg-white/5 rounded border border-white/10">1-4</kbd> grade ·{" "}
        <kbd className="px-1 py-0.5 bg-white/5 rounded border border-white/10">Space</kbd> skip ·{" "}
        <kbd className="px-1 py-0.5 bg-white/5 rounded border border-white/10">P</kbd> pronounce ·{" "}
        <kbd className="px-1 py-0.5 bg-white/5 rounded border border-white/10">⌘K</kbd> search ·{" "}
        <kbd className="px-1 py-0.5 bg-white/5 rounded border border-white/10">⌘B</kbd> bookmarks
      </p>

      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        mode={mode}
        onModeChange={setMode}
        onSelect={setWord}
      />

      <BookmarksModal
        open={bookmarksOpen}
        onClose={() => setBookmarksOpen(false)}
        onSelect={setWord}
        onRefreshBookmarks={() => setBookmarksCount(getBookmarked().length)}
      />
    </Shell>
  );
}

export default App;
