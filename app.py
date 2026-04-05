import os
import re
import json
import base64
import uuid
from pathlib import Path
from flask import Flask, request, jsonify, render_template, send_from_directory
from PIL import Image
import easyocr
from textblob import TextBlob
from spellchecker import SpellChecker

app = Flask(__name__)

UPLOAD_FOLDER = Path("uploads")
OUTPUT_FOLDER = Path("outputs")
UPLOAD_FOLDER.mkdir(exist_ok=True)
OUTPUT_FOLDER.mkdir(exist_ok=True)
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "bmp", "tiff"}

reader = None

def get_reader():
    global reader
    if reader is None:
        print("Loading EasyOCR model... (first run may take a moment)")
        reader = easyocr.Reader(["en"], gpu=False)
        print("EasyOCR model loaded.")
    return reader


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def correct_text(text):
    blob = TextBlob(text)
    return str(blob.correct())

spell = SpellChecker()

def smart_clean_text(text):
    import re

    
    text = re.sub(r'\s+', ' ', text)

    text = text.replace('0', 'o')
    text = text.replace('1', 'l')
    text = text.replace('4', 'a')

    words = text.split()
    corrected_words = []

    for word in words:
       
        if "@" in word or word.isdigit():
            corrected_words.append(word)
            continue

        corrected = spell.correction(word)

        if corrected:
            corrected_words.append(corrected)
        else:
            corrected_words.append(word)

    text = " ".join(corrected_words)

    
    text = re.sub(r'(\w)\s+(\w)', r'\1\2', text)

    return text.strip()

def format_results(raw_results: list) -> dict:
    """
    Takes raw EasyOCR output and returns structured formatted text.

    raw_results: list of ([bbox_points], text, confidence)
    Returns dict with:
      - raw_lines: list of {text, confidence, bbox}
      - formatted_text: clean reconstructed paragraph / structured text
      - word_count: int
      - avg_confidence: float
      - sections: list of detected section headings and their content
    """
    lines = []
    for bbox, text, conf in raw_results:
        top_y = min(pt[1] for pt in bbox)
        left_x = min(pt[0] for pt in bbox)
        lines.append({"text": text.strip(), "confidence": round(conf, 3),
                       "top_y": top_y, "left_x": left_x, "bbox": bbox})

    lines.sort(key=lambda l: (round(l["top_y"] / 20) * 20, l["left_x"]))

    grouped_lines = []
    current_group = []
    prev_y = None

    for line in lines:
        if prev_y is None or abs(line["top_y"] - prev_y) < 25:
            current_group.append(line)
        else:
            if current_group:
                grouped_lines.append(current_group)
            current_group = [line]
        prev_y = line["top_y"]
    if current_group:
        grouped_lines.append(current_group)

    text_lines = []
    for group in grouped_lines:
        group.sort(key=lambda l: l["left_x"])
        merged = " ".join(l["text"] for l in group)
        text_lines.append(merged)

    sections = []
    current_section = {"heading": None, "content": []}
    heading_pattern = re.compile(r"^[A-Z][A-Z\s\d:]{2,}[:]?\s*$|^\d+[\.\)]\s+[A-Z]")

    for line in text_lines:
        if heading_pattern.match(line) or (len(line) < 40 and line.endswith(":")):
            if current_section["content"] or current_section["heading"]:
                sections.append(current_section)
            current_section = {"heading": line.rstrip(":"), "content": []}
        else:
            current_section["content"].append(line)

    if current_section["content"] or current_section["heading"]:
        sections.append(current_section)

    formatted_parts = []
    for sec in sections:
        if sec["heading"]:
            formatted_parts.append(f"## {sec['heading']}\n")
        if sec["content"]:
            paragraph = " ".join(sec["content"])
            paragraph = re.sub(r"\s+", " ", paragraph).strip()
            formatted_parts.append(paragraph)
        formatted_parts.append("")

    formatted_text = "\n".join(formatted_parts).strip()
    #formatted_text = smart_clean_text(formatted_text)

    if not formatted_text:
        formatted_text = " ".join(text_lines)
        formatted_text = smart_clean_text(formatted_text)

    all_confidences = [l["confidence"] for l in lines]
    avg_conf = round(sum(all_confidences) / len(all_confidences), 3) if all_confidences else 0.0

    words = formatted_text.split()

    return {
        "raw_lines": [{"text": l["text"], "confidence": l["confidence"]} for l in lines],
        "formatted_text": formatted_text,
        "plain_text": "\n".join(text_lines),
        "word_count": len(words),
        "avg_confidence": avg_conf,
        "sections": sections,
        "line_count": len(text_lines),
    }


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": f"File type not allowed. Use: {', '.join(ALLOWED_EXTENSIONS)}"}), 400

    ext = file.filename.rsplit(".", 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = UPLOAD_FOLDER / filename

    file.save(str(filepath))

    try:
        img = Image.open(filepath)
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
            filepath_converted = filepath.with_suffix(".jpg")
            img.save(str(filepath_converted))
            filepath = filepath_converted

        ocr_reader = get_reader()
        raw = ocr_reader.readtext(str(filepath), detail=1, paragraph=False)

        if not raw:
            return jsonify({
                "success": True,
                "formatted_text": "",
                "plain_text": "",
                "raw_lines": [],
                "word_count": 0,
                "avg_confidence": 0.0,
                "sections": [],
                "line_count": 0,
                "message": "No text detected in the image."
            })

        result = format_results(raw)

        output_path = OUTPUT_FOLDER / f"{filepath.stem}_output.json"
        with open(output_path, "w") as f:
            json.dump(result, f, indent=2)

        return jsonify({"success": True, **result})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            filepath.unlink(missing_ok=True)
        except Exception:
            pass


@app.route("/outputs/<filename>")
def download_output(filename):
    return send_from_directory(str(OUTPUT_FOLDER), filename)


@app.route("/health")
def health():
    return jsonify({"status": "ok", "model_loaded": reader is not None})


if __name__ == "__main__":
    print("Starting HandNote OCR server...")
    print("Loading EasyOCR model...")
    get_reader()

   
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)



