#!/bin/bash
source "/d/IRCTC/Captcha OCR Python/.venv/Scripts/activate"
uvicorn ocr:app --host 0.0.0.0 --port 8000