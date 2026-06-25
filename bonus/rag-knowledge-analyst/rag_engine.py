"""
rag_engine.py — Retrieval-Augmented Generation core
====================================================
Pipeline:
  1. ingest()  — parse raw text into overlapping chunks
  2. embed()   — Gemini text-embedding-004 per chunk
  3. retrieve() — cosine similarity top-k chunks for a query
  4. answer()  — Gemini Flash synthesises answer + inline citations
"""
from __future__ import annotations

import json
import logging
import math
import re
from typing import Any

from google import genai
from google.genai import types as genai_types

logger = logging.getLogger(__name__)

# ─── Chunking ─────────────────────────────────────────────────────────────────

def chunk_text(text: str, chunk_size: int = 400, overlap: int = 80) -> list[str]:
    """
    Split text into overlapping character-window chunks.
    Tries to break on sentence boundaries for cleaner retrieval.
    """
    # Normalise whitespace
    text = re.sub(r'\r\n', '\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text)

    # Split on sentence-ish boundaries first
    sentences: list[str] = re.split(r'(?<=[.!?])\s+', text)

    chunks: list[str] = []
    current = ""
    for sent in sentences:
        if len(current) + len(sent) + 1 <= chunk_size:
            current += (" " if current else "") + sent
        else:
            if current:
                chunks.append(current.strip())
                # Carry overlap characters into next chunk
                current = current[-overlap:] + " " + sent if len(current) > overlap else sent
            else:
                # Sentence itself too long — hard split
                for i in range(0, len(sent), chunk_size - overlap):
                    chunks.append(sent[i:i + chunk_size].strip())
                current = ""

    if current.strip():
        chunks.append(current.strip())

    return [c for c in chunks if c]


# ─── Embeddings ───────────────────────────────────────────────────────────────

def embed_chunks(client: genai.Client, chunks: list[str]) -> list[list[float]]:
    """
    Return a list of embedding vectors (one per chunk) using Gemini.
    Falls back to a simple TF-IDF-style bag of words if the API call fails.
    """
    try:
        result = client.models.embed_content(
            model="models/text-embedding-004",
            contents=chunks,
        )
        return [e.values for e in result.embeddings]
    except Exception as exc:
        logger.warning("Gemini embedding failed (%s); using fallback TF-IDF.", exc)
        return _tfidf_embeddings(chunks)


def embed_query(client: genai.Client, query: str) -> list[float]:
    """Embed a single query string."""
    try:
        result = client.models.embed_content(
            model="models/text-embedding-004",
            contents=[query],
        )
        return result.embeddings[0].values
    except Exception as exc:
        logger.warning("Gemini query embedding failed (%s); using fallback.", exc)
        # Re-use TF-IDF fallback with combined vocab from query alone
        return _tfidf_embeddings([query])[0]


# ─── Simple TF-IDF fallback (no external deps) ───────────────────────────────

def _tfidf_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Minimal bag-of-words TF-IDF embeddings for offline / rate-limit fallback.
    Not as good as Gemini embeddings but functional for demo purposes.
    """
    import math

    def tokenise(t: str) -> list[str]:
        return re.findall(r'\b[a-z]{2,}\b', t.lower())

    corpus = [tokenise(t) for t in texts]
    vocab  = sorted({w for doc in corpus for w in doc})
    idx    = {w: i for i, w in enumerate(vocab)}
    n      = len(corpus)

    # IDF
    idf = {}
    for w in vocab:
        df = sum(1 for doc in corpus if w in doc)
        idf[w] = math.log((1 + n) / (1 + df)) + 1

    embeddings = []
    for doc in corpus:
        tf: dict[str, float] = {}
        for w in doc:
            tf[w] = tf.get(w, 0) + 1
        vec = [tf.get(w, 0) * idf.get(w, 0) for w in vocab]
        norm = math.sqrt(sum(x * x for x in vec)) or 1.0
        embeddings.append([x / norm for x in vec])

    return embeddings


# ─── Retrieval ────────────────────────────────────────────────────────────────

def cosine_sim(a: list[float], b: list[float]) -> float:
    dot  = sum(x * y for x, y in zip(a, b))
    na   = math.sqrt(sum(x * x for x in a)) or 1e-9
    nb   = math.sqrt(sum(x * x for x in b)) or 1e-9
    return dot / (na * nb)


def retrieve(
    query_vec: list[float],
    chunk_vecs: list[list[float]],
    chunks: list[str],
    k: int = 5,
) -> list[dict[str, Any]]:
    """Return top-k chunks ranked by cosine similarity to the query."""
    scores = [
        {"index": i, "chunk": chunk, "score": cosine_sim(query_vec, vec)}
        for i, (chunk, vec) in enumerate(zip(chunks, chunk_vecs))
    ]
    scores.sort(key=lambda x: x["score"], reverse=True)
    return scores[:k]


# ─── Answer synthesis ─────────────────────────────────────────────────────────

_ANSWER_SYSTEM = """You are a precise research assistant. Answer the user's question using ONLY the provided context chunks.
Rules:
- Cite each relevant chunk like [Source 1], [Source 2], etc.
- If the context does not contain the answer, say "The documents don't contain enough information to answer this."
- Be concise and factual. Do not add information not present in the context.
- Format your response in clear prose with citations inline."""


def synthesise_answer(
    client: genai.Client,
    query: str,
    top_chunks: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Use Gemini Flash to synthesise an answer from top retrieved chunks.
    Returns dict with 'answer' string and 'sources' list.
    """
    context_parts = "\n\n".join(
        f"[Source {i + 1}] (relevance: {c['score']:.2f})\n{c['chunk']}"
        for i, c in enumerate(top_chunks)
    )
    prompt = (
        f"Context chunks:\n{context_parts}\n\n"
        f"Question: {query}\n\n"
        "Answer (cite sources inline):"
    )

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            system_instruction=_ANSWER_SYSTEM,
            temperature=0.1,
            max_output_tokens=1024,
        ),
    )
    answer = response.text.strip()

    return {
        "answer": answer,
        "sources": [
            {"index": i + 1, "chunk": c["chunk"][:200] + "…" if len(c["chunk"]) > 200 else c["chunk"],
             "score": round(c["score"], 3)}
            for i, c in enumerate(top_chunks)
        ],
    }
