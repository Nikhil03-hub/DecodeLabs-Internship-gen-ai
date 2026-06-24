# Week 1 — Screenshot Plan

Capture these screenshots once the app is running and add them to `screenshots/`.
Embed the first two in the README `## Screenshots` section.

| # | Filename | What to show | Key proof |
|---|---|---|---|
| 1 | `01-empty-state.png` | App on first load — clean chat panel, empty memory array, the "Run memory test" button | UI polish, empty state design |
| 2 | `02-mid-conversation.png` | Several turns in — memory panel populated, message counter = 6+, token bar visible | R2/R3: array grows by 2 per turn |
| 3 | `03-memory-proof.png` | After the memory test: AI correctly recalls name + city from an earlier message | R4: cross-turn context retention |
| 4 | `04-pruning-badge.png` | Long conversation: "context trimmed" badge visible, token bar near/at 100% | R5: pruning loop in action |
| 5 | `05-cli-bonus.png` | Terminal session showing `chat_cli.py` REPL with `[memory: N msgs ~T tokens]` output | R6: terminal interface |
| 6 | `06-error-state.png` | *(optional)* Force an API error (bad key) — clean error toast, history intact | Graceful error handling |

## How to take these shots

```bash
# Start the app
cd week-1-ai-chatbot-memory
python app.py

# Open http://localhost:5000 in a browser
# Use your OS screenshot tool or browser DevTools to capture
```

## Sizing recommendation

- Desktop shots: 1440×900 or 1280×800 (full browser window)
- High-DPI: use 2× retina if available for crisp GitHub display
