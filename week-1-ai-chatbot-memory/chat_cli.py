"""
chat_cli.py — Bonus Terminal Interface (PDF R6)
================================================
A terminal REPL using the SAME memory.py + llm_client.py as the web app.
Run:  python chat_cli.py

Commands:
  /reset   — clear conversation history
  /history — print the current memory array
  /exit    — quit
"""

from __future__ import annotations

import os
import sys
import uuid

from dotenv import load_dotenv

load_dotenv()

# Add the parent dir to path so we can import our modules
sys.path.insert(0, os.path.dirname(__file__))

import memory as mem
import llm_client
from llm_client import LLMError, check_config

_SESSION_ID = str(uuid.uuid4())
_SYSTEM = (
    "You are an intelligent, warm, and helpful AI assistant. "
    "You maintain context across the conversation and refer back to earlier "
    "messages when relevant."
)
_COLORS = {
    "brand":  "\033[38;5;99m",
    "accent": "\033[38;5;51m",
    "dim":    "\033[38;5;59m",
    "warn":   "\033[38;5;220m",
    "error":  "\033[38;5;196m",
    "reset":  "\033[0m",
    "bold":   "\033[1m",
}


def c(text: str, color: str) -> str:
    """Apply ANSI color if stdout is a TTY."""
    if not sys.stdout.isatty():
        return text
    return f"{_COLORS.get(color, '')}{text}{_COLORS['reset']}"


def print_banner() -> None:
    print()
    print(c("  ╔══════════════════════════════════════════╗", "brand"))
    print(c("  ║  DecodeLabs GenAI — Week 1 CLI Chatbot   ║", "brand"))
    print(c("  ║  Powered by Gemini · in-memory history   ║", "dim"))
    print(c("  ╚══════════════════════════════════════════╝", "brand"))
    print()
    print(c("  Commands: /reset  /history  /exit", "dim"))
    print()


def print_memory_line() -> None:
    history = mem.get_history(_SESSION_ID)
    n = len(history)
    t = mem.estimate_tokens(history)
    print(c(f"  [memory: {n} msgs · ~{t} tokens]", "dim"))


def main() -> None:
    try:
        check_config()
    except LLMError as exc:
        print(c(f"  ✖ Configuration error: {exc}", "error"))
        print(c("  Set GEMINI_API_KEY in .env — see .env.example", "warn"))
        sys.exit(1)

    print_banner()

    while True:
        try:
            user_input = input(c("  You › ", "brand")).strip()
        except (KeyboardInterrupt, EOFError):
            print(c("\n  Goodbye!", "dim"))
            break

        if not user_input:
            continue

        # Commands
        if user_input.lower() == "/exit":
            print(c("  Goodbye!", "dim"))
            break

        if user_input.lower() == "/reset":
            mem.reset(_SESSION_ID)
            print(c("  ✓ Memory cleared. Starting fresh.", "accent"))
            print()
            continue

        if user_input.lower() == "/history":
            history = mem.get_history(_SESSION_ID)
            if not history:
                print(c("  (no history yet)", "dim"))
            else:
                print(c(f"\n  ── Memory array ({len(history)} messages) ──", "dim"))
                for i, msg in enumerate(history):
                    role_label = c(f"[{msg['role']:>5}]", "brand" if msg["role"] == "user" else "accent")
                    snippet = msg["content"][:80] + ("…" if len(msg["content"]) > 80 else "")
                    print(f"  {i:>2}. {role_label} {snippet}")
                print()
            continue

        # Chat
        history = mem.get_history(_SESSION_ID)
        mem.append_turn(_SESSION_ID, "user", user_input)

        pruned = mem.prune_if_needed(history)
        if pruned:
            print(c("  ⚠ Context trimmed (oldest messages removed to stay within limit)", "warn"))

        print(c("  AI › ", "accent"), end="", flush=True)
        try:
            reply = llm_client.generate(
                history,
                temperature=0.7,
                top_p=0.95,
                max_output_tokens=1024,
                system=_SYSTEM,
            )
        except LLMError as exc:
            # Roll back user turn on failure
            if history and history[-1]["role"] == "user":
                history.pop()
            print(c(f"\n  ✖ {exc}", "error"))
            print()
            continue

        mem.append_turn(_SESSION_ID, "model", reply)
        print(reply)
        print()
        print_memory_line()
        print()


if __name__ == "__main__":
    main()
