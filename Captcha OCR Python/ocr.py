import base64
import re
import cv2
import pytesseract
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

# CMD TO RUN THE SERVER
# uvicorn ocr:app --host 0.0.0.0 --port 8000

# ================================
# CONFIG
# ================================

# Uncomment if needed
# pytesseract.pytesseract.tesseract_cmd = "/opt/homebrew/bin/tesseract"

OCR_CONFIG = r"--oem 3 --psm 6"  # FAST + accurate
# OCR_CONFIG = r"--oem 1 --psm 8"
MAX_IMAGE_SIZE = 3000  # px (prevent huge images)

# ================================
# FASTAPI INIT
# ================================

app = FastAPI(title="Fast OCR API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all (safe for local dev)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================================
# REQUEST MODEL
# ================================

class OCRRequest(BaseModel):
    image_base64: str

# ================================
# UTILITIES
# ================================

def decode_base64_image(base64_string: str):
    # Remove data:image/... prefix if present
    if base64_string.startswith("data:image"):
        base64_string = re.sub("^data:image/.+;base64,", "", base64_string)

    try:
        image_bytes = base64.b64decode(base64_string)
    except Exception:
        raise ValueError("Invalid base64 string")

    image_array = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

    if img is None:
        raise ValueError("Could not decode image")

    return img


def preprocess_fast(img):
    """
    FAST preprocessing optimized for OCR
    """
    h, w = img.shape[:2]

    # Resize only if image is too large
    if max(h, w) > MAX_IMAGE_SIZE:
        scale = MAX_IMAGE_SIZE / max(h, w)
        img = cv2.resize(img, None, fx=scale, fy=scale)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # OTSU threshold (fast + effective)
    _, thresh = cv2.threshold(
        gray, 0, 255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )

    return thresh


def run_ocr(img):
    return pytesseract.image_to_string(
        img,
        config=OCR_CONFIG,
        lang="eng"
    )

# ================================
# API ENDPOINT
# ================================

@app.post("/ocr")
def ocr_endpoint(payload: OCRRequest):
    try:
        img = decode_base64_image(payload.image_base64)
        processed = preprocess_fast(img)
        text = run_ocr(processed)

        return {
            "success": True,
            "text": text.strip()
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))