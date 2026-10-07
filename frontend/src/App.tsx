import { useEffect, useMemo, useState } from "react";
import { 
  BrainCircuit, 
  BookOpen, 
  ChevronRight, 
  FileText, 
  FlaskConical, 
  GraduationCap, 
  Layers3, 
  MessageCircleQuestion, 
  Moon, 
  Plus, 
  RefreshCw, 
  Sparkles, 
  Sun, 
  Trash2, 
  WandSparkles 
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

type Card = { 
  question: string; 
  answer: string; 
};

type W = { 
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

const demo = `Machine learning is a field of artificial intelligence that enables computer systems to learn patterns from data instead of relying entirely on explicitly programmed rules. Supervised learning uses labeled examples to learn a mapping between inputs and outputs. Classification predicts discrete categories, while regression predicts continuous values. Unsupervised learning works with data that does not have target labels. Clustering groups similar observations, while dimensionality reduction represents data with fewer features. Reinforcement learning is based on an agent interacting with an environment, receiving rewards or penalties, and learning a policy that improves long-term reward. Neural networks contain interconnected neurons arranged in layers. During training, a loss function measures prediction error and optimization adjusts parameters to reduce that loss.`;

function App() {
  const [ws, setWs] = useState<W[]>([]);
  const [active, setActive] = useState<W | null>(null);
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [dark, setDark] = useState(true);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    fetch(`${API}/workspaces`)
      .then((r) => r.json())
      .then((x) => {
        setWs(x);
        if (x[0]) setActive(x[0]);
      })
      .catch(() => setError("Backend is offline. Start the Node.js API first."));
  }, []);

  async function create() {
    if (source.trim().length < 30) return setError("Add at least 30 characters of source material.");
    setLoading("create");
    try {
      const r = await fetch(`${API}/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, sourceText: source })
      });
      if (!r.ok) throw Error((await r.json()).error);
      const w = await r.json();
      setWs((x) => [w, ...x]);
      setActive(w);
      setTitle("");
      setSource("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create workspace.");
    } finally {
      setLoading("");
    }
  }

  async function gen(type: string) {
    if (!active) return;
    setLoading(type);
    try {
      const r = await fetch(`${API}/workspaces/${active.id}/generate/${type}`, { method: "POST" });
      if (!r.ok) throw Error((await r.json()).error);
      const w = await fetch(`${API}/workspaces/${active.id}`).then((r) => r.json());
      setActive(w);
      setWs((x) => x.map((a) => (a.id === w.id ? w : a)));
      if (type === "flashcards") setTab("flashcards");
      if (type === "practice") setTab("practice");
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI generation failed.");
    } finally {
      setLoading("");
    }
  }

  async function ask() {
    if (!active || !question.trim()) return;
    setLoading("chat");
    try {
      const r = await fetch(`${API}/workspaces/${active.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question })
      });
      if (!r.ok) throw Error((await r.json()).error);
      const a = await r.json();
      setActive((w) =>
        w
          ? {
              ...w,
              results: {
                ...w.results,
                chats: [...(w.results.chats || []), { question, answer: a.answer }]
              }
            }
          : w
      );
      setQuestion("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI request failed.");
    } finally {
      setLoading("");
    }
  }

  async function del(id: string) {
    await fetch(`${API}/workspaces/${id}`, { method: "DELETE" });
    const x = ws.filter((w) => w.id !== id);
    setWs(x);
    setActive(x[0] || null);
  }

  const words = useMemo(
    () => active?.sourceText.trim().split(/\s+/).filter(Boolean).length || 0,
    [active]
  );

  return (
    <div className={dark ? "app dark" : "app"}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brandmark">
            <BrainCircuit size={21} />
          </div>
          <div>
            <b>NeuraNote</b>
            <small>AI research workspace</small>
          </div>
        </div>

        <button className="new" onClick={() => setActive(null)}>
          <Plus size={17} />
          New workspace
        </button>

        <div className="label">WORKSPACES</div>

        {ws.map((w) => (
          <button
            className={`workspace ${active?.id === w.id ? "active" : ""}`}
            key={w.id}
            onClick={() => {
              setActive(w);
              setTab("overview");
            }}
          >
            <FileText size={15} />
            <span>{w.title}</span>
          </button>
        ))}

        <div className="sidebottom">
          <div className="status">
            <i />
            <div>
              <b>Local AI engine</b>
              <small>Transformer inference</small>
            </div>
          </div>
          <button className="theme" onClick={() => setDark(!dark)}>
            {dark ? <Sun size={16} /> : <Moon size={16} />} {dark ? "Light mode" : "Dark mode"}
          </button>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <div className="eyebrow">
              <FlaskConical size={13} /> AI-POWERED KNOWLEDGE LAB
            </div>
            <h1>{active ? active.title : "Build your knowledge workspace"}</h1>
          </div>
          {active && (
            <span className="words">
              <Layers3 size={15} />
              {words.toLocaleString()} words
            </span>
          )}
        </header>

        {error && <div className="error">{error}</div>}

        {!active ? (
          <Create
            title={title}
            setTitle={setTitle}
            source={source}
            setSource={setSource}
            create={create}
            loading={loading}
          />
        ) : (
          <Workspace
            active={active}
            tab={tab}
            setTab={setTab}
            gen={gen}
            loading={loading}
            question={question}
            setQuestion={setQuestion}
            ask={ask}
            del={del}
          />
        )}
      </main>
    </div>
  );
}

function Create(p: any) {
  return (
    <section className="create">
      <div className="hero">
        <Sparkles size={27} />
      </div>
      <div className="eyebrow">TURN MATERIAL INTO KNOWLEDGE</div>
      <h2>
        Give your research
        <br />
        <span>an intelligent layer.</span>
      </h2>
      <p>
        Paste notes, documentation, research, or an article. NeuraNote uses a real transformer model
        to summarize it, explain concepts, create flashcards, and answer questions.
      </p>
      <div className="createcard">
        <input
          value={p.title}
          onChange={(e: any) => p.setTitle(e.target.value)}
          placeholder="Workspace title — e.g. Machine Learning Midterm"
        />
        <textarea
          value={p.source}
          onChange={(e: any) => p.setSource(e.target.value)}
          placeholder="Paste your source material here..."
        />
        <footer>
          <button className="ghost" onClick={() => p.setSource(demo)}>
            <WandSparkles size={15} />
            Load example
          </button>
          <button className="primary" onClick={p.create} disabled={!!p.loading}>
            {p.loading ? <RefreshCw className="spin" size={15} /> : <Plus size={15} />}
            Create workspace
          </button>
        </footer>
      </div>
    </section>
  );
}

function Workspace({ active, tab, setTab, gen, loading, question, setQuestion, ask, del }: any) {
  return (
    <section className="workspace">
      <div className="source">
        <div className="heading">
          <div>
            <span className="label">SOURCE MATERIAL</span>
            <h3>Your knowledge base</h3>
          </div>
          <button onClick={() => del(active.id)}>
            <Trash2 size={16} />
          </button>
        </div>
        <p>{active.sourceText}</p>
      </div>

      <div className="actions">
        {[
          ["summary", "Summarize", "Condense the key ideas", Sparkles],
          ["concepts", "Extract concepts", "Find important terms", Layers3],
          ["flashcards", "Make flashcards", "Generate study cards", GraduationCap],
          ["practice", "Practice questions", "Test your understanding", BookOpen]
        ].map(([t, a, b, I]: any) => (
          <button onClick={() => gen(t)} key={t}>
            <span className="actionicon">
              <I size={18} />
            </span>
            <div>
              <b>{a}</b>
              <small>{b}</small>
            </div>
            <ChevronRight size={15} />
          </button>
        ))}
      </div>

      <nav>
        {[
          ["overview", "Overview"],
          ["flashcards", "Flashcards"],
          ["practice", "Practice"],
          ["chat", "Ask AI"]
        ].map(([v, l]) => (
          <button className={tab === v ? "selected" : ""} onClick={() => setTab(v)} key={v}>
            {l}
          </button>
        ))}
      </nav>

      {loading && (
        <div className="generating">
          <RefreshCw className="spin" size={15} />
          Running real AI inference for <b>{loading}</b>...
        </div>
      )}

      {tab === "overview" && (
        <div className="results">
          <article className="wide">
            <span className="label">AI SUMMARY</span>
            {active.results.summary ? (
              <p className="summary">{active.results.summary}</p>
            ) : (
              <Empty text="Generate a summary to see an AI-compressed view of your material." />
            )}
          </article>
          <article>
            <span className="label">IMPORTANT CONCEPTS</span>
            {active.results.concepts?.length ? (
              <div className="concepts">
                {active.results.concepts.map((x: string) => (
                  <span key={x}>{x}</span>
                ))}
              </div>
            ) : (
              <Empty text="Extract concepts from the source." />
            )}
          </article>
          <article>
            <span className="label">AI PIPELINE</span>
            <div className="pipeline">
              <p><b>01</b> Source text</p>
              <p><b>02</b> Transformer inference</p>
              <p><b>03</b> Generated insight</p>
            </div>
          </article>
        </div>
      )}

      {tab === "flashcards" && <Cards title="AI flashcards" cards={active.results.flashcards || []} />}
      {tab === "practice" && <Cards title="Practice questions" cards={active.results.practiceQuestions || []} />}

      {tab === "chat" && (
        <div className="chat">
          <div className="chathead">
            <MessageCircleQuestion size={20} />
            <div>
              <b>Ask about your material</b>
              <small>The AI is grounded in your source.</small>
            </div>
          </div>
          <div className="history">
            {active.results.chats?.map((c: Card, i: number) => (
              <div key={i}>
                <div className="q">{c.question}</div>
                <div className="a">{c.answer}</div>
              </div>
            ))}
            {!active.results.chats?.length && <Empty text="Ask your first question about the material." />}
          </div>
          <div className="chatinput">
            <input
              value={question}
              onChange={(e: any) => setQuestion(e.target.value)}
              onKeyDown={(e: any) => e.key === "Enter" && ask()}
              placeholder="e.g. What is the difference between supervised and unsupervised learning?"
            />
            <button className="primary" onClick={ask}>
              Ask
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Sparkles size={16} />
      {text}
    </div>
  );
}

function Cards({ title, cards }: { title: string; cards: Card[] }) {
  return (
    <section className="cards">
      <span className="label">GENERATED BY AI</span>
      <h2>{title}</h2>
      {cards.length ? (
        <div className="cardgrid">
          {cards.map((c, i) => (
            <article key={i}>
              <small>{String(i + 1).padStart(2, "0")}</small>
              <h3>{c.question}</h3>
              <div className="answer">
                <b>ANSWER</b>
                {c.answer}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">Generate content from your source material.</div>
      )}
    </section>
  );
}

export default App;