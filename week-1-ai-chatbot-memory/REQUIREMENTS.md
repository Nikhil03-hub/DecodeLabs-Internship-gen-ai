# Week 1 — Requirement Compliance Map

> DecodeLabs Generative AI Internship · Project 1 · Custom AI Chatbot with Memory

Every box below is checked and **demonstrably true** in the running application.
Reviewers: run the app, perform the "Memory proof" test, and verify each row.

| # | PDF Requirement | Status | Feature | File(s) |
|---|---|---|---|---|
| R1 | Connect to a frontier LLM using an **official SDK + API key** | ✅ | Real Gemini calls via `google-genai` SDK, keyed by `GEMINI_API_KEY` | `llm_client.py` |
| R2 | Maintain an active **in-memory list array** storing conversation history | ✅ | `SESSIONS: dict[str, list[Message]]` — module-level Python dict of lists | `memory.py` |
| R3 | **Append every new user input AND model response** to the history payload to preserve context (send full array each turn) | ✅ | `append_turn()` called after each user msg and model reply; `POST /api/chat` sends the full `history` list to Gemini | `memory.py`, `app.py` |
| R4 | **Preserve context** across the live session | ✅ | Full history array is the model payload on every call → bot recalls names, facts, preferences from earlier turns. Proven by the "memory test" button | `app.py`, `memory.py` |
| R5 | *(bonus)* A **loop that prunes** older messages when history exceeds the token threshold | ✅ | `prune_if_needed()` loops: while over budget, drops the oldest user+model pair. "context trimmed" badge fires in the UI when pruning occurs | `memory.py`, `static/js/app.js` |
| R6 | *(bonus)* A **clean terminal interface** | ✅ | `chat_cli.py` — REPL with `/reset`, `/history`, `/exit`; prints `[memory: N msgs ~T tokens]` each turn; uses the same `memory.py` + `llm_client.py` | `chat_cli.py` |

## How to verify R4 (memory proof)

1. Start the app and click **"Run memory test"** in the UI.
2. The demo sends: *"My name is Nikhil and my favorite city is Kyoto."*
3. Then immediately: *"What is my name and favorite city?"*
4. The AI correctly recalls both — proving cross-turn context retention.

## How to verify R5 (pruning)

1. Hold a long conversation until the token bar approaches 100%.
2. When `est_tokens > 6000`, `prune_if_needed()` fires automatically.
3. The **"context trimmed"** badge appears in the Memory panel.
4. The message count drops while the conversation continues.

## How to verify R2/R3 (memory panel)

The **Session Memory** panel on the right side of the UI shows the **live in-memory array** in real time:
- The count increases by 2 (one user + one model turn) after every exchange.
- The exact `{role, content}` objects match what is sent to Gemini.
- Caption reads: *"This is the live in-memory history array sent to the model every turn."*
