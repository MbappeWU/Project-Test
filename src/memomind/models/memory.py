from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Optional


@dataclass(frozen=True)
class Memory:
    """Normalized memory representation stored for retrieval."""

    summary: str
    memory_type: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    importance: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    related_document_id: Optional[str] = None
