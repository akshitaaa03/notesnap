NoteSnapOCR

NoteSnapOCR is a simple web app that converts handwritten or printed notes into clean, structured text. Upload an image, and the app extracts and organizes the text instantly.

What it does
Upload an image of notes (handwritten or printed)
Extract text using OCR
Display results in a structured format
Show confidence score for extraction
Allow copying or exporting results as JSON
Tech Stack
Frontend: HTML, CSS, JavaScript
Backend: Flask (Python)
OCR Engine: EasyOCR
Project Structure
NoteSnapOCR/
│── app.py
│── requirements.txt
│── templates/
│    └── index.html
│── static/
│    ├── css/
│    └── js/
│── uploads/
Setup
1. Clone the repository
git clone https://github.com/your-username/notesnapocr.git
cd notesnapocr
2. Create a virtual environment
python -m venv venv
venv\Scripts\activate      # Windows
source venv/bin/activate   # macOS/Linux
3. Install dependencies
pip install -r requirements.txt
Run locally
python app.py

Open your browser and go to:

http://127.0.0.1:5000


Notes
EasyOCR depends on PyTorch, which can increase build size
Deployment platforms may have limits — consider optimizing dependencies if needed


