FROM python:3.12-slim

WORKDIR /app

# Runtime libs:
#   libpq5       — asyncpg/psycopg2
#   libgomp1     — PyTorch (used by EasyOCR)
#   libglib2.0-0 — OpenCV
#   libgl1       — OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libgomp1 \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Warm up local OCR engines so the first request is instant.
#   RapidOCR — ONNX models ship inside the wheel (no download); this just loads them.
#   EasyOCR  — downloads English models into /root/.EasyOCR/ (~100 MB det + ~40 MB rec).
RUN python - <<'EOF'
from rapidocr_onnxruntime import RapidOCR
RapidOCR()
print("RapidOCR models ready.")
import easyocr
easyocr.Reader(['en'], gpu=False, verbose=False, download_enabled=True)
print("EasyOCR models ready.")
EOF

COPY . .

RUN mkdir -p /app/uploads /app/data

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
