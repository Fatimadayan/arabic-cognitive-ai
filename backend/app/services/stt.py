"""
ACAI Speech-To-Text Service.

Uses faster-whisper (CTranslate2) for CPU-efficient Arabic transcription.

Key choices:
  - "tiny" model by default (~75 MB) for fast CPU inference
  - Switch to "small" or "base" in .env for higher accuracy at speed cost
  - INT8 quantization for max speed on CPU
  - Arabic language hint forces dialect-aware decoding
  - Falls back gracefully if faster-whisper isn't installed

Usage:
    from app.services.stt import stt

    text, metadata = await stt.transcribe(audio_bytes)
    # text = "والله الحين وايد زين"
    # metadata = {"language": "ar", "duration": 3.2, "model": "tiny"}
"""
import os
import tempfile
import asyncio
from pathlib import Path
from typing import Optional

from app.core.config import BACKEND_DIR
from app.core.logger import log


# Configurable via .env: WHISPER_MODEL=tiny|base|small|medium|large
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL", "tiny")

# Where faster-whisper caches downloaded models
WHISPER_CACHE_DIR = BACKEND_DIR / "data" / "whisper_models"
WHISPER_CACHE_DIR.mkdir(parents=True, exist_ok=True)


class STTService:
    """
    Speech-to-text service. Lazy-loads model on first use to avoid
    blocking server startup.
    """

    def __init__(self):
        self._model = None
        self._available = None  # tri-state: None (unknown), True, False

    def _try_import(self):
        """Attempt to import faster-whisper. Returns True if available."""
        if self._available is not None:
            return self._available
        try:
            from faster_whisper import WhisperModel
            self._available = True
            log.info("stt: faster-whisper available")
        except ImportError:
            self._available = False
            log.warning(
                "stt: faster-whisper not installed. "
                "Voice transcription disabled. "
                "Install with: uv add faster-whisper"
            )
        return self._available

    def _load_model(self):
        """Load Whisper model on first use (lazy). Returns model or None."""
        if self._model is not None:
            return self._model
        if not self._try_import():
            return None

        from faster_whisper import WhisperModel

        try:
            log.info(f"stt: loading whisper '{WHISPER_MODEL_SIZE}' (first time may download ~75MB)")
            self._model = WhisperModel(
                WHISPER_MODEL_SIZE,
                device="cpu",
                compute_type="int8",
                download_root=str(WHISPER_CACHE_DIR),
            )
            log.info(f"stt: whisper model '{WHISPER_MODEL_SIZE}' loaded")
            return self._model
        except Exception as e:
            log.error(f"stt: failed to load model: {e}")
            self._available = False
            return None

    async def transcribe(
        self,
        audio_bytes: bytes,
        language: Optional[str] = "ar",
    ) -> tuple[str, dict]:
        """
        Transcribe audio bytes to text.

        Args:
            audio_bytes: Raw audio file bytes (WAV/MP3/M4A/WebM/OGG - whisper handles many)
            language: ISO language code ("ar" for Arabic). None = auto-detect.

        Returns:
            (transcribed_text, metadata_dict)
        """
        if not audio_bytes:
            return "", {"error": "empty_audio"}

        # Run blocking model.transcribe in a thread to avoid blocking event loop
        return await asyncio.to_thread(
            self._transcribe_sync, audio_bytes, language
        )

    def _transcribe_sync(
        self,
        audio_bytes: bytes,
        language: Optional[str] = "ar",
    ) -> tuple[str, dict]:
        """Synchronous worker function."""
        model = self._load_model()
        if model is None:
            return "", {
                "error": "whisper_unavailable",
                "hint": "Install faster-whisper: uv add faster-whisper",
            }

        # faster-whisper needs a file path, not bytes. Write to a temp file.
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(
                suffix=".audio", delete=False, dir=str(WHISPER_CACHE_DIR)
            ) as f:
                f.write(audio_bytes)
                tmp_path = f.name

            segments, info = model.transcribe(
                tmp_path,
                language=language,
                beam_size=5,
                vad_filter=True,  # cut silence; faster + more accurate
                vad_parameters={"min_silence_duration_ms": 500},
            )

            # Materialize the generator
            text_parts = []
            for seg in segments:
                if seg.text:
                    text_parts.append(seg.text.strip())

            full_text = " ".join(text_parts).strip()

            return full_text, {
                "language": info.language,
                "language_probability": round(info.language_probability, 3),
                "duration_sec": round(info.duration, 2),
                "model": WHISPER_MODEL_SIZE,
                "segments": len(text_parts),
            }

        except Exception as e:
            log.error(f"stt.transcribe error: {e}")
            return "", {"error": str(e)}
        finally:
            if tmp_path and Path(tmp_path).exists():
                try:
                    Path(tmp_path).unlink()
                except Exception:
                    pass

    def is_available(self) -> bool:
        """Check if STT is ready (without forcing model load)."""
        return self._try_import()


# Singleton
stt = STTService()
