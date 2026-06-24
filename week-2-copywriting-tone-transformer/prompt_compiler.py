"""
prompt_compiler.py — Dynamic Prompt Template System (PDF R2)
=============================================================
Assembles the marketing copy generation prompt from user variables.
This IS the "dynamic string template" the PDF requires — and the compiled
result is surfaced verbatim in the UI so reviewers can see it.
"""

from __future__ import annotations

import json
import re
from typing import TypedDict


# ─── Platform specs (R2, R4, R5) ─────────────────────────────────────────────

PLATFORMS: dict[str, dict] = {
    "LinkedIn": {
        "label": "LinkedIn",
        "icon": "💼",
        "char_limit": 3000,
        "structure": "strong hook → value proposition → CTA",
        "hashtag_rule": "3–5 relevant professional hashtags at the end",
        "voice": "professional, credible, first-person narrative, thought-leadership tone",
        "format_note": "Separate sections with line breaks for readability.",
    },
    "Instagram": {
        "label": "Instagram",
        "icon": "📸",
        "char_limit": 2200,
        "structure": "punchy opening line → vivid description → emotional CTA → hashtag block",
        "hashtag_rule": "10–15 relevant hashtags; include a mix of broad and niche tags",
        "voice": "vivid, energetic, visual, conversational — emoji allowed",
        "format_note": "Add 1–2 relevant emojis naturally. Hashtags on a separate line.",
    },
    "Email": {
        "label": "Email",
        "icon": "📧",
        "char_limit": 9999,  # No hard limit; validated as subject ≤60 + body
        "char_limit_subject": 60,
        "structure": "compelling subject line + short persuasive body + clear CTA",
        "hashtag_rule": "no hashtags",
        "voice": "clear, persuasive, scannable — use short paragraphs",
        "format_note": (
            "Return as JSON with keys 'subject' (≤60 chars) and 'body'. "
            "The body should be 3–5 short paragraphs."
        ),
        "is_email": True,
    },
    "Twitter/X": {
        "label": "Twitter/X",
        "icon": "🐦",
        "char_limit": 280,
        "structure": "one sharp, memorable line",
        "hashtag_rule": "at most 2 hashtags — or none if they don't add value",
        "voice": "concise, witty, punchy — every word earns its place",
        "format_note": "Must fit in 280 characters including hashtags.",
    },
}

TONES: dict[str, str] = {
    "Professional":  "Formal, credible, and authoritative. Use precise language and industry terms.",
    "Friendly":      "Warm, approachable, and conversational. Use 'you' and 'we' freely.",
    "Witty":         "Clever wordplay, light humor, and memorable phrasing. Surprise the reader.",
    "Luxury":        "Aspirational, exclusive, and sophisticated. Evoke prestige without being flashy.",
    "Bold":          "Confident, direct, and unapologetic. Short sentences. Big claims. Strong verbs.",
    "Inspirational": "Uplifting, motivational, and vision-forward. Invite the reader to dream bigger.",
    "Minimalist":    "Strip away everything non-essential. Clarity over decoration. Less is more.",
}


# ─── Types ───────────────────────────────────────────────────────────────────

class Variation(TypedDict):
    text: str         # The copy text (or JSON string for Email)
    char_count: int
    within_limit: bool
    over_by: int
    subject: str      # Email-only
    body: str         # Email-only


# ─── Core functions ───────────────────────────────────────────────────────────


def compile(
    product_name: str,
    description: str,
    platform: str,
    tone: str,
    n: int = 1,
) -> str:
    """
    Assemble the DYNAMIC STRING TEMPLATE (PDF R2) from user variables.

    The returned string is:
      - passed verbatim to the LLM
      - surfaced in the UI's "Compiled Prompt" inspector

    Parameters
    ----------
    product_name : str
    description  : str   User's product description
    platform     : str   Key in PLATFORMS
    tone         : str   Key in TONES
    n            : int   Number of variations to generate (1–4)
    """
    spec = PLATFORMS.get(platform, PLATFORMS["LinkedIn"])
    tone_directive = TONES.get(tone, TONES["Professional"])
    is_email = spec.get("is_email", False)

    if is_email:
        output_format = (
            f"Return ONLY a JSON array of exactly {n} objects. "
            "Each object MUST have exactly two keys: "
            '"subject" (the email subject line, ≤60 characters) and '
            '"body" (the email body text). '
            "No other keys. No markdown. No prose outside the JSON array."
        )
    else:
        output_format = (
            f"Return ONLY a JSON array of exactly {n} strings. "
            "Each string is one complete marketing copy variation. "
            "No object wrappers, no keys, no markdown, no prose outside the JSON array."
        )

    prompt = f"""You are an expert marketing copywriter specializing in platform-native content.

PRODUCT
=======
Name:        {product_name}
Description: {description}

PLATFORM: {spec['label']}
Structure:   {spec['structure']}
Char limit:  {spec['char_limit']} characters{" (subject ≤60 chars + body)" if is_email else ""}
Hashtags:    {spec['hashtag_rule']}
Voice:       {spec['voice']}
Note:        {spec['format_note']}

TONE: {tone}
Directive:   {tone_directive}

OUTPUT FORMAT
=============
{output_format}

Generate {n} distinct variation{"s" if n > 1 else ""} now."""

    return prompt


def parse_structured(raw: str, platform: str) -> list[Variation]:
    """
    Parse the LLM's JSON output into a list of Variation dicts.

    Tolerant: strips code fences, finds the JSON array, falls back
    gracefully on parse failure — never crashes.
    """
    spec = PLATFORMS.get(platform, PLATFORMS["LinkedIn"])
    is_email = spec.get("is_email", False)
    char_limit = spec.get("char_limit", 3000)
    char_limit_subject = spec.get("char_limit_subject", 60)

    # Strip markdown code fences
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()

    # Try JSON parse
    parsed = None
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to find a JSON array in the text
        match = re.search(r'\[[\s\S]*\]', cleaned)
        if match:
            try:
                parsed = json.loads(match.group())
            except json.JSONDecodeError:
                pass

    if not parsed or not isinstance(parsed, list):
        # Fallback: treat whole text as one variation
        parsed = [cleaned] if cleaned else ["(No output generated — please try again.)"]

    variations: list[Variation] = []
    for item in parsed:
        if is_email:
            if isinstance(item, dict):
                subject = item.get("subject", "")[:char_limit_subject]
                body = item.get("body", "")
            else:
                # Fallback: treat as body
                subject = f"{platform} promotion"
                body = str(item)
            text = f"**Subject:** {subject}\n\n{body}"
            count = len(subject) + len(body)
            subject_ok = len(subject) <= char_limit_subject
            variations.append({
                "text": text,
                "char_count": count,
                "within_limit": subject_ok,
                "over_by": max(0, len(subject) - char_limit_subject),
                "subject": subject,
                "body": body,
            })
        else:
            text = str(item)
            v = validate_length(text, char_limit)
            variations.append({
                "text": text,
                "subject": "",
                "body": "",
                **v,
            })

    return variations


def validate_length(text: str, char_limit: int) -> dict:
    """
    PDF R5 — Length validation for character-limited platforms.

    Returns a dict with:
      char_count   : int
      within_limit : bool
      over_by      : int   (0 if within limit)
    """
    count = len(text)
    over  = max(0, count - char_limit)
    return {
        "char_count":   count,
        "within_limit": count <= char_limit,
        "over_by":      over,
    }
