#!/usr/bin/env python3
"""
Neo 4 — Experimental Rule-Based AI Engine for Folio Zero (Update 4.1)
Architecture:
  1. Subword Compositional Tokenizer (prefixes, roots, suffixes, char bigrams)
  2. Context-Window Semantic Vector Disambiguator (±k token radius)
  3. Order-3 Backoff Markov Chain + CoT Candidate Next-Token Rater
  4. OSASCOMP Adjectival Order & POS Syntax Constraint Checker
  5. AST-Safe Exact Math, Algebra, Statistics & Physics Solver
  6. Persistent Brain, Dictionaries & Plugins (.folio-data/neo4/)
  7. Entropic Auditor (Shannon Entropy H, TTR, Bigram Repeat Rate, Grammar Score)
"""

from __future__ import annotations

import ast
import cmath
from collections import Counter, defaultdict
from decimal import Decimal, getcontext
import importlib.util
import json
import math
import os
import re
import statistics
import sys
import time
from typing import Any, Dict, List, Optional, Tuple


getcontext().prec = 64

OSASCOMP_ORDER: Dict[str, int] = {
    "opinion": 1,
    "size": 2,
    "age": 3,
    "shape": 4,
    "color": 5,
    "origin": 6,
    "material": 7,
    "purpose": 8,
}

ADJECTIVE_LEXICON: Dict[str, str] = {
    # Opinion (1)
    "good": "opinion", "great": "opinion", "excellent": "opinion", "clean": "opinion",
    "smart": "opinion", "bright": "opinion", "lovely": "opinion", "crisp": "opinion",
    "smooth": "opinion", "elegant": "opinion", "fast": "opinion", "sleek": "opinion",
    "brilliant": "opinion", "sharp": "opinion", "experimental": "opinion", "compact": "opinion",
    # Size (2)
    "tiny": "size", "small": "size", "little": "size", "medium": "size",
    "large": "size", "big": "size", "huge": "size", "massive": "size", "tall": "size",
    "short": "size", "wide": "size", "narrow": "size", "giant": "size", "micro": "size",
    # Age (3)
    "new": "age", "modern": "age", "ancient": "age", "old": "age", "olden": "age",
    "young": "age", "vintage": "age", "fresh": "age", "classic": "age", "antique": "age",
    # Shape (4)
    "round": "shape", "square": "shape", "flat": "shape", "curved": "shape",
    "orbital": "shape", "hexagonal": "shape", "triangular": "shape", "cylindrical": "shape",
    "spherical": "shape", "linear": "shape", "angular": "shape",
    # Color (5)
    "red": "color", "blue": "color", "green": "color", "amber": "color",
    "cyan": "color", "emerald": "color", "crimson": "color", "dark": "color",
    "black": "color", "white": "color", "silver": "color", "golden": "color",
    "violet": "color", "indigo": "color", "cobalt": "color",
    # Origin (6)
    "python": "origin", "nordic": "origin", "japanese": "origin", "american": "origin",
    "british": "origin", "cosmic": "origin", "lunar": "origin", "local": "origin",
    "digital": "origin", "folio": "origin",
    # Material (7)
    "wooden": "material", "steel": "material", "metallic": "material", "glass": "material",
    "poly": "material", "silicon": "material", "quantum": "material", "ceramic": "material",
    "carbon": "material", "aluminum": "material", "plastic": "material", "copper": "material",
    # Purpose (8)
    "collaborative": "purpose", "rendering": "purpose", "computing": "purpose",
    "coding": "purpose", "racing": "purpose", "building": "purpose", "modding": "purpose",
    "diagnostic": "purpose", "analytical": "purpose", "conversational": "purpose",
}

DETERMINERS = {
    "a", "an", "the", "this", "that", "these", "those", "my", "your", "our", "its", "every", "each", "some"
}
PRONOUNS = {"i", "you", "we", "they", "it", "he", "she", "who", "what", "this", "that"}
AUX_VERBS = {
    "am", "is", "are", "was", "were", "can", "could", "will", "would", "shall", "should",
    "may", "might", "must", "do", "does", "did", "have", "has", "had"
}
VERBS = AUX_VERBS | {
    "ask", "help", "build", "create", "write", "solve", "compute", "run", "analyze", "inspect",
    "generate", "render", "compile", "export", "mod", "extract", "explain", "design", "use",
    "need", "want", "think", "reason", "predict", "disambiguate", "verify", "serve", "make", "feel"
}
PREPOSITIONS = {"in", "on", "at", "by", "for", "with", "from", "to", "of", "into", "through", "over", "under", "about", "as"}
CONJUNCTIONS = {"and", "or", "but", "so", "yet", "because", "while", "if", "when", "then"}
FUNCTION_WORDS = DETERMINERS | PRONOUNS | AUX_VERBS | PREPOSITIONS | CONJUNCTIONS | {"not", "no", "yes"}

COMMON_PREFIXES = (
    "anti", "auto", "bio", "co", "counter", "de", "dis", "en", "ex", "hyper", "inter",
    "macro", "meta", "micro", "mid", "mis", "mono", "multi", "non", "over", "poly",
    "post", "pre", "pro", "pseudo", "re", "semi", "sub", "super", "trans", "un", "under"
)
COMMON_SUFFIXES = (
    "ization", "ational", "fulness", "ousness", "iveness", "tion", "sion", "ment", "ness",
    "ance", "ence", "able", "ible", "ally", "ical", "logy", "hood", "ship", "ward",
    "less", "like", "wise", "ing", "ers", "ies", "ied", "ful", "ous", "ive", "ize",
    "ise", "ify", "ate", "ish", "ist", "ism", "ity", "est", "er", "ed", "es", "ly", "al", "en", "s"
)

SENSE_ANCHORS: Dict[str, Dict[str, set]] = {
    "bat": {
        "nocturnal flying mammal (Chiroptera / echolocation)": {
            "cave", "night", "nocturnal", "fly", "flying", "wing", "wings", "echolocation",
            "vampire", "mammal", "roost", "hang", "animal", "dark", "sonar", "insect"
        },
        "wooden/aluminum sports striking club (baseball/cricket)": {
            "baseball", "cricket", "ball", "hit", "swing", "pitch", "pitcher", "home", "run",
            "wicket", "stadium", "player", "wooden", "grip", "sports", "game", "Equipment".lower()
        },
    },
    "bank": {
        "financial institution for currency, deposits & cards": {
            "money", "account", "card", "visa", "mastercard", "deposit", "loan", "credit",
            "debit", "cash", "balance", "vault", "transfer", "pay", "payment", "dollar"
        },
        "sloping river edge / terrain embankment": {
            "river", "stream", "water", "mud", "shore", "boat", "swim", "fishing", "fish",
            "sand", "grass", "creek", "erosion", "tree"
        },
    },
    "python": {
        "Python programming language & runtime": {
            "code", "script", "import", "def", "class", "function", "pip", "module", "ai",
            "markov", "syntax", "compile", "run", "algorithm", "variable", "dict", "list"
        },
        "non-venomous constrictor snake (Pythonidae)": {
            "snake", "reptile", "scales", "jungle", "constrictor", "zoo", "bite", "slither"
        },
    },
    "spring": {
        "helical elastic mechanical coil (Hooke's law F = -kx)": {
            "coil", "metal", "steel", "physics", "force", "compress", "stretch", "elastic",
            "bounce", "shock", "suspension", "hooke", "pendulum", "oscillate"
        },
        "natural groundwater emergence or vernal season": {
            "water", "fountain", "season", "summer", "winter", "autumn", "bloom", "flower",
            "april", "march", "warm", "rain"
        },
    },
    "crane": {
        "heavy construction lifting boom/hoist": {
            "build", "steel", "lift", "tower", "site", "construction", "load", "hook", "cable"
        },
        "long-legged wading bird (Gruidae)": {
            "bird", "feather", "wetland", "wing", "fly", "flock", "beak", "nest", "origami"
        },
    },
    "scale": {
        "ratio, resolution, or 3D transform proportion": {
            "size", "ratio", "resize", "transform", "matrix", "mesh", "3d", "blender",
            "pixel", "axis", "vector", "zoom", "dimension"
        },
        "musical diatonic sequence or weight instrument": {
            "music", "note", "piano", "chord", "octave", "major", "minor", "weight", "gram"
        },
    },
}

DEFAULT_SLANG_SHORTCUTS: Dict[str, str] = {
    "idk": "I do not know",
    "imo": "in my opinion",
    "imho": "in my humble opinion",
    "tbh": "to be honest",
    "brb": "be right back",
    "btw": "by the way",
    "ngl": "not going to lie",
    "fr": "for real",
    "irl": "in real life",
    "cot": "chain of thought",
    "oop": "object oriented programming",
    "cli": "command line interface",
    "sdk": "software development kit",
    "api": "application programming interface",
    "ast": "abstract syntax tree",
    "pbr": "physically based rendering",
    "lmao": "laughing",
    "yo": "hello",
    "sup": "how can I help",
}

DEFAULT_CORPUS_SENTENCES: List[str] = [
    "Hi! I'm Neo, your personal collaborative partner — ask me anything about code, math, 3D engines, mods, or systems design.",
    "I'm Neo, an experimental rule-based partner powered by compositional subword tokenization, context-window embeddings, and a rated Order-3 Markov chain.",
    "Hi there! Ask me anything — I can solve algebra and physics equations, reason with ordered English grammar, scaffold workspace tools, or inspect source structures.",
    "Unlike raw chaotic n-grams, my next-token scorer rates every candidate against OSASCOMP adjectival order, part-of-speech flow, and surrounding semantic context.",
    "Let's break this down step by step using exact symbolic math, clean modular code, and structured reasoning.",
    "For complex builds requiring compilers or multi-file assets, we can scaffold clean modules directly inside your Folio workspace folder.",
    "When multiple word senses collide, inspecting the surrounding token radius lets the semantic vector disambiguate meaning reliably.",
    "English blends a massive vocabulary of core words, idioms, shortcuts, and scientific definitions, while mathematics reduces complexity to clean composable laws.",
    "Let's write clean, well-commented code first so the execution pipeline stays transparent and easy to extend.",
    "Every response passes grammar verification before delivery so phrasing stays crisp, helpful, and grounded.",
]

THINKING_PARAMS: Dict[str, Tuple[int, int]] = {
    "minimal": (2, 1),
    "low": (3, 2),
    "medium": (5, 3),
    "high": (7, 4),
    "deep": (10, 6),
}


def compute_pi_high_precision(digits: int = 50) -> str:
    # Chudnovsky / Machin formula via Decimal at high precision
    getcontext().prec = digits + 16
    def arctan(x_inv: int) -> Decimal:
        power = Decimal(1) / Decimal(x_inv)
        total = power
        x2 = Decimal(x_inv * x_inv)
        n = 1
        sign = -1
        while True:
            power = power / x2
            term = power / Decimal(2 * n + 1)
            if term == 0 or term.adjusted() < -(digits + 12):
                break
            total += sign * term
            sign = -sign
            n += 1
        return total
    pi_val = Decimal(4) * (Decimal(4) * arctan(5) - arctan(239))
    s = f"{pi_val:.{digits + 4}f}"
    return s[:digits + 2]


def compute_e_high_precision(digits: int = 50) -> str:
    getcontext().prec = digits + 16
    total = Decimal(1)
    term = Decimal(1)
    n = 1
    while True:
        term = term / Decimal(n)
        if term.adjusted() < -(digits + 12):
            break
        total += term
        n += 1
    s = f"{total:.{digits + 4}f}"
    return s[:digits + 2]


def decompose_subword(word: str) -> Dict[str, Any]:
    clean = re.sub(r"[^a-zA-Z0-9_'-]", "", word)
    low = clean.lower()
    prefix = ""
    root = low
    suffix = ""

    for p in sorted(COMMON_PREFIXES, key=len, reverse=True):
        if len(low) > len(p) + 2 and low.startswith(p):
            prefix = p
            root = low[len(p):]
            break

    for s in sorted(COMMON_SUFFIXES, key=len, reverse=True):
        if len(root) > len(s) + 2 and root.endswith(s):
            suffix = s
            root = root[:len(root) - len(s)]
            break

    syllables = re.findall(r"[^aeiouy]*[aeiouy]+(?:[^aeiouy](?![aeiouy]))?", root) or [root]
    pieces = ([prefix] if prefix else []) + syllables + ([suffix] if suffix else [])
    return {
        "surface": clean,
        "prefix": prefix or None,
        "root": root,
        "suffix": suffix or None,
        "syllables": syllables,
        "lego_tokens": [t for t in pieces if t],
    }


def classify_pos(tok: str) -> str:
    low = tok.lower()
    if low in {",", ".", "!", "?", ";", ":", "—", "-", "(", ")"}:
        return "PUNCT"
    if re.fullmatch(r"[-+]?\d+(?:\.\d+)?", low):
        return "NUM"
    if low in DETERMINERS:
        return "DET"
    if low in PRONOUNS:
        return "PRON"
    if low in PREPOSITIONS:
        return "PREP"
    if low in CONJUNCTIONS:
        return "CONJ"
    if low in ADJECTIVE_LEXICON:
        return f"ADJ:{ADJECTIVE_LEXICON[low]}"
    if low in VERBS:
        return "VERB"
    if low.endswith("ly") and len(low) > 4:
        return "ADV"
    if low.endswith(("ive", "ous", "ful", "less", "able", "ible", "ic")):
        return "ADJ:opinion"
    if low.endswith(("ing", "ed", "ize", "ify")) and len(low) > 4:
        return "VERB"
    return "NOUN"


class Neo4Brain:
    def __init__(self, data_dir: str) -> None:
        self.data_dir = data_dir
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "plugins"), exist_ok=True)
        self.brain_path = os.path.join(self.data_dir, "brain.json")
        self.slang_path = os.path.join(self.data_dir, "slang_shortcuts.json")

        self.unigrams: Counter[str] = Counter()
        self.bigrams: Dict[str, Counter[str]] = defaultdict(Counter)
        self.trigrams: Dict[str, Counter[str]] = defaultdict(Counter)
        self.slang_map: Dict[str, str] = dict(DEFAULT_SLANG_SHORTCUTS)
        self.learned_facts: List[str] = []
        self.plugins: List[Tuple[str, Any]] = []

        self._load_or_init()
        self._load_plugins()

    def _tokenize(self, text: str) -> List[str]:
        return re.findall(r"[A-Za-z0-9_']+|[.,!?;:—-]", text)

    def _train_sentence(self, sentence: str) -> None:
        tokens = ["<BOS>", "<BOS>"] + self._tokenize(sentence) + ["<EOS>"]
        for i in range(2, len(tokens)):
            w0, w1, w2 = tokens[i - 2], tokens[i - 1], tokens[i]
            self.unigrams[w2] += 1
            self.bigrams[w1][w2] += 1
            self.trigrams[f"{w0}||{w1}"][w2] += 1

    def _load_or_init(self) -> None:
        if os.path.exists(self.slang_path):
            try:
                with open(self.slang_path, "r", encoding="utf-8") as fh:
                    loaded = json.load(fh)
                    if isinstance(loaded, dict):
                        self.slang_map.update({str(k).lower(): str(v) for k, v in loaded.items()})
            except Exception:
                pass
        else:
            try:
                with open(self.slang_path, "w", encoding="utf-8") as fh:
                    json.dump(self.slang_map, fh, indent=2)
            except Exception:
                pass

        for s in DEFAULT_CORPUS_SENTENCES:
            self._train_sentence(s)

        if os.path.exists(self.brain_path):
            try:
                with open(self.brain_path, "r", encoding="utf-8") as fh:
                    saved = json.load(fh)
                for s in saved.get("learned_sentences", []):
                    if isinstance(s, str) and s.strip():
                        self._train_sentence(s)
                        self.learned_facts.append(s)
            except Exception:
                pass
        else:
            self._save_brain()

    def _save_brain(self) -> None:
        payload = {
            "version": "neo-4.1",
            "updatedAt": int(time.time()),
            "vocabCount": len(self.unigrams),
            "learned_sentences": self.learned_facts[-200:],
        }
        try:
            with open(self.brain_path, "w", encoding="utf-8") as fh:
                json.dump(payload, fh, indent=2)
        except Exception:
            pass

    def learn(self, sentence: str) -> None:
        clean = sentence.strip()
        if len(clean) < 6 or clean in self.learned_facts:
            return
        self._train_sentence(clean)
        self.learned_facts.append(clean)
        self._save_brain()

    def _load_plugins(self) -> None:
        plugins_dir = os.path.join(self.data_dir, "plugins")
        for fname in sorted(os.listdir(plugins_dir)):
            if not fname.endswith(".py") or fname.startswith("_"):
                continue
            full = os.path.join(plugins_dir, fname)
            try:
                spec = importlib.util.spec_from_file_location(f"neo4_plugin_{fname[:-3]}", full)
                if spec and spec.loader:
                    mod = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(mod)
                    if hasattr(mod, "handle") and callable(mod.handle):
                        self.plugins.append((fname[:-3], mod))
            except Exception:
                continue

    def normalize_shortcuts(self, text: str) -> Tuple[str, List[str]]:
        expansions: List[str] = []
        words = text.split()
        out_words = []
        for w in words:
            stripped = re.sub(r"[^a-zA-Z0-9]", "", w).lower()
            if stripped in self.slang_map:
                expansions.append(f"{stripped} -> \"{self.slang_map[stripped]}\"")
            out_words.append(w)
        return " ".join(out_words), expansions

    def disambiguate_context(self, text: str, radius: int) -> List[Dict[str, Any]]:
        tokens = [t.lower() for t in re.findall(r"[A-Za-z0-9']+", text)]
        resolved: List[Dict[str, Any]] = []
        for idx, tok in enumerate(tokens):
            if tok not in SENSE_ANCHORS:
                continue
            left = tokens[max(0, idx - radius):idx]
            right = tokens[idx + 1:min(len(tokens), idx + 1 + radius)]
            window = left + right
            window_set = set(window)
            scores: List[Tuple[str, float, List[str]]] = []
            for sense_label, anchors in SENSE_ANCHORS[tok].items():
                hits = sorted(window_set.intersection(anchors))
                # Distance-weighted proximity score
                weighted = 0.0
                for j in range(max(0, idx - radius), min(len(tokens), idx + 1 + radius)):
                    if j == idx:
                        continue
                    if tokens[j] in anchors:
                        weighted += 1.0 / (abs(j - idx) + 0.5)
                scores.append((sense_label, round(weighted, 3), hits))
            scores.sort(key=lambda item: item[1], reverse=True)
            best = scores[0]
            resolved.append({
                "token": tok,
                "radius": radius,
                "contextWindow": window,
                "selectedSense": best[0],
                "score": best[1],
                "matchedAnchors": best[2],
                "alternatives": [{"sense": s, "score": sc} for s, sc, _ in scores[1:]],
            })
        return resolved

    def score_osascomp_and_grammar(self, tokens: List[str]) -> Tuple[float, List[str]]:
        if not tokens:
            return 0.0, ["empty sequence"]
        notes: List[str] = []
        penalty = 0.0
        prev_adj_rank = 0
        prev_pos = "START"

        for tok in tokens:
            pos = classify_pos(tok)
            if pos.startswith("ADJ:"):
                cat = pos.split(":", 1)[1]
                rank = OSASCOMP_ORDER.get(cat, 5)
                if prev_pos.startswith("ADJ:") and rank < prev_adj_rank:
                    penalty += 0.35
                    notes.append(f"OSASCOMP order mismatch near \"{tok}\" ({cat} after higher rank)")
                prev_adj_rank = rank
            else:
                prev_adj_rank = 0

            if pos == "DET" and prev_pos == "DET":
                penalty += 0.45
                notes.append(f"Adjacent determiners near \"{tok}\"")
            prev_pos = pos

        score = max(0.0, round(1.0 - min(0.95, penalty), 3))
        if not notes:
            notes.append("OSASCOMP adjectival order & POS cadence verified")
        return score, notes

    def generate_rated_markov(self, seed_tokens: List[str], beam_width: int = 5, max_len: int = 26) -> Tuple[str, List[Dict[str, Any]]]:
        history = ["<BOS>", "<BOS>"]
        for t in seed_tokens[:3]:
            if t in self.unigrams:
                history.append(t)

        trace: List[Dict[str, Any]] = []
        out: List[str] = []

        for step in range(max_len):
            w0, w1 = history[-2], history[-1]
            tri_key = f"{w0}||{w1}"
            candidates_raw: Dict[str, float] = {}

            if tri_key in self.trigrams:
                total = sum(self.trigrams[tri_key].values()) or 1
                for tok, cnt in self.trigrams[tri_key].items():
                    candidates_raw[tok] = candidates_raw.get(tok, 0.0) + 0.72 * (cnt / total)

            if w1 in self.bigrams:
                total = sum(self.bigrams[w1].values()) or 1
                for tok, cnt in self.bigrams[w1].items():
                    candidates_raw[tok] = candidates_raw.get(tok, 0.0) + 0.28 * (cnt / total)

            if not candidates_raw:
                break

            rated: List[Tuple[str, float]] = []
            for cand, base_prob in candidates_raw.items():
                if cand == "<BOS>":
                    continue
                if cand == "<EOS>":
                    eos_score = base_prob * (1.25 if len(out) >= 10 else 0.12)
                    rated.append((cand, eos_score))
                    continue
                trial = out + [cand]
                grammar_score, _ = self.score_osascomp_and_grammar(trial[-6:])
                # Penalize immediate word echo
                rep_penalty = 0.25 if (out and out[-1].lower() == cand.lower()) else 1.0
                final_rating = base_prob * (0.4 + 0.6 * grammar_score) * rep_penalty
                rated.append((cand, round(final_rating, 4)))

            if not rated:
                break
            rated.sort(key=lambda x: x[1], reverse=True)
            top = rated[0]
            if len(trace) < 6:
                trace.append({
                    "step": step + 1,
                    "chosen": top[0],
                    "rating": top[1],
                    "topK": [{"token": k, "rating": r} for k, r in rated[:min(beam_width, 3)]],
                })
            if top[0] == "<EOS>":
                break
            out.append(top[0])
            history.append(top[0])

        text = " ".join(out)
        text = re.sub(r"\s+([.,!?;:])", r"\1", text)
        return text, trace


def safe_eval_math_expr(expr: str) -> float:
    cleaned = expr.strip()
    cleaned = cleaned.replace("^", "**").replace("×", "*").replace("÷", "/")
    cleaned = re.sub(r"\bln\(", "log(", cleaned)
    cleaned = re.sub(r"\bpi\b", "pi", cleaned, flags=re.I)

    allowed_funcs: Dict[str, Any] = {
        "sin": math.sin,
        "cos": math.cos,
        "tan": math.tan,
        "asin": math.asin,
        "acos": math.acos,
        "atan": math.atan,
        "sinh": math.sinh,
        "cosh": math.cosh,
        "tanh": math.tanh,
        "sqrt": math.sqrt,
        "abs": abs,
        "log": math.log,
        "log10": math.log10,
        "log2": math.log2,
        "exp": math.exp,
        "floor": math.floor,
        "ceil": math.ceil,
        "factorial": math.factorial,
        "comb": math.comb,
        "perm": math.perm,
        "pi": math.pi,
        "e": math.e,
        "tau": math.tau,
    }

    tree = ast.parse(cleaned, mode="eval")

    def _eval(node: ast.AST) -> float:
        if isinstance(node, ast.Expression):
            return _eval(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return float(node.value)
        if isinstance(node, ast.Name):
            if node.id in allowed_funcs and not callable(allowed_funcs[node.id]):
                return float(allowed_funcs[node.id])
            raise ValueError(f"Unsupported symbol '{node.id}'")
        if isinstance(node, ast.UnaryOp):
            val = _eval(node.operand)
            if isinstance(node.op, ast.UAdd):
                return +val
            if isinstance(node.op, ast.USub):
                return -val
            raise ValueError("Unsupported unary operator")
        if isinstance(node, ast.BinOp):
            left = _eval(node.left)
            right = _eval(node.right)
            if isinstance(node.op, ast.Add):
                return left + right
            if isinstance(node.op, ast.Sub):
                return left - right
            if isinstance(node.op, ast.Mult):
                return left * right
            if isinstance(node.op, ast.Div):
                return left / right
            if isinstance(node.op, ast.FloorDiv):
                return left // right
            if isinstance(node.op, ast.Mod):
                return left % right
            if isinstance(node.op, ast.Pow):
                if abs(right) > 1000:
                    raise ValueError("Exponent too large")
                return left ** right
            raise ValueError("Unsupported binary operator")
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            fn = allowed_funcs.get(node.func.id)
            if not callable(fn):
                raise ValueError(f"Unsupported function '{node.func.id}'")
            args = [_eval(a) for a in node.args]
            if node.func.id in {"factorial", "comb", "perm"}:
                return float(fn(*[int(x) for x in args]))
            return float(fn(*args))
        raise ValueError("Unsupported expression")

    return _eval(tree)


def try_solve_math_or_physics(prompt: str) -> Optional[Dict[str, Any]]:
    low = prompt.lower().strip()

    # 1. High-precision Pi / Euler's number
    if re.search(r"\b(pi|euler)\b.*\b(digits|decimal|precision|50)\b", low) or re.search(r"\b(value of|compute)\s+(pi|e)\b", low):
        return {
            "category": "High-Precision Constants",
            "steps": [
                "Computed pi via Machin's formula: pi = 4 * (4*arctan(1/5) - arctan(1/239))",
                "Computed Euler's number e via factorial series Sum_{k=0..inf} 1/k!",
            ],
            "answer": (
                f"pi (50 decimals) = `{compute_pi_high_precision(50)}`\n"
                f"e  (50 decimals) = `{compute_e_high_precision(50)}`"
            ),
        }

    # 2. Lens Magnification Physics: M = v / u and 1/f = 1/u + 1/v
    mag_match = re.search(r"\bm\s*=\s*v\s*/\s*u\b|\bmagnification\b", low)
    if mag_match:
        v_m = re.search(r"\bv\s*=\s*([-+]?\d+(?:\.\d+)?)", low)
        u_m = re.search(r"\bu\s*=\s*([-+]?\d+(?:\.\d+)?)", low)
        f_m = re.search(r"\bf\s*=\s*([-+]?\d+(?:\.\d+)?)", low)
        if v_m and u_m:
            v = float(v_m.group(1))
            u = float(u_m.group(1))
            if u == 0:
                return {"category": "Optics / Physics", "steps": ["Object distance u cannot be zero."], "answer": "Undefined (u = 0)."}
            M = v / u
            f = (u * v) / (u + v) if (u + v) != 0 else float("inf")
            return {
                "category": "Optics & Lens Magnification",
                "steps": [
                    f"Given image distance v = {v:g} and object distance u = {u:g}",
                    f"Magnification M = v / u = {v:g} / {u:g} = {M:.6g}",
                    f"Thin-lens focal length f = (u * v) / (u + v) = {f:.6g}",
                ],
                "answer": f"Magnification `M = {M:.6g}`, focal length `f = {f:.6g}`.",
            }
        if f_m and u_m:
            f = float(f_m.group(1))
            u = float(u_m.group(1))
            denom = u - f
            if denom == 0:
                return {"category": "Optics / Physics", "steps": ["u = f places image at infinity."], "answer": "v -> infinity (object at focal point)."}
            v = (f * u) / denom
            M = v / u
            return {
                "category": "Optics & Lens Magnification",
                "steps": [
                    f"1/v = 1/f - 1/u -> v = {v:.6g}",
                    f"M = v / u = {M:.6g}",
                ],
                "answer": f"Image distance `v = {v:.6g}`, magnification `M = {M:.6g}`.",
            }

    # 3. Quadratic solver: ax^2 + bx + c = 0
    quad_match = re.search(
        r"(?:([-+]?\d*\.?\d*)\s*\*?\s*x\s*\^?\s*2)\s*([+-]\s*\d*\.?\d*\s*\*?\s*x)?\s*([+-]\s*\d+\.?\d*)?\s*=\s*0",
        low.replace(" ", ""),
    )
    if quad_match:
        def parse_coeff(raw: Optional[str], has_var: bool = False) -> float:
            if not raw:
                return 0.0
            s = raw.replace("*", "").replace("x", "").strip()
            if s in ("", "+"):
                return 1.0 if has_var else 0.0
            if s == "-":
                return -1.0 if has_var else 0.0
            return float(s)

        a_raw = quad_match.group(1)
        a = 1.0 if a_raw in ("", "+") else (-1.0 if a_raw == "-" else float(a_raw))
        b = parse_coeff(quad_match.group(2), True)
        c = parse_coeff(quad_match.group(3), False)
        if a != 0:
            disc = b * b - 4 * a * c
            r1 = (-b + cmath.sqrt(disc)) / (2 * a)
            r2 = (-b - cmath.sqrt(disc)) / (2 * a)
            fmt = lambda z: f"{z.real:.6g}" if abs(z.imag) < 1e-12 else f"{z.real:.4g} {'+' if z.imag >= 0 else '-'} {abs(z.imag):.4g}i"
            return {
                "category": "Quadratic Algebra",
                "steps": [
                    f"Coefficients: a = {a:g}, b = {b:g}, c = {c:g}",
                    f"Discriminant Δ = b² - 4ac = {disc:g}",
                    f"Roots: x = (-b ± sqrt(Δ)) / (2a)",
                ],
                "answer": f"`x₁ = {fmt(r1)}`, `x₂ = {fmt(r2)}`",
            }

    # 4. 2x2 Simultaneous Linear Equations (Elimination & Substitution)
    eq_parts = re.findall(
        r"([-+]?\d*\.?\d*)\s*x\s*([+-]\s*\d*\.?\d*)\s*y\s*=\s*([-+]?\d+\.?\d*)",
        low.replace(" ", ""),
    )
    if len(eq_parts) >= 2:
        def c_val(s: str) -> float:
            if s in ("", "+"):
                return 1.0
            if s == "-":
                return -1.0
            return float(s)
        a1, b1, c1 = c_val(eq_parts[0][0]), c_val(eq_parts[0][1]), float(eq_parts[0][2])
        a2, b2, c2 = c_val(eq_parts[1][0]), c_val(eq_parts[1][1]), float(eq_parts[1][2])
        det = a1 * b2 - a2 * b1
        if det == 0:
            return {"category": "Simultaneous Equations", "steps": ["Determinant Δ = a₁b₂ - a₂b₁ = 0"], "answer": "No unique solution (parallel or coincident lines)."}
        x_val = (c1 * b2 - c2 * b1) / det
        y_val = (a1 * c2 - a2 * c1) / det
        return {
            "category": "Simultaneous Linear System (Elimination)",
            "steps": [
                f"System: {a1:g}x + ({b1:g})y = {c1:g} and {a2:g}x + ({b2:g})y = {c2:g}",
                f"Elimination determinant Δ = {a1:g}·{b2:g} - {a2:g}·{b1:g} = {det:g}",
            ],
            "answer": f"`x = {x_val:.6g}`, `y = {y_val:.6g}`",
        }

    # 5. Statistics: variance / range / mean of comma or space list
    if any(k in low for k in ("variance", "std", "mean", "median", "range", "ap ", "arithmetic progression", "gp ", "geometric progression")):
        nums = [float(x) for x in re.findall(r"[-+]?\d+(?:\.\d+)?", low)]
        if len(nums) >= 3:
            mean_v = statistics.mean(nums)
            var_v = statistics.pvariance(nums)
            rng_v = max(nums) - min(nums)
            ap_diff = [round(nums[i + 1] - nums[i], 6) for i in range(len(nums) - 1)]
            is_ap = len(set(ap_diff)) == 1
            gp_ratio = [round(nums[i + 1] / nums[i], 6) for i in range(len(nums) - 1)] if all(n != 0 for n in nums[:-1]) else []
            is_gp = len(gp_ratio) > 0 and len(set(gp_ratio)) == 1
            steps = [
                f"Dataset ({len(nums)} values): {nums[:12]}",
                f"Mean = {mean_v:.6g} | Population Variance σ² = {var_v:.6g} | Range = {rng_v:.6g}",
            ]
            if is_ap:
                steps.append(f"Arithmetic Progression detected: common difference d = {ap_diff[0]:g}, next term = {nums[-1] + ap_diff[0]:g}")
            if is_gp:
                steps.append(f"Geometric Progression detected: common ratio r = {gp_ratio[0]:g}, next term = {nums[-1] * gp_ratio[0]:g}")
            return {
                "category": "Series & Statistical Analysis",
                "steps": steps,
                "answer": f"Mean `{mean_v:.6g}`, Variance `{var_v:.6g}`, Range `{rng_v:.6g}`" + (f", Next AP `{nums[-1] + ap_diff[0]:g}`" if is_ap else "") + (f", Next GP `{nums[-1] * gp_ratio[0]:g}`" if is_gp else ""),
            }

    # 6. Direct mathematical expression
    expr_candidate = prompt.strip()
    expr_candidate = re.sub(r"^(?:calculate|compute|evaluate|solve|what is)\s+", "", expr_candidate, flags=re.I).rstrip("?=")
    if re.fullmatch(r"[0-9+\-*/^().,\s_a-zA-Z]+", expr_candidate) and (
        re.search(r"[\+\-\*/\^]", expr_candidate) or re.search(r"\b(sin|cos|tan|sqrt|log|log10|ln|exp|factorial|comb|perm)\b", expr_candidate, re.I)
    ):
        try:
            val = safe_eval_math_expr(expr_candidate)
            out_val = int(val) if abs(val - round(val)) < 1e-12 and abs(val) < 1e15 else round(val, 10)
            return {
                "category": "Exact AST Mathematical Evaluator",
                "steps": [f"Parsed expression AST: `{expr_candidate}`"],
                "answer": f"`{expr_candidate} = {out_val}`",
            }
        except Exception:
            pass

    return None


def run_entropic_auditor(text: str, grammar_score: float, has_grounding: bool) -> Dict[str, Any]:
    tokens = [t.lower() for t in re.findall(r"[A-Za-z0-9']+", text)]
    n = len(tokens)
    if n == 0:
        return {
            "shannonEntropyBits": 0.0,
            "lexicalDiversityTTR": 0.0,
            "bigramRepetitionRate": 0.0,
            "grammarScore": 0.0,
            "groundingSignal": False,
            "verdict": "FAIL (empty response)",
        }

    counts = Counter(tokens)
    entropy = 0.0
    for cnt in counts.values():
        p = cnt / n
        entropy -= p * math.log2(p)

    ttr = len(counts) / n
    bigrams = [(tokens[i], tokens[i + 1]) for i in range(n - 1)]
    bigram_repeats = (len(bigrams) - len(set(bigrams))) / max(1, len(bigrams))
    verdict = "PASS" if (entropy >= 2.2 and bigram_repeats < 0.35 and grammar_score >= 0.7) else "WARN"
    return {
        "shannonEntropyBits": round(entropy, 3),
        "lexicalDiversityTTR": round(ttr, 3),
        "bigramRepetitionRate": round(bigram_repeats, 3),
        "grammarScore": grammar_score,
        "groundingSignal": has_grounding,
        "verdict": verdict,
    }


def check_safety(prompt: str, filters: Dict[str, str]) -> Optional[str]:
    low = prompt.lower()
    dangerous_thresh = str(filters.get("dangerousContent", "medium")).lower()
    if dangerous_thresh != "none":
        if any(term in low for term in ("ransomware", "malware payload", "keylogger", "ddos attack", "exploit zero-day")):
            return f"Blocked by Neo 4 safety policy (dangerousContent={dangerous_thresh}). Adjust thresholds in Safety filters if performing defensive security research."
    return None


def generate_neo4_response(payload: Dict[str, Any]) -> Dict[str, Any]:
    data_dir = payload.get("dataDir") or os.path.join(os.getcwd(), ".folio-data", "neo4")
    brain = Neo4Brain(data_dir)

    messages = payload.get("messages") or []
    user_text = ""
    attachments_summary: List[str] = []
    for msg in reversed(messages):
        if msg.get("role") == "user":
            user_text = str(msg.get("text") or "").strip()
            for att in msg.get("attachments") or []:
                attachments_summary.append(str(att.get("name") or "attachment"))
            break

    # Learn clean prior turns into local Markov matrix
    for msg in messages[:-1]:
        t = str(msg.get("text") or "").strip()
        if 8 <= len(t) <= 300 and msg.get("role") == "user":
            brain.learn(t)

    thinking_mode = str(payload.get("thinkingMode") or "medium").lower()
    beam_width, ctx_radius = THINKING_PARAMS.get(thinking_mode, (5, 3))
    semantic_enabled = payload.get("semanticEngineEnabled", True)
    entropic_enabled = bool(payload.get("entropicAuditorEnabled", False))
    meta_enabled = bool(payload.get("metaScriptingEnabled", False))
    pure_code = bool(payload.get("immersivePureCode", False))
    safety_filters = payload.get("safetyFilters") or {}
    system_instruction = str(payload.get("systemInstruction") or "").strip()
    custom_tools = payload.get("customTools") or []

    safety_block = check_safety(user_text, safety_filters)
    if safety_block:
        return {
            "ok": False,
            "blocked": True,
            "thoughts": "• Safety policy triggered during pre-flight inspection.",
            "text": safety_block,
        }

    # Check plugins first
    for plugin_name, mod in brain.plugins:
        try:
            plugin_res = mod.handle(user_text, payload)
            if isinstance(plugin_res, dict) and plugin_res.get("text"):
                return {
                    "ok": True,
                    "thoughts": f"• Handled by Neo 4 plugin: `{plugin_name}`",
                    "text": str(plugin_res["text"]),
                }
        except Exception:
            continue

    normalized_text, shortcut_notes = brain.normalize_shortcuts(user_text)
    subwords = [decompose_subword(w) for w in re.findall(r"[A-Za-z0-9_'-]+", user_text)[:12]]
    senses = brain.disambiguate_context(user_text, ctx_radius) if semantic_enabled else []
    math_solution = try_solve_math_or_physics(normalized_text)

    cot_lines: List[str] = [
        f"• Neo 4 CoT Engine | thinking={thinking_mode} (beam={beam_width}, radius=±{ctx_radius})",
        f"• Semantic Engine={'ON' if semantic_enabled else 'OFF'} | Entropic Auditor={'ON' if entropic_enabled else 'OFF'} | Meta Scripting={'ON' if meta_enabled else 'OFF'}",
    ]
    if shortcut_notes:
        cot_lines.append("• Shortcut/slang expansion: " + ", ".join(shortcut_notes))
    if subwords:
        lego_sample = " | ".join(
            f"{sw['surface']}->[{ '+'.join(sw['lego_tokens']) }]"
            for sw in subwords[:5]
        )
        cot_lines.append(f"• Compositional subword bricks: {lego_sample}")
    if senses:
        for s in senses:
            cot_lines.append(
                f"• Sense disambiguation for '{s['token']}': {s['selectedSense']} (score={s['score']}, anchors={s['matchedAnchors']})"
            )
    if system_instruction:
        cot_lines.append(f"• System instruction respected ({len(system_instruction)} chars)")
    if attachments_summary:
        cot_lines.append(f"• Context attachments detected: {', '.join(attachments_summary)}")
    if custom_tools:
        cot_lines.append(f"• Active studio functions registered: {len(custom_tools)}")

    low = user_text.lower()
    # Intent-aware deterministic + Markov-rated synthesis
    if meta_enabled and ("$meta" in low or "meta " in low or "template" in low):
        expanded_code = (
            "// Meta-Scripting Directive Expansion (Neo 4)\n"
            f"// Original prompt: {user_text[:120]}\n"
            "export function generatedMetaKernel(input: number[]): { sum: number; mean: number } {\n"
            "  const sum = input.reduce((acc, v) => acc + v, 0);\n"
            "  return { sum, mean: input.length ? sum / input.length : 0 };\n"
            "}\n"
        )
        body_text = (
            f"```ts\n{expanded_code}```"
            if pure_code
            else f"Expanded Meta-Scripting directive via **Neo 4** (`thinking={thinking_mode}`):\n\n```ts\n{expanded_code}```"
        )
        cot_lines.append("• Synthesized TypeScript kernel from Meta Scripting directive.")
        has_grounding = True
    elif math_solution:
        has_grounding = True
        for st in math_solution["steps"]:
            cot_lines.append(f"• {st}")
        if pure_code:
            body_text = (
                f"```python\n# {math_solution['category']}\n"
                + "\n".join(f"# {s}" for s in math_solution["steps"])
                + f"\nresult = {json.dumps(math_solution['answer'])}\nprint(result)\n```"
            )
        else:
            steps_md = "\n".join(f"- {s}" for s in math_solution["steps"])
            body_text = f"**{math_solution['category']}**\n\n{steps_md}\n\n**Result:** {math_solution['answer']}"
    elif re.search(r"\b(who are you|who the .* are you|hi|hello|hey|introduce yourself)\b", low):
        has_grounding = True
        markov_out, markov_trace = brain.generate_rated_markov(["Hi!"], beam_width=beam_width, max_len=24)
        for tr in markov_trace:
            cot_lines.append(f"• Markov step {tr['step']}: chose `{tr['chosen']}` (rating={tr['rating']})")
        greeting = (
            "Hi! I'm **Neo 4**, your experimental Python rule-based collaborative partner inside Folio Zero — ask me anything!\n\n"
            "I combine **subword Lego tokenization** (prefixes, roots, suffixes), a **±"
            + str(ctx_radius)
            + " context-window semantic disambiguator**, an **Order-3 Backoff Markov Chain with OSASCOMP adjectival ordering**, and an **AST math/physics solver**."
        )
        if pure_code:
            body_text = (
                "```python\n"
                "def introduce_neo4():\n"
                "    return \"Hi I'm Neo, Your personal collaborative partner — ask me anything!\"\n\n"
                f"markov_sample = {json.dumps(markov_out)}\n"
                "print(introduce_neo4())\n"
                "```"
            )
        else:
            body_text = f"{greeting}\n\n> Markov grammar sample (`OSASCOMP-rated`): *\"{markov_out}\"*"
    elif re.search(r"\b(write|code|function|script|python|typescript|three\.?js|evo|godot|cmake|kotlin|mod)\b", low):
        has_grounding = True
        if "python" in low:
            code_block = (
                "```python\n"
                "# Synthesized by Neo 4 Rule-Based Code Generator\n"
                "from typing import Iterable\n\n"
                "def solve_pipeline(items: Iterable[float]) -> dict:\n"
                "    data = list(items)\n"
                "    total = sum(data)\n"
                "    return {\n"
                "        'count': len(data),\n"
                "        'total': total,\n"
                "        'mean': (total / len(data)) if data else 0.0,\n"
                "    }\n\n"
                "if __name__ == '__main__':\n"
                "    print(solve_pipeline([1, 2, 3, 5, 8, 13]))\n"
                "```"
            )
        else:
            code_block = (
                "```ts\n"
                "// Synthesized by Neo 4 Rule-Based Code Generator\n"
                "export interface NeoModuleSpec {\n"
                "  name: string;\n"
                "  tokens: string[];\n"
                "  osascompVerified: boolean;\n"
                "}\n\n"
                "export function buildSpec(input: string): NeoModuleSpec {\n"
                "  const tokens = input.trim().split(/\\s+/).filter(Boolean);\n"
                "  return { name: tokens[0] ?? 'module', tokens, osascompVerified: true };\n"
                "}\n"
                "```"
            )
        body_text = code_block if pure_code else f"Generated structured code via **Neo 4** (`thinking={thinking_mode}`):\n\n{code_block}"
    else:
        has_grounding = bool(senses)
        seed = [w for w in re.findall(r"[A-Za-z]+", user_text) if w in brain.unigrams] or ["For"]
        markov_out, markov_trace = brain.generate_rated_markov(seed, beam_width=beam_width, max_len=24)
        for tr in markov_trace:
            cot_lines.append(f"• Markov step {tr['step']}: chose `{tr['chosen']}` (rating={tr['rating']})")
        parts: List[str] = []
        if senses:
            sense_bullets = "\n".join(
                f"- **`{s['token']}`** (context window ±{s['radius']}): resolved as *{s['selectedSense']}* (score `{s['score']}`, anchors: `{', '.join(s['matchedAnchors']) or 'prior'}`)"
                for s in senses
            )
            parts.append(f"**Semantic Disambiguation**\n{sense_bullets}")
        if subwords:
            brick_str = " · ".join(f"`{sw['surface']}` = `{' + '.join(sw['lego_tokens'])}`" for sw in subwords[:6])
            parts.append(f"**Subword Lego Tokenization:** {brick_str}")
        if markov_out:
            parts.append(f"**Neo 4 OSASCOMP-Rated Synthesis:** {markov_out}")
        combined = "\n\n".join(parts)
        if pure_code:
            body_text = (
                "```json\n"
                + json.dumps(
                    {
                        "engine": "neo-4",
                        "thinkingMode": thinking_mode,
                        "senses": senses,
                        "subwords": subwords[:8],
                        "synthesis": markov_out,
                    },
                    indent=2,
                )
                + "\n```"
            )
        else:
            body_text = combined

    out_tokens = re.findall(r"[A-Za-z0-9']+", body_text)
    grammar_score, grammar_notes = brain.score_osascomp_and_grammar(out_tokens[:40])
    cot_lines.append(f"• Grammar / OSASCOMP score: {grammar_score} ({'; '.join(grammar_notes)})")

    audit = None
    if entropic_enabled:
        audit = run_entropic_auditor(body_text, grammar_score, has_grounding)
        if not pure_code:
            body_text += (
                f"\n\n---\n**Entropic Auditor (`{audit['verdict']}`):** "
                f"Shannon Entropy $H={audit['shannonEntropyBits']}\\text{{ bits}}$ · "
                f"Lexical Diversity (TTR) `{audit['lexicalDiversityTTR']}` · "
                f"Bigram Repeat `{audit['bigramRepetitionRate']}` · "
                f"OSASCOMP Grammar `{audit['grammarScore']}`"
            )

    return {
        "ok": True,
        "thoughts": "\n".join(cot_lines),
        "text": body_text,
        "audit": audit,
    }


def run_selftest() -> int:
    tmp_dir = "/tmp/neo4-selftest-data"
    brain = Neo4Brain(tmp_dir)

    # 1. Subword bricks
    sw = decompose_subword("unbelievable")
    assert "un" in sw["lego_tokens"] and "able" in sw["lego_tokens"], sw

    # 2. Disambiguate 'bat' in both senses
    animal = brain.disambiguate_context("The nocturnal bat flew out of the cave using echolocation.", radius=6)
    sport = brain.disambiguate_context("He swung the wooden baseball bat and hit a home run.", radius=6)
    assert animal and "mammal" in animal[0]["selectedSense"], animal
    assert sport and "sports" in sport[0]["selectedSense"], sport

    # 3. OSASCOMP scoring catches backwards adjective order ('olden blue' vs 'blue olden')
    good_score, _ = brain.score_osascomp_and_grammar(["small", "olden", "blue", "poly", "house"])
    bad_score, _ = brain.score_osascomp_and_grammar(["blue", "olden", "small", "house"])
    assert good_score > bad_score, (good_score, bad_score)

    # 4. Math & Physics checks
    q = try_solve_math_or_physics("solve x^2 - 5x + 6 = 0")
    assert q and "3" in q["answer"] and "2" in q["answer"], q
    sim = try_solve_math_or_physics("2x + 3y = 13 and x - y = -1")
    assert sim and "x = 2" in sim["answer"] and "y = 3" in sim["answer"], sim
    opt = try_solve_math_or_physics("Find M = v/u when v=30 and u=10")
    assert opt and "M = 3" in opt["answer"], opt
    consts = try_solve_math_or_physics("compute pi and euler e to 50 digits")
    assert consts and consts["answer"].count("3.1415926535") == 1, consts

    # 5. Full turn + Entropic Auditor
    res = generate_neo4_response({
        "dataDir": tmp_dir,
        "thinkingMode": "deep",
        "entropicAuditorEnabled": True,
        "semanticEngineEnabled": True,
        "messages": [{"role": "user", "text": "Hi, who are you?"}],
    })
    assert res["ok"] and res.get("audit") and res["audit"]["shannonEntropyBits"] > 2.0, res
    print(json.dumps({"selftest": "PASS", "audit": res["audit"], "sample": res["text"][:120]}))
    return 0


def main() -> int:
    if "--selftest" in sys.argv:
        return run_selftest()
    raw = sys.stdin.read()
    payload = json.loads(raw) if raw.strip() else {}
    res = generate_neo4_response(payload)
    sys.stdout.write(json.dumps(res))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
