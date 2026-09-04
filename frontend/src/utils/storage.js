const KEYS = {
  bookmarked: "zipf-bookmarked",
  learned: "zipf-learned",
};

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

function write(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

export function getBookmarked() {
  return read(KEYS.bookmarked);
}

export function isBookmarked(id) {
  return getBookmarked().some((w) => w.id === id);
}

export function toggleBookmark(word) {
  const list = getBookmarked();
  const idx = list.findIndex((w) => w.id === word.id);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push({
      id: word.id,
      word: word.word,
      mode: word.mode,
      category: word.category,
      zipf: word.zipf,
      rank: word.rank,
    });
  }
  write(KEYS.bookmarked, list);
  return idx < 0; // true = was added, false = was removed
}

export function getLearned() {
  return read(KEYS.learned);
}

export function isLearned(id) {
  return getLearned().some((w) => w.id === id);
}

export function toggleLearned(word) {
  const list = getLearned();
  const idx = list.findIndex((w) => w.id === word.id);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push({
      id: word.id,
      word: word.word,
      mode: word.mode,
      category: word.category,
      zipf: word.zipf,
      rank: word.rank,
      learnedAt: Date.now(),
    });
  }
  write(KEYS.learned, list);
  return idx < 0;
}

export function getStats() {
  const learned = getLearned();
  const cotidiano = learned.filter((w) => w.mode === "cotidiano");
  const tecnico = learned.filter((w) => w.mode === "tecnico");
  const avgZipf =
    learned.length > 0
      ? (learned.reduce((s, w) => s + w.zipf, 0) / learned.length).toFixed(2)
      : 0;
  return {
    totalLearned: learned.length,
    cotidianoCount: cotidiano.length,
    tecnicoCount: tecnico.length,
    avgZipf,
  };
}
