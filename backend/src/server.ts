import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

dotenv.config();

type Card = {
  question: string;
  answer: string;
};

type Workspace = {
  id: string;
  title: string;
  sourceText: string;
  createdAt: string;
  updatedAt: string;
  results: {
    summary?: string;
    concepts?: string[];
    flashcards?: Card[];
    practiceQuestions?: Card[];
    chats?: Card[];
  };
};

const app = express();
const PORT = Number(process.env.PORT || 4000);
const ML = process.env.ML_SERVICE_URL || "http://localhost:8000";

const file = path.join(process.cwd(), "data", "workspaces.json");

app.use(cors());
app.use(express.json({ limit: "3mb" }));

async function load(): Promise<Workspace[]> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, "[]");
    return [];
  }
}

async function save(x: Workspace[]) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(x, null, 2));
}

async function ai(endpoint: string, body: unknown) {
  const r = await fetch(`${ML}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

app.get("/api/health", async (_q, res) => {
  try {
    const r = await fetch(`${ML}/health`);
    res.json({ api: "ok", ml: await r.json() });
  } catch {
    res.status(503).json({ api: "ok", ml: { status: "offline" } });
  }
});

app.get("/api/workspaces", async (_q, res) => {
  res.json(await load());
});

app.post("/api/workspaces", async (req, res) => {
  const { title, sourceText } = req.body;
  if (typeof sourceText !== "string" || sourceText.trim().length < 30) {
    return res.status(400).json({ error: "Please provide at least 30 characters of source material." });
  }
  const all = await load();
  const now = new Date().toISOString();
  const w: Workspace = {
    id: crypto.randomUUID(),
    title: title?.trim() || "Untitled Research",
    sourceText: sourceText.trim(),
    createdAt: now,
    updatedAt: now,
    results: {},
  };
  all.unshift(w);
  await save(all);
  res.status(201).json(w);
});

app.get("/api/workspaces/:id", async (req, res) => {
  const w = (await load()).find((x) => x.id === req.params.id);
  w ? res.json(w) : res.status(404).json({ error: "Workspace not found." });
});

app.post("/api/workspaces/:id/generate/:type", async (req, res) => {
  const all = await load();
  const w = all.find((x) => x.id === req.params.id);
  if (!w) return res.status(404).json({ error: "Workspace not found." });

  try {
    let r: any;
    switch (req.params.type) {
      case "summary":
        r = await ai("/generate/summary", { text: w.sourceText });
        w.results.summary = r.summary;
        break;
      case "concepts":
        r = await ai("/generate/concepts", { text: w.sourceText });
        w.results.concepts = r.concepts;
        break;
      case "flashcards":
        r = await ai("/generate/flashcards", { text: w.sourceText, count: 8 });
        w.results.flashcards = r.flashcards;
        break;
      case "practice":
        r = await ai("/generate/practice", { text: w.sourceText, count: 6 });
        w.results.practiceQuestions = r.questions;
        break;
      default:
        return res.status(400).json({ error: "Unknown generation type." });
    }
    w.updatedAt = new Date().toISOString();
    await save(all);
    res.json(w);
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "AI generation failed." });
  }
});

app.post("/api/workspaces/:id/chat", async (req, res) => {
  const all = await load();
  const w = all.find((x) => x.id === req.params.id);
  if (!w) return res.status(404).json({ error: "Workspace not found." });

  const question = String(req.body.question || "").trim();
  if (!question) return res.status(400).json({ error: "Question is required." });

  try {
    const r = await ai("/chat", { context: w.sourceText, question });
    w.results.chats ??= [];
    w.results.chats.push({ question, answer: r.answer });
    w.updatedAt = new Date().toISOString();
    await save(all);
    res.json(r);
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "AI request failed." });
  }
});

app.delete("/api/workspaces/:id", async (req, res) => {
  const a = await load();
  const b = a.filter((x) => x.id !== req.params.id);
  if (a.length === b.length) return res.status(404).json({ error: "Workspace not found." });
  await save(b);
  res.status(204).end();
});

app.listen(PORT, () => console.log(`NeuraNote API: http://localhost:${PORT}`));