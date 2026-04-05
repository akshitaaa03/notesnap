
# NoteSnapOCR

NoteSnapOCR is a web application that converts handwritten or printed notes into clean, structured digital text. It is designed to make note digitization simple—just upload an image and the app extracts and organizes the text automatically.

---

## Overview

The goal of this project is to bridge the gap between handwritten content and digital usability. Whether it’s class notes, quick sketches, or documents, NoteSnapOCR helps turn them into readable and usable text within seconds.

---

## Features

* Upload images of handwritten or printed notes
* Extract text using OCR (EasyOCR)
* Display output in a clean, structured format
* Show confidence score for extracted text
* Copy extracted content or export as JSON

---

## Tech Stack

* **Frontend:** HTML, CSS, JavaScript
* **Backend:** Flask (Python)
* **OCR Engine:** EasyOCR

---

## Project Structure

```
NoteSnapOCR/
│── app.py
│── requirements.txt
│── templates/
│    └── index.html
│── static/
│    ├── css/
│    └── js/
│── uploads/
```

---

## Setup Instructions

### 1. Clone the repository

```
git clone https://github.com/your-username/notesnap.git
cd notesnapocr
```

### 2. Create a virtual environment

```
python -m venv venv
venv\Scripts\activate      # Windows
source venv/bin/activate   # macOS/Linux
```

### 3. Install dependencies

```
pip install -r requirements.txt
```

---

## Running the Application

```
python app.py
```

Open your browser and visit:

```
http://127.0.0.1:5000
```

---

## Notes

* EasyOCR relies on PyTorch, so the initial setup may take some time
* Accuracy depends on image quality and handwriting clarity

---

