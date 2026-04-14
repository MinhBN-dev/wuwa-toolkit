import os
import uuid
import aiofiles
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.config import settings
from app.services.ocr_service import extract_echo_stats
from app.schemas.echo import OcrResult

router = APIRouter(prefix="/ocr", tags=["OCR"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

# Magic bytes để detect image type khi content_type không tin cậy (vd: clipboard paste)
MAGIC_BYTES: list[tuple[bytes, str, str]] = [
    (b"\xff\xd8\xff", "image/jpeg", ".jpg"),
    (b"\x89PNG\r\n\x1a\n", "image/png", ".png"),
    (b"RIFF", "image/webp", ".webp"),  # RIFF....WEBP
    (b"GIF87a", "image/gif", ".gif"),
    (b"GIF89a", "image/gif", ".gif"),
]


def detect_image_type(data: bytes) -> tuple[str, str] | None:
    """Detect image MIME type from magic bytes. Returns (mime, ext) or None."""
    for magic, mime, ext in MAGIC_BYTES:
        if data[:len(magic)] == magic:
            # Extra check for WebP
            if mime == "image/webp" and data[8:12] != b"WEBP":
                continue
            return mime, ext
    return None


@router.post("/extract", response_model=OcrResult)
async def extract_stats(file: UploadFile = File(...)):
    """Upload an echo screenshot and extract stats using Claude Vision."""
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    content = await file.read()

    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size: {settings.MAX_UPLOAD_SIZE_MB}MB",
        )

    # Detect real type from magic bytes (clipboard paste gửi application/octet-stream)
    detected = detect_image_type(content)
    if detected:
        mime, ext = detected
    elif file.content_type in ALLOWED_TYPES:
        mime = file.content_type
        ext = Path(file.filename or "echo.png").suffix or ".png"
    else:
        raise HTTPException(
            status_code=400,
            detail="File không phải ảnh hợp lệ. Chỉ hỗ trợ JPEG, PNG, WEBP, GIF.",
        )

    # Save to disk
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4()}{ext}"
    file_path = upload_dir / filename

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    try:
        result = await extract_echo_stats(str(file_path))
        return OcrResult(**result)
    except Exception as e:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"OCR thất bại: {str(e)}")
