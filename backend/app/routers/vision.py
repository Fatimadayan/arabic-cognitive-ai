"""
Vision API Router.

Endpoints:
  GET  /vision/status         - What vision capabilities are available
  POST /vision/analyze        - Image → description via LLaVA
  POST /vision/ocr            - Image → Arabic text via Tesseract
  POST /vision/hybrid         - Run BOTH analyze and OCR (best for forms/docs)
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional

from app.services.vision import vision
from app.core.logger import log


router = APIRouter(prefix="/vision", tags=["vision"])


# Limit image upload size
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB


@router.get("/status")
async def vision_status():
    """Report vision service availability."""
    return vision.get_status()


@router.post("/analyze")
async def analyze_image(
    image: UploadFile = File(..., description="Image file (PNG/JPG/etc)"),
    prompt: Optional[str] = Form(
        "صف هذه الصورة بالتفصيل. إذا كان هناك نص عربي، استخرجه.",
        description="Question to ask about the image (Arabic or English)",
    ),
    model: Optional[str] = Form(None, description="Override vision model"),
):
    """
    Send image to a vision-language model for description/reasoning.

    Returns JSON:
        {
            "description": "...",
            "metadata": { "model": "...", "eval_count": ..., ... }
        }
    """
    if not image:
        raise HTTPException(status_code=400, detail="No image provided")

    img_bytes = await image.read()
    if not img_bytes:
        raise HTTPException(status_code=400, detail="Image file is empty")
    if len(img_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large (max {MAX_IMAGE_BYTES // 1024 // 1024} MB)",
        )

    log.info(f"vision.analyze: {image.filename} ({len(img_bytes)} bytes)")

    description, meta = await vision.analyze_image(img_bytes, prompt=prompt, model=model)

    if meta.get("error"):
        return JSONResponse(
            status_code=503,
            content={"description": "", "metadata": meta, "error": meta["error"]},
        )

    return {
        "description": description,
        "metadata": meta,
        "filename": image.filename,
    }


@router.post("/ocr")
async def ocr_image(
    image: UploadFile = File(..., description="Image with Arabic text"),
    lang: Optional[str] = Form("ara+eng", description="Tesseract language code"),
):
    """
    Extract Arabic (and English) text from image via Tesseract.

    Best for: scanned documents, screenshots, signs, forms.
    """
    if not image:
        raise HTTPException(status_code=400, detail="No image provided")

    img_bytes = await image.read()
    if not img_bytes:
        raise HTTPException(status_code=400, detail="Image file is empty")
    if len(img_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large")

    log.info(f"vision.ocr: {image.filename} ({len(img_bytes)} bytes, lang={lang})")

    text, meta = await vision.ocr_arabic(img_bytes, lang=lang)

    if meta.get("error"):
        return JSONResponse(
            status_code=503,
            content={"text": "", "metadata": meta, "error": meta["error"]},
        )

    return {
        "text": text,
        "metadata": meta,
        "filename": image.filename,
    }


@router.post("/hybrid")
async def hybrid_analyze(
    image: UploadFile = File(...),
    prompt: Optional[str] = Form(
        "صف هذه الصورة بالتفصيل واستخرج أي نص عربي"
    ),
):
    """
    Run LLaVA analyze AND Tesseract OCR in parallel.

    Best for: official forms, certificates, documents where you want both
    a human-readable summary AND exact text extraction.

    Returns:
        {
            "description": "...",      # from LLaVA
            "ocr_text": "...",         # from Tesseract
            "description_meta": {...},
            "ocr_meta": {...}
        }
    """
    if not image:
        raise HTTPException(status_code=400, detail="No image provided")

    img_bytes = await image.read()
    if not img_bytes:
        raise HTTPException(status_code=400, detail="Image file is empty")
    if len(img_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large")

    log.info(f"vision.hybrid: {image.filename} ({len(img_bytes)} bytes)")

    result = await vision.hybrid_analyze(img_bytes, prompt=prompt)
    result["filename"] = image.filename
    return result
