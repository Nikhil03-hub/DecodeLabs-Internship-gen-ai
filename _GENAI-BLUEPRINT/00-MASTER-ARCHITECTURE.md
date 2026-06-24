# DecodeLabs Gen AI Internship — Master Architecture & Strategy

**Author of this blueprint:** Architecture/planning pass (the "brain").
**Implemented by:** Sonnet 4.6 (high-effort) using the per-week master prompts in this folder.
**Intern:** Nikhil · **Batch:** 2026 · **Track:** Generative AI · **Org:** DecodeLabs (decodelabs.tech).

---

## 0. How to use this folder

This folder (`_GENAI-BLUEPRINT/`) contains the **complete plan** for the DecodeLabs Gen AI internship. It is the source of truth for *how* to build, sitting on top of the DecodeLabs PDFs, which are the source of truth for *what* to build.

| File | Purpose |
|---|---|
| `00-MASTER-ARCHITECTURE.md` (this file) | Global strategy, repo structure, shared systems, conventions, the compliance contract. **Read first.** |
| `WEEK-1-CHATBOT-WITH-MEMORY.md` | Full design + Sonnet master prompt for Project 1. |
| `WEEK-2-COPYWRITING-TONE-TRANSFORMER.md` | Full design + Sonnet master prompt for Project 2. |
| `WEEK-3-IMAGE-GENERATION-STUDIO.md` | Full design + Sonnet master prompt for Project 3. |
| `WEEK-4-CODE-REVIEWER.md` | Full design + Sonnet master prompt for Project 4 (flagship). |

**Workflow:** Read this file → open the week file → copy its "MASTER PROMPT FOR SONNET" block into a fresh Sonnet 4.6 high-effort session → build → verify against that week's acceptance checklist → commit → next week.

Each week is independent. Build them one at a time, in order. Do **not** start Week 2 until Week 1 passes its acceptance checklist.

---

## 1. The single most important principle — THE PDF IS THE CONTRACT

> **Every architecture decision, feature, UI control, file, and README section must trace back to an explicit requirement in the official DecodeLabs weekly PDF. Satisfy 100% of the stated requirements first. Only then add portfolio polish. Never sacrifice requirement-compliance for extra complexity.**

DecodeLabs reviewers will hold the PDF in one hand and your project in the other. They must be able to tick every requirement **without searching**. To guarantee this, every week folder ships a **`REQUIREMENTS.md`** traceability file that maps each PDF requirement to the exact file/feature that satisfies it. If the PDF says "Temperature control," there is a visible temperature slider. If it says "maintain chat history," there is a visible, persistent chat history. No requirement is implied or hidden.

This single rule is what separates an *approved, high-scoring* submission from an impressive-but-noncompliant one.

---

## 2. Scope correction — read this carefully

There are **two different DecodeLabs documents** in the project, and they describe **different projects**. This caused the earlier work to be built against the wrong brief.

**(A) The old overview — `GENERATIVE AI.pdf` ("Industrial Training Mission Kit", 5 tasks):**
System Prompt Architect · Creative Visionary · RAG Knowledge Analyst · Multimodal Content Engine · AI Safety Audit. (This deck even opens with mislabeled "UX Engineer / wireframing" text — it is a reused template and is *not* the operative spec.)

**(B) The 4 official weekly kits — `Generative AI Project 1–4.pdf` ("Industrial Training Kit"):**
These are the **real, current internship deliverables** and the documents reviewers will grade against:

1. **Week 1 — Custom AI Chatbot with Memory**
2. **Week 2 — Automated Copywriting & Tone Transformer**
3. **Week 3 — Multimodal Image Generation Studio**
4. **Week 4 — Intelligent Code Reviewer & Explainer** *(optional "mastery" project)*

**What went wrong before:** earlier Sonnet (low-effort) built System Prompt Architect + RAG + AI Safety — i.e., brief (A). Those don't match brief (B). Both independent GPT reviews reached the same conclusion: **brief (B) is canonical; the prior work is exploratory/bonus.**

**Decision (confirmed with Nikhil):** Re-architect cleanly against the 4 weekly PDFs. The prior RAG app and AI Safety report are genuinely valuable, so they are **preserved as bonus projects** (they also happen to satisfy brief (A)'s Tasks 3 & 5 — useful for resume/LinkedIn, not for weekly grading).

> Note on Week 1 specifically: the prior "System Prompt Architect" chatbot ran in *demo mode with no API key*. Week 1's PDF **requires** a real "frontier LLM via official SDK + API key" and an in-memory history array. So Week 1 must be genuinely rebuilt — it is not a reskin of the old file.

---

## 3. The four deliverables at a glance

| Wk | Project | Core requirement (verbatim intent from PDF) | Required visible skills |
|---|---|---|---|
| 1 | **Custom AI Chatbot with Memory** | Conversational web app that remembers prior messages in a live session; connect to a frontier LLM via official SDK + API key; maintain an in-memory history array; append every user+model turn to preserve context. | API integration, session-state management, chat-history mechanics |
| 2 | **Automated Copywriting & Tone Transformer** | Take Product_Name / Platform / Tone; inject into a **dynamic prompt template**; expose **Temperature** and **Top-P** controls; generate platform-tailored marketing copy. | Dynamic prompt-template compilation, inference-parameter tuning, text generation |
| 3 | **Multimodal Image Generation Studio** | Integrate a text-to-image API; payload controls for **resolution, aspect ratio, image count**; handle binary/URL image data; display + download cleanly. | Text-to-image APIs, image URL/binary handling, design parameters |
| 4 | **Intelligent Code Reviewer & Explainer** *(optional)* | Ingest a raw code file (.py/.js/.java) as a string; **system instructions force structured output** (distinct bug report + optimized code block); render with **markdown syntax highlighting**. | Code-as-context, structured outputs, code-analysis pipelines |

Certification is met after Weeks 1–3; Week 4 is optional mastery. **Nikhil is building all four**, with Week 4 as the flagship.

---

## 4. Locked technical decisions (and why)

| Decision | Choice | Rationale |
|---|---|---|
| **Text LLM** (Wk 1, 2, 4) | **Google Gemini — free tier**, official `google-genai` SDK | Free for a student, frontier-grade, satisfies "frontier LLM via official SDK." |
| **Image API** (Wk 3) | **Hugging Face Inference API — free SDXL** (Stable Diffusion XL) | Zero cost; free-tier rate-limits make the PDF's required timeout/retry/back-off logic *genuinely necessary* — a compliance win, not busywork. |
| **Provider strategy** | Thin **provider-abstraction layer**; Gemini = primary, OpenAI/Claude swappable via config | "Official SDK" satisfied; future-proof; recruiter-friendly ("provider-agnostic"). |
| **App stack** | **Flask (Python) backend + custom HTML/CSS/vanilla-JS frontend** | Leverages Nikhil's strong front-end skills; looks like a real product; consistent with his Full-Stack internship repo. |
| **UI** | One shared **dark, modern design system** across all 4 ("DecodeLabs GenAI Suite") | Cohesive portfolio; "no default Bootstrap / no beginner styling." |
| **Repo** | **One monorepo, 4 week folders + `bonus/`**, four separately-linkable folders | Matches how the Full-Stack internship was submitted (one repo, per-week folder links in the Google Form). |
| **Deploy** | **Render** (free web service) per app; local-run always works | Recruiters value deployment-readiness; Render fits Flask. |
| **Secrets** | `.env` (git-ignored) + committed `.env.example` | Never commit keys; reviewer-safe. |

> **Model-ID note for Sonnet:** use a current Gemini *Flash* model (fast + free-tier friendly). Model identifiers change over time — Sonnet must verify the exact current model string against the live Google AI Studio / Gemini API docs at build time rather than hard-trusting any string in this blueprint.

---

## 5. Repository structure

One GitHub repo, mirroring the Full-Stack submission style. **Recommended repo name:** `DecodeLabs-GenAI`.

```
DecodeLabs-GenAI/
├── README.md                          ← Portfolio landing page (the "Suite" overview)
├── .gitignore                         ← ignores .env, venv, __pycache__, /generated, etc.
│
├── week-1-ai-chatbot-memory/
├── week-2-copywriting-tone-transformer/
├── week-3-image-generation-studio/
├── week-4-intelligent-code-reviewer/
│
└── bonus/
    ├── rag-knowledge-analyst/         ← preserved prior work (brief A · Task 3)
    └── ai-safety-audit/               ← preserved prior work (brief A · Task 5)
```

**Google Form submission (one link per week, same as Full-Stack):**
```
Week 1 → https://github.com/<user>/DecodeLabs-GenAI/tree/main/week-1-ai-chatbot-memory
Week 2 → https://github.com/<user>/DecodeLabs-GenAI/tree/main/week-2-copywriting-tone-transformer
Week 3 → https://github.com/<user>/DecodeLabs-GenAI/tree/main/week-3-image-generation-studio
Week 4 → https://github.com/<user>/DecodeLabs-GenAI/tree/main/week-4-intelligent-code-reviewer
```

> Because each link points reviewers at a single folder, **every week folder must be 100% self-contained and independently runnable** — its own README, REQUIREMENTS.md, requirements.txt, .env.example, and app code. A reviewer who only ever sees that one folder must be able to understand, run, and verify it.

---

## 6. Architectural model — four self-contained apps that share DNA

**Chosen model:** four **independent, self-contained Flask apps**, each in its own week folder, that **share an identical design system and a near-identical provider-abstraction module** (copied into each project, not imported across folders).

Why not one mega-app with internal routes? Because the Google Form links each folder separately and reviewers run folders in isolation — a single shared app would break the "this folder runs on its own" guarantee and entangle dependencies. Independent folders keep each week clean, gradable, and deployable on its own.

How we still avoid "four unrelated mini-projects":
- A single shared **design-system stylesheet** (`static/css/theme.css`) is identical in every project (same tokens, navbar, cards, buttons, footer). The suite *looks* like one product.
- A single shared **`llm_client.py`** (the provider abstraction) is reused verbatim in Weeks 1, 2, 4. Week 3 uses the parallel **`image_client.py`** pattern.
- Identical project skeleton, README shape, and naming conventions across all four.

Net effect: consistent architecture + consistent look, with the independence reviewers need.

---

## 7. Shared component — LLM Provider Abstraction Layer

Used by Weeks 1, 2, and 4. Specify it once; reuse the spec in each.

**Module:** `llm_client.py` — a thin wrapper so the app code never talks to a vendor SDK directly.

**Public contract (design, not implementation):**
- `generate(messages, *, temperature, top_p, max_output_tokens, system=None) -> str`
  - `messages`: ordered list of `{role: "user"|"model", content: str}` (the conversation/history payload).
  - Returns the model's text. Raises a typed `LLMError` on failure (network, auth, rate-limit, safety-block) so callers can show clean messages.
- Provider selected by env var `LLM_PROVIDER` (default `gemini`). Primary backend = Gemini via the official `google-genai` SDK, keyed by `GEMINI_API_KEY`.
- Designed so an `openai` or `anthropic` backend can be added later behind the same `generate()` signature — **no caller code changes.**

**Why this matters for grading & resume:** it satisfies the PDF's "official SDK" requirement, isolates vendor specifics, makes parameter-passing (Temperature/Top-P) uniform for Week 2, and lets you say "provider-agnostic architecture" truthfully.

**Reliability behavior (shared):** centralised timeout, a small retry with exponential back-off on transient/429 errors, and friendly typed errors. (Week 3's image client follows the same reliability pattern.)

---

## 8. Shared component — Design System ("DecodeLabs GenAI Suite")

One stylesheet, identical in every project: `static/css/theme.css`. Dark, modern, gradient-accented, responsive, accessible. No Bootstrap default look.

**Design tokens (spec — exact values are Sonnet's to finalize, but keep them consistent across all 4):**

| Token | Intent | Guide value |
|---|---|---|
| `--bg` | App background | near-black `#0B0F17` |
| `--surface` | Cards / panels | `#141A24` |
| `--surface-2` | Raised / inputs | `#1C2430` |
| `--border` | Hairlines | `rgba(255,255,255,0.08)` |
| `--text` | Primary text | `#E8EDF4` |
| `--text-dim` | Secondary text | `#9AA7B8` |
| `--brand` | Primary accent | indigo `#6366F1` |
| `--brand-2` | Gradient partner | violet `#A855F7` |
| `--accent` | Secondary accent | cyan `#22D3EE` |
| `--success` / `--warning` / `--danger` | Status | `#22C55E` / `#F59E0B` / `#EF4444` |
| `--radius` | Corner radius | `14px` |
| `--shadow` | Card elevation | soft, low-opacity |
| Font (UI) | Sans | Inter / system stack |
| Font (code) | Mono | JetBrains Mono / `ui-monospace` |

**Shared UI furniture (same markup/classes in all 4):**
- **Top navbar:** "DecodeLabs · GenAI Suite" wordmark (gradient) on the left; on the right, a small project label ("Week 1 · AI Chatbot"). Subtle bottom border.
- **Card** with header + body; **primary gradient button**; **secondary/ghost button**; **labeled slider** (used for Temperature/Top-P/count); **select dropdown**; **toast/inline error**; **footer** ("Built by Nikhil · DecodeLabs GenAI Internship 2026 · powered by Gemini/Hugging Face").
- **States:** every async action shows loading (spinner/skeleton), success, and a clean error. Empty states have helpful hints.
- **Responsive:** usable down to ~360px; controls stack on mobile.

A 4–6 line "design system" note at the top of `theme.css` documents the tokens so reviewers see intent.

---

## 9. Configuration & secrets convention (all projects)

- All keys via environment variables loaded from a git-ignored **`.env`** (use `python-dotenv`).
- Commit a **`.env.example`** listing every variable with placeholder values and a one-line comment.
- App must **fail fast with a clear message** if a required key is missing ("Set GEMINI_API_KEY in .env — see .env.example"), never crash with a raw stack trace.
- **Never** print or log secret values. `.gitignore` must include `.env`, `venv/`, `__pycache__/`, `*.pyc`, and any generated-asset folder.

Standard variables:
```
# .env.example (Weeks 1,2,4)
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_key_here

# .env.example (Week 3)
IMAGE_PROVIDER=huggingface
HUGGINGFACE_API_TOKEN=your_token_here
```

---

## 10. Per-project deliverable standard

**Every** week folder must contain, at minimum:

```
week-N-.../
├── app.py                  ← Flask entry (routes, request handling)
├── llm_client.py           ← provider abstraction (Wk 1,2,4)  /  image_client.py (Wk 3)
├── <domain modules>.py     ← week-specific logic (see week files)
├── requirements.txt        ← pinned deps
├── .env.example            ← documented env vars
├── .gitignore
├── README.md               ← recruiter-grade (see §11)
├── REQUIREMENTS.md          ← PDF-requirement → feature traceability (see §1)
├── SCREENSHOT_PLAN.md       ← exact screenshots to capture for GitHub (see §13)
├── templates/
│   └── index.html
└── static/
    ├── css/theme.css       ← shared design system
    └── js/app.js           ← front-end logic
```

(Week 3 adds a `generated/` output folder, git-ignored; Week 1 may add a CLI entry as a bonus; Week 4 may add `samples/` with intentionally buggy files to demo on.)

---

## 11. README standard (every week + repo root)

Recruiter-grade, in this order: **Title + one-line pitch → Live Demo / screenshots → Overview → Problem Statement → Solution Architecture (with the ASCII data-flow diagram from the week file) → Features (as a PDF-requirement checklist) → Tech Stack → Folder Structure → Setup (local) → Configuration (.env) → Usage → Deployment (Render) → Requirement Compliance (link to REQUIREMENTS.md) → Future Improvements → Author.** Prose + tables; screenshots near the top. The root README presents the whole "GenAI Suite," links each week, and lists the bonus projects.

---

## 12. Deployment standard

Every README documents **both**:
1. **Local:** `python -m venv venv` → activate → `pip install -r requirements.txt` → copy `.env.example`→`.env` + add key → `python app.py` → open `http://localhost:5000`.
2. **Render (free web service):** Build = `pip install -r requirements.txt`; Start = `gunicorn app:app` (add `gunicorn` to requirements); set env vars in the Render dashboard. Note free-tier cold-starts. Include a one-line note that the same pattern works on Railway/HF Spaces.

Deployment docs are required **even if not deployed** — reviewers reward readiness.

---

## 13. Screenshots (portfolio multiplier)

Each week ships a `SCREENSHOT_PLAN.md` naming the exact shots to capture once the app runs (home/empty state, primary action mid-use, the requirement-specific proof shot, success result, an error/edge case). Screenshots live in `week-N-.../screenshots/` and are embedded near the top of that week's README. This is the cheapest, highest-impact way to make the GitHub repo look professional.

---

## 14. Coding standards (tell Sonnet, enforced in every prompt)

Modular files (no 800-line `app.py`); clear function names; docstrings on non-trivial functions; type hints on public functions; **no secrets in code**; centralized error handling with typed exceptions and user-friendly messages; basic `logging` (not bare `print`) on the backend; input validation on every route; pinned `requirements.txt`; consistent formatting. **No placeholder/stub logic** in the required paths — if a feature is in the PDF, it must actually work end-to-end against the real API (no fake "demo mode" standing in for a required capability; a graceful offline fallback may exist *in addition to*, never *instead of*, the real integration).

---

## 15. Acceptance gate (per project)

A week is "done" only when: (a) every box in its `REQUIREMENTS.md` is checked and demonstrably true in the running app; (b) it runs from a clean clone following only its README; (c) it fails gracefully with no key / bad input / API error; (d) README + screenshots + deployment docs are present; (e) the UI matches the shared design system. Each week file ends with this checklist made concrete.

---

## 16. Build sequence with Sonnet 4.6

1. Create the repo + folder skeleton (§5) and the shared `theme.css` + `llm_client.py` once; copy into each week as you reach it.
2. **Week 1** → paste its master prompt → build → run the acceptance checklist → screenshots → commit.
3. Repeat for **Week 2**, **Week 3**, **Week 4** (flagship — give it the most polish/time).
4. Move prior RAG + Safety into `bonus/`.
5. Write the root README, push, and paste the four folder links into the Google Form.

Build strictly one week at a time; never let an unfinished week block the next.

---

## 17. Git & commit conventions

Conventional, readable commits (`feat(week1): in-memory history + Gemini integration`, `docs(week1): README + REQUIREMENTS`). Commit per logical unit, not one giant dump — a clean history reads as professional. Tag a `v1-week1` style checkpoint when a week passes acceptance (optional but nice).

---

## 18. Known risks & mitigations

- **HF free-tier rate limits / model cold-start (Week 3):** mitigated by the required timeout + exponential-back-off + retry logic and clear user-facing "model warming up, retrying…" messaging. This is exactly what the PDF asks for.
- **Gemini free-tier quotas (Weeks 1,2,4):** keep `max_output_tokens` sane; surface quota errors via the typed `LLMError`; Week 1 history pruning also limits payload growth.
- **Model-ID drift:** Sonnet verifies the current Gemini model string at build time (see §4 note).
- **Secret leakage:** `.env` git-ignored + `.env.example` committed; pre-push check that no key is staged.

---

*Next: open each `WEEK-N-*.md` for the full per-project architecture and the copy-paste master prompt for Sonnet.*
