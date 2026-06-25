"""
app.py — RAG Knowledge Analyst (Bonus Project)
===============================================
Flask web app for document Q&A using Retrieval-Augmented Generation.

Routes:
  POST /api/ingest   — upload + chunk + embed a document
  POST /api/query    — retrieve + synthesise an answer
  GET  /api/status   — health / session info
  GET  /             — dashboard
"""
from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path

from google import genai
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request, session

from rag_engine import chunk_text, embed_chunks, embed_query, retrieve, synthesise_answer

load_dotenv()

# ─── App setup ────────────────────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", os.urandom(24).hex())
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024  # 2 MB max upload

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# ─── Gemini client ────────────────────────────────────────────────────────────
_API_KEY = os.getenv("GEMINI_API_KEY", "")
_client = genai.Client(api_key=_API_KEY) if _API_KEY else None

# ─── In-memory document store (per-session) ──────────────────────────────────
# Structure: { session_id: { "filename": str, "chunks": [...], "embeddings": [...] } }
DOC_STORE: dict[str, dict] = {}

ALLOWED_EXT = {".txt", ".md", ".py", ".js", ".html", ".csv", ".rst", ".log"}


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/status")
def status():
    sid = session.get("sid")
    doc = DOC_STORE.get(sid, {})
    return jsonify({
        "api_ready": bool(_API_KEY),
        "has_document": bool(doc),
        "filename": doc.get("filename", ""),
        "chunk_count": len(doc.get("chunks", [])),
    })


@app.route("/api/ingest", methods=["POST"])
def ingest():
    """Upload a document, chunk it, and embed it."""
    if not _API_KEY:
        return jsonify({"error": "GEMINI_API_KEY not set."}), 503

    # Accept file upload or pasted text
    if "file" in request.files and request.files["file"].filename:
        f = request.files["file"]
        ext = Path(f.filename).suffix.lower()
        if ext not in ALLOWED_EXT and ext != ".pdf":
            return jsonify({"error": f"Unsupported file type: {ext}. Use .txt, .md, .py, .js, .html, .csv"}), 400
        try:
            if ext == ".pdf":
                return jsonify({"error": "PDF support requires PyMuPDF. Paste text instead."}), 400
            raw = f.read().decode("utf-8", errors="replace")
            filename = f.filename
        except Exception as exc:
            return jsonify({"error": f"Could not read file: {exc}"}), 400
    elif request.is_json:
        body = request.get_json(force=True)
        raw = body.get("text", "").strip()
        filename = body.get("filename", "pasted_text.txt")
        if not raw:
            return jsonify({"error": "No text provided."}), 400
    else:
        return jsonify({"error": "Send a file or JSON {text, filename}."}), 400

    if len(raw) > 100_000:
        return jsonify({"error": "Document too large (max 100 000 characters)."}), 400

    # Chunk + embed
    try:
        chunks = chunk_text(raw)
        if not chunks:
            return jsonify({"error": "Document produced no usable chunks."}), 400

        embeddings = embed_chunks(_client, chunks)
        logger.info("Ingested '%s': %d chunks, %d embeddings", filename, len(chunks), len(embeddings))
    except Exception as exc:
        logger.exception("Ingest error")
        return jsonify({"error": f"Embedding failed: {exc}"}), 500

    # Store in session
    if "sid" not in session:
        session["sid"] = uuid.uuid4().hex
    sid = session["sid"]
    DOC_STORE[sid] = {
        "filename": filename,
        "chunks":   chunks,
        "embeddings": embeddings,
        "preview": raw[:500],
    }

    return jsonify({
        "filename":    filename,
        "chunk_count": len(chunks),
        "char_count":  len(raw),
        "preview":     raw[:300],
    })


@app.route("/api/query", methods=["POST"])
def query():
    """Retrieve relevant chunks and synthesise an answer."""
    if not _API_KEY:
        return jsonify({"error": "GEMINI_API_KEY not set."}), 503

    sid = session.get("sid")
    doc = DOC_STORE.get(sid, {})
    if not doc:
        return jsonify({"error": "No document loaded. Upload or paste a document first."}), 400

    body = request.get_json(force=True)
    q    = (body.get("query") or "").strip()
    k    = min(int(body.get("k", 5)), 10)

    if not q:
        return jsonify({"error": "Query is required."}), 400
    if len(q) > 1000:
        return jsonify({"error": "Query too long (max 1000 characters)."}), 400

    try:
        q_vec  = embed_query(_client, q)
        top_k  = retrieve(q_vec, doc["embeddings"], doc["chunks"], k=k)
        result = synthesise_answer(_client, q, top_k)
    except Exception as exc:
        logger.exception("Query error")
        return jsonify({"error": f"Query failed: {exc}"}), 500

    return jsonify({
        "answer":   result["answer"],
        "sources":  result["sources"],
        "filename": doc["filename"],
    })


@app.route("/api/clear", methods=["POST"])
def clear():
    sid = session.get("sid")
    if sid and sid in DOC_STORE:
        del DOC_STORE[sid]
    return jsonify({"ok": True})


# ─── Run ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("PORT", 5004))
    debug = os.getenv("FLASK_DEBUG", "true").lower() == "true"
    logger.info("RAG Knowledge Analyst → http://localhost:%d", port)
    app.run(host="0.0.0.0", port=port, debug=debug)
