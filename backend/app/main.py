"""
ACAI Backend - FastAPI Application Entry Point.

Batch 3 update: adds voice + vision routers.
"""
import re
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import PRIMARY_MODEL, OLLAMA_URL
from app.core.logger import log
from app.db.database import init_db
from app.routers import query, health, chat, documents, voice, vision


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("🚀 ACAI: محرك الذكاء الاصطناعي المعرفي العربي")
    log.info("✅ ACAI ready")

    # Initialize database tables (idempotent)
    try:
        init_db()
        log.info("Database initialized.")
    except Exception as e:
        log.error(f"DB init failed: {e}")

    # Optional Ollama model preload to warm up cache
    if PRIMARY_MODEL:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=300.0) as client:
                await client.post(
                    f"{OLLAMA_URL}/api/generate",
                    json={"model": PRIMARY_MODEL, "prompt": "test", "stream": False, "keep_alive": "10m"},
                )
            log.info(f"✅ Preloaded model: {PRIMARY_MODEL}")
        except Exception as e:
            log.warning(f"Preload skipped: {e}")

    # Surface vision/voice availability at startup
    try:
        from app.services.stt import stt
        from app.services.tts import tts
        from app.services.vision import vision
        log.info(f"🎤 STT available: {stt.is_available()}")
        log.info(f"🔊 TTS status: {tts.get_status()}")
        log.info(f"👁️  Vision status: {vision.get_status()}")
    except Exception as e:
        log.warning(f"Multimodal status check failed: {e}")

    yield
    log.info("ACAI shutting down")


app = FastAPI(
    title="ACAI v3",
    description="Arabic Cognitive AI Engine Backend - Autonomous Multi-Agent System with RAG, Voice & Vision",
    version="3.1.0",
    lifespan=lifespan,
)


# CORS: allow both localhost and 127.0.0.1 on any port (Vite uses 5173/5174/5175 unpredictably)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-TTS-Backend", "X-TTS-Voice", "X-Privacy-Note"],
)


# Register routers
app.include_router(health)
app.include_router(query)
app.include_router(chat)
app.include_router(documents)
app.include_router(voice)
app.include_router(vision)


@app.get("/")
async def root():
    return {
        "service": "ACAI",
        "version": "3.1.0",
        "name_ar": "محرك الذكاء الاصطناعي المعرفي العربي",
        "tagline": "PRIVATE · ON-PREMISE · ARABIC FIRST · RESEARCH GRADE",
        "features": {
            "multi_agent": True,
            "rag": True,
            "documents": True,
            "voice_stt": True,
            "voice_tts": True,
            "vision": True,
            "arabic_ocr": True,
        },
        "endpoints": {
            "docs": "/docs",
            "health": "/health",
            "query": "/query",
            "chat": "/chat/{session_id}",
            "documents": "/documents/upload, /documents/list, /documents/search",
            "voice": "/voice/transcribe, /voice/synthesize, /voice/status",
            "vision": "/vision/analyze, /vision/ocr, /vision/hybrid, /vision/status",
        },
    }
