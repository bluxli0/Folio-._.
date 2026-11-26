#!/usr/bin/env python3
"""
Neo 4 Knowledge & Markov Trainer
Builds `.folio-data/neo4/knowledge.db` (SQLite + FTS5) from:
  1. Princeton WordNet (117,000+ real English synsets, 150,000+ lemmas, senses, definitions, examples)
  2. Brown Corpus (57,000+ grammatical English sentences with POS tags -> trigram/bigram Markov & POS lexicon)
  3. Curated Folio/CS/Physics/Linguistics facts & optional custom `.txt` / `.jsonl` / `.csv` datasets
"""

from __future__ import annotations

from collections import Counter, defaultdict
import csv
import json
import os
import re
import sqlite3
import sys
import time
import zipfile
from typing import Any, Dict, Iterable, List, Optional, Tuple


DEFAULT_RAW_DIR = os.path.join(os.getcwd(), ".folio-data", "neo4", "raw")
DEFAULT_DB_PATH = os.path.join(os.getcwd(), ".folio-data", "neo4", "knowledge.db")

POS_FILES = [
    ("noun", "wordnet/data.noun", "wordnet/index.noun"),
    ("verb", "wordnet/data.verb", "wordnet/index.verb"),
    ("adj", "wordnet/data.adj", "wordnet/index.adj"),
    ("adv", "wordnet/data.adv", "wordnet/index.adv"),
]

BROWN_POS_MAP = {
    "nn": "noun", "nns": "noun", "np": "noun", "nps": "noun", "nr": "noun",
    "vb": "verb", "vbd": "verb", "vbg": "verb", "vbn": "verb", "vbp": "verb", "vbz": "verb",
    "be": "verb", "bed": "verb", "bedz": "verb", "beg": "verb", "bem": "verb", "ben": "verb",
    "ber": "verb", "bez": "verb", "do": "verb", "dod": "verb", "doz": "verb",
    "hv": "verb", "hvd": "verb", "hvg": "verb", "hvn": "verb", "hvz": "verb", "md": "verb",
    "jj": "adj", "jjr": "adj", "jjt": "adj", "jjs": "adj",
    "rb": "adv", "rbr": "adv", "rbt": "adv", "rn": "adv", "rp": "adv",
    "in": "prep", "at": "det", "dt": "det", "dts": "det", "dti": "det", "dtx": "det",
    "cc": "conj", "cs": "conj", "pp": "pron", "pps": "pron", "ppo": "pron",
}

CURATED_DOMAIN_KNOWLEDGE: List[Tuple[str, str, str]] = [
    ("Algorithm", "Computer Science", "A finite, step-by-step mathematical procedure for solving a problem or transforming inputs into outputs, analyzed by time complexity O(f(n)) and space complexity."),
    ("Markov Chain", "Probability & AI", "A stochastic model where the probability of each next state depends only on the current k-token history state (Markov property) rather than the full unbounded sequence."),
    ("Tokenization", "NLP & AI", "Splitting raw text into reusable compositional subword units (prefixes, roots, syllables, suffixes, or BPE merges) so huge vocabularies compress cleanly without exploding memory."),
    ("Word Sense Disambiguation", "Linguistics & AI", "Determining which meaning of a polysemous word (such as 'bat' as a flying mammal vs. a baseball club) applies by scoring overlap within a ±k surrounding context window."),
    ("OSASCOMP", "English Grammar", "Standard English cumulative adjectival order: Opinion, Size, Age, Shape, Color, Origin, Material, Purpose before the head noun."),
    ("Aleph-Zero", "Mathematics", "Denoted ℵ₀ (Aleph-null), the smallest infinite cardinality representing the size of countably infinite sets such as the natural numbers ℕ = {1, 2, 3, ...}."),
    ("AABB Hitbox", "Game Physics", "An Axis-Aligned Bounding Box defined by (x, y, width, height) or min/max bounds; two AABBs overlap when min(ax+aw, bx+bw) > max(ax, bx) and min(ay+ah, by+bh) > max(ay, by)."),
    ("Elastic Collision", "Classical Physics", "A collision between rigid bodies where both momentum and kinetic energy are conserved; restitution e=1 preserves bounce energy while e<1 simulates damped rebounds."),
    ("Euler Integration", "Physics Simulation", "Stepping rigid-body motion each frame dt: velocity += acceleration * dt, position += velocity * dt, resolving floor/wall/hitbox boundaries with restitution impulses."),
    ("Folio Zero", "Creative Studio", "Folio v4.1 (Folio Zero) integrates Flash/Hydrogen/Neon/Carbon Gemini models, local Neo 4 Python Rule AI, EVO 3D Engine, Stop Motion v3, Pixel Engine v3, Three.js Studio, Antigravity CLI, Godot 4, Blender CLI, and CMake/Kotlin toolchains."),
]


def init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA temp_store = FILE;
        PRAGMA cache_size = -16384;
        PRAGMA mmap_size = 67108864;

        DROP TABLE IF EXISTS synsets_fts;
        DROP TABLE IF EXISTS corpus_fts;
        DROP TABLE IF EXISTS lemma_senses;
        DROP TABLE IF EXISTS synsets;
        DROP TABLE IF EXISTS corpus_facts;
        DROP TABLE IF EXISTS pos_lexicon;
        DROP TABLE IF EXISTS markov_trigrams;
        DROP TABLE IF EXISTS markov_bigrams;
        DROP TABLE IF EXISTS meta;

        CREATE TABLE meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE synsets (
            offset_pos TEXT PRIMARY KEY,
            pos TEXT NOT NULL,
            lemmas TEXT NOT NULL,
            definition TEXT NOT NULL,
            examples TEXT NOT NULL
        );

        CREATE TABLE lemma_senses (
            lemma TEXT NOT NULL,
            offset_pos TEXT NOT NULL,
            pos TEXT NOT NULL,
            sense_rank INTEGER NOT NULL
        );

        CREATE INDEX idx_lemma_senses_lemma ON lemma_senses(lemma, sense_rank);

        CREATE VIRTUAL TABLE synsets_fts USING fts5(
            offset_pos UNINDEXED,
            lemmas,
            definition,
            examples
        );

        CREATE TABLE corpus_facts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT NOT NULL,
            category TEXT NOT NULL,
            sentence TEXT NOT NULL
        );

        CREATE VIRTUAL TABLE corpus_fts USING fts5(
            topic,
            category,
            sentence
        );

        CREATE TABLE pos_lexicon (
            word TEXT PRIMARY KEY,
            pos TEXT NOT NULL,
            freq INTEGER NOT NULL
        );

        CREATE TABLE markov_trigrams (
            w1 TEXT NOT NULL,
            w2 TEXT NOT NULL,
            next_word TEXT NOT NULL,
            freq INTEGER NOT NULL,
            PRIMARY KEY (w1, w2, next_word)
        );

        CREATE TABLE markov_bigrams (
            w1 TEXT NOT NULL,
            next_word TEXT NOT NULL,
            freq INTEGER NOT NULL,
            PRIMARY KEY (w1, next_word)
        );
        """
    )


def parse_gloss(raw_gloss: str) -> Tuple[str, str]:
    text = raw_gloss.strip()
    examples = re.findall(r'"([^"]+)"', text)
    # Strip quoted examples to keep crisp definition
    defn = re.sub(r';?\s*"[^"]+"', "", text).strip(" ;")
    return defn, " | ".join(examples)


def ingest_wordnet(conn: sqlite3.Connection, wordnet_zip: str) -> Tuple[int, int, List[str]]:
    synset_rows: List[Tuple[str, str, str, str, str]] = []
    fts_rows: List[Tuple[str, str, str, str]] = []
    lemma_rows: List[Tuple[str, str, str, int]] = []
    example_sentences: List[str] = []
    pos_counts: Dict[Tuple[str, str], int] = defaultdict(int)

    with zipfile.ZipFile(wordnet_zip, "r") as zf:
        for pos_label, data_file, index_file in POS_FILES:
            pos_short = {"noun": "n", "verb": "v", "adj": "a", "adv": "r"}[pos_label]
            raw_data = zf.read(data_file).decode("utf-8", errors="ignore").splitlines()
            for line in raw_data:
                if not line or line.startswith("  "):
                    continue
                left, sep, gloss = line.partition(" | ")
                if not sep:
                    continue
                parts = left.split()
                if len(parts) < 4:
                    continue
                offset = parts[0]
                ss_type = parts[2]
                norm_pos = "a" if ss_type == "s" else ss_type
                if norm_pos != pos_short:
                    norm_pos = pos_short
                try:
                    w_cnt = int(parts[3], 16)
                except ValueError:
                    continue
                words: List[str] = []
                for k in range(w_cnt):
                    idx = 4 + 2 * k
                    if idx >= len(parts):
                        break
                    w = parts[idx].replace("_", " ")
                    w = re.sub(r"\((?:p|a|ip)\)$", "", w).strip()
                    if w:
                        words.append(w)
                        if " " not in w and w.isalpha():
                            pos_counts[(w.lower(), pos_label)] += 1
                offset_pos = f"{offset}-{pos_short}"
                defn, ex_str = parse_gloss(gloss)
                lemmas_joined = ", ".join(words)
                synset_rows.append((offset_pos, pos_label, lemmas_joined, defn, ex_str))
                fts_rows.append((offset_pos, lemmas_joined, defn, ex_str))
                if ex_str:
                    for ex in ex_str.split(" | "):
                        ex_clean = ex.strip()
                        if 12 <= len(ex_clean) <= 220:
                            example_sentences.append(ex_clean)

            raw_idx = zf.read(index_file).decode("utf-8", errors="ignore").splitlines()
            for line in raw_idx:
                if not line or line.startswith("  "):
                    continue
                parts = line.split()
                if len(parts) < 6:
                    continue
                lemma = parts[0].replace("_", " ").lower()
                try:
                    synset_cnt = int(parts[2])
                except ValueError:
                    continue
                if synset_cnt <= 0 or len(parts) < 6 + synset_cnt:
                    continue
                offsets = parts[-synset_cnt:]
                for rank, off in enumerate(offsets):
                    if len(off) == 8 and off.isdigit():
                        lemma_rows.append((lemma, f"{off}-{pos_short}", pos_label, rank))

    conn.executemany(
        "INSERT OR REPLACE INTO synsets(offset_pos, pos, lemmas, definition, examples) VALUES (?, ?, ?, ?, ?)",
        synset_rows,
    )
    conn.executemany(
        "INSERT INTO synsets_fts(offset_pos, lemmas, definition, examples) VALUES (?, ?, ?, ?)",
        fts_rows,
    )
    conn.executemany(
        "INSERT INTO lemma_senses(lemma, offset_pos, pos, sense_rank) VALUES (?, ?, ?, ?)",
        lemma_rows,
    )
    conn.commit()
    return len(synset_rows), len(lemma_rows), example_sentences


def clean_brown_sentence(tokens: List[str]) -> str:
    text = " ".join(tokens)
    text = re.sub(r"\s+([,.;:!?%)\]])", r"\1", text)
    text = re.sub(r"([(\[])\s+", r"\1", text)
    text = re.sub(r"\s+'s\b", "'s", text)
    text = re.sub(r"\s+n't\b", "n't", text)
    text = text.replace("`` ", '"').replace(" ''", '"').replace("''", '"')
    return text.strip()


def ingest_brown(
    conn: sqlite3.Connection,
    brown_zip: str,
    extra_sentences: List[str],
) -> Tuple[int, int, int]:
    trigram_counts: Counter = Counter()
    bigram_counts: Counter = Counter()
    word_pos_freq: Dict[str, Counter] = defaultdict(Counter)
    total_sentences = 0
    brown_fact_candidates: List[Tuple[str, str, str]] = []

    def feed_tokens(toks: List[str]) -> None:
        if len(toks) < 3:
            return
        padded = ["<BOS>", "<BOS>"] + toks + ["<EOS>"]
        for i in range(2, len(padded)):
            trigram_counts[(padded[i - 2], padded[i - 1], padded[i])] += 1
            bigram_counts[(padded[i - 1], padded[i])] += 1

    with zipfile.ZipFile(brown_zip, "r") as zf:
        for name in zf.namelist():
            base = os.path.basename(name)
            if not base or not re.match(r"^c[a-z]\d\d$", base):
                continue
            genre = base[:2]
            is_informative = genre in ("ca", "cb", "cc", "cd", "ce", "cf", "cg", "ch", "cj")
            content = zf.read(name).decode("utf-8", errors="ignore")
            for raw_line in content.splitlines():
                line = raw_line.strip()
                if not line:
                    continue
                sent_words: List[str] = []
                for item in line.split():
                    if "/" not in item:
                        continue
                    word, _, tag = item.rpartition("/")
                    if not word:
                        continue
                    base_tag = re.sub(r"-(tl|hl|nc|fw)$", "", tag.lower())
                    mapped_pos = BROWN_POS_MAP.get(base_tag)
                    clean_w = re.sub(r"^[^A-Za-z0-9]+|[^A-Za-z0-9'-]+$", "", word)
                    if mapped_pos and clean_w.isalpha():
                        word_pos_freq[clean_w.lower()][mapped_pos] += 1
                    if clean_w:
                        sent_words.append(clean_w)
                if len(sent_words) >= 4:
                    total_sentences += 1
                    feed_tokens(sent_words)
                    if is_informative and 9 <= len(sent_words) <= 28 and len(brown_fact_candidates) < 12000:
                        sent_str = clean_brown_sentence(sent_words)
                        if sent_str[0].isupper():
                            brown_fact_candidates.append(("General Knowledge", f"brown-{genre}", sent_str))

    for sent in extra_sentences:
        toks = re.findall(r"[A-Za-z0-9'-]+|[.,!?;:]", sent)
        if len(toks) >= 3:
            total_sentences += 1
            feed_tokens(toks)

    # Index curated + sampled factual sentences into corpus_facts
    fact_rows = list(CURATED_DOMAIN_KNOWLEDGE) + brown_fact_candidates
    conn.executemany(
        "INSERT INTO corpus_facts(topic, category, sentence) VALUES (?, ?, ?)",
        fact_rows,
    )
    conn.executemany(
        "INSERT INTO corpus_fts(topic, category, sentence) VALUES (?, ?, ?)",
        fact_rows,
    )

    # Persist dominant POS tag per word for fast grammatical rating
    pos_rows: List[Tuple[str, str, int]] = []
    for w, cnts in word_pos_freq.items():
        top_pos, freq = cnts.most_common(1)[0]
        pos_rows.append((w, top_pos, freq))
    conn.executemany(
        "INSERT OR REPLACE INTO pos_lexicon(word, pos, freq) VALUES (?, ?, ?)",
        pos_rows,
    )

    # Keep top transitions & pruned counts to stay crisp and fast on disk
    by_ctx2: Dict[Tuple[str, str], List[Tuple[str, int]]] = defaultdict(list)
    for (w1, w2, nxt), cnt in trigram_counts.items():
        if cnt >= 2 or w1 == "<BOS>":
            by_ctx2[(w1, w2)].append((nxt, cnt))
    tri_rows: List[Tuple[str, str, str, int]] = []
    for (w1, w2), items in by_ctx2.items():
        items.sort(key=lambda x: -x[1])
        for nxt, cnt in items[:10]:
            tri_rows.append((w1, w2, nxt, cnt))

    by_ctx1: Dict[str, List[Tuple[str, int]]] = defaultdict(list)
    for (w1, nxt), cnt in bigram_counts.items():
        if cnt >= 2:
            by_ctx1[w1].append((nxt, cnt))
    bi_rows: List[Tuple[str, str, int]] = []
    for w1, items in by_ctx1.items():
        items.sort(key=lambda x: -x[1])
        for nxt, cnt in items[:14]:
            bi_rows.append((w1, nxt, cnt))

    conn.executemany(
        "INSERT OR REPLACE INTO markov_trigrams(w1, w2, next_word, freq) VALUES (?, ?, ?, ?)",
        tri_rows,
    )
    conn.executemany(
        "INSERT OR REPLACE INTO markov_bigrams(w1, next_word, freq) VALUES (?, ?, ?)",
        bi_rows,
    )
    conn.commit()
    return total_sentences, len(tri_rows), len(pos_rows)


def ingest_custom_dataset(conn: sqlite3.Connection, file_path: str) -> int:
    ext = os.path.splitext(file_path)[1].lower()
    sentences: List[str] = []
    fact_rows: List[Tuple[str, str, str]] = []

    if ext == ".jsonl":
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                if not line.strip():
                    continue
                obj = json.loads(line)
                topic = str(obj.get("topic") or obj.get("word") or obj.get("title") or "Custom")
                text = str(obj.get("text") or obj.get("definition") or obj.get("gloss") or obj.get("sentence") or "").strip()
                if text:
                    sentences.append(text)
                    fact_rows.append((topic, "custom-jsonl", text[:500]))
    elif ext in (".csv", ".tsv"):
        delim = "\t" if ext == ".tsv" else ","
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            reader = csv.reader(f, delimiter=delim)
            for row in reader:
                joined = " — ".join(c.strip() for c in row if c.strip())
                if len(joined) >= 8:
                    sentences.append(joined)
                    fact_rows.append((row[0][:48] if row else "Custom", "custom-table", joined[:500]))
    else:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            raw = f.read()
        for sent in re.split(r"(?<=[.!?])\s+|\n+", raw):
            s = sent.strip()
            if len(s) >= 12:
                sentences.append(s)
                fact_rows.append(("Custom Text", "custom-txt", s[:500]))

    if fact_rows:
        conn.executemany("INSERT INTO corpus_facts(topic, category, sentence) VALUES (?, ?, ?)", fact_rows)
        conn.executemany("INSERT INTO corpus_fts(topic, category, sentence) VALUES (?, ?, ?)", fact_rows)

    for sent in sentences:
        toks = re.findall(r"[A-Za-z0-9'-]+|[.,!?;:]", sent)
        if len(toks) < 3:
            continue
        padded = ["<BOS>", "<BOS>"] + toks + ["<EOS>"]
        for i in range(2, len(padded)):
            conn.execute(
                "INSERT INTO markov_trigrams(w1, w2, next_word, freq) VALUES (?, ?, ?, 1) "
                "ON CONFLICT(w1, w2, next_word) DO UPDATE SET freq = freq + 1",
                (padded[i - 2], padded[i - 1], padded[i]),
            )
            conn.execute(
                "INSERT INTO markov_bigrams(w1, next_word, freq) VALUES (?, ?, 1) "
                "ON CONFLICT(w1, next_word) DO UPDATE SET freq = freq + 1",
                (padded[i - 1], padded[i]),
            )
    conn.commit()
    return len(sentences)


def build_knowledge_db(raw_dir: str = DEFAULT_RAW_DIR, db_path: str = DEFAULT_DB_PATH) -> Dict[str, int]:
    t0 = time.time()
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    wordnet_zip = os.path.join(raw_dir, "wordnet.zip")
    brown_zip = os.path.join(raw_dir, "brown.zip")
    if not os.path.exists(wordnet_zip) or not os.path.exists(brown_zip):
        raise FileNotFoundError(f"Expected wordnet.zip and brown.zip in {raw_dir}")

    tmp_db = db_path + ".building"
    if os.path.exists(tmp_db):
        os.remove(tmp_db)

    conn = sqlite3.connect(tmp_db)
    init_schema(conn)

    syn_count, lemma_count, wn_examples = ingest_wordnet(conn, wordnet_zip)
    sent_count, tri_count, pos_count = ingest_brown(conn, brown_zip, wn_examples)

    stats = {
        "synsets": syn_count,
        "lemmaSenses": lemma_count,
        "trainedSentences": sent_count,
        "trigrams": tri_count,
        "posLexicon": pos_count,
        "elapsedSec": round(time.time() - t0, 2),
    }
    conn.executemany(
        "INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)",
        [(k, str(v)) for k, v in stats.items()] + [("builtAt", str(int(time.time())))],
    )
    conn.commit()
    conn.close()
    os.replace(tmp_db, db_path)
    return stats


def ingest_folio_docs(
    root_dir: Optional[str] = None,
    db_path: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    root = root_dir or os.getcwd()
    out_db = db_path or os.path.join(os.path.dirname(DEFAULT_DB_PATH), "folio_docs.db")
    os.makedirs(os.path.dirname(out_db), exist_ok=True)
    tmp_db = out_db + ".building"
    if os.path.exists(tmp_db):
        os.remove(tmp_db)

    conn = sqlite3.connect(tmp_db)
    conn.executescript(
        """
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA temp_store = FILE;
        PRAGMA cache_size = -8192;

        CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE docs_sections (
            section_id TEXT PRIMARY KEY,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            summary TEXT NOT NULL,
            content TEXT NOT NULL,
            code_example TEXT NOT NULL DEFAULT '',
            source_file TEXT NOT NULL
        );
        CREATE VIRTUAL TABLE docs_fts USING fts5(
            section_id UNINDEXED,
            category,
            title,
            summary,
            content,
            code_example
        );
        """
    )

    sections: List[Tuple[str, str, str, str, str, str, str]] = []

    # 1. Ingest structured sections passed directly from TS SDK / CLI
    if payload and isinstance(payload, dict):
        raw_secs = payload.get("sections") or []
        for s in raw_secs:
            sid = f"guide:{s.get('id', '')}"
            cat = str(s.get("category") or "Guide")
            title = str(s.get("title") or "")
            summary = str(s.get("summary") or "")
            content = str(s.get("content") or "")
            code_ex = ""
            if s.get("codeExample"):
                ce = s["codeExample"]
                code_ex = f"```{ce.get('language', 'typescript')}\n# {ce.get('label', 'Example')}\n{ce.get('code', '')}\n```"
            sections.append((sid, cat, title, summary, content, code_ex, "src/data/folioDocs.ts"))

        raw_changelogs = payload.get("changelogs") or []
        for c in raw_changelogs:
            ver = str(c.get("version") or "")
            codename = str(c.get("codename") or "")
            date = str(c.get("date") or "")
            summary = str(c.get("summary") or "")
            hl_lines = [f"- [{h.get('category', 'Update')}] **{h.get('title', '')}**: {h.get('detail', '')}" for h in (c.get("highlights") or [])]
            content = f"Release: {ver} ({codename} · {date})\nSummary: {summary}\n\nHighlights:\n" + "\n".join(hl_lines)
            sections.append((f"changelog:{ver.lower().replace('.', '-')}", "Changelog", f"{ver} — {codename}", summary, content, "", "src/data/changelogs.ts"))

    # 2. Markdown master docs: docs/FOLIO_DOCS.md
    docs_md_path = os.path.join(root, "docs", "FOLIO_DOCS.md")
    if os.path.exists(docs_md_path):
        with open(docs_md_path, "r", encoding="utf-8", errors="ignore") as fh:
            md_text = fh.read()
        chunks = re.split(r"(?m)^##\s+", md_text)
        for idx, chunk in enumerate(chunks):
            chunk = chunk.strip()
            if not chunk:
                continue
            lines = chunk.splitlines()
            title = lines[0].strip("# ").strip()
            body = "\n".join(lines[1:]).strip() or title
            sec_id = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or f"doc-{idx}"
            summary = lines[1].strip() if len(lines) > 1 and not lines[1].startswith("```") else title
            sections.append((f"docs:{sec_id}", "Documentation", title, summary, body, "", "docs/FOLIO_DOCS.md"))

    # 3. Source files: TS SDK, Python SDK, CLI
    for rel_path, sid, cat, title, summary in [
        ("src/sdk/folioSdk.ts", "sdk:typescript", "SDK", "Folio TypeScript SDK Exports & Signatures", "Full TypeScript SDK source for FolioClient, Creative Builders, and validators."),
        ("python/folio_sdk.py", "sdk:python", "SDK", "Folio Python SDK Exports & KnowledgeStore", "Full Python SDK source for FolioClient, KnowledgeStore, MemoryGuard, and 3D Builders."),
        ("scripts/folio-cli.ts", "cli:commands", "CLI", "Folio Official CLI Command Handlers", "Command-line tool for doctor, docs, changelog, neo4, kb ingest, and backups."),
    ]:
        fp = os.path.join(root, rel_path)
        if os.path.exists(fp):
            with open(fp, "r", encoding="utf-8", errors="ignore") as fh:
                src_text = fh.read()
            sections.append((sid, cat, title, summary, src_text[:16000], "", rel_path))

    seen_ids = set()
    inserted = 0
    for sid, cat, title, summary, content, code_ex, src_file in sections:
        if sid in seen_ids or not title:
            continue
        seen_ids.add(sid)
        conn.execute(
            "INSERT INTO docs_sections(section_id, category, title, summary, content, code_example, source_file) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (sid, cat, title, summary, content, code_ex, src_file),
        )
        conn.execute(
            "INSERT INTO docs_fts(section_id, category, title, summary, content, code_example) VALUES (?, ?, ?, ?, ?, ?)",
            (sid, cat, title, summary, content, code_ex),
        )
        inserted += 1

    conn.executemany(
        "INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)",
        [
            ("sections", str(inserted)),
            ("builtAt", str(int(time.time()))),
            ("version", "4.2"),
        ],
    )
    conn.commit()
    conn.close()
    os.replace(tmp_db, out_db)
    return {"ok": True, "dbPath": out_db, "sections": inserted, "sizeBytes": os.path.getsize(out_db)}


def _open_shard_conn(shard_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(shard_path)
    conn.executescript(
        """
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA temp_store = FILE;
        PRAGMA cache_size = -16384;
        PRAGMA mmap_size = 67108864;

        CREATE TABLE IF NOT EXISTS corpus_facts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT NOT NULL,
            category TEXT NOT NULL,
            sentence TEXT NOT NULL
        );
        CREATE VIRTUAL TABLE IF NOT EXISTS corpus_fts USING fts5(
            topic,
            category,
            sentence
        );
        """
    )
    return conn


def _iter_stream_records(target_path: str) -> Iterable[Tuple[str, str, str]]:
    files: List[str] = []
    if os.path.isdir(target_path):
        for dirpath, _, filenames in os.walk(target_path):
            for fn in sorted(filenames):
                if fn.endswith((".txt", ".md", ".jsonl", ".csv", ".tsv")):
                    files.append(os.path.join(dirpath, fn))
    elif os.path.exists(target_path):
        files.append(target_path)

    for fp in files:
        base = os.path.basename(fp)
        if fp.endswith(".jsonl"):
            with open(fp, "r", encoding="utf-8", errors="ignore") as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                        txt = str(obj.get("text") or obj.get("sentence") or obj.get("content") or obj.get("definition") or "").strip()
                        topic = str(obj.get("topic") or obj.get("title") or base).strip()
                        cat = str(obj.get("category") or "shard").strip()
                        if len(txt) >= 12:
                            yield (topic[:120], cat[:64], txt[:2000])
                    except Exception:
                        continue
        elif fp.endswith((".csv", ".tsv")):
            delim = "\t" if fp.endswith(".tsv") else ","
            with open(fp, "r", encoding="utf-8", errors="ignore") as fh:
                reader = csv.reader(fh, delimiter=delim)
                for row in reader:
                    joined = " ".join(c.strip() for c in row if c.strip())
                    if len(joined) >= 12:
                        yield (base, "tabular", joined[:2000])
        else:
            with open(fp, "r", encoding="utf-8", errors="ignore") as fh:
                for line in fh:
                    s = line.strip()
                    if len(s) >= 16:
                        yield (base, "corpus", s[:2000])


def ingest_sharded_dataset(
    target_path: str,
    shards_dir: Optional[str] = None,
    max_rows_per_shard: int = 500_000,
) -> Dict[str, Any]:
    """Streams arbitrarily large text/JSONL/CSV datasets into disk-backed SQLite FTS5 shards using <100 MB RAM."""
    out_dir = shards_dir or os.path.join(os.path.dirname(DEFAULT_DB_PATH), "shards")
    os.makedirs(out_dir, exist_ok=True)
    existing = sorted(f for f in os.listdir(out_dir) if f.startswith("shard_") and f.endswith(".db"))
    shard_idx = len(existing)
    current_path = os.path.join(out_dir, f"shard_{shard_idx:03d}.db")
    conn = _open_shard_conn(current_path)
    rows_in_shard = 0
    total_inserted = 0
    shards_created = [current_path]
    batch: List[Tuple[str, str, str]] = []

    def _flush() -> None:
        nonlocal rows_in_shard, total_inserted, batch
        if not batch:
            return
        conn.executemany("INSERT INTO corpus_facts(topic, category, sentence) VALUES (?, ?, ?)", batch)
        conn.executemany("INSERT INTO corpus_fts(topic, category, sentence) VALUES (?, ?, ?)", batch)
        conn.commit()
        rows_in_shard += len(batch)
        total_inserted += len(batch)
        batch = []

    for rec in _iter_stream_records(target_path):
        batch.append(rec)
        if len(batch) >= 2000:
            _flush()
        if rows_in_shard >= max_rows_per_shard:
            conn.close()
            shard_idx += 1
            current_path = os.path.join(out_dir, f"shard_{shard_idx:03d}.db")
            conn = _open_shard_conn(current_path)
            shards_created.append(current_path)
            rows_in_shard = 0

    _flush()
    conn.close()

    catalog_path = os.path.join(out_dir, "shard_catalog.json")
    all_shards = sorted(f for f in os.listdir(out_dir) if f.startswith("shard_") and f.endswith(".db"))
    catalog = {
        "updatedAt": int(time.time()),
        "maxRowsPerShard": max_rows_per_shard,
        "shards": all_shards,
        "lastIngestRows": total_inserted,
    }
    with open(catalog_path, "w", encoding="utf-8") as fh:
        json.dump(catalog, fh, indent=2)

    return {
        "ok": True,
        "shardsDir": out_dir,
        "ingestedRows": total_inserted,
        "shardsCount": len(all_shards),
        "newShards": len(shards_created),
    }


def main() -> int:
    args = sys.argv[1:]
    if "--ingest-folio-docs" in args:
        payload_data = None
        if not sys.stdin.isatty():
            try:
                raw_in = sys.stdin.read().strip()
                if raw_in:
                    payload_data = json.loads(raw_in)
            except Exception:
                pass
        res = ingest_folio_docs(payload=payload_data)
        print(json.dumps(res))
        return 0

    if "--ingest-shards" in args:
        idx = args.index("--ingest-shards")
        if idx + 1 >= len(args):
            print(json.dumps({"ok": False, "error": "Missing file or folder path after --ingest-shards"}))
            return 1
        target = args[idx + 1]
        max_rows = 500_000
        if "--shard-rows" in args:
            ridx = args.index("--shard-rows")
            if ridx + 1 < len(args) and args[ridx + 1].isdigit():
                max_rows = max(1000, int(args[ridx + 1]))
        print(json.dumps(ingest_sharded_dataset(target, max_rows_per_shard=max_rows)))
        return 0

    if "--stats" in args:
        from folio_sdk import KnowledgeStore
        print(json.dumps({"ok": True, **KnowledgeStore().stats()}))
        return 0

    if "--train" in args:
        idx = args.index("--train")
        if idx + 1 >= len(args):
            print(json.dumps({"ok": False, "error": "Missing file path after --train"}))
            return 1
        target = args[idx + 1]
        if not os.path.exists(DEFAULT_DB_PATH):
            build_knowledge_db()
        conn = sqlite3.connect(DEFAULT_DB_PATH)
        added = ingest_custom_dataset(conn, target)
        conn.close()
        print(json.dumps({"ok": True, "ingestedSentences": added, "source": target}))
        return 0

    stats = build_knowledge_db()
    print(json.dumps({"ok": True, "dbPath": DEFAULT_DB_PATH, **stats}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
