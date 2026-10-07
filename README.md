# NeuraNote — Full-Stack AI Research Workspace

NeuraNote turns pasted research/study material into summaries, concepts, flashcards, practice questions, and grounded Q&A.

## Real AI
The `ml-service` is a Python FastAPI service using the Hugging Face `google/flan-t5-small` transformer and PyTorch for actual text generation. It is not a mock response system. The first startup downloads the model and caches it locally.

## Stack
- React + TypeScript + Vite
- Node.js + Express + TypeScript
- Python + FastAPI + Transformers + PyTorch
- JSON persistence for workspaces

## Run

### AI service
```bash
cd ml-service
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
python main.py
```
Runs on `http://localhost:8001`.

### Backend
```bash
cd backend
npm install
npm run dev
```
Runs on `http://localhost:4000`.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Open the Vite URL, normally `http://localhost:5173`.


## Project structure
```text
NeuraNote/
├── backend/
├── frontend/
├── ml-service/
├── .gitignore
└── README.md
```
