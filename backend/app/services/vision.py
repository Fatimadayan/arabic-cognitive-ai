"""
ACAI Vision service — Clean version (NO OCR).

Strategy:
  1. moondream describes the image in English
  2. qwen2.5:3b translates that English to elegant Arabic

This is the production-stable path. OCR was removed because:
  - Tesseract failed on stylized Arabic (logos, calligraphy)
  - Garbage OCR output was worse than no OCR
  - moondream alone gives clean visual descriptions that translate well
"""
import base64
import io
import logging
import os
import time
import traceback
from typing import Optional, Dict, Any

import httpx

log = logging.getLogger(__name__)

VISION_MODEL = os.getenv("VISION_MODEL", "moondream")
TRANSLATE_MODEL = os.getenv("VISION_TRANSLATE_MODEL", "qwen2.5:3b")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
VISION_TIMEOUT = float(os.getenv("VISION_TIMEOUT", "120.0"))
TRANSLATE_TIMEOUT = float(os.getenv("VISION_TRANSLATE_TIMEOUT", "60.0"))


class VisionService:
    def __init__(self):
        self._pil_ok = None
        self._check_pil()

    def _check_pil(self) -> bool:
        if self._pil_ok is not None:
            return self._pil_ok
        try:
            from PIL import Image  # noqa: F401
            self._pil_ok = True
        except Exception as e:
            self._pil_ok = False
            log.warning(f"vision: PIL not available: {e}")
        return self._pil_ok

    def is_available(self) -> bool:
        return self._pil_ok

    def status(self) -> Dict[str, Any]:
        return {
            "vision_model": VISION_MODEL,
            "translate_model": TRANSLATE_MODEL,
            "ollama_host": OLLAMA_HOST,
            "pil_available": self._pil_ok,
            "timeout_seconds": VISION_TIMEOUT,
            "strategy": "moondream(EN) -> qwen2.5:3b(translate to AR)",
        }

    def _preprocess_image(self, image_bytes: bytes) -> bytes:
        """Resize huge images and normalize format."""
        if not self._check_pil():
            return image_bytes
        try:
            from PIL import Image
            img = Image.open(io.BytesIO(image_bytes))

            if img.mode in ("RGBA", "LA", "P"):
                bg = Image.new("RGB", img.size, (255, 255, 255))
                if img.mode == "RGBA":
                    bg.paste(img, mask=img.split()[3])
                elif img.mode == "LA":
                    bg.paste(img.convert("RGB"))
                else:
                    bg.paste(img.convert("RGB"))
                img = bg
            elif img.mode != "RGB":
                img = img.convert("RGB")

            MAX_DIM = 1024
            if max(img.size) > MAX_DIM:
                ratio = MAX_DIM / max(img.size)
                new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
                img = img.resize(new_size, Image.LANCZOS)
                log.info(f"vision: resized image to {new_size}")

            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=90)
            return buf.getvalue()
        except Exception as e:
            log.warning(f"vision: preprocessing failed: {e}")
            return image_bytes

    async def _moondream_describe(self, image_b64: str) -> str:
        """Get a detailed English description from moondream."""
        prompt = (
            "Describe this image in detail. "
            "Include: what is in it, colors, layout, any notable objects, "
            "logos, symbols, or visible features. Be thorough and specific."
        )
        async with httpx.AsyncClient(timeout=VISION_TIMEOUT) as client:
            resp = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={
                    "model": VISION_MODEL,
                    "prompt": prompt,
                    "images": [image_b64],
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "num_predict": 400,
                        "num_ctx": 2048,
                    },
                },
            )
            if resp.status_code != 200:
                raise RuntimeError(f"moondream HTTP {resp.status_code}: {resp.text[:200]}")
            data = resp.json()
            desc = (data.get("response") or "").strip()
            if not desc:
                raise RuntimeError("moondream returned empty description")
            return desc

    async def _translate_to_arabic(self, english_text: str) -> str:
        """Translate moondream's English to elegant Arabic via qwen2.5:3b."""
        if not english_text:
            return ""

        prompt = f"""أنت مترجم محترف. ترجم الوصف الإنجليزي التالي للصورة إلى عربية فصحى واضحة ومفصلة.
اكتب الإجابة كاملة بالعربية فقط. لا تستخدم أي حرف صيني أو إنجليزي.

الوصف الإنجليزي:
{english_text}

اكتب الوصف بالعربية فقط الآن:"""

        async with httpx.AsyncClient(timeout=TRANSLATE_TIMEOUT) as client:
            resp = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={
                    "model": TRANSLATE_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "num_predict": 600,
                    },
                },
            )
            if resp.status_code != 200:
                return english_text
            data = resp.json()
            return (data.get("response") or english_text).strip()

    async def analyze(self, image_bytes: bytes, prompt: str = None) -> Dict[str, Any]:
        if not image_bytes:
            return {"error": "empty_image", "detail": "No image bytes received"}

        t0 = time.time()

        # 1. Preprocess
        try:
            processed = self._preprocess_image(image_bytes)
            log.info(f"vision: preprocessed {len(image_bytes)} -> {len(processed)} bytes")
        except Exception as e:
            return {
                "error": "preprocess_failed",
                "detail": f"{type(e).__name__}: {e}",
            }

        # 2. Get English description from moondream
        b64 = base64.b64encode(processed).decode("utf-8")
        try:
            english_desc = await self._moondream_describe(b64)
            t_vision = time.time()
            log.info(
                f"vision: moondream produced {len(english_desc)} chars in "
                f"{(t_vision-t0)*1000:.0f}ms"
            )
        except httpx.TimeoutException:
            return {
                "error": "vision_timeout",
                "detail": f"Moondream timed out after {VISION_TIMEOUT}s",
                "hint": "Try again. First call loads the model into RAM.",
            }
        except httpx.ConnectError as e:
            return {
                "error": "ollama_not_running",
                "detail": f"Cannot reach {OLLAMA_HOST}: {e}",
                "hint": "Start Ollama: ollama serve",
            }
        except Exception as e:
            tb = traceback.format_exc()
            log.error(f"vision: moondream failed:\n{tb}")
            return {
                "error": "moondream_failed",
                "detail": f"{type(e).__name__}: {e}",
            }

        # 3. Translate to Arabic via qwen2.5:3b
        try:
            arabic_desc = await self._translate_to_arabic(english_desc)
            t_done = time.time()
            log.info(
                f"vision: translation done in {(t_done-t_vision)*1000:.0f}ms"
            )
        except Exception as e:
            log.warning(f"vision: translation failed, using English: {e}")
            arabic_desc = english_desc
            t_done = time.time()

        return {
            "description": arabic_desc,
            "english_description": english_desc,
            "model": VISION_MODEL,
            "translate_model": TRANSLATE_MODEL,
            "latency_ms": int((t_done - t0) * 1000),
            "vision_latency_ms": int((t_vision - t0) * 1000),
            "translate_latency_ms": int((t_done - t_vision) * 1000),
        }


vision = VisionService()


def get_vision() -> VisionService:
    return vision
