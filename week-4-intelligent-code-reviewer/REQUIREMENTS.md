# Week 4 Requirements Traceability

| # | PDF Requirement | Implementation | File | How to Verify |
|---|---|---|---|---|
| R1 | Gemini reviews submitted code | `analyze()` calls `llm_client.generate()` with full code + system prompt | `analyzer.py`, `llm_client.py` | Submit any code; see review in UI |
| R2 | Strict JSON-schema structured output | `_SYSTEM_PROMPT` instructs Gemini to return ONLY raw JSON matching defined schema | `analyzer.py` lines 30-70 | Check browser network tab for JSON response |
| R3 | Validate `bug_report` + `refactored_code` exist | `validate_output()` checks both fields; raises error with specifics if missing | `analyzer.py` lines 73-95 | Code review |
| R4 | One repair retry on validation failure | `_build_repair_prompt()` + second `generate()` call if first attempt invalid | `analyzer.py` lines 144-165 | Check logs for "Repair retry" message |
| R5 | Bug report list with severity levels | `bug_report` array with `critical\|high\|medium\|low\|info` severity + sorted | `analyzer.py` `_normalise()` | Submit buggy.py; see colored bug cards |
| R6 | Overall quality score 0-100 | `overall_score` field; animated ring SVG with count-up number | `analyzer.py`, `static/js/app.js` | Score ring animates on review complete |
| R7 | Language auto-detection | `ingest.py` detects from extension → shebang → heuristics | `ingest.py` lines 104-145 | Submit without language hint; badge shows detected language |
| R8 | Export review as Markdown | `buildMarkdownReport()` generates full .md with score, all bugs, refactored code | `static/js/app.js` | Click "Export .md" → download file |
| R9 | Monaco Editor for code input | Monaco loaded from CDN; diff editor for original vs refactored | `templates/index.html`, `static/js/app.js` | Code editor loads on page; Diff tab shows Monaco DiffEditor |
| R10 | File upload + paste modes | Tab strip: "Paste Code" (Monaco) vs "Upload File" (drag-drop) | `templates/index.html`, `app.py` | Switch tabs; upload buggy.py |
