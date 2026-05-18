"""
ACAI Text-to-Speech service.

Strips markdown formatting before synthesis so TTS doesn't read out
asterisks, hashes, brackets, etc. as "نجمة، نجمة".
"""
import asyncio
import logging
import os
import re
import tempfile
from typing import Optional, Dict, Any

log = logging.getLogger(__name__)

EDGE_VOICE = os.getenv("EDGE_TTS_VOICE", "ar-BH-LailaNeural")
TTS_BACKEND = os.getenv("TTS_BACKEND", "edge").lower()
PRIVACY_MODE = os.getenv("PRIVACY_MODE", "false").lower() == "true"


def strip_markdown_for_tts(text: str) -> str:
    """
    Remove markdown formatting so TTS reads only the spoken content.
    Handles: **bold**, *italic*, ##headers, [links](url), `code`, lists,
    bullets, dashes, emojis, and other punctuation noise.
    """
    if not text:
        return ""

    # Remove code blocks (triple backticks)
    text = re.sub(r'```[^`]*```', '', text, flags=re.DOTALL)

    # Remove inline code (single backticks)
    text = re.sub(r'`([^`]+)`', r'\1', text)

    # Remove markdown links [text](url) → text
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)

    # Remove bold/italic markers (** and *)
    text = re.sub(r'\*{1,3}([^\*]+)\*{1,3}', r'\1', text)

    # Remove header hashes (# ## ###)
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)

    # Remove list bullets and numbering
    text = re.sub(r'^[\s]*[-•·]\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^[\s]*\d+[\.\)]\s+', '', text, flags=re.MULTILINE)

    # Remove blockquote markers
    text = re.sub(r'^>\s+', '', text, flags=re.MULTILINE)

    # Remove horizontal rules
    text = re.sub(r'^[-=_]{3,}$', '', text, flags=re.MULTILINE)

    # Remove emoji and common decorative symbols that TTS reads literally
    decorative_chars = '🔭🧠⚖️🔍🕸️🎤🔊🖼️📄✅❌⚠️🛡️⛔🌟⭐★☆◈◉◊⬡▲▼→←↑↓⎘'
    for ch in decorative_chars:
        text = text.replace(ch, ' ')

    # Remove other emoji ranges using regex
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"  # emoticons
        "\U0001F300-\U0001F5FF"  # symbols & pictographs
        "\U0001F680-\U0001F6FF"  # transport & map symbols
        "\U0001F1E0-\U0001F1FF"  # flags
        "\U00002600-\U000027BF"  # misc symbols
        "\U0001F900-\U0001F9FF"  # supplemental symbols
        "]+", flags=re.UNICODE)
    text = emoji_pattern.sub(' ', text)

    # Remove pipe table delimiters
    text = re.sub(r'\|', ' ', text)
    text = re.sub(r'^[\s\-:]+$', '', text, flags=re.MULTILINE)

    # Collapse multiple spaces and blank lines
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = text.strip()

    return text


class TTSService:
    def __init__(self):
        self._edge_ok = None
        self._pyttsx3_ok = None
        self._edge_error: Optional[str] = None
        self._pyttsx3_error: Optional[str] = None

    def _check_edge(self) -> bool:
        if self._edge_ok is not None:
            return self._edge_ok
        try:
            import edge_tts  # noqa: F401
            self._edge_ok = True
        except Exception as e:
            self._edge_ok = False
            self._edge_error = f"{type(e).__name__}: {e}"
            log.warning(f"tts: edge-tts import failed: {e}")
        return self._edge_ok

    def _check_pyttsx3(self) -> bool:
        if self._pyttsx3_ok is not None:
            return self._pyttsx3_ok
        try:
            import pyttsx3  # noqa: F401
            self._pyttsx3_ok = True
        except Exception as e:
            self._pyttsx3_ok = False
            self._pyttsx3_error = f"{type(e).__name__}: {e}"
            log.warning(f"tts: pyttsx3 import failed: {e}")
        return self._pyttsx3_ok

    def is_available(self) -> bool:
        """Backward-compat for main.py startup check."""
        return self._check_edge() or self._check_pyttsx3()

    def status(self) -> Dict[str, Any]:
        return {
            "default_backend": "pyttsx3" if PRIVACY_MODE else TTS_BACKEND,
            "default_voice": EDGE_VOICE,
            "available": {
                "edge": self._check_edge(),
                "pyttsx3": self._check_pyttsx3(),
            },
            "errors": {
                "edge": self._edge_error,
                "pyttsx3": self._pyttsx3_error,
            },
            "privacy_mode": PRIVACY_MODE,
        }

    async def _synth_edge(self, text: str, voice: str) -> bytes:
        if not self._check_edge():
            raise RuntimeError(f"edge-tts import failed: {self._edge_error}")

        import edge_tts

        communicate = edge_tts.Communicate(text, voice)
        chunks = []
        try:
            async for chunk in communicate.stream():
                if chunk.get("type") == "audio":
                    chunks.append(chunk["data"])
        except Exception as e:
            raise RuntimeError(f"edge-tts network/stream failed: {type(e).__name__}: {e}")

        if not chunks:
            raise RuntimeError("edge-tts returned no audio (empty response)")

        return b"".join(chunks)

    def _synth_pyttsx3(self, text: str) -> bytes:
        if not self._check_pyttsx3():
            raise RuntimeError(f"pyttsx3 import failed: {self._pyttsx3_error}")

        import pyttsx3
        engine = pyttsx3.init()
        tmp = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
                tmp = f.name
            engine.save_to_file(text, tmp)
            engine.runAndWait()
            with open(tmp, "rb") as f:
                return f.read()
        finally:
            if tmp:
                try:
                    os.unlink(tmp)
                except Exception:
                    pass

    async def synthesize(self, text: str, voice: str = None) -> Dict[str, Any]:
        """
        Synthesize text to audio. STRIPS MARKDOWN BEFORE SYNTHESIS so the
        voice doesn't read asterisks, hashes, etc.
        """
        text = (text or "").strip()
        if not text:
            return {"error": "empty_text", "detail": "No text provided"}

        # ★ KEY FIX: clean markdown before TTS ★
        clean_text = strip_markdown_for_tts(text)

        if not clean_text:
            return {"error": "empty_after_strip",
                    "detail": "Text was only markdown formatting"}

        if len(clean_text) > 5000:
            clean_text = clean_text[:5000]

        log.info(f"tts: original={len(text)} chars, cleaned={len(clean_text)} chars")

        voice = voice or EDGE_VOICE
        use_pyttsx3_first = PRIVACY_MODE or TTS_BACKEND == "pyttsx3"

        if not use_pyttsx3_first and self._check_edge():
            try:
                audio = await self._synth_edge(clean_text, voice)
                return {"audio": audio, "format": "mp3", "backend": "edge"}
            except Exception as e:
                log.warning(f"tts: edge failed, falling back: {e}")
                edge_err = str(e)

                if self._check_pyttsx3():
                    try:
                        audio = self._synth_pyttsx3(clean_text)
                        return {"audio": audio, "format": "wav", "backend": "pyttsx3",
                                "fallback_reason": edge_err}
                    except Exception as e2:
                        return {
                            "error": "tts_all_backends_failed",
                            "detail": f"edge: {edge_err} | pyttsx3: {e2}",
                        }
                else:
                    return {
                        "error": "tts_edge_failed_no_fallback",
                        "detail": edge_err,
                    }

        if self._check_pyttsx3():
            try:
                audio = self._synth_pyttsx3(clean_text)
                return {"audio": audio, "format": "wav", "backend": "pyttsx3"}
            except Exception as e:
                return {
                    "error": "pyttsx3_failed",
                    "detail": f"{type(e).__name__}: {e}",
                }

        return {
            "error": "no_tts_backend_available",
            "detail": f"edge_ok={self._edge_ok}; pyttsx3_ok={self._pyttsx3_ok}",
        }


# Backward-compat singleton
tts = TTSService()


def get_tts() -> TTSService:
    return tts
