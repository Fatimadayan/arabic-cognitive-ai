"""
ACAI Speech-to-Text service.

Improvements:
  - Uses better beam_size=5 (instead of 1) for higher accuracy
  - initial_prompt seeds Whisper with Arabic context
  - Supports WHISPER_MODEL=small/medium for accuracy upgrade
  - Backward-compat exports `stt` singleton + `is_available()`
"""
import logging
import os
import tempfile
import traceback
from pathlib import Path
from typing import Optional, Dict, Any

log = logging.getLogger(__name__)

WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL", "tiny")
WHISPER_CACHE_DIR = Path(os.getenv("WHISPER_CACHE", "./whisper_cache"))
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE = os.getenv("WHISPER_COMPUTE", "int8")

# Seed Whisper with Arabic context — helps it produce Arabic-correct output
ARABIC_INITIAL_PROMPT = (
    "هذا نص باللغة العربية الفصحى. "
    "يحتوي على أسئلة وكلمات عربية. "
    "أين الكويت، ما هي البحرين، كيف الحال."
)


class STTService:
    def __init__(self):
        self._model = None
        self._import_ok = None
        self._load_error: Optional[str] = None
        self._try_import()

    def _try_import(self) -> bool:
        if self._import_ok is not None:
            return self._import_ok
        try:
            import faster_whisper  # noqa: F401
            self._import_ok = True
            log.info("stt: faster-whisper available")
        except Exception as e:
            self._import_ok = False
            self._load_error = f"import_failed: {type(e).__name__}: {e}"
            log.error(f"stt: faster-whisper import failed: {e}")
        return self._import_ok

    @property
    def available(self) -> bool:
        return bool(self._import_ok)

    def is_available(self) -> bool:
        """Backward-compat method for main.py startup check."""
        return self.available

    def _load_model(self):
        if self._model is not None:
            return self._model
        if not self._try_import():
            return None

        from faster_whisper import WhisperModel

        try:
            log.info(f"stt: loading whisper '{WHISPER_MODEL_SIZE}' on {WHISPER_DEVICE}")
            WHISPER_CACHE_DIR.mkdir(parents=True, exist_ok=True)
            self._model = WhisperModel(
                WHISPER_MODEL_SIZE,
                device=WHISPER_DEVICE,
                compute_type=WHISPER_COMPUTE,
                download_root=str(WHISPER_CACHE_DIR),
            )
            log.info(f"stt: whisper '{WHISPER_MODEL_SIZE}' loaded")
            return self._model
        except Exception as e:
            tb = traceback.format_exc()
            self._load_error = f"{type(e).__name__}: {e}"
            log.error(f"stt: model load failed:\n{tb}")
            return None

    def status(self) -> Dict[str, Any]:
        return {
            "available": self.available,
            "model_size": WHISPER_MODEL_SIZE,
            "device": WHISPER_DEVICE,
            "compute": WHISPER_COMPUTE,
            "model_loaded": self._model is not None,
            "load_error": self._load_error,
            "cache_dir": str(WHISPER_CACHE_DIR.absolute()),
            "accuracy_tip": (
                "For better Arabic accuracy, set WHISPER_MODEL=small or medium in .env"
                if WHISPER_MODEL_SIZE == "tiny" else None
            ),
        }

    def transcribe(self, audio_bytes: bytes, language: str = "ar") -> Dict[str, Any]:
        if not self._try_import():
            return {"text": "", "error": "whisper_not_installed",
                    "detail": self._load_error}

        model = self._load_model()
        if model is None:
            return {"text": "", "error": "whisper_load_failed",
                    "detail": self._load_error or "unknown load failure"}

        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            # ★ IMPROVED TRANSCRIPTION SETTINGS for Arabic accuracy ★
            segments, info = model.transcribe(
                tmp_path,
                language=language,
                beam_size=5,                     # was 1; 5 is much more accurate
                best_of=5,                       # generates multiple candidates and picks best
                temperature=0.0,                 # deterministic, less hallucination
                condition_on_previous_text=False,# prevents drift on short audio
                initial_prompt=ARABIC_INITIAL_PROMPT if language == "ar" else None,
                vad_filter=True,                 # voice activity detection
                vad_parameters={"min_silence_duration_ms": 500},
            )
            text = " ".join(seg.text.strip() for seg in segments).strip()

            return {
                "text": text,
                "language": info.language,
                "duration": info.duration,
                "model": WHISPER_MODEL_SIZE,
                "hint": (
                    "Transcription accuracy can be improved by upgrading "
                    "WHISPER_MODEL from 'tiny' to 'small' or 'medium' in .env"
                    if WHISPER_MODEL_SIZE == "tiny" else None
                ),
            }
        except Exception as e:
            tb = traceback.format_exc()
            log.error(f"stt: transcribe failed:\n{tb}")
            return {"text": "", "error": "transcribe_failed",
                    "detail": f"{type(e).__name__}: {e}"}
        finally:
            if tmp_path:
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass


# Backward-compat singleton
stt = STTService()


def get_stt() -> STTService:
    return stt
