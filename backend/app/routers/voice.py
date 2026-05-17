"""
Voice API Router.

Endpoints:
  GET  /voice/status                - Show STT/TTS availability
  POST /voice/transcribe            - Audio file → Arabic text
  POST /voice/synthesize            - Text → Audio (returns audio file)
  POST /voice/transcribe-and-ask    - Audio → Transcript → ACAI query response

Frontend usage (browser audio):
  1. Record audio via MediaRecorder API in browser
  2. POST as multipart/form-data to /voice/transcribe
  3. Receive transcript text
  4. (Optional) POST same audio to /voice/transcribe-and-ask to chain into agents
"""
import io
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Optional

from app.services.stt import stt
from app.services.tts import tts
from app.core.logger import log


router = APIRouter(prefix="/voice", tags=["voice"])


@router.get("/status")
async def voice_status():
    """Return what's available for voice features."""
    return {
        "stt": {
            "available": stt.is_available(),
            "engine": "faster-whisper",
            "hint": "Install with: uv add faster-whisper" if not stt.is_available() else None,
        },
        "tts": tts.get_status(),
    }


@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(..., description="Audio file (WAV/MP3/M4A/WebM/OGG)"),
    language: Optional[str] = Form("ar", description="Language hint, default Arabic"),
):
    """
    Transcribe an uploaded audio file to text.

    Returns JSON:
        {
            "text": "والله الحين وايد زين",
            "metadata": { "language": "ar", "duration_sec": 3.2, ... }
        }
    """
    if not audio:
        raise HTTPException(status_code=400, detail="No audio file provided")

    try:
        audio_bytes = await audio.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read audio: {e}")

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio file is empty")

    log.info(f"voice.transcribe: {audio.filename} ({len(audio_bytes)} bytes, lang={language})")

    text, meta = await stt.transcribe(audio_bytes, language=language)

    if meta.get("error"):
        # Don't 500 - return graceful error so frontend can show it
        return JSONResponse(
            status_code=503 if meta["error"] == "whisper_unavailable" else 500,
            content={
                "text": "",
                "metadata": meta,
                "error": meta["error"],
            },
        )

    return {
        "text": text,
        "metadata": meta,
        "filename": audio.filename,
    }


@router.post("/synthesize")
async def synthesize(
    text: str = Form(..., description="Text to convert to speech"),
    backend: Optional[str] = Form(None, description="Override backend: edge|pyttsx3"),
    voice: Optional[str] = Form(None, description="Override voice (edge only)"),
):
    """
    Convert text to speech, return audio stream.

    On success: streams audio bytes with appropriate content-type.
    On failure: returns JSON error.
    """
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="text parameter required")

    log.info(f"voice.synthesize: {len(text)} chars, backend={backend or 'default'}")

    audio_bytes, meta = await tts.synthesize(text, backend=backend, voice=voice)

    if meta.get("error") or not audio_bytes:
        return JSONResponse(
            status_code=503,
            content={"error": meta.get("error", "synthesis_failed"), "metadata": meta},
        )

    # Determine MIME type from backend
    fmt = meta.get("format", "mp3")
    media_type = "audio/mpeg" if fmt == "mp3" else "audio/wav"

    return StreamingResponse(
        io.BytesIO(audio_bytes),
        media_type=media_type,
        headers={
            "Content-Disposition": f'inline; filename="speech.{fmt}"',
            "X-TTS-Backend": meta.get("backend", "unknown"),
            "X-TTS-Voice": meta.get("voice", ""),
            "X-Privacy-Note": meta.get("privacy_note", ""),
        },
    )


@router.post("/transcribe-and-ask")
async def transcribe_and_ask(
    audio: UploadFile = File(...),
    agent: Optional[str] = Form("auto"),
    language: Optional[str] = Form("ar"),
):
    """
    Convenience endpoint: transcribe audio, then fire it at an ACAI agent.

    Returns:
        {
            "transcript": "...",
            "transcript_meta": {...},
            "agent_response": "...",
            "agent_meta": {...}
        }
    """
    if not audio:
        raise HTTPException(status_code=400, detail="No audio file provided")

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio is empty")

    # 1) Transcribe
    transcript, t_meta = await stt.transcribe(audio_bytes, language=language)
    if t_meta.get("error"):
        return JSONResponse(
            status_code=503,
            content={"error": "transcription_failed", "metadata": t_meta},
        )
    if not transcript:
        return {"transcript": "", "transcript_meta": t_meta, "agent_response": ""}

    # 2) Run through orchestrator
    try:
        from app.services.orchestrator import orchestrator
        agent_response = await orchestrator.handle_query(
            query_text=transcript,
            agent=agent,
            session_id="voice",
        )
        if isinstance(agent_response, dict):
            answer = agent_response.get("response", "") or agent_response.get("text", "")
            agent_meta = {k: v for k, v in agent_response.items() if k not in ("response", "text")}
        else:
            answer = str(agent_response)
            agent_meta = {}
    except Exception as e:
        log.error(f"voice.transcribe-and-ask: orchestrator error: {e}")
        answer = ""
        agent_meta = {"error": str(e)}

    return {
        "transcript": transcript,
        "transcript_meta": t_meta,
        "agent_response": answer,
        "agent_meta": agent_meta,
    }
