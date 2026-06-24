# Week 1 — Custom AI Chatbot with Memory

**DecodeLabs Gen AI · Project 1** · Status: **REQUIRED** (foundation) · Folder: `week-1-ai-chatbot-memory/`
**Stack:** Flask + vanilla JS · Gemini (free) via `google-genai` · shared design system.
> Read `00-MASTER-ARCHITECTURE.md` first. This file = full design + the copy-paste Sonnet master prompt (bottom).

---

## 1. The contract — verbatim from the PDF

> **Goal:** Build a conversational terminal or web app that **remembers previous user messages during a live session**.
>
> **Key Requirements:**
> 1. **Connect to a frontier LLM using an official SDK API key.**
> 2. **Maintain an active in-memory list array** to store the conversation history.
> 3. **Append every new user input and model response to the history payload** to preserve context.
>
> **Key Skills:** API integration, session-state management, chat-history mechanics.
>
> **Conclusion / bonus ideas:** a logic loop to **prune older messages when history exceeds the model's token limit**; a clean terminal interface; treat out-of-context responses / API payload errors as learning.

**Plain reading:** the whole project is about *statefulness*. A stateless LLM is turned into a contextual conversation by (a) really calling the model through its official SDK, (b) keeping an in-memory array of the dialogue, and (c) sending that growing array back on every turn. The memory must be **real and visible**.

---

## 2. Requirement → feature traceability (becomes `REQUIREMENTS.md`)

| # | PDF requirement | How it's satisfied | Where reviewer sees it |
|---|---|---|---|
| R1 | Frontier LLM via official SDK + API key | `llm_client.py` calls Gemini through the official `google-genai` SDK, keyed by `GEMINI_API_KEY` | Real replies in chat; `llm_client.py`; README "Tech Stack" |
| R2 | In-memory list array of conversation history | Server holds `SESSIONS[session_id] -> list[Message]` (a Python list) for the live session | **"Session Memory" side panel** renders the live array; `/api/history` |
| R3 | Append every user + model turn to the payload | Each `/api/chat` call appends the user msg, sends the **entire** array to the model, then appends the model reply | Memory panel grows by 2 each turn; context is retained across turns |
| R4 | Preserve context across the session | Whole history array is the model payload every call → the bot remembers earlier facts | "Memory test" demo (tell it your name, ask later) |
| R5 (bonus) | Prune when over token limit | Token-estimate loop trims oldest turns past a threshold, keeping the session within limits | "context trimmed" badge + counter in the Memory panel |
| R6 (bonus) | Clean terminal interface | `chat_cli.py` — same engine, terminal REPL | README "Bonus: CLI" + screenshot |

Every box above ships **checked and demonstrably true**.

---

## 3. End-to-end architecture

```
┌────────────────────────────── BROWSER (single-page chat) ──────────────────────────────┐
│  Chat window (user/assistant bubbles)   │   SESSION MEMORY panel (proof of R2/R3/R5)     │
│  ──────────────────────────────────     │   • live view of the in-memory array           │
│  [ message input ........... ] [Send]    │   • "N messages in memory · ~T tokens"          │
│  [ New Chat ]  (typing indicator)         │   • "context trimmed" badge when pruning fires  │
└───────────────┬──────────────────────────────────────────────────────────────────────────┘
                │  POST /api/chat { message }            (cookie carries session_id)
                ▼
┌────────────────────────────── FLASK BACKEND (app.py) ──────────────────────────────────┐
│  1. resolve session_id (Flask signed cookie)                                            │
│  2. history = SESSIONS[session_id]        ← THE in-memory list array  (R2)              │
│  3. history.append({role:"user", content:msg})                        (R3)              │
│  4. prune_if_needed(history)              ← token-limit loop          (R5)              │
│  5. reply = llm_client.generate(history, temperature, top_p, ...)     (R1, R4)          │
│  6. history.append({role:"model", content:reply})                     (R3)              │
│  7. return { reply, memory:[...], message_count, est_tokens, pruned }                   │
└───────────────┬──────────────────────────────────────────────────────────────────────────┘
                │  llm_client.generate(messages, ...)
                ▼
        ┌─────────────────── llm_client.py (provider abstraction) ───────────────────┐
        │  official google-genai SDK · model = current Gemini Flash                   │
        │  maps message array → SDK contents · returns text · raises typed LLMError   │
        └──────────────────────────────────────────────────────────────────────────┘

SESSIONS : dict[str, list[Message]]   # module-level, in-memory; the literal "history array"
Message  : { "role": "user" | "model", "content": str }
```

**Why server-side memory:** the PDF asks for "an active in-memory list array." A module-level `SESSIONS` dict of lists is exactly that — the canonical history lives on the server and is sent in full to the model each turn. The browser mirrors it for display. (A new process = cleared memory, which is correct for "live session" semantics. Optionally also persist to the Flask `session` cookie only for `session_id`, never the full history.)

---

## 4. Folder structure

```
week-1-ai-chatbot-memory/
├── app.py                 # Flask routes + session/history orchestration
├── llm_client.py          # Gemini provider abstraction (shared pattern)
├── memory.py              # SESSIONS store, append, token-estimate, prune loop
├── chat_cli.py            # BONUS terminal interface (same memory.py + llm_client.py)
├── requirements.txt       # flask, google-genai, python-dotenv, gunicorn
├── .env.example           # LLM_PROVIDER, GEMINI_API_KEY
├── .gitignore
├── README.md
├── REQUIREMENTS.md
├── SCREENSHOT_PLAN.md
├── templates/index.html
├── static/css/theme.css   # shared design system
├── static/js/app.js       # chat UI + memory panel logic
└── screenshots/
```

---

## 5. Backend design (contracts, not code)

**`memory.py`**
- `SESSIONS: dict[str, list[Message]]` — module-level, in-memory.
- `get_history(session_id) -> list[Message]` — create empty list on first use.
- `append_turn(session_id, role, content)` — append one message.
- `estimate_tokens(history) -> int` — heuristic (≈ chars/4); note in code that the SDK's token counter could replace it.
- `prune_if_needed(history, max_tokens) -> bool` — **loop**: while over budget, drop the oldest user+model pair (never drop a pinned system message); return whether anything was pruned. (R5)
- `reset(session_id)` — clear the list.
- `MAX_CONTEXT_TOKENS` config (e.g. ~6000) chosen well under model limit to demo pruning without huge payloads.

**`llm_client.py`** — see Master doc §7. `generate(messages, *, temperature=0.7, top_p=0.95, max_output_tokens=1024, system=DEFAULT_SYSTEM) -> str`. Maps the role-tagged array to the Gemini SDK `contents`, applies generation config, returns text, raises typed `LLMError`. A short, friendly assistant `DEFAULT_SYSTEM` persona is fine (memory is the star, not persona).

**`app.py` routes:**

| Method · Path | Request | Response | Notes |
|---|---|---|---|
| `GET /` | — | renders `index.html` | sets a session cookie if absent |
| `POST /api/chat` | `{ "message": str }` | `{ "reply": str, "memory": Message[], "message_count": int, "est_tokens": int, "pruned": bool }` | steps 1–7 of §3 |
| `GET /api/history` | — | `{ "memory": Message[], "message_count": int, "est_tokens": int }` | powers the Memory panel on load |
| `POST /api/reset` | — | `{ "ok": true }` | clears `SESSIONS[session_id]` |

**Validation/edge:** reject empty/whitespace message (400 + friendly msg); cap input length (e.g. 4000 chars) with a clear message; on `LLMError` return 502 + `{error}` that the UI shows as a toast (history still intact); missing `GEMINI_API_KEY` → fail fast at startup with a one-line fix hint.

---

## 6. Frontend design

Single page, shared dark theme, two-column on desktop / stacked on mobile:

- **Left — Chat:** scrollable transcript of user (right, brand gradient) and assistant (left, surface) bubbles; sticky composer with textarea + **Send** (Enter to send, Shift+Enter newline); animated typing indicator while awaiting reply; **New Chat** clears via `/api/reset`.
- **Right — "Session Memory" panel (the requirement made visible):** live JSON-ish list of the in-memory array (role + truncated content per row); header counter **"{n} messages in memory · ~{t} tokens"**; a **"context trimmed"** badge that appears when `pruned:true`; a one-line caption: *"This panel is the live in-memory history array sent to the model on every turn."*
- **Memory-proof affordance:** a "Run memory test" helper button that sends "My name is Nikhil and my favorite city is Kyoto." then "What's my name and favorite city?" so the retention is trivially demonstrable for screenshots/reviewers.
- States: loading, success, error toast, empty state ("Start chatting — your conversation memory builds on the right →").

---

## 7. Error handling & reliability

Missing key → fail fast. Network/timeout/429/safety-block → typed `LLMError` → 502 + friendly toast, history preserved (the failed user turn can be kept or rolled back — keep it, and let retry resend the array). Centralized timeout + one back-off retry in `llm_client`. Backend uses `logging`, never logs message content beyond debug level, never logs the key.

---

## 8. Deliverables checklist (acceptance gate)

- [ ] Real Gemini reply via official SDK (R1) — works with a valid key; clear error without one.
- [ ] `SESSIONS` in-memory list array exists and is the model payload (R2/R3).
- [ ] Memory panel shows the live array + counters; grows by 2 each turn (R2/R3).
- [ ] Context retained across turns — name/city memory test passes (R4).
- [ ] Pruning loop trims oldest turns past the token threshold; "context trimmed" badge shows (R5).
- [ ] `chat_cli.py` runs a terminal conversation with the same memory (R6).
- [ ] Empty/oversized input handled; API error shows a toast without losing history.
- [ ] README + REQUIREMENTS.md + SCREENSHOT_PLAN.md + .env.example + requirements.txt present.
- [ ] Local run works from README alone; Render notes included.
- [ ] Matches shared design system; responsive to ~360px.

---

## 9. SCREENSHOT_PLAN.md (contents to generate)

1. **Home / empty state** — clean chat + empty Memory panel.
2. **Mid-conversation** — several turns; Memory panel populated; counter visible.
3. **Memory proof** — the name/city test showing the bot recalling earlier info.
4. **Pruning** — long chat with the "context trimmed" badge + counter.
5. **CLI bonus** — terminal session screenshot.
6. *(optional)* error toast on a forced API failure.

---

## 10. Future improvements (README section)

Replace token heuristic with the SDK's exact token counter; streaming responses (SSE); optional Redis-backed session store for multi-instance deploys; export transcript; system-prompt selector; provider switch to OpenAI/Claude via the same `llm_client` contract.

---

## 11. MASTER PROMPT FOR SONNET 4.6 — Week 1

> Paste everything in the box into a fresh Sonnet 4.6 (high-effort) session. It is self-contained.

```
ROLE
You are a senior Gen-AI application engineer. Build a production-quality, portfolio-grade project for the DecodeLabs Generative AI internship (Batch 2026), Week 1. Quality bar: it must look and behave like a real product, and a reviewer must be able to verify every requirement at a glance.

NON-NEGOTIABLE PRINCIPLE — THE PDF IS THE CONTRACT
The official DecodeLabs Project-1 requirements are below. Satisfy 100% of them, make each one VISIBLE in the UI, and create a REQUIREMENTS.md that maps each requirement to the feature/file that fulfills it. Only after all requirements are met may you add polish. Never trade compliance for extra complexity.

PROJECT: Custom AI Chatbot with Memory
GOAL: A conversational web app that remembers previous user messages during a live session.
REQUIREMENTS (verbatim intent):
  R1. Connect to a frontier LLM using an official SDK + API key.
  R2. Maintain an active IN-MEMORY LIST ARRAY storing the conversation history.
  R3. Append every new user input AND model response to the history payload to preserve context (send the whole array each turn).
  R4. Preserve context across the live session.
  R5. (bonus) A loop that prunes older messages when history exceeds a token threshold.
  R6. (bonus) A clean terminal interface.

LOCKED TECH DECISIONS
- Backend: Flask (Python). Frontend: server-rendered template + vanilla HTML/CSS/JS (NO React, NO Bootstrap default look).
- LLM: Google Gemini via the OFFICIAL google-genai SDK, keyed by GEMINI_API_KEY from a .env (python-dotenv). Use a current Gemini *Flash* model — VERIFY the exact current model id against current Google Gemini API docs before finalizing; do not assume.
- Provider abstraction: put all model access in llm_client.py exposing
    generate(messages, *, temperature=0.7, top_p=0.95, max_output_tokens=1024, system=DEFAULT_SYSTEM) -> str
  where messages is a list of {"role":"user"|"model","content":str}. Raise a typed LLMError on any failure. Keep it swappable (a future openai/anthropic backend must fit the same signature). Select provider via LLM_PROVIDER env (default "gemini").

ARCHITECTURE (implement exactly)
- memory.py: SESSIONS: dict[str, list[Message]] (module-level, in-memory — this IS the required array). Functions: get_history(session_id), append_turn(session_id, role, content), estimate_tokens(history) (~chars/4; comment that the SDK token counter could replace it), prune_if_needed(history, max_tokens) -> bool (a LOOP dropping the oldest user+model pair until under budget; never drop a pinned system msg), reset(session_id). MAX_CONTEXT_TOKENS ≈ 6000 (low enough to demo pruning).
- app.py routes:
    GET  /            -> render index.html, ensure a Flask session cookie (session_id)
    POST /api/chat    body {message} -> append user turn; prune_if_needed; reply = llm_client.generate(history,...); append model turn; return {reply, memory, message_count, est_tokens, pruned}
    GET  /api/history -> {memory, message_count, est_tokens}
    POST /api/reset   -> clear this session's history -> {ok:true}
  Validation: reject empty/whitespace (400, friendly), cap input ~4000 chars, on LLMError return 502 {error} (keep history intact), fail fast at startup if GEMINI_API_KEY missing (clear one-line fix message).
- chat_cli.py: a terminal REPL using the SAME memory.py + llm_client.py (type to chat, /reset to clear, /exit to quit, prints a small "[memory: N msgs ~T tokens]" line each turn).

FRONTEND (shared design system — dark, modern, responsive, no Bootstrap default)
Implement the design tokens and shared furniture described here:
  --bg #0B0F17, --surface #141A24, --surface-2 #1C2430, --border rgba(255,255,255,.08), --text #E8EDF4, --text-dim #9AA7B8, --brand #6366F1, --brand-2 #A855F7, --accent #22D3EE, success/warning/danger #22C55E/#F59E0B/#EF4444, --radius 14px, Inter for UI, JetBrains Mono for code/memory. Gradient wordmark "DecodeLabs · GenAI Suite", right-side label "Week 1 · AI Chatbot". Footer: "Built by Nikhil · DecodeLabs GenAI Internship 2026 · powered by Gemini". Put these tokens in static/css/theme.css (this exact file will be reused across all four weekly projects, so keep it self-contained and documented).
Layout: two columns on desktop, stacked on mobile (usable to ~360px).
  LEFT = Chat: scrollable transcript (user bubbles right/brand-gradient, assistant left/surface), sticky composer (textarea + Send; Enter sends, Shift+Enter newline), typing indicator, "New Chat" (calls /api/reset).
  RIGHT = "Session Memory" panel: live list of the in-memory array (role + truncated content per row, mono font), header counter "{n} messages in memory · ~{t} tokens", a "context trimmed" badge shown when pruned=true, and caption "This is the live in-memory history array sent to the model every turn."
Add a "Run memory test" button that sends two scripted messages proving recall ("My name is Nikhil and my favorite city is Kyoto." then "What's my name and favorite city?").
Every async action shows loading + success + clean error toast. Empty state invites the first message.

DELIVERABLES (create all)
app.py, llm_client.py, memory.py, chat_cli.py, requirements.txt (flask, google-genai, python-dotenv, gunicorn — pinned), .env.example (LLM_PROVIDER=gemini, GEMINI_API_KEY=your_key_here), .gitignore (.env, venv/, __pycache__/, *.pyc), templates/index.html, static/css/theme.css, static/js/app.js, README.md, REQUIREMENTS.md, SCREENSHOT_PLAN.md.
README (recruiter-grade, in order): title + one-line pitch, screenshots placeholder, Overview, Problem Statement, Solution Architecture (include an ASCII data-flow diagram), Features (as the R1–R6 checklist), Tech Stack, Folder Structure, Setup (venv + pip + copy .env.example to .env + add key + python app.py + localhost:5000), Configuration, Usage, Deployment (Render: build pip install -r requirements.txt, start gunicorn app:app, set env vars; note free-tier cold start), Requirement Compliance (link REQUIREMENTS.md), Future Improvements, Author (Nikhil).
REQUIREMENTS.md: a table mapping R1–R6 to the file/feature that satisfies each, every box checked.
SCREENSHOT_PLAN.md: list the exact shots (empty state, mid-conversation, memory-test proof, pruning badge, CLI, error).

CODING STANDARDS
Modular files (no monolith), docstrings on non-trivial functions, type hints on public functions, centralized typed error handling with user-friendly messages, python logging (never print secrets, never log the key), input validation on every route, pinned requirements. No stub/fake logic on the required path: R1 must be a REAL Gemini call. (A graceful error state when the API is unreachable is fine, but it must never replace the real integration.)

ACCEPTANCE — before you call it done, self-verify and report:
  [ ] Real Gemini reply via official SDK; clean failure with no/invalid key.
  [ ] SESSIONS in-memory array is the actual model payload; grows by 2 per turn.
  [ ] Memory panel shows the live array + counters; pruning badge fires past threshold.
  [ ] Name/city memory test proves cross-turn context retention.
  [ ] chat_cli.py works with the same memory.
  [ ] Empty/oversized input + API error handled gracefully (history intact).
  [ ] All deliverable files present; app runs from README alone; responsive; matches the design tokens.
Output a short build summary plus the filled acceptance checklist. Ask me before introducing any dependency or pattern not listed above.
```

---
*End of Week 1. Next: `WEEK-2-COPYWRITING-TONE-TRANSFORMER.md`.*
