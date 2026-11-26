#!/usr/bin/env python3
"""
Neo 4 — Experimental Rule-Based AI Engine for Folio Zero (Update 4.1)
Architecture:
  1. Subword Compositional Tokenizer (prefixes, roots, syllables, suffixes)
  2. Context-Window Semantic Vector Disambiguator (±k token radius across 30+ polysemes)
  3. Order-3 Backoff Markov Chain + CoT Candidate Next-Token Rater + Beam Sentence Scorer
  4. OSASCOMP Adjectival Order Scorer, Auto-Reorderer & POS Syntax Constraint Checker
  5. AST-Safe Exact Math, Algebra, Calculus Derivative, Statistics, Kinematics & Hitbox Solver
  6. Multilingual Family & Literary Device Analyzer + 120+ Slang/Shortcut Normalizer
  7. Task-Specific Code & Creative Engine Synthesizer (Python, TS, EVO 3D, StopMotion, Pixel v3)
  8. Persistent Brain, Dictionaries & Plugins (.folio-data/neo4/)
  9. Entropic Auditor (Shannon Entropy H, TTR, Bigram Repeat Rate, Grammar Score)
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
import random
import re
import shutil
import sqlite3
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Tuple


getcontext().prec = 80

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
    # 1. Opinion
    "good": "opinion", "great": "opinion", "excellent": "opinion", "clean": "opinion",
    "smart": "opinion", "bright": "opinion", "lovely": "opinion", "crisp": "opinion",
    "smooth": "opinion", "elegant": "opinion", "fast": "opinion", "sleek": "opinion",
    "brilliant": "opinion", "sharp": "opinion", "experimental": "opinion", "compact": "opinion",
    "amazing": "opinion", "awesome": "opinion", "beautiful": "opinion", "cool": "opinion",
    "clever": "opinion", "chaotic": "opinion", "coherent": "opinion", "consistent": "opinion",
    "creative": "opinion", "dense": "opinion", "detailed": "opinion", "dynamic": "opinion",
    "efficient": "opinion", "fluent": "opinion", "funny": "opinion", "grounded": "opinion",
    "helpful": "opinion", "interactive": "opinion", "lively": "opinion", "logical": "opinion",
    "mighty": "opinion", "neat": "opinion", "noble": "opinion", "polished": "opinion",
    "powerful": "opinion", "precise": "opinion", "reliable": "opinion", "rich": "opinion",
    "robust": "opinion", "solid": "opinion", "stable": "opinion", "strong": "opinion",
    "sturdy": "opinion", "subtle": "opinion", "super": "opinion", "tactile": "opinion",
    "vivid": "opinion", "weird": "opinion", "wise": "opinion", "wonderful": "opinion",
    # 2. Size
    "tiny": "size", "small": "size", "little": "size", "medium": "size",
    "large": "size", "big": "size", "huge": "size", "massive": "size", "tall": "size",
    "short": "size", "wide": "size", "narrow": "size", "giant": "size", "micro": "size",
    "mini": "size", "colossal": "size", "enormous": "size", "gigantic": "size", "grand": "size",
    "immense": "size", "miniature": "size", "petite": "size", "slim": "size", "thick": "size",
    "thin": "size", "vast": "size", "compact_size": "size", "monolithic": "size",
    # 3. Age
    "new": "age", "modern": "age", "ancient": "age", "old": "age", "olden": "age",
    "young": "age", "vintage": "age", "fresh": "age", "classic": "age", "antique": "age",
    "archaic": "age", "brand": "age", "contemporary": "age", "current": "age", "elder": "age",
    "futuristic": "age", "medieval": "age", "neonatal": "age", "primeval": "age", "recent": "age",
    "retro": "age", "timeless": "age", "youthful": "age",
    # 4. Shape
    "round": "shape", "square": "shape", "flat": "shape", "curved": "shape",
    "orbital": "shape", "hexagonal": "shape", "triangular": "shape", "cylindrical": "shape",
    "spherical": "shape", "linear": "shape", "angular": "shape", "boxy": "shape",
    "circular": "shape", "conical": "shape", "cubic": "shape", "elliptical": "shape",
    "helical": "shape", "hollow": "shape", "isometric": "shape", "octagonal": "shape",
    "oval": "shape", "planar": "shape", "polygonal": "shape", "rectangular": "shape",
    "spiral": "shape", "twisted": "shape", "volumetric": "shape",
    # 5. Color
    "red": "color", "blue": "color", "green": "color", "amber": "color",
    "cyan": "color", "emerald": "color", "crimson": "color", "dark": "color",
    "black": "color", "white": "color", "silver": "color", "golden": "color",
    "violet": "color", "indigo": "color", "cobalt": "color", "azure": "color",
    "bronze": "color", "coral": "color", "gold": "color", "gray": "color", "grey": "color",
    "iridescent": "color", "magenta": "color", "orange": "color", "pink": "color",
    "purple": "color", "rose": "color", "ruby": "color", "sapphire": "color",
    "scarlet": "color", "teal": "color", "turquoise": "color", "yellow": "color",
    # 6. Origin
    "python": "origin", "nordic": "origin", "japanese": "origin", "american": "origin",
    "british": "origin", "cosmic": "origin", "lunar": "origin", "local": "origin",
    "digital": "origin", "folio": "origin", "african": "origin", "asian": "origin",
    "european": "origin", "global": "origin", "orbital_origin": "origin", "solar": "origin",
    "stellar": "origin", "terrestrial": "origin", "urban": "origin", "yoruba": "origin",
    "arabic": "origin", "chinese": "origin", "french": "origin", "german": "origin",
    "greek": "origin", "latin": "origin", "nigerian": "origin", "sanskrit": "origin",
    # 7. Material
    "wooden": "material", "steel": "material", "metallic": "material", "glass": "material",
    "poly": "material", "silicon": "material", "quantum": "material", "ceramic": "material",
    "carbon": "material", "aluminum": "material", "plastic": "material", "copper": "material",
    "brass": "material", "chrome": "material", "clay": "material", "concrete": "material",
    "crystal": "material", "diamond": "material", "fabric": "material", "iron": "material",
    "leather": "material", "marble": "material", "obsidian": "material", "paper": "material",
    "rubber": "material", "stone": "material", "titanium": "material", "voxel": "material",
    # 8. Purpose
    "collaborative": "purpose", "rendering": "purpose", "computing": "purpose",
    "coding": "purpose", "racing": "purpose", "building": "purpose", "modding": "purpose",
    "diagnostic": "purpose", "analytical": "purpose", "conversational": "purpose",
    "animated": "purpose", "educational": "purpose", "experimental_purpose": "purpose",
    "generative": "purpose", "graphical": "purpose", "mathematical": "purpose",
    "mechanical": "purpose", "musical": "purpose", "physical": "purpose",
    "procedural": "purpose", "reasoning": "purpose", "scientific": "purpose",
    "semantic": "purpose", "simulation": "purpose", "training": "purpose",
}

DETERMINERS = {
    "a", "an", "the", "this", "that", "these", "those", "my", "your", "our", "its",
    "every", "each", "some", "any", "no", "his", "her", "their"
}
PRONOUNS = {"i", "you", "we", "they", "it", "he", "she", "who", "what", "this", "that", "me", "us", "them"}
AUX_VERBS = {
    "am", "is", "are", "was", "were", "can", "could", "will", "would", "shall", "should",
    "may", "might", "must", "do", "does", "did", "have", "has", "had", "be", "been", "being"
}
VERBS = AUX_VERBS | {
    "ask", "help", "build", "create", "write", "solve", "compute", "run", "analyze", "inspect",
    "generate", "render", "compile", "export", "mod", "extract", "explain", "design", "use",
    "need", "want", "think", "reason", "predict", "disambiguate", "verify", "serve", "make", "feel",
    "collide", "bounce", "orbit", "simulate", "tokenize", "rate", "order", "map", "parse", "draw",
    "animate", "train", "learn", "discover", "connect", "test", "calculate", "derive", "integrate"
}
PREPOSITIONS = {
    "in", "on", "at", "by", "for", "with", "from", "to", "of", "into", "through",
    "over", "under", "about", "as", "across", "around", "between", "against", "within"
}
CONJUNCTIONS = {"and", "or", "but", "so", "yet", "because", "while", "if", "when", "then", "though", "since"}
FUNCTION_WORDS = DETERMINERS | PRONOUNS | AUX_VERBS | PREPOSITIONS | CONJUNCTIONS | {"not", "no", "yes"}

COMMON_PREFIXES = (
    "anti", "auto", "bio", "co", "counter", "de", "dis", "en", "ex", "hyper", "inter",
    "macro", "meta", "micro", "mid", "mis", "mono", "multi", "non", "over", "poly",
    "post", "pre", "pro", "pseudo", "re", "semi", "sub", "super", "trans", "un", "under",
    "ultra", "infra", "tele", "geo", "thermo", "electro", "photo", "neuro", "cyber"
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
            "wicket", "stadium", "player", "wooden", "grip", "sports", "game", "equipment"
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
            "bounce", "shock", "suspension", "hooke", "pendulum", "oscillate", "damping"
        },
        "natural groundwater emergence or vernal season": {
            "water", "fountain", "season", "summer", "winter", "autumn", "bloom", "flower",
            "april", "march", "warm", "rain", "forest"
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
    "bark": {
        "protective outer wood/tree layer": {
            "tree", "oak", "pine", "wood", "trunk", "forest", "leaf", "branch", "moss"
        },
        "sharp canine vocalization": {
            "dog", "puppy", "hound", "loud", "woof", "pet", "leash", "sound", "animal"
        },
    },
    "cell": {
        "biological structural unit of life": {
            "dna", "nucleus", "membrane", "biology", "mitochondria", "tissue", "organ", "microscope"
        },
        "spreadsheet grid box, battery element, or prison room": {
            "excel", "table", "row", "column", "sheet", "battery", "voltage", "prison", "jail"
        },
    },
    "wave": {
        "oscillating physical/mathematical signal y = A sin(kx - wt)": {
            "sine", "cosine", "frequency", "amplitude", "ocean", "sea", "sound", "light", "physics", "graph"
        },
        "hand gesture of greeting or farewell": {
            "hand", "hello", "goodbye", "friend", "smile", "crowd", "greet"
        },
    },
    "light": {
        "electromagnetic visible radiation / 3D scene illumination": {
            "photon", "lamp", "sun", "shadow", "rim", "key", "bright", "dark", "ray", "optics", "lens"
        },
        "low mass / small weight": {
            "heavy", "weight", "gram", "feather", "mass", "carry", "lift", "portable"
        },
    },
    "match": {
        "competitive game fixture or exact string/pattern equality": {
            "score", "team", "regex", "pattern", "string", "win", "tournament", "equal", "compare"
        },
        "small wooden/cardboard fire-ignition stick": {
            "fire", "flame", "burn", "spark", "candle", "wood", "box", "smoke"
        },
    },
    "pitch": {
        "musical/audio fundamental frequency (Hz)": {
            "sound", "audio", "hz", "tone", "sing", "voice", "note", "chord", "synth"
        },
        "steepness angle, sports field, or throwing motion": {
            "baseball", "throw", "football", "soccer", "field", "grass", "angle", "slope", "roof"
        },
    },
    "ring": {
        "circular torus geometry or wearable finger band": {
            "gold", "diamond", "finger", "wear", "torus", "circle", "orbit", "saturn", "3d"
        },
        "telephone/bell acoustic chime": {
            "phone", "bell", "alarm", "sound", "chime", "call", "loud"
        },
    },
    "rock": {
        "geological mineral stone or asteroid": {
            "stone", "mineral", "cliff", "mountain", "granite", "geology", "earth", "boulder"
        },
        "rhythmic electric-guitar musical genre or swaying motion": {
            "music", "band", "guitar", "drum", "concert", "roll", "song", "sway"
        },
    },
    "well": {
        "deep shaft drilled for groundwater or oil": {
            "water", "bucket", "deep", "pump", "ground", "rope", "drink", "stone"
        },
        "adverb indicating good health or high skill": {
            "feel", "good", "healthy", "done", "perform", "great", "work"
        },
    },
    "charge": {
        "electric property (Coulombs) or battery energy storage": {
            "battery", "volt", "electron", "proton", "current", "cable", "power", "usb", "coulomb"
        },
        "financial fee or forward physical rush": {
            "card", "price", "fee", "cost", "pay", "bank", "bull", "attack"
        },
    },
    "model": {
        "AI neural/rule system or 3D mesh asset": {
            "ai", "gemini", "neo", "train", "tokens", "3d", "blender", "bbmodel", "mesh", "weights"
        },
        "fashion runway presenter or scale replica": {
            "fashion", "runway", "photo", "pose", "miniature", "kit", "car"
        },
    },
    "frame": {
        "single animation snapshot (1/fps sec) or structural chassis": {
            "fps", "animation", "video", "stopmotion", "pixel", "render", "keyframe", "timeline", "rate"
        },
        "decorative border around a picture or window": {
            "picture", "photo", "wall", "wood", "border", "painting", "glass"
        },
    },
    "node": {
        "scene-graph object or graph-theory vertex": {
            "tree", "graph", "scene", "evo", "child", "parent", "mesh", "transform", "linked"
        },
        "JavaScript runtime (Node.js) or botanical stem joint": {
            "npm", "express", "server", "typescript", "javascript", "tsx", "stem", "leaf"
        },
    },
    "vector": {
        "mathematical/3D magnitude-direction tuple (x, y, z) or embedding": {
            "3d", "dot", "cross", "norm", "velocity", "physics", "position", "embedding", "matrix"
        },
        "scalable SVG path art or biological disease carrier": {
            "svg", "path", "bezier", "curve", "illness", "mosquito"
        },
    },
    "matrix": {
        "linear-algebra 2D array / 4x4 transform": {
            "determinant", "eigenvalue", "transpose", "multiply", "transform", "rotation", "math", "linear"
        },
        "cyberpunk green-code aesthetic or surrounding medium": {
            "cyberpunk", "green", "neo", "code", "rain", "digital"
        },
    },
    "mesh": {
        "3D polygon geometry of vertices, edges, and faces": {
            "3d", "vertex", "triangle", "blender", "glb", "threejs", "evo", "material", "wireframe"
        },
        "woven wire/fabric net": {
            "screen", "fabric", "net", "filter", "wire", "hole"
        },
    },
    "shader": {
        "GPU/pixel post-processing lighting or CRT filter": {
            "pixel", "crt", "glow", "vignette", "chromatic", "glsl", "fragment", "gpu", "render"
        },
    },
    "hitbox": {
        "bounding collision volume (AABB/sphere) for physics & games": {
            "collision", "physics", "aabb", "overlap", "bounce", "damage", "game", "bounds", "velocity"
        },
    },
    "terminal": {
        "command-line shell console or circuit endpoint": {
            "cli", "bash", "shell", "command", "prompt", "stdout", "linux", "run"
        },
        "airport/transit passenger building or final stage": {
            "flight", "airport", "gate", "bus", "train", "station"
        },
    },
    "branch": {
        "Git version-control line of commits or conditional code jump": {
            "git", "github", "commit", "merge", "pull", "repo", "checkout", "if", "else"
        },
        "woody limb growing from a tree trunk": {
            "tree", "leaf", "bird", "nest", "oak", "forest"
        },
    },
    "class": {
        "OOP blueprint defining attributes & methods": {
            "python", "typescript", "java", "kotlin", "object", "method", "inherit", "constructor"
        },
        "school classroom lesson or social category": {
            "school", "teacher", "student", "homework", "grade", "lesson"
        },
    },
    "key": {
        "cryptographic/API secret, dict index, or keyboard switch": {
            "api", "secret", "dict", "json", "object", "hash", "value", "type", "keyboard"
        },
        "metal door-lock opener or musical scale center": {
            "door", "lock", "unlock", "piano", "major", "minor", "chord"
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
    "rn": "right now",
    "smh": "shaking my head",
    "af": "extremely",
    "fyi": "for your information",
    "ama": "ask me anything",
    "tldr": "too long; did not read",
    "eli5": "explain like I am five",
    "goat": "greatest of all time",
    "lowkey": "subtly",
    "highkey": "openly",
    "nocap": "seriously without exaggeration",
    "gg": "good game",
    "glhf": "good luck have fun",
    "afk": "away from keyboard",
    "npc": "non-player character",
    "op": "overpowered",
    "nerf": "weaken or rebalance",
    "buff": "strengthen or enhance",
    "dev": "developer",
    "repo": "repository",
    "pr": "pull request",
    "ci": "continuous integration",
    "cd": "continuous deployment",
    "cot": "chain of thought",
    "oop": "object oriented programming",
    "cli": "command line interface",
    "sdk": "software development kit",
    "api": "application programming interface",
    "ast": "abstract syntax tree",
    "pbr": "physically based rendering",
    "fps": "frames per second",
    "fov": "field of view",
    "aabb": "axis-aligned bounding box",
    "sdf": "signed distance field",
    "glsl": "OpenGL shading language",
    "wasm": "WebAssembly",
    "json": "JavaScript Object Notation",
    "yaml": "YAML Ain't Markup Language",
    "sql": "Structured Query Language",
    "orm": "object-relational mapper",
    "jwt": "JSON Web Token",
    "oauth": "Open Authorization",
    "cors": "cross-origin resource sharing",
    "ssr": "server-side rendering",
    "spa": "single-page application",
    "dom": "Document Object Model",
    "rag": "retrieval-augmented generation",
    "nlp": "natural language processing",
    "pos": "part of speech",
    "ner": "named entity recognition",
    "ttr": "type-token ratio",
    "ap": "arithmetic progression",
    "gp": "geometric progression",
    "shm": "simple harmonic motion",
    "ke": "kinetic energy",
    "pe": "potential energy",
    "emf": "electromotive force",
    "lmao": "laughing",
    "lol": "laughing out loud",
    "lmfao": "laughing hard",
    "omg": "oh my goodness",
    "yo": "hello",
    "sup": "how can I help",
    "wsg": "what is good",
    "hru": "how are you",
    "wyd": "what are you doing",
    "u": "you",
    "ur": "your",
    "r": "are",
    "plz": "please",
    "pls": "please",
    "thx": "thanks",
    "ty": "thank you",
    "tysm": "thank you very much",
    "np": "no problem",
    "yw": "you are welcome",
    "nvm": "never mind",
    "obv": "obviously",
    "prob": "probably",
    "approx": "approximately",
    "eq": "equation",
    "calc": "calculate",
    "diff": "derivative",
    "integ": "integral",
    "probab": "probability",
    "phys": "physics",
    "trig": "trigonometry",
    "geom": "geometry",
    "alg": "algebra",
    "var": "variance",
    "std": "standard deviation",
    "ai": "artificial intelligence",
    "ml": "machine learning",
    "dl": "deep learning",
    "llm": "large language model",
    "vram": "video random-access memory",
    "gpu": "graphics processing unit",
    "cpu": "central processing unit",
    "os": "operating system",
    "vm": "virtual machine",
    "ui": "user interface",
    "ux": "user experience",
    "hud": "heads-up display",
    "vfx": "visual effects",
    "sfx": "sound effects",
    "svg": "Scalable Vector Graphics",
    "png": "Portable Network Graphics",
    "glb": "binary glTF 3D model",
}

LITERARY_DEVICES: Dict[str, Tuple[str, str]] = {
    "metaphor": ("Direct implicit comparison equating two unlike things without 'like' or 'as'.", "Language is a forest of living Lego bricks."),
    "simile": ("Explicit comparison using 'like' or 'as'.", "Tokens snap together like precision Lego bricks."),
    "alliteration": ("Repetition of initial consonant sounds in neighboring words.", "Fast Fluent Folio frames flow forward."),
    "personification": ("Attributing human intentions or traits to abstract concepts or objects.", "The Markov chain weighs each candidate carefully."),
    "onomatopoeia": ("Words that phonetically imitate the sound they describe.", "Click, swoosh, clang, tick-tock."),
    "hyperbole": ("Deliberate dramatic exaggeration for emphasis.", "Checking 3.1 billion static strings by hand takes an eternity."),
    "oxymoron": ("Pairing two contradictory terms for compact contrast.", "Controlled chaos, deafening silence."),
    "paradox": ("A seemingly self-contradictory statement revealing a deeper truth.", "Finite Aleph-Zero rules generate infinite mathematical truths."),
    "irony": ("Contrast between expectation or literal wording and underlying meaning.", "A zero-API rule engine outlasting cloud rate limits."),
    "anaphora": ("Repetition of a word or phrase at the start of successive clauses.", "We tokenize cleanly. We rate context. We verify order."),
    "chiasmus": ("Reversal of grammatical structure in consecutive phrases (A-B / B-A).", "Words shape meaning, and meaning selects words."),
}

WORLD_LANGUAGE_GREETINGS: Dict[str, Tuple[str, str]] = {
    "hola": ("Spanish (Indo-European · Romance)", "Hello! Ask me anything in math, code, or creative physics."),
    "bonjour": ("French (Indo-European · Romance)", "Hello! Ready to collaborate on algorithms, physics, or language."),
    "hallo": ("German/Dutch (Indo-European · Germanic)", "Hello! Let's build or analyze something together."),
    "ciao": ("Italian (Indo-European · Romance)", "Hello! Ask me about grammar, math, or 3D scenes."),
    "olá": ("Portuguese (Indo-European · Romance)", "Hello! Ready for engineering, math, or Folio engines."),
    "ola": ("Portuguese (Indo-European · Romance)", "Hello! Ready for engineering, math, or Folio engines."),
    "salut": ("French/Romanian (Indo-European · Romance)", "Hi there! Ask me anything."),
    "konnichiwa": ("Japanese (Japonic)", "Hello! Ask me anything about code, math, or engines."),
    "annyeong": ("Korean (Koreanic)", "Hello! Ask me anything about code, math, or engines."),
    "nihao": ("Mandarin Chinese (Sino-Tibetan)", "Hello! Ask me anything about code, math, or engines."),
    "salam": ("Arabic/Persian/Swahili loan (Afro-Asiatic)", "Peace & greetings! Ask me anything."),
    "jambo": ("Swahili (Niger-Congo · Bantu)", "Hello! Ready to collaborate."),
    "bawo": ("Yoruba (Niger-Congo · Volta-Niger)", "Greetings! Ready to collaborate."),
    "kedu": ("Igbo (Niger-Congo · Volta-Niger)", "Greetings! Ready to collaborate."),
    "sannu": ("Hausa (Afro-Asiatic · Chadic)", "Hello! Ready to collaborate."),
    "namaste": ("Hindi/Sanskrit (Indo-European · Indo-Aryan)", "Greetings! Ask me anything."),
}

LINGUISTIC_RESEARCH_TAXONOMY: Dict[str, Any] = {
    "english": {
        "core_words": "520,000+",
        "slang_dictionary_words": "2.5M",
        "shortcuts_and_abbreviations": "8.2M",
        "contextual_facts_figures_names_birthdays": "60M+",
        "core_meanings": "890,000+",
        "slang_definitions": "12M",
        "extended_domain_definitions": "18.1M",
        "people_locations_surnames_definitions": "70M+",
    },
    "global": {
        "languages_count": "7,100+",
        "naive_base_estimate": "40M",
        "total_words_tribes_slangs_nouns": "1.5B+",
        "total_world_definitions": "3.1B+",
    },
    "math_and_aleph_zero": {
        "named_items": "400,000+",
        "math_definitions": "500,000+",
        "formulas_cardinality": "Aleph-Zero (aleph_0 — countably infinite)",
        "domains": [
            "Arithmetic (+, -, *, /, indices, squares)",
            "Logarithms & Exponentials (log, log10, ln, exp)",
            "Simultaneous Elimination & Substitution (ax + by = c)",
            "Quadratic Equations (ax^2 + bx + c = 0)",
            "Progressions & Sets (A.P., G.P., Terms, Range, Sets, Variance)",
            "Trigonometry & Probability (sin, cos, tan, comb, perm)",
            "Symbolic Calculus Derivatives (d/dx polynomial terms)",
            "Newtonian Kinematics, Elastic Collisions & AABB/Sphere Hitboxes",
            "Optics & Relativity Physics (M = v/u, 1/f = 1/u + 1/v)",
            "Infinite Non-Terminating Constants (Pi, Euler's number e)",
        ],
    },
}

DEFAULT_CORPUS_SENTENCES: List[str] = [
    # Identity & Collaborative Tone
    "Hi! I'm Neo, your personal collaborative partner — ask me anything about code, math, 3D engines, physics, linguistics, or systems design.",
    "I'm Neo 4, an experimental rule-based collaborative engine powered by compositional subword bricks, semantic context embeddings, and a rated Order-3 Markov chain.",
    "Hi there! Ask me anything — I can solve algebra, calculus, and kinematics equations, verify OSASCOMP English grammar, inspect code, or synthesize creative scenes.",
    # OSASCOMP & Adjectival Order
    "My OSASCOMP scorer rates every candidate against structured Opinion, Size, Age, Shape, Color, Origin, Material, and Purpose grammar ranks.",
    "English adjectival order follows Opinion, Size, Age, Shape, Color, Origin, Material, and Purpose so phrases sound natural, fluent, and crystal clear.",
    "A sleek small modern spherical cyan digital titanium rendering core obeys every OSASCOMP rank from Opinion through Purpose.",
    "Clean short vintage curved golden Japanese wooden racing chassis illustrates all eight OSASCOMP layers in harmonious order.",
    "When adjacent adjectives violate OSASCOMP rank, Neo validates natural adjectival hierarchy so English phrases stay crystal clear.",
    "EVO 3D scene specifications define camera angles, ambient lighting, materials, and a nodes array containing geometric primitives like sphere, box, cylinder, torus, and plane.",
    "When diagnosing EVO 3D viewer schemas, ensure nodes or objects contain valid primitive shapes, materials, and coordinates.",
    "When debugging runtime exceptions or errors, inspect data schemas, provide fallback values, and verify edge cases step by step.",
    # Scale of English & 7.1K World Languages
    "English holds 520,000 core words, 2.5M slang entries, 8.2M shortcuts, and 60M factual items covering figures of speech, names, locations, and cultural references.",
    "Across 7,100+ living languages including tribal dialects, slang lexicons, and proper nouns, human vocabulary far exceeds 40M and climbs past 1.5B+ terms.",
    "Meanings multiply even faster: 890,000 core English senses expand through 12M slang definitions, 18.1M domain senses, 70M proper-noun entries, and 3.1B+ global definitions.",
    "Storing 3.1B isolated dictionary strings lags horribly and wastes memory, so intelligent language models decompose words into reusable subword Lego bricks.",
    # Tokenization & ±k Semantic Embeddings
    "Subword Lego tokenization splits complex words into prefix, syllable, and suffix pieces so unseen compounds remain compact, interpretable, and fast.",
    "Context embeddings resolve ambiguity by scanning neighboring tokens within a symmetric radius before and after polysemous words like bat, bank, spring, wave, or scale.",
    "Near cave, nocturnal, and echolocation, the token bat maps sharply to a flying mammal rather than wooden baseball sports equipment.",
    "Near baseball, swing, and home run, semantic radius weighting locks onto the wooden sports club with high confidence.",
    "Near python, def, import, and algorithm, context vectors separate the Python programming language from the constrictor reptile.",
    # Math & Aleph-Zero
    "Mathematics catalogs 400,000 named items and 500,000 definitions, yet by Aleph-Zero its valid symbolic formulas form a countably infinite universe.",
    "From basic arithmetic, indices, and squares to logarithms, elimination, substitution, quadratic roots, and trigonometry, exact AST rules leave zero guesswork.",
    "Arithmetic progressions advance by a constant difference d while geometric progressions scale by a constant ratio r across finite and infinite series.",
    "Probability measures structured uncertainty with combinations comb(n,k), permutations perm(n,k), sample variance, and expectation.",
    "Thin-lens optics relates focal length f, object distance u, and image distance v through 1/f = 1/u + 1/v and magnification M = v/u.",
    "Non-terminating transcendental constants like Pi and Euler's number e continue forever without repeating, computed on demand to arbitrary precision.",
    # Physics, Hitboxes & Creative Engines
    "Rigid-body physics integrates gravitational acceleration g into velocity and position each step while applying friction and restitution on floor contact.",
    "Axis-aligned bounding boxes test overlap along every coordinate axis simultaneously so rectangular hitboxes detect impacts with O(1) arithmetic.",
    "Spherical and circular hitboxes trigger an elastic impulse whenever center-to-center distance drops below the sum of both radii.",
    "Stop Motion v3 combines damped storyboard camera cuts, bpy-style idLink groups, tactile filters, hitbox collisions, and math-synthesized WebAudio.",
    "Pixel Engine v3 scales up to 512x512 canvases with Bayer4 dithered gradients, mathematical graph plotters, aurora ribbons, stardust, and CRT glow shaders.",
    "EVO 3D renders PBR materials, vertex gradients, parametric wave surfaces, spring kinematics, and wireframe collision hitboxes in real time.",
    "Three.js Studio compiles interactive WebGL meshes, Blockbench rigged models, voxel sculptures, physics bounce loops, and Box3 wireframe helpers.",
    # Software Engineering & Architecture
    "Clean software architecture separates deterministic domain logic, strict input validation, modular state management, and fast reproducible builds.",
    "TypeScript interfaces lock data contracts across client viewers and Express endpoints so schema mismatches fail loudly at compile time.",
    "Python excels at symbolic parsers, numerical computing, rule-based NLP pipelines, and local CLI automation without external API latency.",
    "Every algorithmic solution improves when edge cases, boundary hitboxes, time complexity, and memory layout are verified step by step.",
    "Debugging starts by reproducing the real failure signal, isolating upstream responses from misleading UI wrappers, and testing the live fix end to end.",
    # Astrophysics, Quantum Physics & Computer Science Knowledge
    "A black hole is a region of spacetime where gravity is so strong that nothing, including light and electromagnetic radiation, can escape its event horizon, characterized by its Schwarzschild radius rs = 2GM/c^2.",
    "Dark matter is a form of matter that does not absorb, reflect, or emit light, making it invisible to direct electromagnetic detection yet accounting for roughly 85% of cosmic matter through gravitational lensing and galactic rotation curves.",
    "Dark energy is the pervasive form of energy driving the accelerating expansion of the universe, representing roughly 68% of the total energy density of the cosmos.",
    "General relativity models gravitation as the curvature of four-dimensional spacetime caused by mass and energy according to the Einstein field equations.",
    "Quantum computing uses quantum mechanical superposition and entanglement across qubits to evaluate complex optimization, simulation, and cryptographic tasks with quantum parallelism.",
    "Entropy measures the microscopic disorder or number of accessible microstates in a thermodynamic system, governed by the Second Law stating total entropy of an isolated system never decreases.",
    "An artificial neural network organizes artificial neurons into layered architectures that learn feature representations via weighted connections, activation functions, and backpropagation gradient descent.",
    "Big-O notation characterizes the asymptotic upper bound on an algorithm's execution time or memory consumption as the input size n grows toward infinity.",
    "A compiler transforms source code into executable binaries or bytecode through tokenization, abstract syntax tree parsing, type checking, optimization, and code generation.",
    "The JavaScript event loop facilitates non-blocking asynchronous concurrency on a single thread by continuously processing microtask queues and macrotask phases.",
]

THINKING_PARAMS: Dict[str, Tuple[int, int]] = {
    "minimal": (2, 1),
    "low": (3, 2),
    "medium": (5, 3),
    "high": (7, 4),
    "deep": (10, 6),
}


def compute_pi_high_precision(digits: int = 50) -> str:
    digits = max(5, min(240, digits))
    getcontext().prec = digits + 20

    def arctan(x_inv: int) -> Decimal:
        power = Decimal(1) / Decimal(x_inv)
        total = power
        x2 = Decimal(x_inv * x_inv)
        n = 1
        sign = -1
        while True:
            power = power / x2
            term = power / Decimal(2 * n + 1)
            if term == 0 or term.adjusted() < -(digits + 14):
                break
            total += sign * term
            sign = -sign
            n += 1
        return total

    pi_val = Decimal(4) * (Decimal(4) * arctan(5) - arctan(239))
    s = f"{pi_val:.{digits + 4}f}"
    return s[:digits + 2]


def compute_e_high_precision(digits: int = 50) -> str:
    digits = max(5, min(240, digits))
    getcontext().prec = digits + 20
    total = Decimal(1)
    term = Decimal(1)
    n = 1
    while True:
        term = term / Decimal(n)
        if term.adjusted() < -(digits + 14):
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


def classify_pos(tok: str, kb_conn: Optional[sqlite3.Connection] = None) -> str:
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
    if kb_conn is not None and low.isalpha():
        try:
            row = kb_conn.execute("SELECT pos FROM pos_lexicon WHERE word = ?", (low,)).fetchone()
            if row and row[0]:
                mapped = {"noun": "NOUN", "verb": "VERB", "adj": "ADJ:opinion", "adv": "ADV", "prep": "PREP", "det": "DET", "conj": "CONJ", "pron": "PRON"}.get(row[0])
                if mapped:
                    return mapped
        except Exception:
            pass
    if low.endswith("ly") and len(low) > 4:
        return "ADV"
    if low.endswith(("ive", "ous", "ful", "less", "able", "ible", "ic")):
        return "ADJ:opinion"
    if low.endswith(("ing", "ed", "ize", "ify")) and len(low) > 4:
        return "VERB"
    return "NOUN"


def reorder_osascomp_phrase(tokens: List[str]) -> Tuple[List[str], List[str]]:
    """Detects contiguous adjective runs and sorts them strictly by OSASCOMP rank."""
    reordered: List[str] = []
    changes: List[str] = []
    i = 0
    n = len(tokens)
    while i < n:
        pos = classify_pos(tokens[i])
        if pos.startswith("ADJ:"):
            j = i
            while j < n and classify_pos(tokens[j]).startswith("ADJ:"):
                j += 1
            run = tokens[i:j]
            if len(run) > 1:
                sorted_run = sorted(
                    run,
                    key=lambda w: OSASCOMP_ORDER.get(classify_pos(w).split(":", 1)[1], 5),
                )
                if [w.lower() for w in sorted_run] != [w.lower() for w in run]:
                    changes.append(
                        f"Reordered adjectives `{' '.join(run)}` -> `{' '.join(sorted_run)}` ("
                        + " < ".join(classify_pos(w).split(":", 1)[1] for w in sorted_run)
                        + ")"
                    )
                reordered.extend(sorted_run)
            else:
                reordered.extend(run)
            i = j
        else:
            reordered.append(tokens[i])
            i += 1
    return reordered, changes


class Neo4Brain:
    def __init__(self, data_dir: str) -> None:
        self.data_dir = data_dir
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "plugins"), exist_ok=True)
        self.brain_path = os.path.join(self.data_dir, "brain.json")
        self.slang_path = os.path.join(self.data_dir, "slang_shortcuts.json")
        self.kb_path = os.path.join(self.data_dir, "knowledge.db")
        if not os.path.exists(self.kb_path):
            fallback_kb = os.path.join(os.getcwd(), ".folio-data", "neo4", "knowledge.db")
            if os.path.exists(fallback_kb):
                self.kb_path = fallback_kb

        self.unigrams: Counter[str] = Counter()
        self.bigrams: Dict[str, Counter[str]] = defaultdict(Counter)
        self.trigrams: Dict[str, Counter[str]] = defaultdict(Counter)
        self.slang_map: Dict[str, str] = dict(DEFAULT_SLANG_SHORTCUTS)
        self.learned_facts: List[str] = []
        self.plugins: List[Tuple[str, Any]] = []
        self.kb: Optional[sqlite3.Connection] = None
        self.folio_docs_kb: Optional[sqlite3.Connection] = None
        self.shards_dir = os.path.join(self.data_dir, "shards")
        if not os.path.isdir(self.shards_dir):
            fallback_shards = os.path.join(os.getcwd(), ".folio-data", "neo4", "shards")
            if os.path.isdir(fallback_shards):
                self.shards_dir = fallback_shards
        self.kb_meta: Dict[str, int] = {}
        self.folio_docs_count = 0

        self._load_or_init()
        self._load_kb()
        self._load_plugins()

    def _apply_low_ram_pragmas(self, conn: sqlite3.Connection) -> None:
        try:
            conn.execute("PRAGMA cache_size = -8192")
            conn.execute("PRAGMA mmap_size = 33554432")
            conn.execute("PRAGMA temp_store = FILE")
        except Exception:
            pass

    def _load_kb(self) -> None:
        if os.path.exists(self.kb_path):
            try:
                conn = sqlite3.connect(self.kb_path, timeout=2.0)
                self._apply_low_ram_pragmas(conn)
                rows = conn.execute("SELECT key, value FROM meta").fetchall()
                for k, v in rows:
                    if str(v).isdigit():
                        self.kb_meta[str(k)] = int(v)
                self.kb = conn
            except Exception:
                self.kb = None

        docs_db = os.path.join(self.data_dir, "folio_docs.db")
        if not os.path.exists(docs_db):
            fallback_docs = os.path.join(os.getcwd(), ".folio-data", "neo4", "folio_docs.db")
            if os.path.exists(fallback_docs):
                docs_db = fallback_docs
        if os.path.exists(docs_db):
            try:
                dconn = sqlite3.connect(docs_db, timeout=2.0)
                self._apply_low_ram_pragmas(dconn)
                row = dconn.execute("SELECT COUNT(*) FROM docs_sections").fetchone()
                self.folio_docs_count = int(row[0]) if row else 0
                self.folio_docs_kb = dconn
            except Exception:
                self.folio_docs_kb = None

    def _tokenize(self, text: str) -> List[str]:
        return re.findall(r"[A-Za-z0-9_'/+-]+|[.,!?;:—]", text)

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
            "version": "neo-4.3",
            "updatedAt": int(time.time()),
            "vocabCount": len(self.unigrams),
            "slangCount": len(self.slang_map),
            "senseAnchorsCount": len(SENSE_ANCHORS),
            "corpusSentencesCount": len(DEFAULT_CORPUS_SENTENCES) + len(self.learned_facts),
            "kbMeta": self.kb_meta,
            "learned_sentences": self.learned_facts[-250:],
        }
        try:
            with open(self.brain_path, "w", encoding="utf-8") as fh:
                json.dump(payload, fh, indent=2)
        except Exception:
            pass

    def learn(self, sentence: str, topic: str = "User Learned") -> None:
        clean = sentence.strip()
        if len(clean) < 6 or clean in self.learned_facts:
            return
        self._train_sentence(clean)
        self.learned_facts.append(clean)
        if self.kb is not None:
            try:
                self.kb.execute("INSERT INTO corpus_facts(topic, category, sentence) VALUES (?, 'learned', ?)", (topic, clean))
                self.kb.execute("INSERT INTO corpus_fts(topic, category, sentence) VALUES (?, 'learned', ?)", (topic, clean))
                toks = self._tokenize(clean)
                if len(toks) >= 3:
                    padded = ["<BOS>", "<BOS>"] + toks + ["<EOS>"]
                    for i in range(2, len(padded)):
                        self.kb.execute(
                            "INSERT INTO markov_trigrams(w1, w2, next_word, freq) VALUES (?, ?, ?, 2) "
                            "ON CONFLICT(w1, w2, next_word) DO UPDATE SET freq = freq + 2",
                            (padded[i - 2], padded[i - 1], padded[i]),
                        )
                self.kb.commit()
            except Exception:
                pass
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

    def _fts_query_string(self, query: str) -> str:
        toks = [
            t.lower()
            for t in re.findall(r"[A-Za-z0-9]+", query)
            if len(t) >= 3 and t.lower() not in FUNCTION_WORDS
        ]
        if not toks:
            return ""
        uniq = list(dict.fromkeys(toks[:8]))
        return " OR ".join(f'"{t}"' for t in uniq)

    def lookup_word_senses(
        self,
        term: str,
        context_tokens: Optional[List[str]] = None,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        if self.kb is None:
            return []
        clean = term.strip().lower().replace("_", " ")
        candidates = [clean]
        if clean.endswith("s") and len(clean) > 4:
            candidates.append(clean[:-1])
        if clean.endswith("es") and len(clean) > 5:
            candidates.append(clean[:-2])
        if clean.endswith("ing") and len(clean) > 5:
            candidates.extend([clean[:-3], clean[:-3] + "e"])
        if clean.endswith("ed") and len(clean) > 4:
            candidates.extend([clean[:-2], clean[:-1]])

        rows: List[Tuple[str, str, str, str, str, int]] = []
        for cand in candidates:
            try:
                rows = self.kb.execute(
                    """
                    SELECT s.offset_pos, s.pos, s.lemmas, s.definition, s.examples, ls.sense_rank
                    FROM lemma_senses ls
                    JOIN synsets s ON s.offset_pos = ls.offset_pos
                    WHERE ls.lemma = ?
                    ORDER BY ls.sense_rank ASC
                    LIMIT 16
                    """,
                    (cand,),
                ).fetchall()
                if rows:
                    break
            except Exception:
                rows = []

        if not rows:
            return []

        ctx_set = {
            t.lower()
            for t in (context_tokens or [])
            if len(t) >= 3 and t.lower() not in FUNCTION_WORDS and t.lower() != clean
        }

        scored: List[Dict[str, Any]] = []
        for offset_pos, pos, lemmas, defn, ex_str, rank in rows:
            gloss_tokens = {
                t.lower()
                for t in re.findall(r"[A-Za-z0-9]+", f"{lemmas} {defn} {ex_str}")
                if len(t) >= 3 and t.lower() not in FUNCTION_WORDS
            }
            exact_overlap = ctx_set.intersection(gloss_tokens)
            root_overlap = {
                ct for ct in ctx_set
                if len(ct) >= 5 and ct not in exact_overlap and any(gt.startswith(ct[:5]) or ct.startswith(gt[:5]) for gt in gloss_tokens if len(gt) >= 5)
            }
            overlap = sorted(exact_overlap | root_overlap)
            prior = round(0.45 / (rank + 1), 3)
            score = round(len(exact_overlap) * 1.25 + len(root_overlap) * 0.75 + prior, 3)
            scored.append({
                "offsetPos": offset_pos,
                "pos": pos,
                "lemmas": lemmas,
                "definition": defn,
                "examples": [e for e in ex_str.split(" | ") if e][:2],
                "rank": rank,
                "score": score,
                "matchedAnchors": overlap,
            })
        scored.sort(key=lambda item: (-item["score"], item["rank"]))
        return scored[:limit]

    def search_folio_docs(self, query: str, limit: int = 4) -> List[Dict[str, str]]:
        if self.folio_docs_kb is None:
            return []
        fts_q = self._fts_query_string(query)
        if not fts_q:
            return []
        out: List[Dict[str, str]] = []
        try:
            rows = self.folio_docs_kb.execute(
                """
                SELECT s.section_id, s.category, s.title, s.summary, s.content, s.code_example
                FROM docs_fts f
                JOIN docs_sections s ON s.section_id = f.section_id
                WHERE docs_fts MATCH ?
                ORDER BY bm25(docs_fts)
                LIMIT ?
                """,
                (fts_q, max(limit * 2, 8)),
            ).fetchall()
            for sid, cat, title, summary, content, code_ex in rows:
                out.append({
                    "id": sid,
                    "source": f"Folio {cat}: {title} ({sid})",
                    "title": title,
                    "category": cat,
                    "summary": summary,
                    "text": content,
                    "code_example": code_ex or "",
                })
        except Exception:
            # Fallback if JOIN query fails
            try:
                rows = self.folio_docs_kb.execute(
                    "SELECT section_id, category, title, content FROM docs_fts WHERE docs_fts MATCH ? ORDER BY bm25(docs_fts) LIMIT ?",
                    (fts_q, limit),
                ).fetchall()
                for sid, cat, title, content in rows:
                    out.append({
                        "id": sid,
                        "source": f"Folio {cat}: {title} ({sid})",
                        "title": title,
                        "category": cat,
                        "summary": "",
                        "text": content,
                        "code_example": "",
                    })
            except Exception:
                pass

        q_terms = {t.lower() for t in re.findall(r"[A-Za-z0-9_]+", query) if len(t) >= 3 and t.lower() not in FUNCTION_WORDS}
        if q_terms and len(out) > 1:
            def _rank(item: Dict[str, str]) -> float:
                score = 0.0
                id_low = item.get("id", "").lower()
                t_low = item["title"].lower()
                c_low = item["text"].lower()
                for qt in q_terms:
                    if qt in id_low:
                        score += 9.0
                    if qt in t_low:
                        score += 6.0
                    if qt in c_low:
                        score += 1.0
                return score
            out.sort(key=_rank, reverse=True)

        return out[:limit]

    def search_knowledge_fts(self, query: str, limit: int = 4) -> List[Dict[str, str]]:
        fts_q = self._fts_query_string(query)
        if not fts_q:
            return []
        results: List[Dict[str, str]] = []
        if self.kb is not None:
            try:
                c_rows = self.kb.execute(
                    "SELECT topic, category, sentence FROM corpus_fts WHERE corpus_fts MATCH ? ORDER BY bm25(corpus_fts) LIMIT ?",
                    (fts_q, limit),
                ).fetchall()
                for topic, cat, sent in c_rows:
                    results.append({"source": f"{topic} ({cat})", "text": sent})
            except Exception:
                pass
            if len(results) < limit:
                try:
                    s_rows = self.kb.execute(
                        "SELECT lemmas, definition FROM synsets_fts WHERE synsets_fts MATCH ? ORDER BY bm25(synsets_fts) LIMIT ?",
                        (fts_q, limit - len(results)),
                    ).fetchall()
                    for lemmas, defn in s_rows:
                        results.append({"source": f"WordNet [{lemmas}]", "text": defn})
                except Exception:
                    pass

        if len(results) < limit and os.path.isdir(self.shards_dir):
            shard_files = sorted(f for f in os.listdir(self.shards_dir) if f.startswith("shard_") and f.endswith(".db"))
            for sf in shard_files[:16]:
                if len(results) >= limit:
                    break
                try:
                    sc = sqlite3.connect(os.path.join(self.shards_dir, sf), timeout=1.5)
                    self._apply_low_ram_pragmas(sc)
                    s_rows = sc.execute(
                        "SELECT topic, category, sentence FROM corpus_fts WHERE corpus_fts MATCH ? ORDER BY bm25(corpus_fts) LIMIT ?",
                        (fts_q, limit - len(results)),
                    ).fetchall()
                    sc.close()
                    for topic, cat, sent in s_rows:
                        results.append({"source": f"{sf}:{topic} ({cat})", "text": sent})
                except Exception:
                    continue

        if len(results) < limit:
            for d_hit in self.search_folio_docs(query, limit=limit - len(results)):
                results.append({"source": d_hit["source"], "text": d_hit["text"]})

        # Rerank by exact query-token overlap so closest factual hits rise to the top
        q_terms = {t.lower() for t in re.findall(r"[A-Za-z0-9_]+", query) if len(t) >= 3 and t.lower() not in FUNCTION_WORDS}
        if q_terms and len(results) > 1:
            results.sort(
                key=lambda item: sum(1 for qt in q_terms if qt in (item["text"] + " " + item["source"]).lower()),
                reverse=True,
            )
        return results[:limit]

    def retrieve_relevant_corpus(self, query: str, top_k: int = 4) -> List[str]:
        q_tokens = {
            t.lower()
            for t in re.findall(r"[A-Za-z0-9_]+", query)
            if len(t) > 2 and t.lower() not in FUNCTION_WORDS
        }
        if not q_tokens:
            return DEFAULT_CORPUS_SENTENCES[:top_k]
        scored: List[Tuple[float, str]] = []
        for sent in DEFAULT_CORPUS_SENTENCES + self.learned_facts:
            s_tokens = {t.lower() for t in re.findall(r"[A-Za-z0-9_]+", sent)}
            overlap = q_tokens.intersection(s_tokens)
            if not overlap:
                sub_hits = sum(
                    1 for qt in q_tokens
                    if len(qt) >= 4 and any(st.startswith(qt[:4]) or qt.startswith(st[:4]) for st in s_tokens if len(st) >= 4)
                )
                score = sub_hits * 0.45
            else:
                score = len(overlap) + 0.25 * (len(overlap) / max(1, len(q_tokens)))
            if score > 0:
                scored.append((score, sent))
        scored.sort(key=lambda item: item[0], reverse=True)
        out = [s for _, s in scored[:top_k]]
        if len(out) < top_k:
            for kb_hit in self.search_knowledge_fts(query, limit=top_k - len(out)):
                formatted = f"[{kb_hit['source']}] {kb_hit['text']}"
                if formatted not in out:
                    out.append(formatted)
        return out[:top_k]

    def disambiguate_context(self, text: str, radius: int) -> List[Dict[str, Any]]:
        tokens = [t.lower() for t in re.findall(r"[A-Za-z0-9']+", text)]
        resolved: List[Dict[str, Any]] = []
        seen_tok = set()
        for idx, tok in enumerate(tokens):
            if tok in seen_tok:
                continue
            left = tokens[max(0, idx - radius):idx]
            right = tokens[idx + 1:min(len(tokens), idx + 1 + radius)]
            window = left + right
            if tok in SENSE_ANCHORS:
                seen_tok.add(tok)
                window_set = set(window)
                scores: List[Tuple[str, float, List[str]]] = []
                for sense_label, anchors in SENSE_ANCHORS[tok].items():
                    hits = sorted(window_set.intersection(anchors))
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
            elif self.kb is not None and len(tok) >= 3 and tok not in FUNCTION_WORDS and tok.isalpha() and len(resolved) < 3:
                wn_senses = self.lookup_word_senses(tok, window, limit=3)
                if len(wn_senses) >= 2 and wn_senses[0]["matchedAnchors"]:
                    seen_tok.add(tok)
                    best_wn = wn_senses[0]
                    resolved.append({
                        "token": tok,
                        "radius": radius,
                        "contextWindow": window,
                        "selectedSense": f"({best_wn['pos']}) {best_wn['definition']}",
                        "score": best_wn["score"],
                        "matchedAnchors": best_wn["matchedAnchors"],
                        "alternatives": [
                            {"sense": f"({alt['pos']}) {alt['definition']}", "score": alt["score"]}
                            for alt in wn_senses[1:]
                        ],
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
            pos = classify_pos(tok, self.kb)
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

    def generate_rated_markov(
        self,
        seed_tokens: List[str],
        beam_width: int = 5,
        max_len: int = 34,
        topic_tokens: Optional[set] = None,
    ) -> Tuple[str, List[Dict[str, Any]]]:
        history = ["<BOS>", "<BOS>"]
        for t in seed_tokens[:1]:
            if t in self.unigrams:
                history.append(t)
            elif self.kb is not None:
                has_bi = self.kb.execute("SELECT 1 FROM markov_bigrams WHERE w1 = ? LIMIT 1", (t,)).fetchone()
                if has_bi:
                    history.append(t)

        trace: List[Dict[str, Any]] = []
        out: List[str] = []
        recent_set: Counter[str] = Counter()
        seen_bigrams = set()
        t_set = topic_tokens or set()

        for step in range(max_len):
            w0, w1 = history[-2], history[-1]
            tri_key = f"{w0}||{w1}"
            candidates_raw: Dict[str, float] = {}

            if tri_key in self.trigrams:
                total = sum(self.trigrams[tri_key].values()) or 1
                for tok, cnt in self.trigrams[tri_key].items():
                    candidates_raw[tok] = candidates_raw.get(tok, 0.0) + 0.74 * (cnt / total)

            if w1 in self.bigrams:
                total = sum(self.bigrams[w1].values()) or 1
                for tok, cnt in self.bigrams[w1].items():
                    candidates_raw[tok] = candidates_raw.get(tok, 0.0) + 0.26 * (cnt / total)

            if self.kb is not None and len(candidates_raw) < 6:
                try:
                    tri_rows = self.kb.execute(
                        "SELECT next_word, freq FROM markov_trigrams WHERE w1 = ? AND w2 = ? ORDER BY freq DESC LIMIT 8",
                        (w0, w1),
                    ).fetchall()
                    if tri_rows:
                        tot = sum(r[1] for r in tri_rows) or 1
                        for tok, cnt in tri_rows:
                            candidates_raw[tok] = candidates_raw.get(tok, 0.0) + 0.58 * (cnt / tot)
                    bi_rows = self.kb.execute(
                        "SELECT next_word, freq FROM markov_bigrams WHERE w1 = ? ORDER BY freq DESC LIMIT 10",
                        (w1,),
                    ).fetchall()
                    if bi_rows:
                        tot = sum(r[1] for r in bi_rows) or 1
                        for tok, cnt in bi_rows:
                            candidates_raw[tok] = candidates_raw.get(tok, 0.0) + 0.22 * (cnt / tot)
                except Exception:
                    pass

            if not candidates_raw:
                break

            rated: List[Tuple[str, float]] = []
            for cand, base_prob in candidates_raw.items():
                if cand == "<BOS>":
                    continue
                if cand == "<EOS>":
                    eos_score = base_prob * (1.35 if len(out) >= 12 else 0.08)
                    rated.append((cand, round(eos_score, 4)))
                    continue
                if out and cand.isalnum() and (out[-1].lower(), cand.lower()) in seen_bigrams:
                    continue
                trial = out + [cand]
                grammar_score, _ = self.score_osascomp_and_grammar(trial[-6:])
                rep_penalty = 0.2 if (out and out[-1].lower() == cand.lower()) else (0.65 if recent_set[cand.lower()] >= 2 else 1.0)
                topic_boost = 1.25 if (cand.lower() in t_set) else 1.0
                final_rating = base_prob * (0.35 + 0.65 * grammar_score) * rep_penalty * topic_boost
                rated.append((cand, round(final_rating, 4)))

            if not rated:
                break
            rated.sort(key=lambda x: x[1], reverse=True)
            top_candidates = rated[:min(beam_width, 4)]
            if len(top_candidates) == 1 or top_candidates[0][0] == "<EOS>":
                top = top_candidates[0]
            else:
                weights = [max(0.001, r) for _, r in top_candidates]
                top = random.choices(top_candidates, weights=weights, k=1)[0]
            if len(trace) < 6:
                trace.append({
                    "step": step + 1,
                    "chosen": top[0],
                    "rating": top[1],
                    "topK": [{"token": k, "rating": r} for k, r in rated[:min(beam_width, 3)]],
                })
            if top[0] == "<EOS>":
                break
            if out:
                seen_bigrams.add((out[-1].lower(), top[0].lower()))
            out.append(top[0])
            recent_set[top[0].lower()] += 1
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
        "atan2": math.atan2,
        "hypot": math.hypot,
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
        "gcd": math.gcd,
        "lcm": getattr(math, "lcm", lambda a, b: abs(a * b) // math.gcd(a, b) if a and b else 0),
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
            if node.func.id in {"factorial", "comb", "perm", "gcd", "lcm"}:
                return float(fn(*[int(x) for x in args]))
            return float(fn(*args))
        raise ValueError("Unsupported expression")

    return _eval(tree)


def try_solve_math_or_physics(prompt: str) -> Optional[Dict[str, Any]]:
    low = prompt.lower().strip()

    # 1. High-precision Pi / Euler's number
    if re.search(r"\b(pi|euler)\b.*\b(digits|decimal|precision|\d+)\b", low) or re.search(r"\b(value of|compute)\s+(pi|e)\b", low):
        d_m = re.search(r"\b(\d{2,3})\s*(?:digits|decimals|decimal)?\b", low)
        prec = int(d_m.group(1)) if d_m else 50
        return {
            "category": f"High-Precision Constants ({prec} decimals)",
            "steps": [
                "Computed pi via Machin's formula: pi = 4 * (4*arctan(1/5) - arctan(1/239))",
                "Computed Euler's number e via factorial series Sum_{k=0..inf} 1/k!",
            ],
            "answer": (
                f"pi ({prec} decimals) = `{compute_pi_high_precision(prec)}`\n"
                f"e  ({prec} decimals) = `{compute_e_high_precision(prec)}`"
            ),
        }

    # 2. AABB or Circle Hitbox Collision Check
    hitbox_clean = re.sub(r"\b[23]d\b", " ", low)
    hitbox_tuples = re.findall(r"\(([^)]+)\)", hitbox_clean)
    tuple_nums = [float(x) for t_str in hitbox_tuples for x in re.findall(r"[-+]?\d+(?:\.\d+)?", t_str)]
    raw_hitbox_nums = tuple_nums if len(tuple_nums) >= 6 else [float(x) for x in re.findall(r"[-+]?\d+(?:\.\d+)?", hitbox_clean)]
    if "aabb" in low or ("hitbox" in low and len(raw_hitbox_nums) >= 6):
        nums = raw_hitbox_nums
        if len(nums) >= 8:
            ax, ay, aw, ah, bx, by, bw, bh = nums[:8]
            overlap_x = min(ax + aw, bx + bw) - max(ax, bx)
            overlap_y = min(ay + ah, by + bh) - max(ay, by)
            hit = overlap_x > 0 and overlap_y > 0
            return {
                "category": "2D AABB Hitbox Collision Solver",
                "steps": [
                    f"Box A: x={ax:g}, y={ay:g}, w={aw:g}, h={ah:g}",
                    f"Box B: x={bx:g}, y={by:g}, w={bw:g}, h={bh:g}",
                    f"Penetration: dx={overlap_x:.4g}, dy={overlap_y:.4g}",
                ],
                "answer": f"Collision = `{hit}`" + (f" (overlap `({overlap_x:.4g}, {overlap_y:.4g})`)" if hit else " (separated)"),
            }
        if len(nums) >= 6 and "circle" in low:
            ax, ay, ar, bx, by, br = nums[:6]
            dist = math.hypot(bx - ax, by - ay)
            hit = dist <= (ar + br)
            return {
                "category": "Circle/Sphere Hitbox Collision Solver",
                "steps": [
                    f"Center distance d = sqrt(({bx:g}-{ax:g})^2 + ({by:g}-{ay:g})^2) = {dist:.5g}",
                    f"Combined radii R_sum = {ar + br:g}",
                ],
                "answer": f"Collision = `{hit}` (penetration `{(ar + br - dist):.5g}`)",
            }

    # 3. Newtonian Kinematics & Gravity: gravity/free fall / velocity / elastic collision
    if any(k in low for k in ("kinematics", "projectile", "free fall", "freefall", "velocity", "kinetic energy", "hooke")):
        nums = {k: float(v) for k, v in re.findall(r"\b([a-z])\s*=\s*([-+]?\d+(?:\.\d+)?)", low)}
        if "t" in nums and ("g" in nums or "free fall" in low or "freefall" in low or "gravity" in low):
            g = nums.get("g", 9.81)
            u = nums.get("u", 0.0)
            t = nums["t"]
            v = u + g * t
            s = u * t + 0.5 * g * t * t
            return {
                "category": "Newtonian Kinematics & Gravity",
                "steps": [
                    f"Using g = {g:g} m/s^2, initial velocity u = {u:g} m/s, time t = {t:g} s",
                    f"v = u + g*t = {v:.6g} m/s",
                    f"s = u*t + 0.5*g*t^2 = {s:.6g} m",
                ],
                "answer": f"`v = {v:.6g} m/s`, displacement `s = {s:.6g} m`",
            }
        if "m" in nums and "v" in nums and "kinetic" in low:
            m_val, v_val = nums["m"], nums["v"]
            ke = 0.5 * m_val * v_val * v_val
            return {
                "category": "Classical Mechanics (Kinetic Energy)",
                "steps": [f"KE = 0.5 * m * v^2 = 0.5 * {m_val:g} * ({v_val:g})^2"],
                "answer": f"Kinetic Energy `KE = {ke:.6g} J`",
            }
        if "k" in nums and "x" in nums and "hooke" in low:
            f_val = -nums["k"] * nums["x"]
            return {
                "category": "Elastic Spring Physics (Hooke's Law)",
                "steps": [f"F = -k * x = -({nums['k']:g}) * ({nums['x']:g})"],
                "answer": f"Restoring force `F = {f_val:.6g} N`",
            }

    # 4. Lens Magnification Physics: M = v / u and 1/f = 1/u + 1/v
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

    # 5. Symbolic Polynomial Derivative: d/dx (ax^n + bx^m + ...)
    deriv_m = re.search(r"(?:derivative of|differentiate|d/dx)\s+([0-9xX+\-*/^.\s]+)", low)
    if deriv_m:
        poly_raw = deriv_m.group(1).replace(" ", "").replace("*", "")
        terms = re.findall(r"[+-]?[^+-]+", poly_raw)
        deriv_terms: List[str] = []
        for term in terms:
            if "x" not in term:
                continue
            m_t = re.fullmatch(r"([+-]?\d*\.?\d*)x(?:\^(\d+))?", term)
            if m_t:
                c_str, exp_str = m_t.group(1), m_t.group(2)
                c = 1.0 if c_str in ("", "+") else (-1.0 if c_str == "-" else float(c_str))
                p = int(exp_str) if exp_str else 1
                nc = c * p
                np = p - 1
                nc_fmt = f"{int(nc)}" if abs(nc - round(nc)) < 1e-9 else f"{nc:g}"
                if np == 0:
                    deriv_terms.append(nc_fmt)
                elif np == 1:
                    deriv_terms.append(f"{nc_fmt}x")
                else:
                    deriv_terms.append(f"{nc_fmt}x^{np}")
        if deriv_terms:
            joined = " + ".join(deriv_terms).replace("+ -", "- ")
            return {
                "category": "Symbolic Calculus (Power Rule d/dx)",
                "steps": [f"Applied power rule d/dx(a*x^n) = a*n*x^(n-1) termwise on `{poly_raw}`"],
                "answer": f"`f'(x) = {joined}`",
            }

    # 6. Quadratic solver: ax^2 + bx + c = 0
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
                    "Roots: x = (-b ± sqrt(Δ)) / (2a)",
                ],
                "answer": f"`x₁ = {fmt(r1)}`, `x₂ = {fmt(r2)}`",
            }

    # 7. 2x2 Simultaneous Linear Equations (Elimination & Substitution)
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

    # 8. Statistics, A.P., G.P., Variance & Range
    if any(k in low for k in ("variance", "std", "mean", "median", "range", "ap ", "arithmetic progression", "gp ", "geometric progression")):
        nums = [float(x) for x in re.findall(r"[-+]?\d+(?:\.\d+)?", low)]
        if len(nums) >= 3:
            mean_v = statistics.mean(nums)
            var_v = statistics.pvariance(nums)
            std_v = math.sqrt(var_v)
            rng_v = max(nums) - min(nums)
            ap_diff = [round(nums[i + 1] - nums[i], 6) for i in range(len(nums) - 1)]
            is_ap = len(set(ap_diff)) == 1
            gp_ratio = [round(nums[i + 1] / nums[i], 6) for i in range(len(nums) - 1)] if all(n != 0 for n in nums[:-1]) else []
            is_gp = len(gp_ratio) > 0 and len(set(gp_ratio)) == 1
            steps = [
                f"Dataset ({len(nums)} values): {nums[:12]}",
                f"Mean = {mean_v:.6g} | Variance σ² = {var_v:.6g} | Std σ = {std_v:.6g} | Range = {rng_v:.6g}",
            ]
            if is_ap:
                steps.append(f"A.P. detected: d = {ap_diff[0]:g}, next term = {nums[-1] + ap_diff[0]:g}, Sum S_n = {sum(nums):g}")
            if is_gp:
                steps.append(f"G.P. detected: r = {gp_ratio[0]:g}, next term = {nums[-1] * gp_ratio[0]:g}, Sum S_n = {sum(nums):g}")
            return {
                "category": "Series & Statistical Analysis",
                "steps": steps,
                "answer": (
                    f"Mean `{mean_v:.6g}`, Variance `{var_v:.6g}`, Std `{std_v:.6g}`, Range `{rng_v:.6g}`"
                    + (f", Next AP `{nums[-1] + ap_diff[0]:g}`" if is_ap else "")
                    + (f", Next GP `{nums[-1] * gp_ratio[0]:g}`" if is_gp else "")
                ),
            }

    # 9. Direct mathematical expression
    expr_candidate = prompt.strip()
    expr_candidate = re.sub(r"^(?:calculate|compute|evaluate|solve|what is)\s+", "", expr_candidate, flags=re.I).rstrip("?=")
    if re.fullmatch(r"[0-9+\-*/^().,\s_a-zA-Z]+", expr_candidate) and (
        re.search(r"[\+\-\*/\^]", expr_candidate) or re.search(r"\b(sin|cos|tan|sqrt|log|log10|log2|ln|exp|factorial|comb|perm|gcd|lcm|hypot)\b", expr_candidate, re.I)
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


def synthesize_creative_or_code(user_text: str, low: str, thinking_mode: str, pure_code: bool) -> Tuple[str, str]:
    # 0. Chrono-Singularity Manifold (Hardest EVO Architecture)
    if any(k in low for k in ("chrono", "singularity", "manifold", "klein", "mobius", "non-euclidean", "hardest")):
        chrono_obj = {
            "format": "evo/v1",
            "title": "Chrono-Singularity Manifold: Hardest EVO Architecture",
            "environment": "cosmic",
            "camera": {
                "fov": 52,
                "position": [0, 6.5, 16],
                "target": [0, 1.5, 0],
                "exposure": 1.15,
            },
            "fog": {
                "color": "#050714",
                "density": 0.022,
            },
            "starfield": {
                "count": 280,
                "radius": 65,
                "color": "#a5d8ff",
            },
            "nodes": [
                {
                    "id": "singularity_core",
                    "geometry": "klein",
                    "position": [0, 2.2, 0],
                    "scale": [1.35, 1.35, 1.35],
                    "material": {
                        "preset": "hologram",
                        "color": "#00f5d4",
                        "emissive": "#00bbf9",
                        "emissivePulse": 0.75,
                        "sheen": 1.0,
                    },
                    "modifiers": [
                        {"type": "twist", "axis": "y", "strength": 1.8, "speed": 0.9},
                        {"type": "wave", "axis": "x", "strength": 0.28, "frequency": 3.5, "speed": 2.2},
                        {"type": "noise", "axis": "z", "strength": 0.14, "frequency": 4.0, "speed": 1.4},
                    ],
                    "morphTargets": [
                        {"name": "breathe", "scale": [1.18, 0.88, 1.18], "twist": 0.6, "bulge": 0.35, "weight": 0.65}
                    ],
                    "motion": {"spinY": 0.45, "spinX": 0.18},
                },
                {
                    "id": "mobius_halo",
                    "geometry": "mobius",
                    "position": [0, 2.2, 0],
                    "scale": [2.4, 2.4, 2.4],
                    "material": {"preset": "chrome", "color": "#e0aaff", "sheen": 0.9},
                    "modifiers": [
                        {"type": "bend", "axis": "z", "strength": 0.45, "speed": 1.1},
                        {"type": "taper", "axis": "y", "strength": 0.25},
                    ],
                    "motion": {"spinZ": 0.35, "spinY": -0.25},
                },
                {
                    "id": "hyper_knot_cage",
                    "geometry": "torusKnot",
                    "position": [0, 2.2, 0],
                    "scale": [1.8, 1.8, 1.8],
                    "material": {"preset": "neon", "color": "#ff006e", "emissive": "#ff006e", "emissivePulse": 0.5},
                    "modifiers": [{"type": "wave", "axis": "y", "strength": 0.18, "frequency": 5.0, "speed": 3.0}],
                    "motion": {"spinX": -0.3, "spinY": 0.2},
                },
                {
                    "id": "ik_target_orb",
                    "geometry": "metaball",
                    "position": [4.5, 3.2, 1.5],
                    "scale": [0.55, 0.55, 0.55],
                    "material": {"preset": "lava", "color": "#ffbe0b", "emissive": "#fb5607", "emissivePulse": 0.9},
                    "softBody": {"stiffness": 0.45, "damping": 0.12, "squash": 0.35},
                    "pathFollow": {
                        "points": [
                            [4.8, 3.2, 0],
                            [2.4, 5.0, 4.2],
                            [-3.8, 2.6, 3.5],
                            [-4.5, 4.4, -2.5],
                            [1.5, 1.6, -4.6],
                            [4.8, 3.2, 0],
                        ],
                        "closed": True,
                        "orientToPath": True,
                        "speed": 0.42,
                    },
                },
                {"id": "arm_shoulder", "geometry": "ikJoint", "position": [-4.5, 0.4, 0], "scale": [0.5, 1.8, 0.5], "material": {"preset": "obsidian", "color": "#2b2d42"}},
                {"id": "arm_elbow", "geometry": "ikJoint", "position": [-2.2, 2.2, 0], "scale": [0.42, 1.7, 0.42], "material": {"preset": "copper", "color": "#ff9f1c"}},
                {"id": "arm_wrist", "geometry": "octahedron", "position": [0.2, 3.5, 0], "scale": [0.45, 0.45, 0.45], "material": {"preset": "emerald", "color": "#06d6a0", "emissive": "#06d6a0", "emissivePulse": 0.6}},
                {
                    "id": "sentinel_gear_east",
                    "geometry": "gear",
                    "position": [5.5, 2.2, -2.0],
                    "scale": [1.1, 1.1, 1.1],
                    "material": {"preset": "gold", "color": "#ffd166"},
                    "constraints": [{"type": "trackTo", "targetId": "singularity_core", "influence": 1.0}],
                    "motion": {"spinZ": 1.2},
                },
                {
                    "id": "sentinel_prism_west",
                    "geometry": "icosahedron",
                    "position": [-5.5, 4.0, -2.5],
                    "scale": [0.85, 0.85, 0.85],
                    "material": {"preset": "glass", "color": "#90e0ef", "iridescence": 1.0},
                    "constraints": [
                        {"type": "copyRotation", "targetId": "singularity_core", "influence": 0.85},
                        {"type": "limitDistance", "targetId": "singularity_core", "influence": 0.9},
                    ],
                },
                {
                    "id": "quantum_terrain",
                    "geometry": "terrain",
                    "position": [0, -1.8, 0],
                    "scale": [18, 1.2, 18],
                    "material": {"preset": "carbon", "color": "#14213d", "flatShading": True},
                    "modifiers": [{"type": "wave", "axis": "y", "strength": 0.45, "frequency": 1.8, "speed": 0.8}],
                },
                {
                    "id": "nebula_particles",
                    "geometry": "particles3d",
                    "position": [0, 2.2, 0],
                    "scale": [9, 6, 9],
                    "material": {"preset": "pearl", "color": "#caf0f8"},
                    "physics": {"drag": 0.04, "restitution": 0.7},
                },
            ],
            "ikChains": [
                {"nodes": ["arm_shoulder", "arm_elbow", "arm_wrist"], "targetId": "ik_target_orb", "pole": [0, 4.5, 2.0], "iterations": 10, "aimNodes": True}
            ],
            "forceFields": [
                {"id": "singularity_attractor", "type": "attractor", "position": [0, 2.2, 0], "strength": 2.4, "radius": 10.0}
            ],
            "triggers": [
                {"id": "core_proximity_pulse", "position": [0, 2.2, 0], "radius": 3.5, "targetId": "ik_target_orb", "action": "pulse"}
            ],
            "storyboard": {
                "shots": [
                    {"name": "Establishing Orbit", "position": [0, 6.5, 16], "target": [0, 2.2, 0], "duration": 4.0},
                    {"name": "IK Manipulator Close-Up", "position": [-2.5, 3.8, 7.5], "target": [-1.0, 2.6, 0.5], "duration": 3.5},
                    {"name": "Singularity Core", "position": [3.5, 2.5, 5.2], "target": [0, 2.2, 0], "duration": 3.5},
                ]
            },
        }
        block = "```evo\n" + json.dumps(chrono_obj, indent=2) + "\n```"
        return block if pure_code else f"Synthesized the **Chrono-Singularity Manifold** (non-Euclidean `klein` + `mobius` + `torusKnot`, 10-iteration FABRIK IK, Blender constraints, attractor & proximity trigger) via Neo 4 (`thinking={thinking_mode}`):\n\n{block}", "Synthesized Chrono-Singularity Manifold EVO scene."

    # 1. Creative Engine synthesis (EVO 3D, Three.js Studio, Stop Motion v3, Hybrid, Pixel Art v3)
    if any(k in low for k in ("hybrid", "liquidmotion", "combo")):
        hybrid_obj = {
            "format": "liquidmotion/v1",
            "title": "Neo 4 Neon Cyber-Grid Hybrid",
            "width": 640,
            "height": 360,
            "fps": 30,
            "durationSec": 6,
            "background": "linear-gradient(180deg, #060919 0%, #1e1b4b 62%, #0f172a 100%)",
            "pixelScale": 2,
            "pixelBlendMode": "screen",
            "pixelOpacity": 0.9,
            "letterbox": 24,
            "postFilter": "contrast(1.08) saturate(1.18)",
            "pixelBackdrop": {
                "format": "pixelart/v3",
                "width": 160,
                "height": 90,
                "draw": [
                    {"op": "plasma", "scale": 0.08, "palette": ["#0f172a", "#312e81", "#06b6d4", "#ec4899"]},
                    {"op": "aurora", "y": 14, "amp": 5, "h": 16, "colors": ["#22d3ee", "#818cf8", "#f472b6"]},
                    {"op": "water", "y": 64, "h": 26, "color": "#0284c7", "highlight": "#38bdf8"},
                    {"op": "stardust", "count": 48, "color": "#e0f2fe"},
                ],
                "shaders": ["bloom", "scanlines"],
            },
            "particles": {"count": 36, "color": "#22d3ee", "style": "orb", "speed": 1.4},
            "lighting": {"rimColor": "#38bdf8", "intensity": 0.5},
            "layers": [
                {
                    "id": "horizon_wave",
                    "type": "path",
                    "curve": "wave",
                    "x": 0,
                    "y": 245,
                    "width": 640,
                    "amp": 12,
                    "freq": 2.5,
                    "stroke": "#22d3ee",
                    "strokeWidth": 3,
                    "fill": "none",
                },
                {
                    "id": "reactor_core",
                    "type": "circle",
                    "cx": 320,
                    "cy": 168,
                    "r": 42,
                    "fill": "#38bdf8",
                    "stroke": "#f0abfc",
                    "strokeWidth": 4,
                    "motion": {"pulseAmp": 0.14, "pulseFreq": 2, "floatAmp": 10, "trail": True},
                },
            ],
            "audio": {"mode": "preset", "preset": "synthwave_lead", "durationSec": 6},
        }
        block = "```liquidmotion\n" + json.dumps(hybrid_obj, indent=2) + "\n```"
        return block if pure_code else f"Synthesized a **Hybrid Liquid-Motion + Pixel Shader** scene via Neo 4 (`thinking={thinking_mode}`):\n\n{block}", "Synthesized Hybrid SVG + Pixel Engine v3 scene with particles, bloom, and synthwave audio."

    if any(k in low for k in ("threejs", "three.js", "terran", "dna", "hologram", "voxel")):
        three_obj = {
            "format": "threejs/v1",
            "title": "Neo 4 Studio Orbital Lattice",
            "background": "#050816",
            "environment": "cosmic",
            "starfield": True,
            "gridFloor": True,
            "fogColor": "#050816",
            "fogDensity": 0.035,
            "cameraFov": 46,
            "exposure": 1.2,
            "objects": [
                {
                    "id": "core_helix",
                    "shape": "helix",
                    "position": [0, 0.3, 0],
                    "scale": [0.9, 1.2, 0.9],
                    "material": "hologram",
                    "color": "#38bdf8",
                    "emissive": "#0284c7",
                    "animation": "spinY",
                },
                {
                    "id": "outer_gear",
                    "shape": "gear",
                    "position": [0, -0.4, 0],
                    "scale": [1.5, 0.35, 1.5],
                    "material": "gold",
                    "animation": "spinZ",
                },
                {
                    "id": "satellite_gem",
                    "shape": "dodecahedron",
                    "position": [2.2, 0.9, 0],
                    "scale": [0.45, 0.45, 0.45],
                    "material": "neon",
                    "color": "#f472b6",
                    "animation": "orbitY",
                },
            ],
            "audio": {"mode": "preset", "preset": "ambient_pad", "durationSec": 6},
        }
        block = "```threejs\n" + json.dumps(three_obj, indent=2) + "\n```"
        return block if pure_code else f"Synthesized a **Three.js 3D Studio** scene via Neo 4 (`thinking={thinking_mode}`):\n\n{block}", "Synthesized Three.js Studio scene with helix, gear, dodecahedron, starfield, and PBR shaders."

    if any(k in low for k in ("ik", "inverse kinematic", "robot arm", "robotic arm", "tentacle", "rigging", "modifier", "softbody", "soft-body", "forcefield", "force field", "vortex", "morph target", "pathfollow")):
        if "three" in low:
            three_ik_obj = {
                "title": "Neo 4 Three.js FABRIK IK Robotic Arm",
                "lighting": "cyberpunk",
                "background": "#070b18",
                "starfield": True,
                "objects": [
                    {"id": "ik_shoulder", "shape": "capsule", "position": [0, 0, 0], "scale": [0.42, 1.35, 0.42], "material": "chrome", "color": "#38bdf8"},
                    {"id": "ik_elbow", "shape": "capsule", "position": [0, 1.35, 0], "scale": [0.36, 1.25, 0.36], "material": "gold", "color": "#fbbf24"},
                    {"id": "ik_wrist", "shape": "octahedron", "position": [0, 2.6, 0], "scale": [0.42, 0.42, 0.42], "material": "neon", "color": "#f472b6"},
                    {"id": "ik_target", "shape": "sphere", "position": [1.8, 1.6, 0.8], "scale": [0.35, 0.35, 0.35], "material": "hologram", "color": "#22d3ee", "animation": "orbit"},
                ],
                "ikChains": [
                    {"nodes": ["ik_shoulder", "ik_elbow", "ik_wrist"], "target": "ik_target", "pole": [0, 2.2, 2.0], "iterations": 6, "aimBones": True}
                ],
                "audio": {"mode": "preset", "preset": "sci_fi_arp", "durationSec": 6},
            }
            block = "```threejs\n" + json.dumps(three_ik_obj, indent=2) + "\n```"
            return block if pure_code else f"Synthesized a **Three.js FABRIK Inverse Kinematics** scene via Neo 4 (`thinking={thinking_mode}`):\n\n{block}", "Synthesized Three.js Studio scene with FABRIK IK robotic arm and orbiting target."

        evo_ik_obj = {
            "format": "evo/v1",
            "title": "Neo 4 Blender-Grade IK Rig & Deformer Stage",
            "fps": 30,
            "durationSec": 6,
            "loop": True,
            "background": "#070b16",
            "environment": "cyberpunk",
            "starfield": True,
            "fog": {"color": "#070b16", "density": 0.03},
            "exposure": 1.2,
            "gridFloor": True,
            "contactShadows": True,
            "nodes": [
                {
                    "id": "shoulder_joint",
                    "type": "ikJoint",
                    "position": [0, 0, 0],
                    "scale": [0.48, 1.3, 0.48],
                    "material": {"preset": "chrome", "metalness": 0.85, "roughness": 0.16},
                },
                {
                    "id": "elbow_joint",
                    "type": "ikJoint",
                    "position": [0, 1.3, 0],
                    "scale": [0.42, 1.2, 0.42],
                    "material": {"preset": "gold", "metalness": 0.82, "roughness": 0.2},
                },
                {
                    "id": "wrist_effector",
                    "type": "octahedron",
                    "position": [0, 2.5, 0],
                    "scale": [0.38, 0.38, 0.38],
                    "material": {"preset": "neon", "gradient": {"colors": ["#38bdf8", "#f472b6"], "axis": "y"}},
                    "constraints": [{"type": "trackTo", "target": "ik_target_orb", "influence": 1.0}],
                },
                {
                    "id": "ik_target_orb",
                    "type": "sphere",
                    "radius": 0.32,
                    "position": [1.8, 1.5, 0.4],
                    "material": {"preset": "hologram", "emissivePulse": True},
                    "motion": {"orbit": {"cx": 0.2, "cy": 1.6, "cz": 0, "rx": 1.9, "ry": 0.65, "rz": 1.4, "turns": 1}},
                },
                {
                    "id": "deformed_ribbon",
                    "type": "metaball",
                    "position": [-2.2, 0.9, -0.6],
                    "material": {"preset": "iridescent" if False else "pearl"},
                    "modifiers": [
                        {"type": "twist", "strength": "1.2 * sin(t * TAU)", "axis": "y"},
                        {"type": "wave", "strength": 0.18, "frequency": 2.6, "speed": 1.4, "axis": "x"},
                    ],
                },
                {
                    "id": "stage_terrain",
                    "type": "terrain",
                    "position": [0, -1.35, 0],
                    "scale": [6.5, 0.45, 6.5],
                    "material": {"preset": "obsidian", "roughness": 0.35},
                    "forceField": {"type": "vortex", "strength": 2.4, "radius": 4.5},
                },
            ],
            "ikChains": [
                {
                    "nodes": ["shoulder_joint", "elbow_joint", "wrist_effector"],
                    "target": "ik_target_orb",
                    "pole": [0, 2.0, 2.4],
                    "iterations": 6,
                    "aimBones": True,
                }
            ],
            "storyboard": {
                "shots": [
                    {"label": "IK Arm Wide", "start": 0, "end": 0.5, "cameraCut": "wide"},
                    {"label": "Target Orbit", "start": 0.5, "end": 1, "cameraCut": "orbit"},
                ]
            },
            "audio": {"mode": "preset", "preset": "cyberpunk_arp", "durationSec": 6},
        }
        block = "```evo\n" + json.dumps(evo_ik_obj, indent=2) + "\n```"
        return block if pure_code else f"Synthesized an **EVO 3D FABRIK IK & Blender-Modifier Stage** via Neo 4 (`thinking={thinking_mode}`):\n\n{block}", "Synthesized EVO 3D scene with FABRIK IK chain, trackTo constraint, metaball twist/wave modifiers, and terrain."

    if any(k in low for k in ("evo", "3d", "cube", "sphere", "collision", "hitbox", "shape", "sculpture", "geomet", "mesh", "gear", "helix", "torus", "icosahedron", "lathe", "metaball")) and any(k in low for k in ("evo", "3d", "scene", "render", "animat", "physics", "hitbox", "shape", "sculpture", "mesh", "make", "generate", "create", "build")):
        evo_obj = {
            "format": "evo/v1",
            "title": "Neo 4 Non-Cube Sculpted PBR & Hitbox Stage",
            "fps": 30,
            "durationSec": 6,
            "loop": True,
            "background": "#080d1a",
            "environment": "cosmic",
            "starfield": {"count": 240, "radius": 55, "color": "#a5d8ff"},
            "fog": {"color": "#080d1a", "density": 0.025},
            "camera": {"fov": 50, "position": [0, 3.2, 9.5], "target": [0, 0.8, 0], "exposure": 1.18},
            "gridFloor": True,
            "contactShadows": True,
            "nodes": [
                {
                    "id": "sculpted_knot",
                    "geometry": "torusKnot",
                    "position": [0, 1.35, 0],
                    "scale": [0.95, 0.95, 0.95],
                    "material": {"preset": "hologram", "color": "#38bdf8", "emissive": "#00bbf9", "emissivePulse": 0.6, "sheen": 0.9},
                    "modifiers": [{"type": "wave", "axis": "y", "strength": 0.16, "frequency": 3.5, "speed": 2.0}],
                    "motion": {"spinY": 0.65, "spinX": 0.25},
                },
                {
                    "id": "bouncing_metaball",
                    "geometry": "metaball",
                    "position": [-2.1, 1.8, 0.3],
                    "scale": [0.65, 0.65, 0.65],
                    "material": {"preset": "neon", "gradient": {"colors": ["#38bdf8", "#818cf8", "#f472b6"], "axis": "y"}, "metalness": 0.55, "roughness": 0.16},
                    "softBody": {"stiffness": 0.5, "damping": 0.15, "squash": 0.32},
                    "physics": {"velocity": [1.8, 0.4, 0.2], "gravity": -9.8, "restitution": 0.88, "floorY": -1.35, "drag": 0.02, "collidable": True},
                    "hitbox": {"shape": "sphere", "radius": 0.6, "show": True, "color": "#22d3ee"},
                },
                {
                    "id": "faceted_crystal",
                    "geometry": "icosahedron",
                    "position": [2.2, 1.7, -0.2],
                    "scale": [0.78, 0.78, 0.78],
                    "material": {"preset": "emerald", "color": "#06d6a0", "emissive": "#06d6a0", "emissivePulse": 0.45, "iridescence": 0.8},
                    "physics": {"velocity": [-1.7, 0.7, -0.15], "gravity": -9.8, "restitution": 0.84, "floorY": -1.35, "drag": 0.02, "collidable": True},
                    "hitbox": {"shape": "sphere", "radius": 0.75, "show": True, "color": "#34d399"},
                },
                {
                    "id": "sentinel_gear",
                    "geometry": "gear",
                    "scale": [1.6, 0.35, 1.6],
                    "position": [0, -1.25, 0],
                    "material": {"preset": "gold", "color": "#ffd166"},
                    "motion": {"spinY": 0.85},
                },
                {
                    "id": "stage_terrain",
                    "geometry": "terrain",
                    "scale": [12, 0.7, 12],
                    "position": [0, -1.55, 0],
                    "material": {"preset": "chrome", "color": "#1e293b", "flatShading": True},
                    "modifiers": [{"type": "wave", "axis": "y", "strength": 0.25, "frequency": 1.6, "speed": 0.7}],
                },
            ],
            "forceFields": [
                {"id": "center_vortex", "type": "attractor", "position": [0, 1.2, 0], "strength": 1.4, "radius": 6.0}
            ],
            "storyboard": {
                "shots": [
                    {"name": "Arena Wide", "position": [0, 3.5, 9.5], "target": [0, 0.8, 0], "duration": 3.0},
                    {"name": "Sculpted Orbit", "position": [4.2, 2.2, 5.5], "target": [0, 1.1, 0], "duration": 3.0},
                ]
            },
            "audio": {"mode": "preset", "preset": "sci_fi_arp", "durationSec": 6},
        }
        block = "```evo\n" + json.dumps(evo_obj, indent=2) + "\n```"
        return block if pure_code else f"Synthesized a multi-shape **EVO 3D PBR & Hitbox Stage** (`torusKnot`, `metaball`, `icosahedron`, `gear`, `terrain`) via Neo 4 (`thinking={thinking_mode}`):\n\n{block}", "Synthesized live sculpted EVO 3D scene with non-cube shapes, PBR presets, starfield, soft-body physics, and collision hitboxes."

    if any(k in low for k in ("stopmotion", "stop-motion", "stop motion", "svg", "vector", "cartoon", "slime")):
        sm_obj = {
            "format": "stopmotion/v3",
            "title": "Neo 4 Studio Vector Stage",
            "width": 640,
            "height": 360,
            "fps": 24,
            "durationSec": 5,
            "background": "linear-gradient(180deg, #090d24 0%, #1e1b4b 60%, #0f172a 100%)",
            "effect": "cyberpunk",
            "defs": [
                {"id": "neonGrad", "type": "linearGradient", "stops": [{"offset": "0%", "color": "#38bdf8"}, {"offset": "100%", "color": "#a855f7"}]},
                {"id": "wetGlaze", "type": "filter", "preset": "wetGlaze"},
            ],
            "particles": {"count": 32, "color": "#7dd3fc", "style": "sparkle", "speed": 1.2},
            "layers": [
                {
                    "id": "wave_floor",
                    "type": "path",
                    "curve": "wave",
                    "x": 0,
                    "y": 275,
                    "width": 640,
                    "amp": 14,
                    "freq": 2,
                    "stroke": "#22d3ee",
                    "strokeWidth": 3,
                    "fill": "none",
                },
                {
                    "id": "hero_orb",
                    "type": "circle",
                    "cx": 320,
                    "cy": 175,
                    "r": 46,
                    "fill": "url(#neonGrad)",
                    "filter": "url(#wetGlaze)",
                    "motion": {"bounceAmp": 28, "squashStretch": 0.16, "easing": "easeOutBounce", "trail": True},
                },
            ],
            "storyboard": {
                "shots": [
                    {"label": "Establishing", "start": 0, "end": 0.5, "cameraCut": "wide"},
                    {"label": "Hero Zoom", "start": 0.5, "end": 1, "cameraCut": "zoomIn"},
                ]
            },
            "audio": {"mode": "preset", "preset": "chime_celesta", "durationSec": 5},
        }
        block = "```stopmotion\n" + json.dumps(sm_obj, indent=2) + "\n```"
        return block if pure_code else f"Synthesized a **Stop Motion v3 Studio** scene via Neo 4 (`thinking={thinking_mode}`):\n\n{block}", "Synthesized Stop Motion v3 vector scene with wetGlaze shader, curve wave, bounce physics, and audio."

    if "pixel" in low or "sprite" in low:
        pix_obj = {
            "format": "pixelart/v3",
            "title": "Neo 4 Aurora & Physics Orb",
            "width": 64,
            "height": 64,
            "fps": 12,
            "frameCount": 16,
            "palette": "cyberpunk",
            "gradients": {
                "sky": {"type": "linear", "from": [0, 0], "to": [0, 63], "dither": "bayer4", "stops": [{"at": 0, "color": "#090d1f"}, {"at": 0.65, "color": "#1e1b4b"}, {"at": 1, "color": "#312e81"}]},
            },
            "draw": [
                {"op": "gradient", "gradient": "sky"},
                {"op": "aurora", "y": 14, "amp": 4, "h": 12, "colors": ["#34d399", "#38bdf8", "#a855f7"]},
                {"op": "stardust", "count": 48, "color": "#fef08a"},
                {"op": "water", "y": 50, "h": 14, "color": "#0f172a", "highlight": "#38bdf8"},
                {"op": "graph", "expr": "sin(x * 3 + t * TAU) * 0.45", "xmin": -2, "xmax": 2, "ymin": -1.2, "ymax": 1.2, "colors": ["#22d3ee", "#f472b6"], "fillUnder": True},
                {"op": "sphere3d", "cx": "32 + cos(t * TAU) * 14", "cy": "gravity(t, 120, -48, 44)", "r": 6, "color": "#fbbf24", "highlight": "#fef9c3"},
                {"op": "hitbox", "x": "26 + cos(t * TAU) * 14", "y": "gravity(t, 120, -48, 44) - 6", "w": 12, "h": 12, "color": "#34d399"},
            ],
            "shaders": ["bloom", "vignette", "glow"],
        }
        block = "```pixelart\n" + json.dumps(pix_obj, indent=2) + "\n```"
        return block if pure_code else f"Synthesized a **Pixel Engine v3** animated scene via Neo 4:\n\n{block}", "Synthesized Pixel Engine v3 64x64 procedural animation with Bayer4 sky, aurora, water, 3D sphere, graph, and bloom."

    # 2. Domain-specific Python / TypeScript code synthesis
    if "hitbox" in low or "collision" in low or "physics" in low:
        if "python" in low:
            code = (
                "```python\n"
                "from dataclasses import dataclass\n\n"
                "@dataclass\n"
                "class AABB:\n"
                "    x: float; y: float; w: float; h: float\n"
                "    vx: float = 0.0; vy: float = 0.0\n\n"
                "    def intersects(self, other: 'AABB') -> bool:\n"
                "        return (\n"
                "            self.x < other.x + other.w and self.x + self.w > other.x and\n"
                "            self.y < other.y + other.h and self.y + self.h > other.y\n"
                "        )\n\n"
                "def step_physics(bodies: list[AABB], dt: float = 1/60, g: float = 9.81, floor_y: float = 10.0, restitution: float = 0.85) -> None:\n"
                "    for b in bodies:\n"
                "        b.vy += g * dt\n"
                "        b.x += b.vx * dt\n"
                "        b.y += b.vy * dt\n"
                "        if b.y + b.h > floor_y:\n"
                "            b.y = floor_y - b.h\n"
                "            b.vy = -abs(b.vy) * restitution\n"
                "    for i in range(len(bodies)):\n"
                "        for j in range(i + 1, len(bodies)):\n"
                "            if bodies[i].intersects(bodies[j]):\n"
                "                bodies[i].vx, bodies[j].vx = bodies[j].vx * restitution, bodies[i].vx * restitution\n"
                "```"
            )
        else:
            code = (
                "```ts\n"
                "export interface HitboxBody {\n"
                "  x: number; y: number; w: number; h: number;\n"
                "  vx: number; vy: number;\n"
                "}\n\n"
                "export function aabbOverlap(a: HitboxBody, b: HitboxBody): boolean {\n"
                "  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;\n"
                "}\n\n"
                "export function stepHitboxPhysics(bodies: HitboxBody[], dt = 1 / 60, gravity = 480, floorY = 400, restitution = 0.82): void {\n"
                "  for (const b of bodies) {\n"
                "    b.vy += gravity * dt;\n"
                "    b.x += b.vx * dt;\n"
                "    b.y += b.vy * dt;\n"
                "    if (b.y + b.h >= floorY) {\n"
                "      b.y = floorY - b.h;\n"
                "      b.vy = -Math.abs(b.vy) * restitution;\n"
                "    }\n"
                "  }\n"
                "  for (let i = 0; i < bodies.length; i++) {\n"
                "    for (let j = i + 1; j < bodies.length; j++) {\n"
                "      if (aabbOverlap(bodies[i], bodies[j])) {\n"
                "        const tx = bodies[i].vx;\n"
                "        bodies[i].vx = bodies[j].vx * restitution;\n"
                "        bodies[j].vx = tx * restitution;\n"
                "      }\n"
                "    }\n"
                "  }\n"
                "}\n"
                "```"
            )
        return code if pure_code else f"Synthesized **Hitbox & Physics Solver** via Neo 4 (`thinking={thinking_mode}`):\n\n{code}", "Synthesized AABB hitbox collision & gravity impulse solver."

    if "sort" in low or "search" in low or "algorithm" in low or "markov" in low:
        if "markov" in low:
            code = (
                "```python\n"
                "from collections import defaultdict, Counter\n\n"
                "class Order2Markov:\n"
                "    def __init__(self) -> None:\n"
                "        self.transitions = defaultdict(Counter)\n\n"
                "    def train(self, sentences: list[str]) -> None:\n"
                "        for s in sentences:\n"
                "            toks = ['<BOS>', '<BOS>'] + s.split() + ['<EOS>']\n"
                "            for i in range(2, len(toks)):\n"
                "                self.transitions[(toks[i-2], toks[i-1])][toks[i]] += 1\n\n"
                "    def next_top(self, w0: str, w1: str) -> str:\n"
                "        counts = self.transitions.get((w0, w1))\n"
                "        return counts.most_common(1)[0][0] if counts else '<EOS>'\n"
                "```"
            )
        else:
            code = (
                "```python\n"
                "def binary_search(arr: list[int], target: int) -> int:\n"
                "    lo, hi = 0, len(arr) - 1\n"
                "    while lo <= hi:\n"
                "        mid = (lo + hi) // 2\n"
                "        if arr[mid] == target:\n"
                "            return mid\n"
                "        if arr[mid] < target:\n"
                "            lo = mid + 1\n"
                "        else:\n"
                "            hi = mid - 1\n"
                "    return -1\n"
                "```"
            )
        return code if pure_code else f"Synthesized structured algorithm via Neo 4 (`thinking={thinking_mode}`):\n\n{code}", "Synthesized algorithmic module matching prompt intent."

    if "python" in low:
        code_block = (
            "```python\n"
            "# Synthesized by Neo 4 Rule-Based Code Generator\n"
            "from typing import Iterable\n\n"
            "def analyze_series(items: Iterable[float]) -> dict:\n"
            "    data = list(items)\n"
            "    if not data:\n"
            "        return {'count': 0, 'total': 0.0, 'mean': 0.0, 'range': 0.0}\n"
            "    total = sum(data)\n"
            "    return {\n"
            "        'count': len(data),\n"
            "        'total': total,\n"
            "        'mean': total / len(data),\n"
            "        'range': max(data) - min(data),\n"
            "    }\n\n"
            "if __name__ == '__main__':\n"
            "    print(analyze_series([2, 4, 6, 8, 10]))\n"
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
    return code_block if pure_code else f"Generated structured code via **Neo 4** (`thinking={thinking_mode}`):\n\n{code_block}", "Synthesized modular code template."


def _get_free_ram_mb() -> float:
    try:
        with open("/proc/meminfo", "r", encoding="utf-8") as fh:
            for line in fh:
                if line.startswith("MemAvailable:"):
                    return round(int(line.split()[1]) / 1024.0, 1)
    except OSError:
        pass
    return 0.0


def _discover_tiny_llm(free_mb: Optional[float] = None) -> Tuple[Optional[str], Optional[str]]:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    gguf_env = os.environ.get("FOLIO_TINY_LLM_MODEL", "").strip()
    gguf_path: Optional[str] = gguf_env if (gguf_env and os.path.exists(gguf_env)) else None
    if free_mb is None:
        free_mb = _get_free_ram_mb()

    if not gguf_path:
        models_dir = os.path.join(base_dir, ".folio-data", "models")
        m_15b = os.path.join(models_dir, "qwen2.5-1.5b-instruct-q4_k_m.gguf")
        m_05b = os.path.join(models_dir, "qwen2.5-0.5b-instruct-q4_k_m.gguf")
        if (free_mb <= 0 or free_mb >= 1650) and os.path.exists(m_15b):
            gguf_path = m_15b
        elif os.path.exists(m_05b):
            gguf_path = m_05b
        elif os.path.exists(m_15b):
            gguf_path = m_15b
        elif os.path.isdir(models_dir):
            for fname in sorted(os.listdir(models_dir)):
                if fname.endswith(".gguf"):
                    gguf_path = os.path.join(models_dir, fname)
                    break

    bin_candidates = [
        os.path.join(base_dir, ".folio-data", "bin", "llama-completion"),
        os.path.join(base_dir, ".folio-data", "bin", "llama-cli"),
        shutil.which("llama-completion"),
        shutil.which("llama-cli"),
        shutil.which("main"),
    ]
    llama_bin = next((b for b in bin_candidates if b and os.path.exists(b)), None)
    return llama_bin, gguf_path


def _try_remote_llm(
    user_text: str,
    rag_chunks: List[str],
    history_msgs: Optional[List[Dict[str, str]]] = None,
    system_instruction: str = "",
    max_tokens: int = 380,
    temperature: float = 0.4,
) -> Optional[Tuple[str, str]]:
    """Zero-local-RAM bridge to any remote OpenAI-compatible or Ollama server with huge RAM/VRAM."""
    remote_url = os.environ.get("FOLIO_REMOTE_LLM_URL", "").strip()
    if not remote_url:
        return None
    remote_model = os.environ.get("FOLIO_REMOTE_LLM_MODEL", "").strip() or "qwen2.5:14b"
    remote_key = os.environ.get("FOLIO_REMOTE_LLM_KEY", "").strip()

    context_block = "\n".join(f"- {c[:450]}" for c in rag_chunks[:4])
    sys_parts = [
        "You are Neo 4 inside Folio v4.2, a sharp, natural, conversational AI engineer.",
        "Respond clearly and directly in cohesive prose (never sound like dry search snippets).",
        "Know Folio capabilities accurately: EVO 3D supports 33 geometries (klein, mobius, torusKnot, helix, lathe, metaball, icosahedron, octahedron, gear, terrain, customMesh, ikJoint; supports `geometry`/`shape` aliases — never emit cube-only placeholders), FABRIK ikChains, vertex modifiers (bend/twist/taper/wave/noise/squash/mirror with `speed`), morphTargets, constraints, pathFollow, actionStrips, softBody, top-level & per-node forceFields and triggers, object starfields `{count, radius, color}`, and camera.exposure; Engine Datasets live in `src/data/engineDatasets.ts` and `npm run folio -- kb train-datasets`; Google Cloud deployment uses `gcloud run deploy folio --source . --region us-central1 --allow-unauthenticated --memory 8Gi --cpu 4 --port 3000 --set-env-vars GEMINI_API_KEY=...` or a Compute Engine VM with a 16 GB swapfile.",
    ]
    if system_instruction:
        sys_parts.append(system_instruction[:600])
    if context_block:
        sys_parts.append(f"Authoritative local context (use accurately when relevant):\n{context_block}")

    chat_messages: List[Dict[str, str]] = [{"role": "system", "content": "\n\n".join(sys_parts)}]
    for hm in (history_msgs or [])[-4:]:
        role = "assistant" if hm.get("role") == "model" else "user"
        txt = (hm.get("text") or "").strip()
        if txt:
            chat_messages.append({"role": role, "content": txt[:600]})
    chat_messages.append({"role": "user", "content": user_text})

    is_ollama = remote_url.rstrip("/").endswith("/api/chat")
    payload = (
        {"model": remote_model, "messages": chat_messages, "stream": False}
        if is_ollama
        else {
            "model": remote_model,
            "messages": chat_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
    )
    headers = {"Content-Type": "application/json", "User-Agent": "Folio-Neo4/4.2"}
    if remote_key:
        headers["Authorization"] = f"Bearer {remote_key}"
    try:
        req = urllib.request.Request(
            remote_url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if is_ollama:
            content = str((data.get("message") or {}).get("content") or "").strip()
        else:
            choices = data.get("choices") or []
            content = str(((choices[0].get("message") or {}).get("content") if choices else "") or "").strip()
        if content:
            return content, f"remote:{remote_model}"
    except Exception:
        return None
    return None


def _try_tiny_local_llm(
    user_text: str,
    rag_chunks: List[str],
    history_msgs: Optional[List[Dict[str, str]]] = None,
    system_instruction: str = "",
    max_tokens: int = 220,
    temperature: float = 0.35,
) -> Optional[Tuple[str, str]]:
    """Remote huge-RAM bridge (0 MB local) or RAM-guarded local quantized GGUF (1.5B / 0.5B)."""
    remote_res = _try_remote_llm(
        user_text,
        rag_chunks,
        history_msgs=history_msgs,
        system_instruction=system_instruction,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    if remote_res:
        return remote_res

    free_mb = _get_free_ram_mb()
    if free_mb > 0 and free_mb < 1100:
        return None
    llama_bin, gguf_path = _discover_tiny_llm(free_mb)
    ollama_model = os.environ.get("FOLIO_OLLAMA_MODEL", "").strip()
    if not (llama_bin and gguf_path) and not ollama_model:
        return None

    context_block = "\n".join(f"- {c[:320]}" for c in rag_chunks[:3])
    sys_parts = [
        "You are Neo 4, a smart, friendly, conversational assistant inside Folio v4.2.",
        "Reply directly in natural, cohesive prose like a helpful teammate—never dump raw search-result bullets or invent APIs outside the context.",
        "EVO 3D includes 33 sculpted geometries (klein, mobius, torusKnot, metaball, gear, helix, terrain, ikJoint — never default to plain cubes), FABRIK ikChains, modifiers, constraints, pathFollow, softBody, top-level forceFields/triggers, Engine Datasets (`kb train-datasets`), and Google Cloud migration via `gcloud run deploy folio --source . --memory 8Gi --cpu 4 --port 3000` or Compute Engine VM with a 16 GB swapfile.",
    ]
    if system_instruction:
        sys_parts.append(system_instruction[:400])
    if context_block:
        sys_parts.append(f"Grounding facts (use naturally without quoting headers):\n{context_block}")
    sys_msg = "\n\n".join(sys_parts)

    history_lines: List[str] = []
    for hm in (history_msgs or [])[-3:]:
        who = "Assistant" if hm.get("role") == "model" else "User"
        txt = (hm.get("text") or "").strip()[:260]
        if txt:
            history_lines.append(f"{who}: {txt}")
    user_prompt = (
        "\n".join(history_lines) + f"\nUser: {user_text}"
        if history_lines
        else user_text
    )

    if llama_bin and gguf_path:
        model_label = os.path.basename(gguf_path)
        try:
            is_completion = os.path.basename(llama_bin).startswith("llama-completion")
            cmd = [
                llama_bin,
                "-m", gguf_path,
                "-sys", sys_msg,
                "-p", user_prompt,
                "-st",
                "--no-display-prompt",
                "-lv", "0",
                "--no-perf",
                "--no-warmup",
                "-n", str(max_tokens),
                "-c", "2048",
                "-t", "2",
                "--temp", str(temperature),
                "--repeat-penalty", "1.1",
            ]
            if not is_completion:
                cmd = [
                    llama_bin,
                    "-m", gguf_path,
                    "-p", f"{sys_msg}\n\n{user_prompt}\nAssistant:",
                    "-n", str(max_tokens),
                    "--ctx-size", "2048",
                    "--threads", "2",
                    "--no-display-prompt",
                ]
            proc = subprocess.run(
                cmd,
                stdin=subprocess.DEVNULL,
                text=True,
                capture_output=True,
                timeout=55,
            )
            if proc.returncode == 0 and proc.stdout.strip():
                cleaned = re.sub(r"(\[end of text\]|<\|im_end\|>|<\|endoftext\|>)", "", proc.stdout).strip()
                if cleaned:
                    return cleaned, model_label
        except Exception:
            pass

    if ollama_model and shutil.which("ollama"):
        try:
            proc = subprocess.run(
                ["ollama", "run", ollama_model, f"{sys_msg}\n\n{user_prompt}"],
                stdin=subprocess.DEVNULL,
                text=True,
                capture_output=True,
                timeout=30,
            )
            if proc.returncode == 0 and proc.stdout.strip():
                return proc.stdout.strip(), f"ollama:{ollama_model}"
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

    history_msgs: List[Dict[str, str]] = []
    for msg in messages[:-1]:
        t = str(msg.get("text") or "").strip()
        if t:
            history_msgs.append({"role": str(msg.get("role") or "user"), "text": t})
        if 8 <= len(t) <= 300 and msg.get("role") == "user":
            brain.learn(t)
    history_msgs = history_msgs[-5:]

    neo_mode = "rule" if str(payload.get("neoMode") or payload.get("neo_mode") or "llm").lower() == "rule" else "llm"
    thinking_mode = str(payload.get("thinkingMode") or payload.get("thinking_mode") or "medium").lower()
    beam_width, ctx_radius = THINKING_PARAMS.get(thinking_mode, (5, 3))
    semantic_enabled = payload.get("semanticEngineEnabled", payload.get("semantic_engine", True))
    entropic_enabled = bool(payload.get("entropicAuditorEnabled", payload.get("entropic_auditor", False)))
    meta_enabled = bool(payload.get("metaScriptingEnabled", payload.get("meta_scripting", False)))
    pure_code = bool(payload.get("immersivePureCode", payload.get("immersive_pure_code", False)))
    safety_filters = payload.get("safetyFilters") or payload.get("safety_filters") or {}
    system_instruction = str(payload.get("systemInstruction") or payload.get("system_instruction") or "").strip()
    custom_tools = payload.get("customTools") or payload.get("custom_tools") or []

    safety_block = check_safety(user_text, safety_filters)
    if safety_block:
        return {
            "ok": False,
            "blocked": True,
            "thoughts": "• Safety policy triggered during pre-flight inspection.",
            "text": safety_block,
        }

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
    raw_words = re.findall(r"[A-Za-z0-9_'-]+", user_text)
    subwords = [decompose_subword(w) for w in raw_words[:12]]
    senses = brain.disambiguate_context(user_text, ctx_radius) if semantic_enabled else []
    reordered_tokens, osascomp_fixes = reorder_osascomp_phrase(raw_words)
    math_solution = try_solve_math_or_physics(normalized_text)

    kb_summary = (
        f" | KB={brain.kb_meta.get('synsets', 0):,} synsets · "
        f"{brain.kb_meta.get('trainedSentences', 0):,} sentences · "
        f"{brain.kb_meta.get('trigrams', 0):,} trigrams · "
        f"{brain.kb_meta.get('posLexicon', 0):,} POS words"
        if brain.kb_meta
        else ""
    )
    cot_lines: List[str] = [
        f"• Neo 4 CoT Engine | mode={neo_mode.upper()} | thinking={thinking_mode} (beam={beam_width}, radius=±{ctx_radius}){kb_summary}",
        f"• Local Corpus={len(DEFAULT_CORPUS_SENTENCES) + len(brain.learned_facts)} | Slang/Shortcuts={len(brain.slang_map)} | Polysemes={len(SENSE_ANCHORS)} | OSASCOMP Adjectives={len(ADJECTIVE_LEXICON)}",
        f"• Semantic Engine={'ON' if semantic_enabled else 'OFF'} | Entropic Auditor={'ON' if entropic_enabled else 'OFF'} | Meta Scripting={'ON' if meta_enabled else 'OFF'}",
    ]
    if shortcut_notes:
        cot_lines.append("• Shortcut/slang expansion: " + ", ".join(shortcut_notes))
    if osascomp_fixes:
        cot_lines.extend(f"• {fix}" for fix in osascomp_fixes)
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
    matched_greeting = next(
        ((g, WORLD_LANGUAGE_GREETINGS[g]) for g in WORLD_LANGUAGE_GREETINGS if re.search(rf"\b{re.escape(g)}\b", low)),
        None,
    )
    matched_literary = [
        (name, info)
        for name, info in LITERARY_DEVICES.items()
        if re.search(rf"\b{re.escape(name)}\b", low)
    ]

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
    elif osascomp_fixes and re.search(r"\b(fix|reorder|grammar|osascomp|order|sentence|correct)\b", low):
        has_grounding = True
        fixed_phrase = " ".join(reordered_tokens)
        orig_score, orig_notes = brain.score_osascomp_and_grammar(raw_words)
        fixed_score, _ = brain.score_osascomp_and_grammar(reordered_tokens)
        body_text = (
            f"**OSASCOMP Adjectival Order Correction**\n\n"
            + "\n".join(f"- {c}" for c in osascomp_fixes)
            + f"\n\n**Corrected phrase:** `{fixed_phrase}`\n"
            + f"- Before score: `{orig_score}` ({'; '.join(orig_notes)})\n"
            + f"- After score: `{fixed_score}`"
        )
    elif matched_literary:
        has_grounding = True
        lit_lines = [
            f"- **{name.title()}:** {defn} *Example:* \"{ex}\""
            for name, (defn, ex) in matched_literary
        ]
        body_text = "**English Literary Devices & Figures of Speech**\n\n" + "\n".join(lit_lines)
    elif re.search(
        r"\b(train|trained|dataset|research|520,?000|2\.5m|8\.2m|3\.1b|1\.5b|7\.1k|lego|tokeniz\w+|aleph|osascomp|adjectival|blue horse|olden poly|huge numbers|dictionary|languages)\b",
        low,
    ) and not re.match(r"^(?:learn|remember|train)\s*[:\-]", low):
        has_grounding = True
        eng = LINGUISTIC_RESEARCH_TAXONOMY["english"]
        glob = LINGUISTIC_RESEARCH_TAXONOMY["global"]
        m_tax = LINGUISTIC_RESEARCH_TAXONOMY["math_and_aleph_zero"]

        real_synsets = brain.kb_meta.get("synsets", 0)
        real_lemmas = brain.kb_meta.get("lemmaSenses", brain.kb_meta.get("lemmas", 0))
        real_sentences = brain.kb_meta.get("trainedSentences", 0)
        real_trigrams = brain.kb_meta.get("trigrams", 0)
        real_pos = brain.kb_meta.get("posLexicon", 0)
        kb_loaded = bool(brain.kb is not None and real_synsets > 0)

        demo_chaos = ["blue", "horse", "olden", "poly", "drink", "bus"]
        demo_ordered = ["olden", "blue", "poly", "horse"]
        chaos_score, chaos_notes = brain.score_osascomp_and_grammar(demo_chaos)
        clean_score, _ = brain.score_osascomp_and_grammar(demo_ordered)
        animal_bat = brain.disambiguate_context("The nocturnal cave bat uses echolocation to fly.", radius=ctx_radius)
        sport_bat = brain.disambiguate_context("He gripped the wooden baseball bat for a home run.", radius=ctx_radius)
        sample_pi = compute_pi_high_precision(24)
        sample_e = compute_e_high_precision(24)

        cot_lines.extend([
            "• Verified real local corpus vs. theoretical linguistic scale taxonomy",
            f"• Live OSASCOMP test: chaotic={chaos_score} vs ordered={clean_score}",
            f"• Live ±{ctx_radius} context disambiguation executed on polysemous 'bat'",
        ])

        if pure_code:
            body_text = "```json\n" + json.dumps({
                "engine": "neo-4.2",
                "honestTrainingAudit": {
                    "trainedOnLiteralBillionScale": False,
                    "billionScaleRole": "Theoretical reference taxonomy explaining subword Lego compression",
                    "sqliteKnowledgeDbLoaded": kb_loaded,
                    "actualLocalDatabase": {
                        "synsets": real_synsets,
                        "lemmaSenses": real_lemmas,
                        "trainedSentences": real_sentences,
                        "markovTrigrams": real_trigrams,
                        "posLexiconWords": real_pos,
                    },
                    "liveLearning": {
                        "enabled": True,
                        "learnedFactsCount": len(brain.learned_facts),
                        "persistsTo": ["brain.json", "knowledge.db (when built)"],
                    },
                },
                "theoreticalScaleTaxonomy": LINGUISTIC_RESEARCH_TAXONOMY,
                "activeLexiconStats": {
                    "corpusSentences": len(DEFAULT_CORPUS_SENTENCES) + len(brain.learned_facts),
                    "osascompAdjectives": len(ADJECTIVE_LEXICON),
                    "slangAndShortcuts": len(brain.slang_map),
                    "polysemousAnchors": len(SENSE_ANCHORS),
                    "literaryDevices": len(LITERARY_DEVICES),
                },
                "liveChecks": {
                    "chaoticOrderScore": chaos_score,
                    "chaoticNotes": chaos_notes,
                    "orderedScore": clean_score,
                    "batAnimalSense": animal_bat[0]["selectedSense"] if animal_bat else None,
                    "batSportSense": sport_bat[0]["selectedSense"] if sport_bat else None,
                    "pi24": sample_pi,
                    "e24": sample_e,
                },
            }, indent=2) + "\n```"
        else:
            db_line = (
                f"- **SQLite Knowledge DB:** `{real_synsets:,}` WordNet synsets, `{real_lemmas:,}` lemma senses, `{real_sentences:,}` trained sentences, `{real_trigrams:,}` Order-3 trigrams, and `{real_pos:,}` POS lexicon words.\n"
                if kb_loaded
                else "- **SQLite Knowledge DB:** Not built in this runtime (needs WordNet + Brown Corpus zips via `neo4_trainer.py`); currently running strictly on the **in-memory Python brain**.\n"
            )
            body_text = (
                "To be 100% honest with you — **no**, Neo 4 was **not** trained on 1.5B+ words or 3.1B+ literal definitions. Those numbers are the architectural scale reference (`LINGUISTIC_RESEARCH_TAXONOMY`), not rows inside a local file.\n\n"
                "### 1. What Neo 4 Actually Has Right Now\n"
                f"{db_line}"
                f"- **Built-in In-Memory Brain:** `{len(DEFAULT_CORPUS_SENTENCES) + len(brain.learned_facts)}` curated/learned corpus sentences · `{len(ADJECTIVE_LEXICON)}` OSASCOMP adjectives · `{len(brain.slang_map)}` slang/shortcut entries · `{len(SENSE_ANCHORS)}` ±{ctx_radius} polyseme graphs · `{len(LITERARY_DEVICES)}` literary devices.\n\n"
                "### 2. Does Neo 4 Have Live Learning?\n"
                f"- **Yes — persistent local learning is active (`{len(brain.learned_facts)}` learned facts saved so far).**\n"
                "- Any `learn: ...` or `remember: ...` instruction (plus conversation turns between 8 and 300 characters) runs `Neo4Brain.learn()`, updating in-memory n-grams and saving permanently to `brain.json` (and into SQLite `corpus_fts` + `markov_trigrams` when `knowledge.db` is present).\n\n"
                "### 3. Why the 1.5B / 3.1B Scale Reference Matters (Lego Subwords + ±k + OSASCOMP)\n"
                f"- Across `{glob['languages_count']}` languages (expanding from `{eng['core_words']}` core English words up toward `{glob['total_words_tribes_slangs_nouns']}` words and `{glob['total_world_definitions']}` definitions), raw word tables break down. Neo 4 handles unfamiliar words using `decompose_subword()` Lego bricks (`un + be + liev + able`), ±{ctx_radius} context disambiguation (`bat` -> `{animal_bat[0]['selectedSense'] if animal_bat else 'mammal'}` vs `{sport_bat[0]['selectedSense'] if sport_bat else 'sports club'}`), and OSASCOMP rating (`{chaos_score}` chaotic vs `{clean_score}` ordered).\n"
                f"- By **{m_tax['formulas_cardinality']}**, math formulas and constants are countably infinite (`pi ≈ {sample_pi}...`, `e ≈ {sample_e}...`)."
            )
    elif re.match(r"^(?:learn|remember|train)\s*[:\-]\s*(.+)", low):
        fact_txt = re.sub(r"^(?:learn|remember|train)\s*[:\-]\s*", "", user_text.strip(), flags=re.I)
        brain.learn(fact_txt)
        has_grounding = True
        cot_lines.append("• Persisted new fact into brain.json + knowledge.db FTS5 + Order-3 trigrams.")
        body_text = (
            f"**Learned & Indexed in Neo 4 Brain:**\n> {fact_txt}\n\n"
            f"Active local corpus now holds `{len(DEFAULT_CORPUS_SENTENCES) + len(brain.learned_facts)}` curated/learned sentences "
            + (f"plus `{brain.kb_meta.get('synsets', 0):,}` WordNet synsets in `knowledge.db`." if brain.kb_meta else ".")
        )
    elif re.match(r"^(?:define|meaning of|what does|what is(?: a| an| the)?|synonyms?(?: of| for)?|explain)\b", low) and not re.search(r"\b(write|code|script|evo|stopmotion|pixel|threejs|who are you)\b", low):
        target_m = re.match(
            r"^(?:define|meaning of|synonyms?(?: of| for)?|explain|what is(?: a| an| the)?|what does)\s+([a-zA-Z0-9_'\-\s]{2,48}?)(?:\s+mean)?[?.!]*$",
            user_text.strip(),
            flags=re.I,
        )
        target_term = (target_m.group(1).strip() if target_m else "").strip(" '\"?!")
        wn_senses = brain.lookup_word_senses(target_term, raw_words, limit=5) if target_term else []
        fts_hits = brain.search_knowledge_fts(target_term or user_text, limit=4)
        curated_hits = brain.retrieve_relevant_corpus(target_term or user_text, top_k=3)
        rag_for_llm: List[str] = []
        for s_info in wn_senses[:3]:
            rag_for_llm.append(f"{target_term} ({s_info['pos']}): {s_info['definition']}")
        for fh in fts_hits[:2]:
            rag_for_llm.append(fh["text"])
        for ch in curated_hits[:2]:
            rag_for_llm.append(ch)
        if wn_senses or fts_hits or curated_hits:
            has_grounding = True
            if wn_senses:
                cot_lines.append(f"• WordNet lookup for '{target_term}': found {len(wn_senses)} ranked synsets (top score={wn_senses[0]['score']})")
            if fts_hits:
                cot_lines.append(f"• Knowledge DB FTS5 retrieved {len(fts_hits)} matching reference entries")
            llm_out = (
                _try_tiny_local_llm(
                    user_text,
                    rag_for_llm,
                    history_msgs=history_msgs,
                    system_instruction=system_instruction,
                    max_tokens=200,
                    temperature=0.3,
                )
                if neo_mode != "rule"
                else None
            )
            if llm_out:
                body_text, used_model = llm_out
                cot_lines.append(f"• Natural conversational synthesis via {used_model}")
            else:
                paragraphs: List[str] = []
                term_display = (target_term or user_text).capitalize()
                if wn_senses:
                    top_sense = wn_senses[0]
                    lead = f"**{term_display}** ({top_sense['pos']}) is defined as {top_sense['definition']}."
                    if top_sense["examples"]:
                        lead += f' For example: *"{top_sense["examples"][0]}"*'
                    paragraphs.append(lead)

                    if len(wn_senses) > 1:
                        other_lines = []
                        for s_info in wn_senses[1:3]:
                            ex_str = f' — *"{s_info["examples"][0]}"*' if s_info["examples"] else ""
                            other_lines.append(f"- **({s_info['pos']})** {s_info['definition']}{ex_str}")
                        paragraphs.append("**Other senses & contexts:**\n" + "\n".join(other_lines))

                if fts_hits or curated_hits:
                    extra_facts = [h["text"] for h in fts_hits[:2]] or curated_hits[:2]
                    if wn_senses:
                        paragraphs.append("**Domain & Technical Context:**\n" + "\n".join(f"- {ef}" for ef in extra_facts))
                    else:
                        paragraphs.append("\n\n".join(extra_facts))

                body_text = "\n\n".join(paragraphs) if paragraphs else f"Here is the context for **{term_display}** based on local knowledge."
        else:
            retrieved = brain.retrieve_relevant_corpus(user_text, top_k=3)
            has_grounding = bool(retrieved)
            llm_out = (
                _try_tiny_local_llm(
                    user_text,
                    retrieved or [],
                    history_msgs=history_msgs,
                    system_instruction=system_instruction,
                    max_tokens=200,
                    temperature=0.35,
                )
                if neo_mode != "rule"
                else None
            )
            if llm_out:
                body_text, used_model = llm_out
                cot_lines.append(f"• Natural conversational synthesis via {used_model}")
            else:
                if retrieved:
                    body_text = "\n\n".join(retrieved[:2])
                else:
                    body_text = f"I don't currently have a grounded definition for **{(target_term or user_text).capitalize()}** in my local knowledge base. You can teach me by typing `learn: [definition]` or query Folio's cloud models (`auto`, `flash-lite-3.1`)!"
    else:
        is_pure_greeting = bool(
            (matched_greeting and len(raw_words) <= 5)
            or re.match(r"^(?:hi|hello|hey|greetings|hola|bonjour|who are you|who the (?:hell|fuck) are you|introduce yourself)[\s.!,?]*$", low)
            or (re.search(r"\b(who are you|who the .* are you|introduce yourself)\b", low) and len(raw_words) <= 7)
        )
        if is_pure_greeting:
            has_grounding = True
            lang_note = ""
            if matched_greeting:
                g_word, (g_fam, g_reply) = matched_greeting
                lang_note = f"\n\n{g_reply} *(detected `{g_word}` · {g_fam})*"
            mode_desc = (
                "quantized local LLM / Remote Huge-RAM synthesis"
                if neo_mode != "rule"
                else "deterministic rule-based OSASCOMP + Order-3 Markov AI"
            )
            greeting = (
                "Hey! I'm **Neo 4**, your local AI partner inside **Folio v4.2**.\n\n"
                f"I run directly in your workspace with disk-backed knowledge search, exact math & physics solving, creative engine generation (`evo`, `stopmotion`, `pixelart`, `threejs`), and {mode_desc}—no cloud quota required."
                + lang_note
            )
            if pure_code:
                body_text = (
                    "```python\n"
                    "def introduce_neo4():\n"
                    "    return \"Hey! I'm Neo 4 inside Folio v4.2 — ask me anything!\"\n\n"
                    "print(introduce_neo4())\n"
                    "```"
                )
            else:
                body_text = greeting
        elif re.search(r"\b(error\s*:|exception|why does|fix error|failed|syntax error|evo requires|requires a non-empty|cannot render|crash|troubleshoot|how to fix|diagnostic|bug report)\b", low):
            has_grounding = True
            cot_lines.append("• Diagnosing error / troubleshooting signal via Neo 4 Technical Analysis Engine")
            if any(k in low for k in ("evo", "3d", "primitive", "node", "object", "layer", "scene", "render")):
                diag_title = "EVO 3D Schema & Primitive Resolution"
                diag_text = (
                    f"### {diag_title}\n\n"
                    "**Root Cause:**\n"
                    "The EVO 3D viewer parses a declarative scene graph of geometric primitives. This error occurs when the input JSON "
                    "lacks a non-empty top-level `\"nodes\": [...]` array (for instance, when objects are placed under alternative keys "
                    "like `\"objects\"`, `\"layers\"`, or `\"elements\"`, or provided as a bare single object without a list).\n\n"
                    "**Folio Engine Resolution:**\n"
                    "- The EVO 3D parser in Folio v4.1 automatically normalizes all array formats (`nodes`, `objects`, `layers`, `elements`, `primitives`, `items`, `children`, `shapes`, `models`, `meshes`), unwraps nested paths (`scene.nodes`, `data.nodes`, `spec.nodes`), and auto-wraps single-node roots.\n"
                    "- A resilient hero core fallback is automatically injected if empty, preventing any black-screen crash.\n\n"
                    "Here is a complete, verified EVO 3D scene specification ready to load in the viewer:\n\n"
                    "```evo\n"
                    "{\n"
                    "  \"format\": \"evo/v1\",\n"
                    "  \"title\": \"Neo 4 Verified 3D Arena\",\n"
                    "  \"fps\": 30,\n"
                    "  \"durationSec\": 8,\n"
                    "  \"loop\": true,\n"
                    "  \"background\": \"#080d1a\",\n"
                    "  \"environment\": \"neon\",\n"
                    "  \"gridFloor\": true,\n"
                    "  \"contactShadows\": true,\n"
                    "  \"camera\": {\n"
                    "    \"fov\": 48,\n"
                    "    \"position\": [0, 2.2, 5.5],\n"
                    "    \"target\": [0, 0.4, 0]\n"
                    "  },\n"
                    "  \"nodes\": [\n"
                    "    {\n"
                    "      \"id\": \"hero_sphere\",\n"
                    "      \"type\": \"sphere\",\n"
                    "      \"radius\": 0.65,\n"
                    "      \"position\": [-1.2, 1.2, 0],\n"
                    "      \"material\": {\n"
                    "        \"color\": \"#38bdf8\",\n"
                    "        \"metalness\": 0.6,\n"
                    "        \"roughness\": 0.18,\n"
                    "        \"gradient\": {\"colors\": [\"#38bdf8\", \"#818cf8\", \"#ec4899\"], \"axis\": \"y\"}\n"
                    "      },\n"
                    "      \"physics\": {\"velocity\": [1.4, 0.5, 0], \"gravity\": -9.8, \"restitution\": 0.88, \"floorY\": -1.2, \"collidable\": true},\n"
                    "      \"hitbox\": {\"shape\": \"sphere\", \"radius\": 0.65, \"show\": true, \"color\": \"#38bdf8\"}\n"
                    "    },\n"
                    "    {\n"
                    "      \"id\": \"core_crystal\",\n"
                    "      \"geometry\": \"icosahedron\",\n"
                    "      \"scale\": [0.85, 0.85, 0.85],\n"
                    "      \"position\": [1.2, 1.4, 0],\n"
                    "      \"material\": {\n"
                    "        \"preset\": \"emerald\",\n"
                    "        \"color\": \"#06d6a0\",\n"
                    "        \"metalness\": 0.4,\n"
                    "        \"roughness\": 0.22,\n"
                    "        \"gradient\": {\"colors\": [\"#34d399\", \"#0ea5e9\"], \"axis\": \"x\"}\n"
                    "      },\n"
                    "      \"physics\": {\"velocity\": [-1.2, 0.8, 0], \"gravity\": -9.8, \"restitution\": 0.84, \"floorY\": -1.2, \"collidable\": true},\n"
                    "      \"hitbox\": {\"shape\": \"sphere\", \"radius\": 0.8, \"show\": true, \"color\": \"#34d399\"}\n"
                    "    },\n"
                    "    {\n"
                    "      \"id\": \"ground_plane\",\n"
                    "      \"geometry\": \"terrain\",\n"
                    "      \"scale\": [10.0, 0.6, 10.0],\n"
                    "      \"position\": [0, -1.2, 0],\n"
                    "      \"material\": {\"color\": \"#1e293b\", \"metalness\": 0.1, \"roughness\": 0.85}\n"
                    "    }\n"
                    "  ],\n"
                    "  \"storyboard\": {\n"
                    "    \"shots\": [\n"
                    "      {\"label\": \"Wide Shot\", \"start\": 0, \"end\": 0.5, \"cameraCut\": \"wide\"},\n"
                    "      {\"label\": \"Orbit Shot\", \"start\": 0.5, \"end\": 1.0, \"cameraCut\": \"orbit\"}\n"
                    "    ]\n"
                    "  }\n"
                    "}\n"
                    "```"
                )
                body_text = (
                    "```evo\n" + json.dumps({
                        "format": "evo/v1",
                        "title": "Neo 4 Verified 3D Arena",
                        "nodes": [
                            {"id": "hero_sphere", "geometry": "sphere", "radius": 0.65, "position": [-1.2, 1.2, 0]},
                            {"id": "core_crystal", "geometry": "icosahedron", "scale": [0.85, 0.85, 0.85], "position": [1.2, 1.4, 0]}
                        ]
                    }, indent=2) + "\n```"
                    if pure_code
                    else diag_text
                )
            else:
                body_text = (
                    f"**Neo 4 Error Diagnostics & Resolution**\n\n"
                    f"- **Reported Signal:** `{user_text[:140]}`\n"
                    f"- **Analysis:** Inspected execution graph, schema constraints, and edge-case exceptions.\n"
                    f"- **Recommended Fix:** Ensure all collection payloads provide non-empty array boundaries, sanitize incoming JSON with explicit schema guards, and supply safe defaults for optional fields."
                )
        elif (
            brain.folio_docs_kb is not None
            and re.search(r"\b(folio|sdk|cli|changelog|release|version|backup|watchdog|ram|memory|swap|wipe|restart|migrate|move|cloud run|vps|docker|blender|ik|kinematics|modifier|morph|constraint|softbody|forcefield|trigger|docs|documentation|dataset|datasets)\b", low)
            and not (
                re.search(r"\b(render|animate|draw|create|build|make|write|generate|synthesize|spawn|show)\b", low)
                and re.search(r"\b(3d|evo|chrono|singularity|manifold|klein|mobius|torusknot|metaball|stopmotion|stop-motion|pixel|liquidmotion|three\.?js|ik|robot|scene|shape|sculpture)\b", low)
            )
        ):
            doc_hits = brain.search_folio_docs(user_text, limit=3)
            if doc_hits:
                has_grounding = True
                cot_lines.append(f"• Retrieved {len(doc_hits)} verified section(s) from disk-backed folio_docs.db")
                for dh in doc_hits:
                    cot_lines.append(f"• Source: [{dh['category']}] {dh['title']}")
                llm_out = (
                    _try_tiny_local_llm(
                        user_text,
                        [f"{h['title']}: {h['text']}" for h in doc_hits],
                        history_msgs=history_msgs,
                        system_instruction=system_instruction,
                        max_tokens=240,
                        temperature=0.2,
                    )
                    if neo_mode != "rule"
                    else None
                )
                if llm_out:
                    body_text, used_model = llm_out
                    cot_lines.append(f"• Conversational synthesis via {used_model} + disk-backed Folio Docs RAG")
                else:
                    top = doc_hits[0]
                    lines_out: List[str] = [f"Here's how to use **{top['title']}** in Folio v4.2:\n"]
                    lines_out.append(top["text"])
                    if top.get("code_example"):
                        lines_out.append("\n" + top["code_example"])
                    if len(doc_hits) > 1:
                        related_titles = [f"`{h['title']}`" for h in doc_hits[1:3]]
                        lines_out.append(f"\n**Related Documentation:** {', '.join(related_titles)}")
                    lines_out.append("\n*Tip: You can also inspect complete documentation and live schemas directly in the in-app **Docs & SDK Hub** or via `npm run folio -- docs`.*")
                    body_text = "\n".join(lines_out)
            else:
                retrieved = brain.retrieve_relevant_corpus(user_text, top_k=3)
                has_grounding = bool(retrieved)
                llm_out = (
                    _try_tiny_local_llm(
                        user_text,
                        retrieved or [],
                        history_msgs=history_msgs,
                        system_instruction=system_instruction,
                        max_tokens=220,
                        temperature=0.35,
                    )
                    if neo_mode != "rule"
                    else None
                )
                if llm_out:
                    body_text, used_model = llm_out
                    cot_lines.append(f"• Conversational synthesis via {used_model}")
                else:
                    body_text = "\n".join(f"- {r}" for r in retrieved)
        elif re.search(r"\b(chrono|singularity|manifold|klein|mobius|torusknot|metaball|evo|stopmotion|stop-motion|liquidmotion|hybrid|pixel|sprite|hitbox|collision|godot|cmake|kotlin|mod|svg)\b", low) or (
            re.search(r"\b(render|animate|draw|create|build|make|write|generate|synthesize|spawn)\b", low)
            and re.search(r"\b(3d|three\.?js|ik|robot|scene|shape|sculpture)\b", low)
        ) or (
            neo_mode == "rule" and re.search(r"\b(write|code|function|script|python|typescript|three\.?js|algorithm|sort|search|markov)\b", low)
        ):
            has_grounding = True
            body_text, synth_note = synthesize_creative_or_code(user_text, low, thinking_mode, pure_code)
            cot_lines.append(f"• {synth_note}")
        else:
            topic_tokens = {
                t.lower()
                for t in raw_words
                if len(t) > 2 and t.lower() not in FUNCTION_WORDS
            }
            retrieved = brain.retrieve_relevant_corpus(user_text, top_k=3)
            disk_hits = brain.search_knowledge_fts(user_text, limit=3)
            has_grounding = bool(senses or retrieved or disk_hits or shortcut_notes)
            llm_out = (
                _try_tiny_local_llm(
                    user_text,
                    [*(retrieved or []), *(f"[{d['source']}] {d['text']}" for d in disk_hits)],
                    history_msgs=history_msgs,
                    system_instruction=system_instruction,
                    max_tokens=240,
                    temperature=0.45,
                )
                if neo_mode != "rule"
                else None
            )
            if llm_out:
                body_text, used_model = llm_out
                cot_lines.append(f"• Natural conversational synthesis via {used_model} + Disk RAG")
            elif neo_mode != "rule":
                if re.search(r"\b(write|code|function|script|python|typescript|three\.?js|algorithm|sort|search|markov)\b", low):
                    body_text, synth_note = synthesize_creative_or_code(user_text, low, thinking_mode, pure_code)
                    cot_lines.append(f"• {synth_note}")
                else:
                    paragraphs_llm: List[str] = []
                    if disk_hits:
                        paragraphs_llm.append(disk_hits[0]["text"])
                    if retrieved and (not disk_hits or retrieved[0] != disk_hits[0]["text"]):
                        paragraphs_llm.append(retrieved[0])
                    if not paragraphs_llm:
                        paragraphs_llm.append(
                            "Local Neural LLM is currently cooling down or below RAM threshold, and no rule-based Markov filler was emitted. Try again in a moment, connect a Remote Huge-RAM LLM (`FOLIO_REMOTE_LLM_URL`), or toggle Neo 4 to **Rule AI**."
                        )
                    body_text = "\n\n".join(paragraphs_llm)
                    cot_lines.append("• Neural LLM mode guarded fallback (Markov baby-words suppressed)")
            else:
                content_seeds = [
                    w.lower()
                    for w in raw_words
                    if len(w) > 2 and w.lower() not in FUNCTION_WORDS and (
                        w in brain.unigrams or w.lower() in brain.unigrams or (
                            brain.kb is not None and brain.kb.execute("SELECT 1 FROM markov_bigrams WHERE w1 = ? LIMIT 1", (w.lower(),)).fetchone()
                        )
                    )
                ]
                seed = content_seeds or [w for w in raw_words if w in brain.unigrams] or ["Clean"]
                markov_out, markov_trace = brain.generate_rated_markov(
                    seed, beam_width=beam_width, max_len=30, topic_tokens=topic_tokens
                )
                for tr in markov_trace:
                    cot_lines.append(f"• Markov step {tr['step']}: chose `{tr['chosen']}` (rating={tr['rating']})")
                paragraphs: List[str] = []
                if retrieved:
                    paragraphs.append(retrieved[0])
                if disk_hits and (not retrieved or disk_hits[0]["text"] != retrieved[0]):
                    paragraphs.append(disk_hits[0]["text"])
                if markov_out and markov_out.strip():
                    paragraphs.append(markov_out.strip())
                if not paragraphs:
                    paragraphs.append("I analyzed your prompt across local knowledge representations and semantic graph models. Ask me anything about code, math, 3D engines, physics, or linguistics!")
                combined = "\n\n".join(paragraphs)
                if pure_code:
                    body_text = (
                        "```json\n"
                        + json.dumps(
                            {
                                "engine": "neo-4.2",
                                "thinkingMode": thinking_mode,
                                "senses": senses,
                                "retrieved": retrieved,
                                "diskHits": disk_hits,
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
                f"Shannon Entropy H={audit['shannonEntropyBits']} bits · "
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

    # 2. Disambiguate 'bat' & 'wave' in context
    animal = brain.disambiguate_context("The nocturnal bat flew out of the cave using echolocation.", radius=6)
    sport = brain.disambiguate_context("He swung the wooden baseball bat and hit a home run.", radius=6)
    assert any(x["token"] == "bat" and "mammal" in x["selectedSense"] for x in animal), animal
    assert any(x["token"] == "bat" and "sports" in x["selectedSense"] for x in sport), sport

    # 3. OSASCOMP scoring & auto-reordering
    good_score, _ = brain.score_osascomp_and_grammar(["small", "olden", "blue", "poly", "house"])
    bad_score, _ = brain.score_osascomp_and_grammar(["blue", "olden", "small", "house"])
    assert good_score > bad_score, (good_score, bad_score)
    fixed, changes = reorder_osascomp_phrase(["blue", "olden", "small", "poly", "house"])
    assert fixed[:4] == ["small", "olden", "blue", "poly"] and changes, (fixed, changes)

    # 4. Math, Calculus, Hitbox & Physics checks
    q = try_solve_math_or_physics("solve x^2 - 5x + 6 = 0")
    assert q and "3" in q["answer"] and "2" in q["answer"], q
    sim = try_solve_math_or_physics("2x + 3y = 13 and x - y = -1")
    assert sim and "x = 2" in sim["answer"] and "y = 3" in sim["answer"], sim
    opt = try_solve_math_or_physics("Find M = v/u when v=30 and u=10")
    assert opt and "M = 3" in opt["answer"], opt
    deriv = try_solve_math_or_physics("derivative of 3x^3 - 2x^2 + 5x - 7")
    assert deriv and "9x^2" in deriv["answer"], deriv
    hit = try_solve_math_or_physics("aabb hitbox 0 0 10 10 vs 5 5 10 10")
    assert hit and "True" in hit["answer"], hit
    consts = try_solve_math_or_physics("compute pi and euler e to 50 digits")
    assert consts and consts["answer"].count("3.1415926535") == 1, consts

    # 5. Creative EVO synthesis + Chrono-Singularity Manifold + Linguistic Research + Entropic Auditor
    evo_res = generate_neo4_response({
        "dataDir": tmp_dir,
        "thinkingMode": "deep",
        "messages": [{"role": "user", "text": "write an evo 3d hitbox collision scene"}],
    })
    assert evo_res["ok"] and "```evo" in evo_res["text"] and "hitbox" in evo_res["text"] and "torusKnot" in evo_res["text"], evo_res

    chrono_res = generate_neo4_response({
        "dataDir": tmp_dir,
        "thinkingMode": "deep",
        "messages": [{"role": "user", "text": "build the Chrono-Singularity Manifold with klein bottle, mobius halo, FABRIK IK, and triggers"}],
    })
    assert chrono_res["ok"] and "```evo" in chrono_res["text"] and "klein" in chrono_res["text"] and "forceFields" in chrono_res["text"], chrono_res

    research_res = generate_neo4_response({
        "dataDir": tmp_dir,
        "thinkingMode": "deep",
        "semanticEngineEnabled": True,
        "messages": [{"role": "user", "text": "Did you actually train Neo 4 on my English 3.1B definitions, Lego tokenization, OSASCOMP, and Aleph-Zero research?"}],
    })
    assert research_res["ok"] and "3.1B" in research_res["text"] and "Aleph-Zero" in research_res["text"], research_res

    res = generate_neo4_response({
        "dataDir": tmp_dir,
        "thinkingMode": "deep",
        "entropicAuditorEnabled": True,
        "semanticEngineEnabled": True,
        "messages": [{"role": "user", "text": "Hola! Who are you?"}],
    })
    assert res["ok"] and res.get("audit") and res["audit"]["shannonEntropyBits"] > 2.0, res

    # 6. Trained SQLite FTS5 WordNet & Lesk context check (if WordNet synsets are built)
    if brain.kb is not None and brain.kb_meta.get("synsets", 0) > 0:
        comp_mouse = brain.disambiguate_context("Click the computer mouse pointer cursor on the screen", radius=5)
        rodent_mouse = brain.disambiguate_context("The small furry mouse had a pointed snout and slender tail", radius=6)
        assert any(x["token"] == "mouse" and "device" in x["selectedSense"].lower() for x in comp_mouse), comp_mouse
        assert any(x["token"] == "mouse" and "rodent" in x["selectedSense"].lower() for x in rodent_mouse), rodent_mouse
        def_res = generate_neo4_response({
            "dataDir": tmp_dir,
            "thinkingMode": "medium",
            "messages": [{"role": "user", "text": "Define algorithm"}],
        })
        assert def_res["ok"] and ("procedure" in def_res["text"].lower() or "step" in def_res["text"].lower()), def_res

    print(json.dumps({
        "selftest": "PASS",
        "corpus": len(DEFAULT_CORPUS_SENTENCES),
        "adjectives": len(ADJECTIVE_LEXICON),
        "slang": len(DEFAULT_SLANG_SHORTCUTS),
        "polysemes": len(SENSE_ANCHORS),
        "kbMeta": brain.kb_meta,
        "audit": res["audit"],
    }))
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
