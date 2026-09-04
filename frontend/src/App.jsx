import { useState, useEffect, useCallback } from "react";
import Shell from "./Shell";
import FlashCard from "./components/FlashCard";
import SearchModal from "./components/SearchModal";
import BookmarksModal from "./components/BookmarksModal";
import { MODES } from "./config/modes";
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

  const cfg = MODES[mode];

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
        />
      )}

      {/* Next button */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={() => fetchWord()}
          disabled={loading}
          className={`px-6 py-2.5 rounded-lg border text-sm font-medium transition-all cursor-pointer disabled:opacity-40 ${cfg.btnClass}`}
        >
          {loading ? "Loading..." : "Next Word →"}
        </button>
      </div>

      <p className="text-center text-[11px] font-mono text-neutral-600 mt-3">
        <kbd className="px-1 py-0.5 bg-white/5 rounded border border-white/10">Space</kbd> or{" "}
        <kbd className="px-1 py-0.5 bg-white/5 rounded border border-white/10">→</kbd> next ·{" "}
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
