"""
MemoMind - A Multimodal Personal Memory Agent

A local-first personal AI agent that collects multimodal data,
builds a personal knowledge base, and maintains long/short-term memory.
"""

__version__ = "0.1.0"
__author__ = "MemoMind Team"

from memomind.core.agent import AgentOrchestrator
from memomind.core.memory import MemoryManager
from memomind.core.knowledge import KnowledgeProcessor

__all__ = [
    "AgentOrchestrator",
    "MemoryManager",
    "KnowledgeProcessor",
    "__version__",
]
