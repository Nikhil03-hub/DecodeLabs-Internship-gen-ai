# Week 4 — Intelligent Code Reviewer & Explainer  ⭐ FLAGSHIP

**DecodeLabs Gen AI · Project 4** · Status: **OPTIONAL mastery** (certification already met after Wk 1–3) · Folder: `week-4-intelligent-code-reviewer/`
**Stack:** Flask + vanilla JS (+ highlight.js & marked via CDN) · Gemini (free) via `google-genai` · shared design system.
> Read `00-MASTER-ARCHITECTURE.md` first. Treat this as the **showcase** project: best UI, best docs, best screenshots. This file = full design + the copy-paste Sonnet master prompt (bottom).

---

## 1. The contract — verbatim from the PDF (+ the technical lessons it teaches)

> **Goal:** A developer utility tool that **analyzes a code block, identifies bugs, and explains the code in plain language.**
>
> **Key Requirements:**
> 1. **Ingest a raw code file (.py, .js, .java) as a string variable.**
> 2. **Use system formatting instructions to force the model to output a distinct bug report and an optimized code block.**
> 3. **Render the output with markdown formatting so code snippets display with syntax highlighting.**
>
> **Key Skills:** Code-as-context management, structured outputs, code-analysis pipelines.
>
> *(Optional mastery project — finishing it adds "Code Analysis Pipelines & Structured Outputs" to your verified skills.)*

**The PDF's middle pages teach the production pipeline — implement it:**
- **Input stage:** accept `.py/.js/.java` (`.cpp` bonus); load the file as **raw text**; pass the **entire code as context**.
- **Robust file handling:** handle **`FileNotFoundError`**, **`PermissionError`**, **`UnicodeDecodeError`** (encoding) gracefully.
- **Context orchestration:** the model reasons about functions/variables/control-flow/logic — not just text.
- **System prompt:** not "be friendly" but **"You are a Senior Code QA Engineer. Output only the required structured sections."**
- **Output validation:** the response **must contain the mandated sections (BUG_REPORT + REFACTORED_CODE)**; if one is missing, **reject** (repair/retry) rather than show a malformed result.
- **Pipeline:** `Code File → AI Analysis → Validation → Rendering Engine → Formatted Report`.

---

## 2. Requirement → feature traceability (becomes `REQUIREMENTS.md`)

| # | PDF requirement | How it's satisfied | Where reviewer sees it |
|---|---|---|---|
| R1 | Ingest raw code file (.py/.js/.java) as a string | Drag-drop/upload **and** paste-in editor; `ingest.py` reads to string, detects language | Upload zone + editor |
| R2 | System instructions **force** a distinct **bug report** + **optimized code block** | `analyzer.py` strict "Senior Code QA Engineer" system prompt mandating a JSON schema with `bug_report` + `refactored_code` | Rendered Bug Report + Refactored Code panels |
| R3 | **Render markdown with syntax highlighting** | highlight.js highlights original + refactored code; marked renders the plain-language explanation | Highlighted code blocks |
| R4 | **Output validation** (reject if a section missing) | `validate_output()` requires `bug_report` + `refactored_code`; one **repair retry** if malformed | "validated ✓" indicator; never a broken result |
| R5 | Robust file handling | catch `FileNotFoundError`/`PermissionError`/`UnicodeDecodeError`, encoding fallback, size/empty/binary guards | Friendly errors on bad files |
| R6 | Plain-language explanation | `explanation` section, markdown-rendered | "Explanation" panel |
| R7 (bonus) | Severity levels + **Security/Performance** findings | each finding has `severity` + `category`; grouped views | Severity badges; Security/Perf tabs |
| R8 (bonus) | **Improvement score + complexity** | `scores` block → score ring + complexity badge | Header scorecard |
| R9 (bonus) | **Export report** + copy + diff | download `.md` (## BUG_REPORT / ## REFACTORED_CODE), copy refactored, original↔refactored diff | Export / Copy / Diff buttons |

---

## 3. End-to-end architecture (the PDF's pipeline)

```
┌──────────────────────── BROWSER (AI Code Review console) ─────────────────────────┐
│  INPUT                                  │  REPORT                                    │
│  • Drag-drop / Upload (.py/.js/.java)   │  • Scorecard: improvement ring,            │
│  • or paste into code editor (mono)     │      complexity, high/med/low counts (R8)  │
│  • Language [auto ▾]   [Analyze]        │  • BUG REPORT: issue cards w/ severity,    │
│                                          │      line, explanation, fix (R2,R7)        │
│                                          │  • SECURITY / PERFORMANCE tabs (R7)        │
│                                          │  • EXPLANATION (markdown) (R6)             │
│                                          │  • REFACTORED CODE (highlighted) (R2,R3)   │
│                                          │  • Diff · Copy · Download .md  (R9)        │
└───────────────┬─────────────────────────────────────────────────────────────────────┘
                │ POST /api/analyze { code, language }     (or multipart file upload)
                ▼
┌──────────────────────── FLASK BACKEND (app.py) ───────────────────────────────────┐
│ 1. ingest.read(...) -> raw string  (encoding-safe; FileNotFound/Permission/Unicode) (R1,R5) │
│ 2. detect language (extension / hint)                                               │
│ 3. system = analyzer.build_system_prompt()  ← strict QA-engineer + JSON schema (R2)  │
│ 4. raw = llm_client.generate([code as context], temperature≈0.2, max_tokens large)   │
│ 5. parsed = parse_json_tolerant(raw)                                                 │
│ 6. validate_output(parsed): require bug_report[] + refactored_code  → repair-retry   │
│      once if missing, else AnalysisError                            (R4)             │
│ 7. return parsed  { language, summary, scores, bug_report[], explanation,            │
│                     refactored_code }                                                │
└───────────────┬─────────────────────────────────────────────────────────────────────┘
                ▼  llm_client → Gemini (official google-genai SDK)        Rendering: highlight.js + marked (R3)
```

---

## 4. Folder structure

```
week-4-intelligent-code-reviewer/
├── app.py                 # Flask routes
├── llm_client.py          # shared Gemini provider abstraction
├── analyzer.py            # system prompt, schema, analyze(), validate_output(), repair retry
├── ingest.py              # file/string ingestion, encoding-safe read, language detect, guards
├── requirements.txt       # flask, google-genai, python-dotenv, gunicorn
├── .env.example           # LLM_PROVIDER, GEMINI_API_KEY
├── .gitignore
├── README.md
├── REQUIREMENTS.md
├── SCREENSHOT_PLAN.md
├── samples/               # intentionally buggy demo files (buggy.py, buggy.js, buggy.java)
├── templates/index.html
├── static/css/theme.css   # shared design system
├── static/js/app.js       # editor, highlight.js + marked rendering, diff
└── screenshots/
```

---

## 5. Backend design (contracts, not code)

**`ingest.py`** (R1, R5)
- `read_upload(file_storage) -> (code:str, language:str)` and `read_text(code:str, filename_or_lang) -> (code, language)`.
- Encoding-safe: try UTF-8, fall back (e.g., latin-1) and flag; on `UnicodeDecodeError` return a friendly "couldn't decode — is this a text file?" Handle `FileNotFoundError`/`PermissionError` (relevant if a path mode is added). Guard empty file, oversized file (e.g., > ~100 KB → friendly limit message), and obviously-binary content.
- `detect_language(filename|hint) -> "python"|"javascript"|"java"|"cpp"|...` from extension; allow manual override.

**`analyzer.py`** (R2, R4)
- `build_system_prompt() -> str` — the **strict** instruction: *"You are a Senior Code QA Engineer. Analyze the user's {language} code. Respond with ONLY a JSON object matching this schema… Do not include prose outside JSON."* Mandates keys: `language, summary, scores{bug_count, severity_high, severity_medium, severity_low, improvement_score(0–100), complexity}, bug_report[]{title, severity(high|medium|low), line, category(bug|security|performance|style), explanation, suggested_fix}, explanation(markdown), refactored_code(full optimized source as string)`.
- `analyze(code, language) -> dict` — calls `llm_client.generate(...)` with **low temperature (~0.2)** for determinism and a **large `max_output_tokens`** (refactored code can be long).
- `parse_json_tolerant(raw) -> dict` — strip ``` fences, locate the JSON object, `json.loads`.
- `validate_output(parsed) -> (ok, missing)` — **require** non-empty `bug_report` (list) **and** `refactored_code` (string) — the two PDF-mandated sections. If invalid, do **one repair retry** ("Your previous output was missing X / wasn't valid JSON — return ONLY the corrected JSON"). If still invalid → raise `AnalysisError`. (This is the PDF's "reject if a section is missing" rule.)

**`llm_client.py`** — shared (Master §7).

**`app.py` routes:**

| Method · Path | Request | Response |
|---|---|---|
| `GET /` | — | renders console |
| `POST /api/analyze` | JSON `{code, language}` **or** multipart file upload | `{language, summary, scores, bug_report[], explanation, refactored_code, validated:true}` |
| `GET /api/sample/<name>` *(bonus)* | — | returns a bundled buggy sample's code |

**Validation/edge:** empty code → 400 friendly; oversize → 413 friendly; ingestion errors → 400 with the specific reason; `AnalysisError`/`LLMError` → 502 toast; fail fast if key missing.

---

## 6. Frontend design (flagship — a polished code-review console)

- **Input:** a **drag-and-drop upload zone** *and* a **code editor** (mono, line numbers; a styled textarea is fine, or CodeMirror via CDN as enhancement); **language** auto-detected from the file with a manual override dropdown; **"Load a sample"** to try a bundled buggy file; **Analyze** (gradient).
- **Report (the showpiece):**
  - **Scorecard** header: an **improvement-score ring (0–100)**, a **complexity** badge, and **High/Medium/Low** severity counts (R8).
  - **Bug Report:** issue **cards**, each with a colored **severity badge**, **line number**, category icon, plain explanation, and **suggested fix** (R2/R7).
  - **Security / Performance** filter tabs (derived from `category`) (R7).
  - **Explanation:** markdown-rendered plain-language walkthrough via **marked** (R6).
  - **Refactored Code:** full optimized source in a **highlight.js**-highlighted block with a **Copy** button and a **Diff** toggle (original ↔ refactored) (R2/R3/R9).
  - **Export:** **Download report (.md)** assembling `## BUG_REPORT` + `## REFACTORED_CODE` + explanation (the literal PDF format), and browser **Print → PDF**.
  - A small **"validated ✓"** chip confirms the structured-output validation passed (R4).
- States: loading ("Reviewing your code…"), success, clean error toast, empty state ("Paste code or drop a file to get a senior-engineer review").

---

## 7. Structured-output strategy (why JSON + markdown export)

JSON transport makes **validation** reliable (R4) — we can deterministically check that `bug_report` and `refactored_code` exist and repair if not — while the frontend renders it into a rich, **syntax-highlighted** report (R3) and the **`.md` export uses the exact `## BUG_REPORT` / `## REFACTORED_CODE` headings** the PDF shows. This satisfies the literal requirement (distinct bug report + optimized code block, markdown-rendered) *and* the taught validation step, robustly.

---

## 8. Deliverables checklist (acceptance gate)

- [ ] Ingest .py/.js/.java as a string via upload **and** paste (R1); language auto-detected.
- [ ] Strict system prompt forces structured bug report + refactored code (R2).
- [ ] Output validated; missing-section → repair retry → never a malformed result (R4).
- [ ] Code rendered with syntax highlighting; explanation markdown-rendered (R3/R6).
- [ ] File errors (decode/empty/oversize/binary) handled with friendly messages (R5).
- [ ] Severity + Security/Performance grouping (R7); score ring + complexity (R8).
- [ ] Export .md (## BUG_REPORT/## REFACTORED_CODE), copy, diff (R9).
- [ ] `samples/` buggy files included for demo.
- [ ] README + REQUIREMENTS.md + SCREENSHOT_PLAN.md + .env.example + requirements.txt; runs from README; Render notes; shared design system; responsive.

---

## 9. SCREENSHOT_PLAN.md (contents to generate)

1. **Console / empty state.** 2. **Code loaded** (a sample buggy file in the editor). 3. **Full report** — scorecard + bug cards + refactored code. 4. **Severity badges** close-up + Security/Performance tab. 5. **Diff** view (original ↔ refactored). 6. **Exported .md** report preview. 7. **Friendly error** (e.g., binary/oversize file). 8. Multi-language proof (a .js and a .java review).

---

## 10. Future improvements (README section)

Multi-file / repo analysis; inline annotations in the editor gutter; auto-fix-and-rerun loop; test-generation for found bugs; CI/GitHub Action mode; provider switch (Claude excels at code) via the same `llm_client`; persistent review history; language-server-grade static analysis fused with the LLM.

---

## 11. MASTER PROMPT FOR SONNET 4.6 — Week 4 (flagship)

> Paste everything in the box into a fresh Sonnet 4.6 (high-effort) session. Self-contained. This is the showcase project — hold the highest bar.

```
ROLE
You are a senior Gen-AI application engineer building the FLAGSHIP portfolio project for the DecodeLabs Generative AI internship (Batch 2026), Week 4. It must look and feel like a real AI developer tool (think a polished "AI code review" SaaS). Hold the highest quality bar of all four projects. A reviewer must verify every requirement at a glance.

NON-NEGOTIABLE PRINCIPLE — THE PDF IS THE CONTRACT
Satisfy 100% of the requirements below, make each VISIBLE, and ship REQUIREMENTS.md mapping each to its feature/file. The PDF explicitly teaches a pipeline (ingest → AI analysis → VALIDATION → rendering → report) and a strict system prompt — implement them for REAL. Only then add polish.

PROJECT: Intelligent Code Reviewer & Explainer
GOAL: Analyze a code block, identify bugs, explain it in plain language, and return an optimized version.
REQUIREMENTS (verbatim intent + taught pipeline):
  R1. Ingest a raw code file (.py/.js/.java; .cpp bonus) as a STRING — support file upload AND paste.
  R2. Use SYSTEM FORMATTING INSTRUCTIONS to FORCE a distinct BUG REPORT + an OPTIMIZED CODE block.
  R3. RENDER with markdown + SYNTAX HIGHLIGHTING for code.
  R4. VALIDATE the output: if a mandated section (bug report or refactored code) is missing, REJECT and repair-retry — never show a malformed result.
  R5. Robust file handling: catch FileNotFoundError / PermissionError / UnicodeDecodeError; encoding fallback; empty/oversize/binary guards.
  R6. Plain-language EXPLANATION.
  R7. (bonus) Severity levels + Security/Performance findings.
  R8. (bonus) Improvement score (0–100) + complexity rating.
  R9. (bonus) Export report (.md), copy refactored code, original↔refactored diff.

LOCKED TECH DECISIONS
- Backend Flask (Python); frontend server-rendered template + vanilla HTML/CSS/JS (NO React, NO Bootstrap default look). For rendering you MAY use highlight.js and marked via CDN (only these two CDN libs; optionally CodeMirror via CDN for the editor).
- LLM: Google Gemini via OFFICIAL google-genai SDK, GEMINI_API_KEY from .env (python-dotenv). Use a current Gemini *Flash* model — VERIFY the exact model id against current Google docs. Use LOW temperature (~0.2) and a LARGE max_output_tokens (refactored code can be long).
- Reuse the provider abstraction llm_client.py (same as Weeks 1/2) with generate(messages_or_prompt, *, temperature, top_p, max_output_tokens, system) -> str raising typed LLMError; provider swappable via LLM_PROVIDER (default gemini).

ARCHITECTURE (implement exactly — this is the PDF pipeline)
- ingest.py: read_upload(file) and read_text(code, filename_or_lang) -> (code:str, language:str). Encoding-safe (UTF-8 then fallback; friendly UnicodeDecodeError message); handle FileNotFoundError/PermissionError; guard empty/oversize (~100KB)/binary. detect_language(filename|hint) from extension with manual override.
- analyzer.py:
   build_system_prompt(language) -> a STRICT prompt: "You are a Senior Code QA Engineer. Analyze the user's {language} code and respond with ONLY a JSON object matching this schema; no prose outside JSON." Schema keys: language; summary; scores{bug_count, severity_high, severity_medium, severity_low, improvement_score(0-100), complexity(low|medium|high)}; bug_report[]{title, severity(high|medium|low), line, category(bug|security|performance|style), explanation, suggested_fix}; explanation(markdown); refactored_code(full optimized source as string).
   analyze(code, language) -> dict : call llm_client.generate(..., temperature=0.2, max_output_tokens large).
   parse_json_tolerant(raw) -> dict : strip code fences, extract the JSON object, json.loads.
   validate_output(parsed) -> (ok, missing) : REQUIRE non-empty bug_report (list) AND refactored_code (string). If invalid, do ONE repair retry ("Your previous output was missing {X}/invalid JSON — return ONLY corrected JSON"). If still invalid, raise AnalysisError.
- app.py routes:
   GET  /              -> console
   POST /api/analyze    JSON {code, language} OR multipart file upload -> {language, summary, scores, bug_report[], explanation, refactored_code, validated:true}
   GET  /api/sample/<name> -> bundled buggy sample code
   Validation: empty code 400; oversize 413; ingestion errors 400 (specific reason); AnalysisError/LLMError 502 {error}; fail fast if key missing.
- samples/: include buggy.py, buggy.js, buggy.java with real, obvious issues (e.g., off-by-one, mutable default arg, unsanitized input, inefficient loop) to demo on.

FRONTEND (shared design system — dark, modern, responsive; reuse the SAME static/css/theme.css; highest polish of the suite)
Tokens: --bg #0B0F17, --surface #141A24, --surface-2 #1C2430, --border rgba(255,255,255,.08), --text #E8EDF4, --text-dim #9AA7B8, --brand #6366F1, --brand-2 #A855F7, --accent #22D3EE; radius 14px; Inter UI / JetBrains Mono code. Gradient wordmark "DecodeLabs · GenAI Suite"; right label "Week 4 · AI Code Reviewer"; footer "Built by Nikhil · DecodeLabs GenAI Internship 2026 · powered by Gemini".
INPUT: drag-drop upload zone + a mono code editor with line numbers (styled textarea or CodeMirror via CDN); language auto-detect + manual override dropdown; "Load a sample" button; Analyze (gradient).
REPORT: 
  • Scorecard header: improvement-score RING (0–100), complexity badge, High/Medium/Low counts.
  • Bug Report: issue cards with colored severity badge + line number + category icon + explanation + suggested fix.
  • Security / Performance filter tabs (from category).
  • Explanation: markdown-rendered (marked).
  • Refactored Code: highlight.js-highlighted block + Copy button + Diff toggle (original↔refactored).
  • Export: Download report (.md) assembling "## BUG_REPORT" + "## REFACTORED_CODE" + explanation; browser Print→PDF.
  • A "validated ✓" chip confirming output validation passed.
Loading ("Reviewing your code…"), success, clean error toast, empty state.

DELIVERABLES (create all)
app.py, llm_client.py, analyzer.py, ingest.py, requirements.txt (flask, google-genai, python-dotenv, gunicorn — pinned), .env.example (LLM_PROVIDER=gemini, GEMINI_API_KEY=your_key_here), .gitignore, samples/(buggy.py,buggy.js,buggy.java), templates/index.html, static/css/theme.css, static/js/app.js, README.md, REQUIREMENTS.md, SCREENSHOT_PLAN.md.
README order: title + pitch, screenshots, Overview, Problem Statement, Solution Architecture (ASCII pipeline diagram), Features (R1–R9 checklist; call out the validation step + strict system prompt), Tech Stack, Folder Structure, Setup, Configuration, Usage (incl. "Load a sample"), Deployment (Render: gunicorn app:app + env vars), Requirement Compliance (link REQUIREMENTS.md), Future Improvements, Author (Nikhil).
REQUIREMENTS.md: table mapping R1–R9 to feature/file, all checked.
SCREENSHOT_PLAN.md: empty state, code loaded, full report, severity/security tab, diff view, exported .md, friendly error, multi-language proof.

CODING STANDARDS
Modular files, docstrings, type hints on public funcs, centralized typed errors with friendly messages, python logging (no secrets), input validation per route, pinned requirements. R2 (forced structure) and R4 (validation/repair) must be REAL — actually parse, validate, and repair; do not fake the report.

ACCEPTANCE — self-verify and report:
  [ ] Ingest .py/.js/.java as string via upload AND paste; language auto-detected (R1).
  [ ] Strict system prompt forces structured bug report + refactored code (R2).
  [ ] Output validated; missing-section triggers repair retry; never malformed (R4).
  [ ] Syntax-highlighted code + markdown explanation render correctly (R3,R6).
  [ ] Bad-file handling (decode/empty/oversize/binary) friendly (R5).
  [ ] Severity + Security/Performance grouping (R7); score ring + complexity (R8); export/copy/diff (R9).
  [ ] samples/ work; runs from README alone; responsive; matches design tokens.
Output a build summary + filled checklist. Ask before adding any dependency/pattern beyond flask, google-genai, python-dotenv, gunicorn, highlight.js, marked, (optional) CodeMirror.
```

---
*End of Week 4. This completes the four official weekly projects. See `00-MASTER-ARCHITECTURE.md` for repo assembly, the bonus folder, and Google Form submission.*
