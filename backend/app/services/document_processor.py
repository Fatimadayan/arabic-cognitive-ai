"""
ACAI Document Processor — Production version.

Handles: PDF, DOCX, TXT, MD with proper Arabic text handling.

Improvements:
  - PDF OCR fallback for scanned/image-based PDFs
  - Arabic-aware text normalization (removes tatweel, harakat optional)
  - Smart chunking with overlap (better RAG retrieval)
  - Detailed error surfacing
  - Page-level metadata preserved for citations
"""
import logging
import io
import re
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional

log = logging.getLogger(__name__)

# Chunking config
CHUNK_SIZE = 800       # characters per chunk
CHUNK_OVERLAP = 100    # overlapping characters between chunks
MIN_CHUNK_SIZE = 100   # discard chunks shorter than this


def _normalize_arabic(text: str) -> str:
    """Normalize Arabic text: remove tatweel, collapse whitespace."""
    if not text:
        return ""
    # Remove tatweel (kashida)
    text = text.replace("\u0640", "")
    # Normalize various Arabic alef forms (optional — keeps original by default)
    # text = re.sub(r"[إأآا]", "ا", text)
    # Collapse whitespace
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _chunk_text(text: str, source: str = "doc") -> List[Dict[str, Any]]:
    """Split text into overlapping chunks for RAG indexing."""
    if not text or len(text) < MIN_CHUNK_SIZE:
        return []

    chunks = []
    start = 0
    chunk_idx = 0
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))

        # Try to break at sentence boundary (Arabic or English)
        if end < len(text):
            # Look for sentence-ending punctuation in last 100 chars
            window = text[max(start, end - 100):end]
            for punct in ['.', '۔', '!', '؟', '?', '\n\n']:
                pos = window.rfind(punct)
                if pos > 0:
                    end = max(start, end - 100) + pos + 1
                    break

        chunk_text = text[start:end].strip()
        if len(chunk_text) >= MIN_CHUNK_SIZE:
            chunks.append({
                "index": chunk_idx,
                "text": chunk_text,
                "source": source,
                "start_char": start,
                "end_char": end,
                "hash": hashlib.sha256(chunk_text.encode("utf-8")).hexdigest()[:16],
            })
            chunk_idx += 1

        start = end - CHUNK_OVERLAP
        if start < 0 or start >= len(text):
            break

    return chunks


def process_pdf(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Extract text from PDF with OCR fallback for scanned pages."""
    try:
        import pdfplumber
    except ImportError:
        return {
            "error": "pdfplumber_not_installed",
            "detail": "Install with: pip install pdfplumber",
        }

    pages_text = []
    pages_with_text = 0
    pages_total = 0
    ocr_used = False

    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            pages_total = len(pdf.pages)
            for i, page in enumerate(pdf.pages):
                text = (page.extract_text() or "").strip()
                if text and len(text) > 20:
                    pages_text.append({"page": i + 1, "text": text, "source": "extract"})
                    pages_with_text += 1
                else:
                    # Try OCR fallback
                    try:
                        import pytesseract
                        from PIL import Image
                        img = page.to_image(resolution=200).original
                        ocr_text = pytesseract.image_to_string(img, lang="ara+eng")
                        if ocr_text.strip():
                            pages_text.append({
                                "page": i + 1,
                                "text": ocr_text.strip(),
                                "source": "ocr",
                            })
                            pages_with_text += 1
                            ocr_used = True
                    except Exception as e:
                        log.warning(f"pdf: OCR failed on page {i+1}: {e}")
    except Exception as e:
        return {
            "error": "pdf_extraction_failed",
            "detail": f"{type(e).__name__}: {e}",
            "hint": "PDF may be corrupted or password-protected.",
        }

    if not pages_text:
        return {
            "error": "pdf_empty",
            "detail": f"PDF has {pages_total} pages but no extractable text",
            "hint": "PDF may be image-only and OCR is not available, or pages are blank.",
        }

    # Concatenate all pages
    full_text = "\n\n".join(
        f"[صفحة {p['page']}]\n{p['text']}" for p in pages_text
    )
    full_text = _normalize_arabic(full_text)

    chunks = _chunk_text(full_text, source=filename)

    return {
        "filename": filename,
        "format": "pdf",
        "pages_total": pages_total,
        "pages_with_text": pages_with_text,
        "ocr_used": ocr_used,
        "total_chars": len(full_text),
        "chunks": chunks,
        "chunks_indexed": len(chunks),
    }


def process_docx(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Extract text from DOCX."""
    try:
        from docx import Document
    except ImportError:
        return {
            "error": "python_docx_not_installed",
            "detail": "Install with: pip install python-docx",
        }

    try:
        doc = Document(io.BytesIO(file_bytes))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]

        # Also extract from tables
        table_texts = []
        for table in doc.tables:
            for row in table.rows:
                row_text = " | ".join(cell.text.strip() for cell in row.cells)
                if row_text.strip(" |"):
                    table_texts.append(row_text)

        full_text = "\n".join(paragraphs)
        if table_texts:
            full_text += "\n\n[الجداول]\n" + "\n".join(table_texts)

        full_text = _normalize_arabic(full_text)

        if len(full_text) < 20:
            return {
                "error": "docx_empty",
                "detail": "Document has no readable text",
            }

        chunks = _chunk_text(full_text, source=filename)
        return {
            "filename": filename,
            "format": "docx",
            "paragraphs": len(paragraphs),
            "tables": len(doc.tables),
            "total_chars": len(full_text),
            "chunks": chunks,
            "chunks_indexed": len(chunks),
        }
    except Exception as e:
        return {
            "error": "docx_extraction_failed",
            "detail": f"{type(e).__name__}: {e}",
        }


def process_text(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Process plain text or markdown file."""
    try:
        # Try UTF-8 first, fall back to Latin-1
        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = file_bytes.decode("utf-8", errors="replace")

        text = _normalize_arabic(text)

        if len(text) < 20:
            return {"error": "text_too_short", "detail": "File contains no readable text"}

        chunks = _chunk_text(text, source=filename)
        return {
            "filename": filename,
            "format": "text",
            "total_chars": len(text),
            "chunks": chunks,
            "chunks_indexed": len(chunks),
        }
    except Exception as e:
        return {
            "error": "text_processing_failed",
            "detail": f"{type(e).__name__}: {e}",
        }


def process_document(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Main entry point — routes to correct processor by extension."""
    if not file_bytes:
        return {"error": "empty_file", "detail": "File is empty"}

    ext = Path(filename).suffix.lower()

    if ext == ".pdf":
        return process_pdf(file_bytes, filename)
    elif ext in (".docx",):
        return process_docx(file_bytes, filename)
    elif ext in (".txt", ".md", ".markdown"):
        return process_text(file_bytes, filename)
    else:
        return {
            "error": "unsupported_format",
            "detail": f"Extension '{ext}' is not supported",
            "hint": "Supported: PDF, DOCX, TXT, MD",
        }
