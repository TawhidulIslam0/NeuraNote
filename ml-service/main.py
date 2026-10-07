import re
from functools import lru_cache
from fastapi import FastAPI
from pydantic import BaseModel, Field
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch

MODEL = "google/flan-t5-small"
app = FastAPI(title="NeuraNote AI")

class Text(BaseModel):
    text: str = Field(min_length=30, max_length=60000)

class Chat(BaseModel):
    context: str = Field(min_length=30, max_length=60000)
    question: str = Field(min_length=1, max_length=1000)

class Count(Text):
    count: int = Field(default=4, ge=1, le=12)

@lru_cache(maxsize=1)
def model():
    t = AutoTokenizer.from_pretrained(MODEL)
    m = AutoModelForSeq2SeqLM.from_pretrained(MODEL)
    m.eval()
    return t, m

def gen(prompt, n=220):
    t, m = model()
    x = t(prompt, return_tensors="pt", truncation=True, max_length=1024)
    with torch.no_grad():
        y = m.generate(
            **x,
            max_new_tokens=n,
            num_beams=4,
            no_repeat_ngram_size=3,
            early_stopping=True
        )
    return t.decode(y[0], skip_special_tokens=True).strip()

def clean(s):
    return re.sub(r"\s+", " ", s).strip()

def parts(s, limit=2800):
    out = []
    cur = ""
    for sent in re.split(r"(?<=[.!?])\s+", clean(s)):
        if cur and len(cur) + len(sent) + 1 > limit:
            out.append(cur)
            cur = sent
        else:
            cur = f"{cur} {sent}".strip()
    if cur:
        out.append(cur)
    return out

def concepts(s, n=12):
    words = re.findall(r"[A-Za-z][A-Za-z'-]{3,}", s.lower())
    stop = set(
        "this that with from which their there about these those have will "
        "would could should into than then when where what also because while "
        "using used such more most some each other they them your were been "
        "being does only very over under between through after".split()
    )
    freq = {}
    for w in words:
        if w not in stop:
            freq[w] = freq.get(w, 0) + 1
    return [w for w, _ in sorted(freq.items(), key=lambda x: (-x[1], -len(x[0])))[:n]]

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL,
        "model_loaded": model.cache_info().currsize > 0
    }

@app.post("/generate/summary")
def summary(q: Text):
    ss = [
        gen(
            "Write a comprehensive paragraph summarizing the main ideas, facts, and concepts of the text below:\n\n" + p + "\n\nSummary:",
            200
        )
        for p in parts(q.text)[:4]
    ]
    
    if len(ss) > 1:
        combined_text = "\n".join(ss)
        final_summary = gen(
            "Combine the following partial summaries into a single, cohesive, fluid paragraph without repeating information:\n\n" + combined_text + "\n\nFinal Summary:",
            300
        )
        return {"summary": final_summary}
        
    return {"summary": ss[0] if ss else "Could not generate summary."}

@app.post("/generate/concepts")
def getconcepts(q: Text):
    return {"concepts": concepts(q.text)}

def parse_qa_list(raw):
    """Robust parser that handles numbered lists, Q&A formats, or alternating sentences."""
    cards = []
    lines = [l.strip() for l in raw.splitlines() if l.strip()]
    
    # Strategy 1: Look for numbered items or explicit Q/A lines
    for line in lines:
        # Clean leading numbers like "1.", "1)", "-"
        cleaned = re.sub(r"^(\d+[\.\)]|-)\s*", "", line)
        
        # Match Q & A split by colon, pipe, or dash
        m = re.match(r"(?:Q[:\-]?\s*)?(.*?)\s*(?:\||A[:\-]|\-)\s*(.*)", cleaned, re.I)
        if m and m.group(1) and m.group(2):
            cards.append({
                "question": m.group(1).strip("? ").capitalize() + "?",
                "answer": m.group(2).strip()
            })

    # Strategy 2: Consecutive line pairing if strict match fails
    if not cards and len(lines) >= 2:
        for i in range(0, len(lines) - 1, 2):
            cards.append({
                "question": lines[i].strip("? ").capitalize() + "?",
                "answer": lines[i+1].strip()
            })
            
    # Strategy 3: Ultimate fallback using sentences from the text block
    if not cards and raw:
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', raw) if s.strip()]
        for j in range(0, len(sentences) - 1, 2):
            cards.append({
                "question": f"What is the significance of: {sentences[j][:35]}...?",
                "answer": sentences[j+1]
            })
            
    return cards

@app.post("/generate/flashcards")
def flash(q: Count):
    prompt = (
        f"List {q.count} study flashcards based on the text. "
        "Format each on a new line using: Question: [text] Answer: [text]\n\n"
        f"Text:\n{clean(q.text)[:5000]}\n\nFlashcards:"
    )
    raw = gen(prompt, 350)
    results = parse_qa_list(raw)
    return {"flashcards": results[:q.count]}

@app.post("/generate/practice")
def practice(q: Count):
    prompt = (
        f"List {q.count} practice test questions based on the text. "
        "Format each on a new line using: Question: [text] Answer: [text]\n\n"
        f"Text:\n{clean(q.text)[:5000]}\n\nQuestions:"
    )
    raw = gen(prompt, 350)
    results = parse_qa_list(raw)
    return {"questions": results[:q.count]}

@app.post("/chat")
def chat(q: Chat):
    p = (
        "Answer using only the supplied context. If there is not enough "
        "information, say the answer is not supported by the provided material. "
        "Be concise.\n\nCONTEXT:\n" + clean(q.context)[:10000] + 
        "\n\nQUESTION:\n" + clean(q.question) + "\n\nANSWER:"
    )
    return {"answer": gen(p, 220)}

@app.on_event("startup")
def warm():
    try:
        model()
        print("Loaded real AI model:", MODEL)
    except Exception as e:
        print("Model warmup failed; it will retry:", e)