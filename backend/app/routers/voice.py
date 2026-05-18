"""
ACAI Voice Router.

Routes for speech transcription (STT) and synthesis (TTS).

KEY FIX vs previous version:
  Surfaces REAL errors from stt.transcribe() and tts.synthesize()
  instead of short-circuiting with generic 'whisper_unavailable'
  or 'edge_tts_not_installed' messages.
"""
from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import JSONResponse, Response
import logging

from app.services.stt import stt
from app.services.tts import tts

log = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["voice"])


@router.get("/status")
def voice_status():
    """Detailed status for both STT and TTS. Used by frontend diagnostics."""
    return {
        "stt": stt.status(),
        "tts": tts.status(),
    }


@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    language: str = Form("ar"),
):
    """
    Transcribe an uploaded audio file (webm/wav/mp3) to text.

    Returns:
      Success: { text, language, duration, model }
      Failure: { text: "", error: "...", detail: "...", hint: "..." }
                (HTTP 200 — error info is in body, not status code,
                 because the frontend needs to display the detail)
    """
    try:
        audio_bytes = await audio.read()
        if not audio_bytes:
            return JSONResponse({
                "text": "",
                "error": "empty_audio",
                "detail": "Audio file is empty (0 bytes)",
                "hint": "Try recording for at least 1 second.",
            })

        log.info(f"voice: transcribe request — {len(audio_bytes)} bytes, lang={language}")
        result = stt.transcribe(audio_bytes, language=language)

        # Log the actual error if any
        if "error" in result:
            log.error(f"voice: transcribe error — {result.get('error')}: {result.get('detail')}")

        return JSONResponse(result)

    except Exception as e:
        log.exception("voice: transcribe handler crashed")
        return JSONResponse({
            "text": "",
            "error": "handler_exception",
            "detail": f"{type(e).__name__}: {e}",
            "hint": "Check backend logs for full traceback.",
        })


@router.post("/synthesize")
async def synthesize(
    text: str = Form(...),
    voice: str = Form(None),
):
    """
    Synthesize text to audio.

    Success: returns audio/mpeg or audio/wav bytes (HTTP 200)
    Failure: returns JSON with detailed error (HTTP 200, error in body)
    """
    try:
        log.info(f"voice: synthesize request — {len(text)} chars, voice={voice or 'default'}")
        result = await tts.synthesize(text, voice=voice)

        if "error" in result:
            log.error(f"voice: synthesize error — {result.get('error')}: {result.get('detail')}")
            return JSONResponse(result)

        # Success — stream audio bytes back
        audio_bytes = result["audio"]
        media_type = "audio/mpeg" if result["format"] == "mp3" else "audio/wav"

        return Response(
            content=audio_bytes,
            media_type=media_type,
            headers={
                "X-TTS-Backend": result["backend"],
                "X-TTS-Format": result["format"],
            },
        )

    except Exception as e:
        log.exception("voice: synthesize handler crashed")
        return JSONResponse({
            "error": "handler_exception",
            "detail": f"{type(e).__name__}: {e}",
            "hint": "Check backend logs for full traceback.",
        })
