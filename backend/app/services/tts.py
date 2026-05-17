"""
ACAI Text-To-Speech Service.

Dual backend:
  - "edge"     - Microsoft Edge TTS (cloud, high quality, requires internet)
                 ⚠️ Sends text to MS servers - breaks "fully private" claim
  - "pyttsx3"  - Windows SAPI (100% local, robotic quality)
                 ✅ Preserves privacy claim
  - "none"     - Disable TTS

Configured via TTS_BACKEND env var. Default: "edge" for demo quality,
switch to "pyttsx3" for privacy-strict mode.

Usage:
    from app.services.tts import tts

    audio_bytes = await tts.synthesize("مرحبا بالعالم")
    # audio_bytes = raw MP3 data
"""
import os
import asyncio
import tempfile
from pathlib import Path
from typing import Optional

from app.core.config import BACKEND_DIR
from app.core.logger import log


# Backend selection: edge | pyttsx3 | none
TTS_BACKEND = os.getenv("TTS_BACKEND", "edge").lower()

# Edge voice - Arabic options:
#   ar-SA-HamedNeural (male, Saudi)
#   ar-SA-ZariyahNeural (female, Saudi)
#   ar-EG-ShakirNeural (male, Egyptian)
#   ar-BH-AliNeural (male, Bahraini) ← best for ACAI!
#   ar-BH-LailaNeural (female, Bahraini) ← best for ACAI!
EDGE_VOICE = os.getenv("EDGE_TTS_VOICE", "ar-BH-LailaNeural")

# Where TTS output is cached/saved
TTS_OUTPUT_DIR = BACKEND_DIR / "data" / "tts_output"
TTS_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


class TTSService:
    """
    Text-to-speech with pluggable backends.
    Lazy initialization - won't fail on import if a backend is missing.
    """

    def __init__(self):
        self._edge_available = None
        self._pyttsx3_available = None
        self._pyttsx3_engine = None

    def _check_edge(self) -> bool:
        """Check if edge-tts is importable."""
        if self._edge_available is not None:
            return self._edge_available
        try:
            import edge_tts  # noqa: F401
            self._edge_available = True
        except ImportError:
            log.warning("tts: edge-tts not installed. Run: uv add edge-tts")
            self._edge_available = False
        return self._edge_available

    def _check_pyttsx3(self) -> bool:
        """Check if pyttsx3 is importable."""
        if self._pyttsx3_available is not None:
            return self._pyttsx3_available
        try:
            import pyttsx3  # noqa: F401
            self._pyttsx3_available = True
        except ImportError:
            log.warning("tts: pyttsx3 not installed. Run: uv add pyttsx3")
            self._pyttsx3_available = False
        return self._pyttsx3_available

    async def _synthesize_edge(self, text: str, voice: str) -> tuple[bytes, dict]:
        """Use Microsoft Edge TTS (cloud)."""
        if not self._check_edge():
            return b"", {"error": "edge_tts_not_installed"}

        import edge_tts

        try:
            communicator = edge_tts.Communicate(text, voice)
            audio_chunks: list[bytes] = []
            async for chunk in communicator.stream():
                if chunk.get("type") == "audio":
                    data = chunk.get("data")
                    if data:
                        audio_chunks.append(data)

            audio_bytes = b"".join(audio_chunks)
            return audio_bytes, {
                "backend": "edge",
                "voice": voice,
                "format": "mp3",
                "size_bytes": len(audio_bytes),
                "privacy_note": "Audio synthesized via Microsoft cloud servers",
            }
        except Exception as e:
            log.error(f"tts.edge error: {e}")
            return b"", {"error": str(e), "backend": "edge"}

    def _synthesize_pyttsx3_sync(self, text: str) -> tuple[bytes, dict]:
        """Use Windows SAPI via pyttsx3 (100% local)."""
        if not self._check_pyttsx3():
            return b"", {"error": "pyttsx3_not_installed"}

        import pyttsx3

        out_path = None
        try:
            engine = pyttsx3.init()
            # Try to find an Arabic voice
            arabic_voice_id = None
            for v in engine.getProperty("voices"):
                if "ar" in (v.languages[0] if v.languages else "").lower() or "arab" in v.name.lower():
                    arabic_voice_id = v.id
                    break
            if arabic_voice_id:
                engine.setProperty("voice", arabic_voice_id)

            engine.setProperty("rate", 160)  # slower for clarity

            with tempfile.NamedTemporaryFile(
                suffix=".wav", delete=False, dir=str(TTS_OUTPUT_DIR)
            ) as f:
                out_path = f.name

            engine.save_to_file(text, out_path)
            engine.runAndWait()

            audio_bytes = Path(out_path).read_bytes()
            return audio_bytes, {
                "backend": "pyttsx3",
                "voice": arabic_voice_id or "default",
                "format": "wav",
                "size_bytes": len(audio_bytes),
                "privacy_note": "Fully local - no data leaves machine",
            }
        except Exception as e:
            log.error(f"tts.pyttsx3 error: {e}")
            return b"", {"error": str(e), "backend": "pyttsx3"}
        finally:
            if out_path and Path(out_path).exists():
                try:
                    Path(out_path).unlink()
                except Exception:
                    pass

    async def synthesize(
        self,
        text: str,
        backend: Optional[str] = None,
        voice: Optional[str] = None,
    ) -> tuple[bytes, dict]:
        """
        Convert text to speech audio bytes.

        Args:
            text: Text to synthesize (Arabic or English)
            backend: Override the default backend ("edge", "pyttsx3", "none")
            voice: Override the default voice (edge backend only)

        Returns:
            (audio_bytes, metadata)
            audio_bytes is empty on failure - check metadata for error
        """
        if not text or not text.strip():
            return b"", {"error": "empty_text"}

        # Cap text length (TTS gets expensive on long output)
        text = text.strip()[:2000]

        chosen_backend = (backend or TTS_BACKEND).lower()

        if chosen_backend == "none":
            return b"", {"backend": "none", "note": "TTS disabled"}

        if chosen_backend == "edge":
            return await self._synthesize_edge(text, voice or EDGE_VOICE)

        if chosen_backend == "pyttsx3":
            # Run blocking pyttsx3 in thread
            return await asyncio.to_thread(self._synthesize_pyttsx3_sync, text)

        log.warning(f"tts.synthesize: unknown backend '{chosen_backend}'")
        return b"", {"error": f"unknown_backend:{chosen_backend}"}

    def get_status(self) -> dict:
        """Report which backends are available."""
        return {
            "default_backend": TTS_BACKEND,
            "default_voice": EDGE_VOICE,
            "available": {
                "edge": self._check_edge(),
                "pyttsx3": self._check_pyttsx3(),
            },
            "privacy_mode": TTS_BACKEND == "pyttsx3",
        }


# Singleton
tts = TTSService()
