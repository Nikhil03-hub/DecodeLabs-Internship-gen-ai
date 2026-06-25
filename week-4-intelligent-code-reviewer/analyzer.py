"""
analyzer.py — AI Code Analysis Engine (Week 4 core)
=====================================================
PDF requirements:
  R1: Gemini LLM reviews submitted code
  R2: Strict system prompt forces structured JSON output
  R3: Validates bug_report + refactored_code fields exist
  R4: One repair retry if validation fails (self-healing)
  R5: Returns structured BugReport list with severity/line/suggestion
  R6: Overall quality score (0-100) + summary
"""
from __future__ import annotations

import json
import logging
import re

from llm_client import LLMError, generate

logger = logging.getLogger(__name__)

# ─── JSON Schema that Gemini MUST produce ────────────────────────────────────

_SCHEMA_DOC = """
{
  "overall_score": <integer 0-100>,
  "summary": "<2-3 sentence executive summary of code quality>",
  "language": "<detected language: python|javascript|java|typescript|go|cpp|other>",
  "bug_report": [
    {
      "id": "BUG-001",
      "severity": "<critical|high|medium|low|info>",
      "line": <integer line number, or 0 if not applicable>,
      "title": "<short bug title>",
      "description": "<detailed explanation of the issue>",
      "suggestion": "<concrete fix or improvement>",
      "category": "<security|logic|performance|style|maintainability|error_handling>"
    }
  ],
  "refactored_code": "<complete refactored version with all issues fixed>",
  "performance_notes": "<optional performance observations>"
}
"""

# ─── System prompt (R2) ──────────────────────────────────────────────────────

_SYSTEM_PROMPT = f"""You are an expert code reviewer with deep knowledge of security, performance, and software engineering best practices.

Your ONLY job is to analyze the submitted code and respond with a SINGLE valid JSON object. Do not include any text before or after the JSON. Do not use markdown code blocks. Return ONLY raw JSON.

The JSON MUST conform to exactly this schema:
{_SCHEMA_DOC}

Rules:
- overall_score: 0 = completely broken, 100 = production-perfect code
- bug_report: minimum 1 entry even for excellent code (at least one "info" level observation)
- bug_report entries MUST be sorted by severity: critical → high → medium → low → info
- refactored_code: ALWAYS provide a complete, fixed version of the code. Never leave it empty.
- All string values must be properly escaped JSON strings.
- Do not truncate the refactored_code — return the COMPLETE fixed file.

Severity definitions:
  critical  = exploitable vulnerability, data loss, system crash
  high      = significant bug that breaks core functionality
  medium    = incorrect behavior in edge cases, bad practices
  low       = minor style issues, small improvements
  info      = observations, suggestions, best practices
"""

# ─── Validation (R3) ─────────────────────────────────────────────────────────

def validate_output(data: dict) -> list[str]:
    """
    Return a list of validation errors. Empty list = valid.
    Checks that required top-level keys exist with correct types.
    """
    errors: list[str] = []

    # Required fields
    if "bug_report" not in data:
        errors.append("Missing required field: bug_report")
    elif not isinstance(data["bug_report"], list):
        errors.append("bug_report must be a list")

    if "refactored_code" not in data:
        errors.append("Missing required field: refactored_code")
    elif not isinstance(data["refactored_code"], str) or not data["refactored_code"].strip():
        errors.append("refactored_code must be a non-empty string")

    if "overall_score" not in data:
        errors.append("Missing required field: overall_score")
    elif not isinstance(data["overall_score"], (int, float)):
        errors.append("overall_score must be a number")

    return errors


# ─── JSON extraction helper ───────────────────────────────────────────────────

def _extract_json(raw: str) -> dict:
    """
    Try multiple strategies to extract a JSON object from a raw string.
    Handles: bare JSON, JSON wrapped in ```json ... ```, partial markdown.
    """
    text = raw.strip()

    # Strip markdown code fences if present
    text = re.sub(r'^```(?:json)?\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'\s*```$', '', text, flags=re.MULTILINE)
    text = text.strip()

    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to find first { ... } block
    start = text.find('{')
    end   = text.rfind('}')
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not extract valid JSON from response. Raw (first 200 chars): {text[:200]}")


# ─── Repair prompt (R4) ──────────────────────────────────────────────────────

def _build_repair_prompt(original_code: str, broken_response: str, errors: list[str]) -> str:
    return (
        f"Your previous response was not valid. Errors: {'; '.join(errors)}.\n\n"
        f"Your previous response started with:\n{broken_response[:500]}\n\n"
        f"Please re-analyze this code and respond ONLY with a valid JSON object matching the schema. "
        f"No text before or after the JSON. No markdown. Just raw JSON.\n\n"
        f"Code to review:\n```\n{original_code[:4000]}\n```"
    )


# ─── Main entry point ────────────────────────────────────────────────────────

def analyze(code: str, filename: str = "code", language: str | None = None) -> dict:
    """
    Analyze code and return structured review.

    Parameters
    ----------
    code     : source code string (already validated by ingest.py)
    filename : original filename (for context)
    language : optional language hint

    Returns
    -------
    dict matching the JSON schema above

    Raises
    ------
    LLMError : if Gemini fails after retry
    ValueError : if JSON cannot be parsed after repair attempt
    """
    lang_hint = f" (language: {language})" if language else ""
    user_msg = (
        f"Review this code from `{filename}`{lang_hint}:\n\n"
        f"```\n{code}\n```\n\n"
        "Respond with ONLY the JSON review object."
    )

    # First attempt
    raw = generate(
        messages=[{"role": "user", "content": user_msg}],
        temperature=0.2,       # low temp → deterministic, structured output
        top_p=0.95,
        max_output_tokens=16384,   # increased: complex reviews with full refactored_code easily exceed 4096
        system=_SYSTEM_PROMPT,
    )

    logger.debug("Analyzer raw response (%d chars): %s…", len(raw), raw[:100])

    # Parse first attempt
    parse_error_1: Exception | None = None
    data: dict | None = None

    try:
        data = _extract_json(raw)
        errors = validate_output(data)
        if not errors:
            return _normalise(data)
        logger.warning("Validation errors on first attempt: %s", errors)
        parse_error_1 = ValueError("; ".join(errors))
    except (ValueError, json.JSONDecodeError) as exc:
        logger.warning("JSON parse error on first attempt: %s", exc)
        parse_error_1 = exc
        errors = [str(exc)]

    # ── Repair retry (R4) ────────────────────────────────────────────────────
    logger.info("Attempting repair retry (R4)…")
    repair_msg = _build_repair_prompt(code, raw, errors)

    raw2 = generate(
        messages=[{"role": "user", "content": repair_msg}],
        temperature=0.1,
        top_p=0.9,
        max_output_tokens=16384,   # same increase as first attempt
        system=_SYSTEM_PROMPT,
    )

    try:
        data = _extract_json(raw2)
        errors2 = validate_output(data)
        if errors2:
            raise ValueError(f"Repair attempt also failed: {'; '.join(errors2)}")
        logger.info("Repair retry succeeded.")
        return _normalise(data)
    except (ValueError, json.JSONDecodeError) as exc:
        logger.error("Both analysis attempts failed. First: %s | Second: %s", parse_error_1, exc)
        raise ValueError(
            f"Could not produce valid structured output after 2 attempts. "
            f"First error: {parse_error_1}. Second error: {exc}"
        ) from exc


# ─── Normalise + enrich output ───────────────────────────────────────────────

def _normalise(data: dict) -> dict:
    """Ensure all expected fields exist with sensible defaults."""
    data.setdefault("summary", "Code review complete.")
    data.setdefault("language", "unknown")
    data.setdefault("performance_notes", "")
    data.setdefault("overall_score", 50)
    data["overall_score"] = max(0, min(100, int(data["overall_score"])))

    # Normalise bug entries
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    bugs = data.get("bug_report", [])
    for i, bug in enumerate(bugs):
        bug.setdefault("id", f"BUG-{i+1:03d}")
        bug.setdefault("severity", "info")
        bug.setdefault("line", 0)
        bug.setdefault("title", "Issue detected")
        bug.setdefault("description", "")
        bug.setdefault("suggestion", "")
        bug.setdefault("category", "style")

    # Sort by severity
    bugs.sort(key=lambda b: severity_order.get(b.get("severity", "info"), 99))
    data["bug_report"] = bugs

    # Stats
    data["_stats"] = {
        "total":    len(bugs),
        "critical": sum(1 for b in bugs if b["severity"] == "critical"),
        "high":     sum(1 for b in bugs if b["severity"] == "high"),
        "medium":   sum(1 for b in bugs if b["severity"] == "medium"),
        "low":      sum(1 for b in bugs if b["severity"] == "low"),
        "info":     sum(1 for b in bugs if b["severity"] == "info"),
    }

    return data
