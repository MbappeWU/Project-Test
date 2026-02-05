from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Tuple

from memomind.storage.serialization import dumps_payload, dumps_vector, loads_vector
from memomind.storage.vector_store import cosine_similarity


@dataclass
class SqliteVectorStore:
    """SQLite-backed vector store for local persistence."""

    db_path: Path = field(default_factory=lambda: Path("memomind.db"))

    def __post_init__(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def upsert(self, item_id: str, vector: List[float], payload: Dict[str, str]) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO vectors (id, vector, payload)
                VALUES (?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET vector=excluded.vector, payload=excluded.payload
                """,
                (item_id, dumps_vector(vector), dumps_payload(payload)),
            )
            conn.commit()

    def search(self, vector: List[float], limit: int = 5) -> List[Tuple[str, float]]:
        with self._connect() as conn:
            rows = conn.execute("SELECT id, vector FROM vectors").fetchall()
        scored = []
        for item_id, stored_vector in rows:
            score = cosine_similarity(vector, loads_vector(stored_vector))
            scored.append((item_id, score))
        scored.sort(key=lambda item: item[1], reverse=True)
        return scored[:limit]

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS vectors (
                    id TEXT PRIMARY KEY,
                    vector TEXT NOT NULL,
                    payload TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)
