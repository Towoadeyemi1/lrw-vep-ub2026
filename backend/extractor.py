"""
Invoice text/data extraction from various file formats.

Supports: PDF (via pdfplumber + PyPDF2 fallback), DOCX, images (via
Anthropic vision), and plain text.  The primary output is a plain-text
representation of the invoice that is then fed to the Claude extraction
prompt in classifier.py.
"""

from __future__ import annotations

import base64
import io
import logging
import os
import tempfile
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Optional heavy imports (graceful degradation) ────────────────────────────

try:
    import pdfplumber  # type: ignore

    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False

try:
    import PyPDF2  # type: ignore

    HAS_PYPDF2 = True
except ImportError:
    HAS_PYPDF2 = False

try:
    from docx import Document as DocxDocument  # type: ignore

    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False

try:
    from PIL import Image  # type: ignore

    HAS_PIL = True
except ImportError:
    HAS_PIL = False


# ─── PDF extraction ───────────────────────────────────────────────────────────


def _extract_pdf_pdfplumber(data: bytes) -> str:
    """Extract text from PDF using pdfplumber (preferred — preserves layout)."""
    pages: list[str] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            text = page.extract_text(x_tolerance=2, y_tolerance=2)
            if text:
                pages.append(text)
    return "\n\n".join(pages)


def _extract_pdf_pypdf2(data: bytes) -> str:
    """Fallback PDF extraction using PyPDF2."""
    reader = PyPDF2.PdfReader(io.BytesIO(data))
    pages: list[str] = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    return "\n\n".join(pages)


def extract_pdf(data: bytes) -> str:
    """Extract text from a PDF byte string."""
    text = ""
    if HAS_PDFPLUMBER:
        try:
            text = _extract_pdf_pdfplumber(data)
        except Exception as exc:
            logger.warning("pdfplumber failed (%s), trying PyPDF2", exc)

    if not text and HAS_PYPDF2:
        try:
            text = _extract_pdf_pypdf2(data)
        except Exception as exc:
            logger.warning("PyPDF2 also failed: %s", exc)

    return text or ""


# ─── DOCX extraction ──────────────────────────────────────────────────────────


def extract_docx(data: bytes) -> str:
    """Extract text from a DOCX byte string."""
    if not HAS_DOCX:
        return ""
    doc = DocxDocument(io.BytesIO(data))
    lines: list[str] = [para.text for para in doc.paragraphs if para.text.strip()]
    # Also extract tables
    for table in doc.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                lines.append("  ".join(cells))
    return "\n".join(lines)


# ─── Image extraction (base64 → Anthropic vision) ────────────────────────────


def prepare_image_for_vision(data: bytes, media_type: str) -> dict:
    """
    Return the image_source dict for the Anthropic messages API.
    media_type examples: 'image/jpeg', 'image/png', 'image/webp', 'image/gif'
    """
    b64 = base64.standard_b64encode(data).decode("utf-8")
    return {
        "type": "base64",
        "media_type": media_type,
        "data": b64,
    }


def guess_image_media_type(filename: str) -> str:
    """Guess MIME type from file extension."""
    ext = Path(filename).suffix.lower()
    mapping = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".bmp": "image/png",  # convert BMP → PNG
        ".tiff": "image/png",  # convert TIFF → PNG
        ".tif": "image/png",
    }
    return mapping.get(ext, "image/png")


def convert_image_to_png(data: bytes) -> bytes:
    """Convert any Pillow-readable image to PNG bytes."""
    if not HAS_PIL:
        return data
    img = Image.open(io.BytesIO(data))
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="PNG")
    return buf.getvalue()


# ─── Dispatcher ───────────────────────────────────────────────────────────────


class InvoiceFile:
    """
    Holds a parsed invoice file ready for processing.

    Attributes
    ----------
    text : str
        Plain-text content (empty for pure-image files).
    is_image : bool
        True when the file must be processed via vision.
    image_data : bytes
        Raw image bytes (set when is_image=True).
    image_media_type : str
        MIME type of the image.
    filename : str
        Original filename.
    """

    def __init__(
        self,
        text: str = "",
        is_image: bool = False,
        image_data: Optional[bytes] = None,
        image_media_type: str = "image/png",
        filename: str = "invoice",
    ):
        self.text = text
        self.is_image = is_image
        self.image_data = image_data
        self.image_media_type = image_media_type
        self.filename = filename


def parse_upload(
    data: bytes,
    filename: str,
    content_type: Optional[str] = None,
) -> InvoiceFile:
    """
    Parse an uploaded file into an InvoiceFile.

    Supports PDF, DOCX, TXT, and common image formats.
    """
    fname = filename.lower()
    ext = Path(fname).suffix

    # ── PDF ──
    if ext == ".pdf" or (content_type and "pdf" in content_type):
        text = extract_pdf(data)
        if text.strip():
            return InvoiceFile(text=text, filename=filename)
        # PDF with no extractable text — treat as image (scanned PDF)
        # Convert first page to image
        logger.info("PDF yielded no text — treating as scanned image")
        return InvoiceFile(
            text="",
            is_image=True,
            image_data=data,
            image_media_type="image/png",
            filename=filename,
        )

    # ── DOCX ──
    if ext in (".docx", ".doc") or (
        content_type
        and "officedocument.wordprocessingml" in content_type
    ):
        text = extract_docx(data)
        return InvoiceFile(text=text, filename=filename)

    # ── Plain text ──
    if ext in (".txt", ".csv", ".tsv") or (content_type and "text/plain" in content_type):
        try:
            text = data.decode("utf-8", errors="replace")
        except Exception:
            text = data.decode("latin-1", errors="replace")
        return InvoiceFile(text=text, filename=filename)

    # ── Images ──
    image_exts = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".tif"}
    if ext in image_exts or (content_type and content_type.startswith("image/")):
        media_type = guess_image_media_type(filename)
        # Normalize exotic formats to PNG
        if ext in (".bmp", ".tiff", ".tif"):
            data = convert_image_to_png(data)
            media_type = "image/png"
        return InvoiceFile(
            text="",
            is_image=True,
            image_data=data,
            image_media_type=media_type,
            filename=filename,
        )

    # ── Fallback: try to decode as text ──
    try:
        text = data.decode("utf-8", errors="replace")
        return InvoiceFile(text=text, filename=filename)
    except Exception:
        pass

    logger.warning("Unrecognised file format for %s — treating as image", filename)
    return InvoiceFile(
        text="",
        is_image=True,
        image_data=data,
        image_media_type="image/png",
        filename=filename,
    )
