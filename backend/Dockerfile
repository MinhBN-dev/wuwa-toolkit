FROM python:3.12-slim

WORKDIR /app

# Runtime libs:
#   libpq5       — asyncpg/psycopg2
#   libglib2.0-0 — OpenCV
#   libgl1       — OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# --timeout/--retries: survive slow networks (large wheels like opencv/torch otherwise
# hit ReadTimeout on this machine's link and fail the whole build).
RUN pip install --no-cache-dir --timeout 300 --retries 10 -r requirements.txt

# Warm up the local OCR engine so the first request is instant.
#   RapidOCR — ONNX models ship inside the wheel (no download); this just loads them.
RUN python - <<'EOF'
from rapidocr_onnxruntime import RapidOCR
RapidOCR()
print("RapidOCR models ready.")
EOF

COPY . .

RUN mkdir -p /app/uploads /app/data

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
