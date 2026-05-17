"""
ACAI Core Config - Bulletproof env loading.

Loads .env from backend/ root regardless of where Python was invoked.
All env vars have fallback defaults so missing .env never crashes the app.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Force-load .env from backend/ directory (not CWD).
# This file is at: backend/app/core/config.py
# So backend/ is: parent.parent.parent
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BACKEND_DIR / ".env"
load_dotenv(ENV_FILE)

# ─── Core settings ─────────────────────────────────────────────────────
API_KEY        = os.getenv("API_KEY", "acai-dev-key-change-me")
PRIMARY_MODEL  = os.getenv("PRIMARY_MODEL", "qwen2.5:7b-instruct-q4_K_M")
ARABIC_MODEL   = os.getenv("ARABIC_MODEL", "bahraini-pro:latest")
VISION_MODEL   = os.getenv("VISION_MODEL", "llava:7b")  # for vision (Batch 3)

# Normalize Ollama URL - always strips trailing slash so /api/<endpoint> works
OLLAMA_URL     = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")

# Database - default to SQLite file in backend/ so app boots even without .env
DATABASE_URL   = os.getenv("DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'acai.db'}")

# ─── Verification thresholds (used by services/verification.py) ────────
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.5"))
MAX_RETRY_ATTEMPTS   = int(os.getenv("MAX_RETRY_ATTEMPTS", "1"))

# ─── Paths ─────────────────────────────────────────────────────────────
BASE_DIR    = Path(__file__).parent
RAG_DIR     = BACKEND_DIR / "data" / "rag"
UPLOAD_DIR  = BACKEND_DIR / "data" / "uploads"
RESULTS_DIR = BACKEND_DIR / "results"

# Create dirs if missing (no-op if exist)
for d in (RAG_DIR, UPLOAD_DIR, RESULTS_DIR):
    d.mkdir(parents=True, exist_ok=True)

# ─── Auth / routing ────────────────────────────────────────────────────
PUBLIC_PATHS = {
    "/health",
    "/docs",
    "/openapi.json",
    "/",
    "/query/stream",
    # Note: leading slash - was inconsistent before, FastAPI's request.url.path includes leading /
}
