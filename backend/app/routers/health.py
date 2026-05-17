import httpx
from datetime import datetime
from fastapi import APIRouter
from app.core.config import *

router = APIRouter(prefix="/health", tags=["health"])

@router.get("")
async def health():
    try:
        async with httpx.AsyncClient(timeout=4) as c:
            pythonr = await c.get(f"{OLLAMA_URL.rstrip('/')}/api/tags")
            models = [m["name"] for m in pythonr.json().get("models", [])]
            ollama_ok = True
    except:
        models, ollama_ok = [], False
    return {
        "status":       "ok",
        "model":        PRIMARY_MODEL,
        "ollama":       ollama_ok,
        "models":       models,
        "timestamp":    datetime.now().isoformat(),
    }