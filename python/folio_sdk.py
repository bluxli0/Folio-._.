#!/usr/bin/env python3
"""
Official Folio Python SDK (v4.2 · Folio Core)
Provides:
  - FolioClient: HTTP client for Folio server + offline local Neo 4 execution
  - KnowledgeStore: Low-RAM disk-backed SQLite FTS5 + BM25 search across folio_docs.db, knowledge.db, and shards/*.db
  - MemoryGuard: /proc/meminfo & disk safety inspector to prevent 4 GB OOM crashes
  - Creative Schema Builders: EvoBuilder, StopMotionBuilder, PixelArtBuilder, ThreeJSBuilder
  - create_backup(): Clean compressed .tar.gz workspace snapshot utility
"""

from __future__ import annotations

import glob
import json
import os
import shutil
import sqlite3
import subprocess
import tarfile
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

FOLIO_SDK_VERSION = "4.2.0"


class MemoryGuard:
    """Monitors RAM and disk availability on 4 GB / constrained containers."""

    @staticmethod
    def snapshot() -> Dict[str, Any]:
        total_kb = 0
        avail_kb = 0
        free_kb = 0
        try:
            with open("/proc/meminfo", "r", encoding="utf-8") as fh:
                for line in fh:
                    if line.startswith("MemTotal:"):
                        total_kb = int(line.split()[1])
                    elif line.startswith("MemAvailable:"):
                        avail_kb = int(line.split()[1])
                    elif line.startswith("MemFree:"):
                        free_kb = int(line.split()[1])
        except OSError:
            pass

        total_mb = round(total_kb / 1024.0, 1)
        avail_mb = round((avail_kb or free_kb) / 1024.0, 1)
        used_mb = round(max(0.0, total_mb - avail_mb), 1)
        used_pct = round((used_mb / total_mb) * 100.0, 1) if total_mb else 0.0
        disk = shutil.disk_usage(os.getcwd())
        return {
            "total_mb": total_mb,
            "available_mb": avail_mb,
            "used_mb": used_mb,
            "used_percent": used_pct,
            "disk_free_gb": round(disk.free / (1024 ** 3), 2),
            "disk_total_gb": round(disk.total / (1024 ** 3), 2),
            "can_run_heavy_tools": avail_mb >= 450 or total_mb == 0,
            "can_run_blender": avail_mb >= 650 or total_mb == 0,
            "can_run_tiny_llm": avail_mb >= 1100 or total_mb == 0,
        }

    @staticmethod
    def ensure_available_mb(min_mb: float) -> bool:
        snap = MemoryGuard.snapshot()
        if snap["total_mb"] == 0:
            return True
        return snap["available_mb"] >= min_mb


class KnowledgeStore:
    """Low-RAM disk-backed SQLite FTS5 + sharded search store."""

    def __init__(self, data_dir: Optional[str] = None) -> None:
        self.data_dir = data_dir or os.path.join(os.getcwd(), ".folio-data", "neo4")
        self.folio_docs_db = os.path.join(self.data_dir, "folio_docs.db")
        self.knowledge_db = os.path.join(self.data_dir, "knowledge.db")
        self.shards_dir = os.path.join(self.data_dir, "shards")

    def _open_readonly(self, db_path: str) -> sqlite3.Connection:
        conn = sqlite3.connect(db_path, timeout=2.0)
        conn.execute("PRAGMA cache_size = -8192")  # <= 8 MB page cache
        conn.execute("PRAGMA mmap_size = 33554432")  # 32 MB safe mmap
        return conn

    def _fts_query(self, query: str) -> str:
        toks = [t.lower() for t in __import__("re").findall(r"[a-zA-Z0-9_]+", query) if len(t) >= 2]
        if not toks:
            return ""
        return " OR ".join(f'"{t}"' for t in toks[:8])

    def search_folio_docs(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        if not os.path.exists(self.folio_docs_db):
            return []
        fts = self._fts_query(query)
        if not fts:
            return []
        results: List[Dict[str, Any]] = []
        conn = self._open_readonly(self.folio_docs_db)
        try:
            rows = conn.execute(
                "SELECT section_id, category, title, content, bm25(docs_fts) AS rank "
                "FROM docs_fts WHERE docs_fts MATCH ? ORDER BY rank LIMIT ?",
                (fts, limit),
            ).fetchall()
            for sec_id, cat, title, content, rank in rows:
                results.append({
                    "source": "folio_docs",
                    "sectionId": sec_id,
                    "category": cat,
                    "title": title,
                    "text": content,
                    "score": round(-float(rank), 4),
                })
        except Exception:
            pass
        finally:
            conn.close()
        return results

    def search(self, query: str, limit: int = 6) -> List[Dict[str, Any]]:
        fts = self._fts_query(query)
        if not fts:
            return []
        hits: List[Dict[str, Any]] = self.search_folio_docs(query, limit=limit)

        db_files: List[str] = []
        if os.path.exists(self.knowledge_db):
            db_files.append(self.knowledge_db)
        if os.path.isdir(self.shards_dir):
            db_files.extend(sorted(glob.glob(os.path.join(self.shards_dir, "shard_*.db"))))

        for dbp in db_files:
            conn = self._open_readonly(dbp)
            try:
                tables = {
                    r[0]
                    for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
                }
                if "corpus_fts" in tables:
                    for topic, cat, sent, rank in conn.execute(
                        "SELECT topic, category, sentence, bm25(corpus_fts) AS r "
                        "FROM corpus_fts WHERE corpus_fts MATCH ? ORDER BY r LIMIT ?",
                        (fts, limit),
                    ).fetchall():
                        hits.append({
                            "source": os.path.basename(dbp),
                            "topic": topic,
                            "category": cat,
                            "text": sent,
                            "score": round(-float(rank), 4),
                        })
                if "synsets_fts" in tables:
                    for lemmas, defn, rank in conn.execute(
                        "SELECT lemmas, definition, bm25(synsets_fts) AS r "
                        "FROM synsets_fts WHERE synsets_fts MATCH ? ORDER BY r LIMIT ?",
                        (fts, max(2, limit // 2)),
                    ).fetchall():
                        hits.append({
                            "source": "wordnet",
                            "topic": lemmas,
                            "category": "definition",
                            "text": f"{lemmas}: {defn}",
                            "score": round(-float(rank), 4),
                        })
            except Exception:
                pass
            finally:
                conn.close()

        hits.sort(key=lambda h: h.get("score", 0.0), reverse=True)
        return hits[:limit]

    def stats(self) -> Dict[str, Any]:
        shard_files = sorted(glob.glob(os.path.join(self.shards_dir, "shard_*.db"))) if os.path.isdir(self.shards_dir) else []
        docs_rows = 0
        if os.path.exists(self.folio_docs_db):
            c = self._open_readonly(self.folio_docs_db)
            try:
                docs_rows = c.execute("SELECT COUNT(*) FROM docs_sections").fetchone()[0]
            except Exception:
                pass
            finally:
                c.close()

        kb_meta: Dict[str, Any] = {}
        if os.path.exists(self.knowledge_db):
            c = self._open_readonly(self.knowledge_db)
            try:
                for k, v in c.execute("SELECT key, value FROM meta").fetchall():
                    kb_meta[k] = int(v) if str(v).isdigit() else v
            except Exception:
                pass
            finally:
                c.close()

        shard_rows = 0
        shard_bytes = 0
        for sf in shard_files:
            shard_bytes += os.path.getsize(sf)
            c = self._open_readonly(sf)
            try:
                shard_rows += c.execute("SELECT COUNT(*) FROM corpus_facts").fetchone()[0]
            except Exception:
                pass
            finally:
                c.close()

        return {
            "folioDocsDb": os.path.exists(self.folio_docs_db),
            "folioDocsSections": docs_rows,
            "knowledgeDb": os.path.exists(self.knowledge_db),
            "knowledgeMeta": kb_meta,
            "shardCount": len(shard_files),
            "shardRows": shard_rows,
            "shardDiskMb": round(shard_bytes / (1024 * 1024), 2),
        }


class FolioClient:
    """Python HTTP + local Neo 4 client for Folio."""

    def __init__(self, base_url: str = "http://localhost:3000") -> None:
        self.base_url = base_url.rstrip("/")

    def _get(self, path: str) -> Dict[str, Any]:
        req = urllib.request.Request(f"{self.base_url}{path}")
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def _post(self, path: str, body: Dict[str, Any]) -> Dict[str, Any]:
        raw = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            f"{self.base_url}{path}",
            data=raw,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=90) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def chat(
        self,
        prompt: str,
        model_id: str = "auto",
        auto_fallback: bool = True,
        neo_mode: str = "llm",
    ) -> Dict[str, Any]:
        return self._post(
            "/api/chat/complete",
            {
                "modelId": model_id,
                "neoMode": neo_mode,
                "autoFallback": auto_fallback,
                "messages": [{"role": "user", "text": prompt}],
            },
        )

    def health(self) -> Dict[str, Any]:
        return self._get("/api/system/health")

    def docs(self, query: str = "") -> Dict[str, Any]:
        q = f"?q={urllib.request.quote(query)}" if query else ""
        return self._get(f"/api/docs{q}")

    def changelog(self) -> Dict[str, Any]:
        return self._get("/api/changelog")

    def ask_neo4_local(
        self,
        prompt: str,
        thinking_mode: str = "medium",
        neo_mode: str = "llm",
    ) -> Dict[str, Any]:
        engine = os.path.join(os.getcwd(), "python", "neo4_engine.py")
        payload = json.dumps({
            "neoMode": neo_mode,
            "thinkingMode": thinking_mode,
            "semanticEngineEnabled": True,
            "messages": [{"role": "user", "text": prompt}],
        })
        proc = subprocess.run(
            ["python3", engine],
            input=payload,
            text=True,
            capture_output=True,
            timeout=65,
        )
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr or "Neo 4 engine failed")
        return json.loads(proc.stdout)


class EvoBuilder:
    """Schema-safe EVO 3D builder."""

    def __init__(self, title: str, environment: str = "cyberpunk", starfield: bool = True) -> None:
        self.spec: Dict[str, Any] = {
            "format": "evo/v1",
            "title": title,
            "fps": 30,
            "durationSec": 6,
            "loop": True,
            "background": "#080d1a",
            "environment": environment,
            "starfield": starfield,
            "gridFloor": True,
            "contactShadows": True,
            "nodes": [],
        }

    def add_node(self, node_id: str, node_type: str = "sphere", **kwargs: Any) -> "EvoBuilder":
        self.spec["nodes"].append({"id": node_id, "type": node_type, **kwargs})
        return self

    def build(self) -> Dict[str, Any]:
        if not self.spec["nodes"]:
            raise ValueError("EVO 3D requires at least one node.")
        return self.spec

    def to_markdown(self) -> str:
        return "```evo\n" + json.dumps(self.build(), indent=2) + "\n```"


class StopMotionBuilder:
    def __init__(self, title: str, width: int = 640, height: int = 360, fps: int = 24, duration_sec: float = 5.0) -> None:
        self.spec: Dict[str, Any] = {
            "format": "stopmotion/v3",
            "title": title,
            "width": width,
            "height": height,
            "fps": fps,
            "durationSec": duration_sec,
            "layers": [],
        }

    def add_layer(self, layer: Dict[str, Any]) -> "StopMotionBuilder":
        self.spec["layers"].append(layer)
        return self

    def to_markdown(self) -> str:
        return "```stopmotion\n" + json.dumps(self.spec, indent=2) + "\n```"


class PixelArtBuilder:
    def __init__(self, title: str, width: int = 64, height: int = 64, palette: Any = "cyberpunk") -> None:
        self.spec: Dict[str, Any] = {
            "format": "pixelart/v3",
            "title": title,
            "width": width,
            "height": height,
            "fps": 12,
            "frameCount": 16,
            "palette": palette,
            "draw": [],
            "shaders": ["bloom", "vignette"],
        }

    def add_op(self, op: str, **kwargs: Any) -> "PixelArtBuilder":
        self.spec["draw"].append({"op": op, **kwargs})
        return self

    def to_markdown(self) -> str:
        return "```pixelart\n" + json.dumps(self.spec, indent=2) + "\n```"


class ThreeJSBuilder:
    def __init__(self, title: str, environment: str = "cosmic", starfield: bool = True) -> None:
        self.spec: Dict[str, Any] = {
            "format": "threejs/v1",
            "title": title,
            "background": "#050816",
            "environment": environment,
            "starfield": starfield,
            "gridFloor": True,
            "objects": [],
        }

    def add_object(self, obj_id: str, shape: str = "helix", **kwargs: Any) -> "ThreeJSBuilder":
        self.spec["objects"].append({"id": obj_id, "shape": shape, **kwargs})
        return self

    def to_markdown(self) -> str:
        return "```threejs\n" + json.dumps(self.spec, indent=2) + "\n```"


def create_backup(label: str = "manual", root_dir: Optional[str] = None) -> Dict[str, Any]:
    root = root_dir or os.getcwd()
    backups_dir = os.path.join(root, ".folio-data", "backups")
    os.makedirs(backups_dir, exist_ok=True)
    safe_label = "".join(c if c.isalnum() or c in "-_" else "-" for c in label)[:32] or "snapshot"
    stamp = time.strftime("%Y%m%d-%H%M%S")
    dest = os.path.join(backups_dir, f"folio-{safe_label}-{stamp}.tar.gz")
    exclude_dirs = {"node_modules", "dist", ".git", ".folio-data"}

    def _filter(info: tarfile.TarInfo) -> Optional[tarfile.TarInfo]:
        parts = info.name.split("/")
        if any(p in exclude_dirs for p in parts):
            return None
        return info

    with tarfile.open(dest, "w:gz") as tf:
        tf.add(root, arcname=".", filter=_filter)

    return {"ok": True, "file": dest, "sizeBytes": os.path.getsize(dest)}
