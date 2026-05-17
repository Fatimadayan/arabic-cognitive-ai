"""
ACAI Vision Service.

Two capabilities:
  1. analyze_image()  - Send image to LLaVA via Ollama for description/reasoning
                        (uses qwen2.5vl or llava model)
  2. ocr_arabic()     - Extract Arabic text from images via Tesseract OCR

Both lazy-load and degrade gracefully if dependencies are missing.

Requires:
  - Ollama running with a vision-capable model pulled
    (recommended: `ollama pull qwen2.5vl:7b` or `ollama pull llava:7b`)
  - For OCR: Tesseract installed + ara.traineddata language pack
    (download from https://github.com/tesseract-ocr/tessdata/raw/main/ara.traineddata)

Usage:
    from app.services.vision import vision

    desc, meta = await vision.analyze_image(image_bytes, "ما الذي تراه في هذه الصورة؟")
    text, meta = await vision.ocr_arabic(image_bytes)
"""
import os
import base64
import asyncio
import tempfile
from io import BytesIO
from pathlib import Path
from typing import Optional

import httpx

from app.core.config import BACKEND_DIR, OLLAMA_URL, VISION_MODEL
from app.core.logger import log


OLLAMA_HOST = OLLAMA_URL

# Configurable: which Ollama vision model to use
# Common choices: qwen2.5vl:7b, llava:7b, llava:13b, bakllava
# The value comes from backend/.env via app.core.config

# Tesseract OCR settings
TESSERACT_CMD = os.getenv("TESSERACT_CMD")  # e.g. "C:\\Program Files\\Tesseract-OCR\\tesseract.exe"
OCR_LANG = os.getenv("OCR_LANG", "ara+eng")  # Arabic + English fallback

VISION_CACHE_DIR = BACKEND_DIR / "data" / "vision_cache"
VISION_CACHE_DIR.mkdir(parents=True, exist_ok=True)


class VisionService:
    """
    Vision service with two backends:
      - Ollama LLaVA for high-level understanding
      - Tesseract for exact text extraction
    """

    def __init__(self):
        self._ocr_available = None
        self._pil_available = None

    def _check_pil(self) -> bool:
        if self._pil_available is not None:
            return self._pil_available
        try:
            from PIL import Image  # noqa: F401
            self._pil_available = True
        except ImportError:
            log.warning("vision: PIL not installed. Run: uv add pillow")
            self._pil_available = False
        return self._pil_available

    def _check_ocr(self) -> bool:
        if self._ocr_available is not None:
            return self._ocr_available
        try:
            import pytesseract  # noqa: F401
            if TESSERACT_CMD:
                pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
            self._ocr_available = True
            log.info("vision: pytesseract available")
        except ImportError:
            log.warning("vision: pytesseract not installed. Run: uv add pytesseract")
            self._ocr_available = False
        return self._ocr_available

    async def analyze_image(
        self,
        image_bytes: bytes,
        prompt: str = "Describe this image in detail. If there is Arabic text, transcribe it.",
        model: Optional[str] = None,
    ) -> tuple[str, dict]:
        """
        Send image to Ollama vision model. Returns description.

        Args:
            image_bytes: Raw image bytes (PNG/JPG/etc.)
            prompt: Question to ask about the image
            model: Override default VISION_MODEL

        Returns:
            (description_text, metadata)
        """
        if not image_bytes:
            return "", {"error": "empty_image"}

        model_name = model or VISION_MODEL
        img_b64 = base64.b64encode(image_bytes).decode("ascii")

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{OLLAMA_HOST}/api/generate",
                    json={
                        "model": model_name,
                        "prompt": prompt,
                        "images": [img_b64],
                        "stream": False,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                description = (data.get("response") or "").strip()

                return description, {
                    "model": model_name,
                    "prompt": prompt,
                    "image_size_bytes": len(image_bytes),
                    "eval_count": data.get("eval_count"),
                    "total_duration_ms": (data.get("total_duration", 0) // 1_000_000),
                }
        except httpx.HTTPStatusError as e:
            err = f"ollama_http_{e.response.status_code}"
            hint = ""
            if e.response.status_code == 404:
                hint = f"Pull the model first: ollama pull {model_name}"
            log.error(f"vision.analyze_image: {err} - {e.response.text[:200]}")
            return "", {"error": err, "hint": hint, "model": model_name}
        except Exception as e:
            log.error(f"vision.analyze_image: {e}")
            return "", {"error": str(e), "model": model_name}

    async def ocr_arabic(
        self,
        image_bytes: bytes,
        lang: Optional[str] = None,
    ) -> tuple[str, dict]:
        """
        Extract Arabic text from image using Tesseract OCR.

        Args:
            image_bytes: Raw image bytes
            lang: Tesseract lang code, default "ara+eng"

        Returns:
            (extracted_text, metadata)
        """
        if not image_bytes:
            return "", {"error": "empty_image"}

        # Run blocking OCR in thread
        return await asyncio.to_thread(self._ocr_sync, image_bytes, lang or OCR_LANG)

    def _ocr_sync(self, image_bytes: bytes, lang: str) -> tuple[str, dict]:
        if not self._check_pil() or not self._check_ocr():
            return "", {
                "error": "ocr_unavailable",
                "hint": "Install: uv add pytesseract pillow + system Tesseract with ara language pack",
            }

        import pytesseract
        from PIL import Image

        try:
            img = Image.open(BytesIO(image_bytes))

            # Tesseract works better on RGB/grayscale than RGBA
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")

            text = pytesseract.image_to_string(img, lang=lang)
            text = text.strip()

            # Confidence: tesseract.image_to_data gives per-word confidences
            try:
                data = pytesseract.image_to_data(
                    img, lang=lang, output_type=pytesseract.Output.DICT
                )
                confs = [int(c) for c in data.get("conf", []) if str(c).lstrip("-").isdigit() and int(c) >= 0]
                avg_conf = round(sum(confs) / len(confs), 2) if confs else None
            except Exception:
                avg_conf = None

            return text, {
                "lang": lang,
                "image_size_bytes": len(image_bytes),
                "image_dimensions": list(img.size),
                "char_count": len(text),
                "avg_confidence": avg_conf,
                "word_count": len(text.split()),
            }
        except pytesseract.TesseractNotFoundError:
            return "", {
                "error": "tesseract_binary_not_found",
                "hint": "Install Tesseract: https://github.com/UB-Mannheim/tesseract/wiki and add ara.traineddata",
            }
        except Exception as e:
            log.error(f"vision.ocr_arabic: {e}")
            err_str = str(e)
            hint = ""
            if "ara" in err_str.lower() or "language" in err_str.lower():
                hint = "Download ara.traineddata to your Tesseract tessdata folder"
            return "", {"error": err_str, "hint": hint}

    async def hybrid_analyze(
        self,
        image_bytes: bytes,
        prompt: str = "صف هذه الصورة بالتفصيل واستخرج أي نص عربي",
    ) -> dict:
        """
        Run BOTH LLaVA description AND Tesseract OCR in parallel.
        Best for documents/forms where you want exact text + understanding.

        Returns dict with both results.
        """
        description_task = asyncio.create_task(self.analyze_image(image_bytes, prompt))
        ocr_task = asyncio.create_task(self.ocr_arabic(image_bytes))

        desc, desc_meta = await description_task
        ocr, ocr_meta = await ocr_task

        return {
            "description": desc,
            "description_meta": desc_meta,
            "ocr_text": ocr,
            "ocr_meta": ocr_meta,
        }

    def get_status(self) -> dict:
        return {
            "vision_model": VISION_MODEL,
            "ollama_host": OLLAMA_HOST,
            "ocr_available": self._check_ocr(),
            "ocr_lang": OCR_LANG,
            "pil_available": self._check_pil(),
        }


# Singleton
vision = VisionService()
