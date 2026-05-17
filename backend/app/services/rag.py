import re
import sqlite3
from pathlib import Path

from app.core.config import RAG_DIR
from app.core.logger import log

RAG_DB = RAG_DIR / "rag.db"


class MinimalRAG:
    """
    Zero-dependency RAG using SQLite FTS5.
    Ingest → chunk → store → retrieve → inject → cite.
    """

    def __init__(self, db: Path = RAG_DB):
        self.db = str(db)
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db) as c:
            c.executescript("""
                CREATE TABLE IF NOT EXISTS chunks (
                    id       INTEGER PRIMARY KEY AUTOINCREMENT,
                    doc_name TEXT NOT NULL,
                    chunk_no INTEGER,
                    content  TEXT NOT NULL,
                    created  TEXT DEFAULT (datetime('now'))
                );
                CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
                    content, doc_name,
                    content='chunks', content_rowid='id'
                );
                CREATE TRIGGER IF NOT EXISTS chunks_ai
                    AFTER INSERT ON chunks BEGIN
                    INSERT INTO chunks_fts(rowid, content, doc_name)
                    VALUES (new.id, new.content, new.doc_name);
                END;
            """)

    def ingest(self, text: str, doc_name: str, chunk_size: int = 400) -> int:
        """Split document and store as searchable chunks."""
        sents = re.split(r'(?<=[.!?،؟])\s+', text)
        chunks, cur = [], ""
        for s in sents:
            if len(cur) + len(s) < chunk_size:
                cur += s + " "
            else:
                if cur.strip():
                    chunks.append(cur.strip())
                cur = s + " "
        if cur.strip():
            chunks.append(cur.strip())
        if not chunks:
            chunks = [text[:chunk_size]]

        with sqlite3.connect(self.db) as c:
            for i, ch in enumerate(chunks):
                c.execute(
                    "INSERT INTO chunks(doc_name, chunk_no, content) VALUES(?,?,?)",
                    (doc_name, i, ch)
                )
        log.info(f"RAG: ingested '{doc_name}' → {len(chunks)} chunks")
        return len(chunks)

    def retrieve(self, query: str, k: int = 3) -> list[dict]:
        """FTS5 search over chunks."""
        try:
            q_esc = '"' + query.replace('"', '""') + '"'
            with sqlite3.connect(self.db) as c:
                rows = c.execute("""
                    SELECT ch.doc_name, ch.chunk_no, ch.content
                    FROM chunks_fts cf JOIN chunks ch ON cf.rowid = ch.id
                    WHERE chunks_fts MATCH ? ORDER BY rank LIMIT ?
                """, (q_esc, k)).fetchall()
            return [{"doc": r[0], "chunk": r[1], "content": r[2]} for r in rows]
        except Exception as e:
            log.debug(f"RAG retrieve error: {e}")
            return []

    def get_rag_context(self, query: str, k: int = 3) -> str:
        chunks = self.retrieve(query, k)
        if not chunks:
            return ""
        lines = ["[مقتطفات من الوثائق المرجعية]"]
        for c in chunks:
            lines.append(f"📄 {c['doc']} — القطعة {c['chunk'] + 1}")
            lines.append(f"   {c['content'][:300]}")
        return "\n".join(lines)

    def list_docs(self) -> list[dict]:
        try:
            with sqlite3.connect(self.db) as c:
                rows = c.execute(
                    "SELECT doc_name, COUNT(*) FROM chunks GROUP BY doc_name"
                ).fetchall()
            return [{"doc_name": r[0], "chunks": r[1]} for r in rows]
        except Exception as e:
            log.debug(f"RAG list_docs error: {e}")
            return []


rag = MinimalRAG()
