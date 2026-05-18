"""
ACAI Vision Router.

Surfaces real errors from vision.analyze() instead of generic
"لم يتم التحليل" messages.
"""
from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import JSONResponse
import logging

from app.services.vision import vision

log = logging.getLogger(__name__)
router = APIRouter(prefix="/vision", tags=["vision"])


@router.get("/status")
def vision_status():
    """Detailed vision status."""
    return vision.status()


@router.post("/analyze")
async def analyze_image(
    image: UploadFile = File(...),
    prompt: str = Form(None),
):
    """
    Analyze an uploaded image.

    Returns:
      Success: { description, ocr_text, model, latency_ms }
      Failure: { error, detail, hint, metadata }
    """
    try:
        image_bytes = await image.read()
        if not image_bytes:
            return JSONResponse({
                "error": "empty_upload",
                "detail": "Uploaded file is empty (0 bytes)",
            })

        log.info(
            f"vision: analyze request — {len(image_bytes)} bytes, "
            f"prompt={'custom' if prompt else 'default'}"
        )

        result = await vision.analyze(image_bytes, prompt=prompt)

        if "error" in result:
            log.error(f"vision: analyze error — {result.get('error')}: {result.get('detail')}")

        return JSONResponse(result)

    except Exception as e:
        log.exception("vision: handler crashed")
        return JSONResponse({
            "error": "handler_exception",
            "detail": f"{type(e).__name__}: {e}",
            "hint": "Check backend logs for full traceback.",
        })
