"""
ingest.py — Code Ingestion & Language Detection (Week 4)
=========================================================
Handles encoding-safe file reading, language detection, and safety guards.
"""
from __future__ import annotations

import os
import re

# ─── Config ──────────────────────────────────────────────────────────────────

MAX_FILE_SIZE_BYTES = 100_000   # 100 KB — refuse larger files
MAX_LINE_COUNT      = 2_000     # refuse files with > 2000 lines
MAX_CHAR_COUNT      = 80_000    # refuse code > 80k chars

ALLOWED_EXTENSIONS = {
    # Web
    '.js', '.ts', '.jsx', '.tsx', '.html', '.css',
    # Backend
    '.py', '.java', '.go', '.rb', '.php', '.rs', '.swift', '.kt',
    # Systems
    '.c', '.cpp', '.h', '.hpp', '.cs',
    # Data / Config
    '.sql', '.sh', '.bash', '.yaml', '.yml', '.json', '.toml',
    # Plain text
    '.txt', '.md',
}

EXTENSION_TO_LANGUAGE: dict[str, str] = {
    '.py': 'python', '.pyw': 'python',
    '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
    '.ts': 'typescript', '.mts': 'typescript',
    '.jsx': 'javascript', '.tsx': 'typescript',
    '.java': 'java',
    '.go': 'go',
    '.rb': 'ruby',
    '.php': 'php',
    '.rs': 'rust',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.c': 'c', '.h': 'c',
    '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.hpp': 'cpp',
    '.cs': 'csharp',
    '.sql': 'sql',
    '.sh': 'bash', '.bash': 'bash',
    '.html': 'html', '.htm': 'html',
    '.css': 'css', '.scss': 'css', '.sass': 'css',
    '.yaml': 'yaml', '.yml': 'yaml',
    '.json': 'json', '.toml': 'toml',
    '.md': 'markdown',
}

_SHEBANG_LANGUAGES = {
    'python': 'python', 'python3': 'python', 'python2': 'python',
    'node': 'javascript', 'nodejs': 'javascript',
    'ruby': 'ruby', 'perl': 'perl', 'bash': 'bash', 'sh': 'bash',
}


class IngestError(Exception):
    """Raised when the uploaded code cannot be safely processed."""
    pass


# ─── File ingestion ──────────────────────────────────────────────────────────

def read_file(path: str) -> tuple[str, str]:
    """
    Encoding-safe read of a code file.

    Returns
    -------
    (code_text, language)

    Raises
    ------
    IngestError : on size limit, disallowed extension, or binary file
    """
    if not os.path.exists(path):
        raise IngestError(f"File not found: {path}")

    size = os.path.getsize(path)
    if size > MAX_FILE_SIZE_BYTES:
        raise IngestError(
            f"File too large ({size // 1024} KB). Maximum is {MAX_FILE_SIZE_BYTES // 1024} KB."
        )

    ext = os.path.splitext(path)[1].lower()
    if ext and ext not in ALLOWED_EXTENSIONS:
        raise IngestError(
            f"Unsupported file type: {ext}. Supported: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # Try UTF-8 first, then latin-1 as fallback
    code = _read_with_encoding(path)
    language = detect_language(code, filename=os.path.basename(path))

    _validate_text(code)
    return code, language


def _read_with_encoding(path: str) -> str:
    """Try UTF-8, then latin-1 (covers almost all real-world code files)."""
    for enc in ('utf-8', 'utf-8-sig', 'latin-1'):
        try:
            with open(path, encoding=enc) as f:
                text = f.read()
            # Reject if it looks binary (many null bytes)
            if text.count('\x00') > 10:
                raise IngestError("File appears to be binary. Please submit text source code.")
            return text
        except UnicodeDecodeError:
            continue
    raise IngestError("Could not decode file. Please ensure it is saved as UTF-8.")


# ─── Text ingestion (from pasted code) ───────────────────────────────────────

def read_text(code: str, language: str | None = None) -> tuple[str, str]:
    """
    Validate and return pasted code text.

    Returns
    -------
    (code_text, language)
    """
    if not code or not code.strip():
        raise IngestError("No code provided.")

    _validate_text(code)
    lang = language or detect_language(code)
    return code, lang


# ─── Validation guards ───────────────────────────────────────────────────────

def _validate_text(code: str) -> None:
    if len(code) > MAX_CHAR_COUNT:
        raise IngestError(
            f"Code too long ({len(code):,} chars). Maximum is {MAX_CHAR_COUNT:,} characters."
        )
    lines = code.splitlines()
    if len(lines) > MAX_LINE_COUNT:
        raise IngestError(
            f"Too many lines ({len(lines):,}). Maximum is {MAX_LINE_COUNT:,} lines."
        )
    if code.count('\x00') > 5:
        raise IngestError("Code contains binary data and cannot be reviewed.")


# ─── Language detection ───────────────────────────────────────────────────────

def detect_language(code: str, filename: str = "") -> str:
    """
    Detect programming language from filename extension, then shebang, then heuristics.
    Returns lowercase language name (e.g. 'python', 'javascript').
    """
    # 1. Extension
    if filename:
        ext = os.path.splitext(filename)[1].lower()
        if ext in EXTENSION_TO_LANGUAGE:
            return EXTENSION_TO_LANGUAGE[ext]

    # 2. Shebang line
    first_line = code.split('\n', 1)[0] if code else ""
    if first_line.startswith('#!'):
        for key, lang in _SHEBANG_LANGUAGES.items():
            if key in first_line.lower():
                return lang

    # 3. Heuristics
    return _heuristic_detect(code)


def _heuristic_detect(code: str) -> str:
    """Simple heuristic language detection from code patterns."""
    sample = code[:3000]

    patterns = [
        # Python
        ('python', [r'\bdef\s+\w+\s*\(', r'\bimport\s+\w+', r'\bprint\s*\(', r'#.*type:\s*ignore']),
        # JavaScript / TypeScript
        ('javascript', [r'\bconst\b|\blet\b|\bvar\b', r'=>', r'\brequire\s*\(', r'console\.log']),
        ('typescript', [r':\s*string\b', r':\s*number\b', r'interface\s+\w+', r'type\s+\w+\s*=']),
        # Java
        ('java', [r'\bpublic\s+class\b', r'\bpublic\s+static\s+void\s+main\b', r'\bSystem\.out\b']),
        # Go
        ('go', [r'\bfunc\s+\w+\s*\(', r'\bpackage\s+main\b', r'\bfmt\.Print']),
        # Rust
        ('rust', [r'\bfn\s+\w+\s*\(', r'\blet\s+mut\b', r'\bprintln!\s*\(']),
        # C/C++
        ('cpp', [r'#include\s*<', r'\bstd::\w+', r'cout\s*<<']),
        ('c', [r'#include\s*<stdio\.h>', r'\bprintf\s*\(', r'\bint\s+main\s*\(']),
        # SQL
        ('sql', [r'\bSELECT\b', r'\bFROM\b', r'\bWHERE\b', r'\bINSERT\s+INTO\b']),
        # Bash
        ('bash', [r'\becho\s+', r'\$\{?\w+\}?', r'\bif\s+\[', r'\bfi\b']),
    ]

    scores: dict[str, int] = {}
    for lang, pats in patterns:
        score = sum(1 for p in pats if re.search(p, sample))
        if score > 0:
            scores[lang] = score

    if scores:
        return max(scores, key=lambda k: scores[k])

    return "unknown"
