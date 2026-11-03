"""
SQLite Database manager for Smart PPE Kit Detection System.
Stores and queries violation history with evidence images.
"""
import sqlite3
from datetime import datetime
from typing import List, Dict, Any, Optional
import os
import config

class DatabaseManager:
    def __init__(self, db_path: str = str(config.DATABASE_PATH)):
        self.db_path = db_path
        self._init_db()

    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        """Creates the violations table and indexes if they do not exist."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS violations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    violation_type TEXT NOT NULL,
                    missing_ppe TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    evidence_path TEXT,
                    source TEXT DEFAULT 'image_upload',
                    details TEXT
                )
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_violations_timestamp 
                ON violations(timestamp DESC)
            """)
            conn.commit()

    def record_violation(
        self,
        violation_type: str,
        missing_ppe: List[str],
        confidence: float,
        evidence_path: Optional[str] = None,
        source: str = "image_upload",
        details: Optional[str] = None
    ) -> int:
        """Inserts a new violation entry into the database."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        missing_str = ", ".join(missing_ppe) if isinstance(missing_ppe, list) else str(missing_ppe)
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO violations (timestamp, violation_type, missing_ppe, confidence, evidence_path, source, details)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (timestamp, violation_type, missing_str, float(confidence), evidence_path, source, details))
            conn.commit()
            return cursor.lastrowid

    def get_violations(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """Retrieves violation history sorted by newest first."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, timestamp, violation_type, missing_ppe, confidence, evidence_path, source, details
                FROM violations
                ORDER BY id DESC
                LIMIT ? OFFSET ?
            """, (limit, offset))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def get_stats(self) -> Dict[str, Any]:
        """Calculates total violations and breakdown by category."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) AS total FROM violations")
            total = cursor.fetchone()["total"]

            cursor.execute("""
                SELECT violation_type, COUNT(*) as count 
                FROM violations 
                GROUP BY violation_type
                ORDER BY count DESC
            """)
            by_type = [dict(row) for row in cursor.fetchall()]

            return {
                "total_violations": total,
                "breakdown": by_type
            }

    def delete_violation(self, violation_id: int) -> bool:
        """Deletes a specific violation record and cleans up evidence file if needed."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT evidence_path FROM violations WHERE id = ?", (violation_id,))
            row = cursor.fetchone()
            if row and row["evidence_path"] and os.path.exists(row["evidence_path"]):
                try:
                    os.remove(row["evidence_path"])
                except Exception:
                    pass

            cursor.execute("DELETE FROM violations WHERE id = ?", (violation_id,))
            conn.commit()
            return cursor.rowcount > 0

    def clear_all(self):
        """Clears all records."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM violations")
            conn.commit()
