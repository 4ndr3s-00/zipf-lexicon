#!/usr/bin/env python3
"""zipf-lexicon CLI — query the local API (port 8001) from the terminal.

Subcommands:
  next [--mode cotidiano|tecnico]   fetch a word formatted for review
  search <query> [--mode ...]        quick search with Zipf-desc results
  stats                              enrichment + corpus statistics
  review <word_id> <grade>            grade a word 1-4 (SM-2 SRS)
"""

import argparse
import json
import sys
import urllib.request
import urllib.error
from urllib.parse import quote

API = "http://127.0.0.1:8001"

# ANSI colors, dark theme aligned
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
GREEN = "\033[38;5;120m"    # neon green  -> word
CYAN = "\033[38;5;81m"      # cyan        -> accents / category
AMBER = "\033[38;5;214m"    # amber       -> translation
GREY = "\033[38;5;245m"     # grey        -> IPA / meta
VIOLET = "\033[38;5;141m"   # violet      -> tech mode
RED = "\033[38;5;203m"      # red         -> errors


def _get(path):
    req = urllib.request.Request(f"{API}{path}", headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"{RED}HTTP {e.code}: {e.read().decode()}{RESET}")
    except urllib.error.URLError:
        sys.exit(f"{RED}Cannot reach API at {API}. Is the backend running?{RESET}")


def _post(path, payload):
    req = urllib.request.Request(
        f"{API}{path}",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"{RED}HTTP {e.code}: {e.read().decode()}{RESET}")
    except urllib.error.URLError:
        sys.exit(f"{RED}Cannot reach API at {API}. Is the backend running?{RESET}")


def cmd_next(args):
    w = _get(f"/api/words/next?mode={args.mode}")
    _print_word(w)


def _print_word(w):
    mode_color = CYAN if w.get("mode") == "cotidiano" else VIOLET
    mode_label = w.get("mode", "?").title()
    line = f"{BOLD}{GREEN}{w['word']}{RESET}"
    if w.get("ipa"):
        line += f"  {GREY}/{w['ipa']}/{RESET}"
    print(line)
    meta = f"{DIM}{mode_color}{mode_label}{RESET}  {GREY}#{w.get('rank','?')}{RESET}"
    print(f"  {meta}  {DIM}Zipf:{RESET} {w.get('zipf','?')}")
    if w.get("category"):
        print(f"  {DIM}cat:{RESET} {GREY}{w['category']}{RESET}")
    if w.get("definition_en"):
        print(f"\n  {w['definition_en']}")
    if w.get("translation_es"):
        print(f"  {AMBER}{w['translation_es']}{RESET}")
    try:
        examples = json.loads(w.get("examples") or "[]")
    except json.JSONDecodeError:
        examples = []
    if examples:
        first = examples[0]
        print(f"\n  {DIM}example:{RESET} {first.get('en','')}")
        if first.get("es"):
            print(f"           {AMBER}{first['es']}{RESET}")


def cmd_search(args):
    results = _get(f"/api/words/search?q={quote(args.query)}&mode={args.mode}&limit={args.limit}")
    print(f"{DIM}→ {len(results)} result(s) for \"{args.query}\" ({args.mode}){RESET}\n")
    for i, w in enumerate(results, 1):
        zipf = f"{GREY}{w.get('zipf')}{RESET}"
        cat = f" {DIM}{w.get('category')}{RESET}" if w.get("category") else ""
        print(f"{i:>2}. {BOLD}{GREEN}{w['word']}{RESET}{cat}  {DIM}Zipf {zipf}")
        if w.get("translation_es"):
            print(f"    {AMBER}{w['translation_es']}{RESET}")


def cmd_stats(args):
    status = _get("/api/words/enrichment-status")
    counts = _get("/api/words/count")
    print(f"{BOLD}Enrichment status{RESET}")
    print(f"  total     {counts.get('total', status['total']):>10}")
    print(f"  enriched  {GREEN}{status['enriched']:>10}{RESET}")
    print(f"  percent   {GREEN}{status['percent']:>9}%{RESET}\n")
    print(f"{BOLD}Corpus by mode{RESET}")
    print(f"  cotidiano {GREEN}{counts.get('cotidiano',0):>10}{RESET}")
    print(f"  tecnico   {VIOLET}{counts.get('tecnico',0):>10}{RESET}")


def cmd_review(args):
    r = _post(f"/api/words/{args.word_id}/review", {"grade": args.grade})
    print(f"reviewed {BOLD}{GREEN}{r['word']}{RESET} (id {r['id']})")
    print(f"  grade          {r['grade']}")
    print(f"  easiness       {AMBER}{r['easiness_factor']}{RESET}")
    print(f"  interval       {GREY}{r['interval_days']}d{RESET}")
    print(f"  repetitions    {GREY}{r['repetitions']}{RESET}")
    print(f"  next review    {DIM}{r['next_review']}{RESET}")


def build_parser():
    p = argparse.ArgumentParser(prog="lexicon", description="zipf-lexicon terminal client")
    sub = p.add_subparsers(dest="cmd", required=True)

    n = sub.add_parser("next", help="fetch a word to review")
    n.add_argument("--mode", choices=["cotidiano", "tecnico"], default="tecnico")
    n.set_defaults(func=cmd_next)

    s = sub.add_parser("search", help="search the vocabulary")
    s.add_argument("query")
    s.add_argument("--mode", choices=["cotidiano", "tecnico"], default="tecnico")
    s.add_argument("--limit", type=int, default=5)
    s.set_defaults(func=cmd_search)

    st = sub.add_parser("stats", help="enrichment + corpus stats")
    st.set_defaults(func=cmd_stats)

    r = sub.add_parser("review", help="grade a word (SM-2)")
    r.add_argument("word_id", type=int)
    r.add_argument("grade", type=int, choices=[1, 2, 3, 4])
    r.set_defaults(func=cmd_review)

    return p


if __name__ == "__main__":
    args = build_parser().parse_args()
    args.func(args)
