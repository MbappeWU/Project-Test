from pathlib import Path

from memomind.storage.sqlite_store import SqliteVectorStore
from memomind.storage.vector_store import InMemoryVectorStore


def test_in_memory_vector_store_search_orders_results():
    store = InMemoryVectorStore()
    store.upsert("a", [1.0, 0.0], payload={"summary": "first"})
    store.upsert("b", [0.0, 1.0], payload={"summary": "second"})

    results = store.search([1.0, 0.0], limit=2)

    assert results[0][0] == "a"
    assert results[0][1] >= results[1][1]


def test_sqlite_vector_store_persists_and_searches(tmp_path: Path):
    db_path = tmp_path / "memomind.db"
    store = SqliteVectorStore(db_path=db_path)
    store.upsert("memory", [0.5, 0.5], payload={"summary": "hello"})

    new_store = SqliteVectorStore(db_path=db_path)
    results = new_store.search([0.5, 0.5], limit=1)

    assert results
    assert results[0][0] == "memory"
