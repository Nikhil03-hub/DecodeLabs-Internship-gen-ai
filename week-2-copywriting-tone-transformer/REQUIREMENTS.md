# Week 2 — Requirement Compliance Map

> DecodeLabs Generative AI Internship · Project 2 · Automated Copywriting & Tone Transformer

| # | PDF Requirement | Status | Feature | File(s) |
|---|---|---|---|---|
| R1 | Inputs: **Product_Name, Platform, Tone** (+ description) | ✅ | Form fields in UI; all four passed to `prompt_compiler.compile()` | `templates/index.html`, `app.py` |
| R2 | Inject variables into a **dynamic string template** — surfaced in UI | ✅ | `prompt_compiler.compile()` assembles the prompt; returned to frontend; shown verbatim in "Compiled Prompt" inspector | `prompt_compiler.py`, `app.py` |
| R3 | **Temperature** and **Top-P** controls flow into generation config | ✅ | Two labeled sliders; values clamped 0–1; passed directly to `llm_client.generate(temperature=, top_p=)` | `templates/index.html`, `static/js/app.js`, `llm_client.py` |
| R4 | Output is genuinely **platform-tailored** | ✅ | `PLATFORMS` dict drives structure/voice/hashtag rules per platform; LinkedIn ≠ Instagram ≠ Email ≠ Twitter | `prompt_compiler.py` |
| R5 | *(bonus)* **Strict length validation** for char-limited platforms | ✅ | `validate_length()` checks each variation; live char meter (green/amber/red) + "Over limit" badge | `prompt_compiler.py`, `static/js/app.js` |
| R6 | *(bonus)* **Compare temperatures** demo | ✅ | "Compare temperatures" button → `/api/compare-temps` → 3-column modal (0.2 / 0.7 / 1.0) | `app.py`, `static/js/app.js` |
| R7 | *(bonus)* Multiple variations + **export** | ✅ | 1–4 variations slider; "Copy all" + "Download .md" export | `app.py`, `static/js/app.js` |
