from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Depends
from bson import ObjectId
from app.rag.ingest import ingest_pdf
from app.rag.retriever import retrieve_context
from app.rag.pinecone_client import get_index, get_index_stats
from app.utils.groq_utils import chat_with_groq, build_system_prompt
from app.db.database import get_db
from app.db.models import FARMER_PROFILES_COLLECTION, ICAR_DOCUMENTS_COLLECTION
from app.utils.weather_utils import get_current_weather, get_season_from_month
from app.core.security import get_current_admin, get_current_user
from datetime import datetime

router = APIRouter()


# ── Admin — Ingest PDF ────────────────────────────────────────────────────────

@router.post("/ingest")
async def ingest_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    admin: dict = Depends(get_current_admin)
):
    """Admin uploads ICAR PDF → Pinecone. Also tracked in Mongo so it can
    be listed and precisely removed later — Pinecone alone has no
    built-in way to enumerate 'which documents have been uploaded'."""
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    pdf_bytes    = await file.read()
    source_name  = file.filename.replace(".pdf", "").replace(" ", "_")
    original_name = file.filename
    uploaded_by  = admin.get("email") or admin.get("name") or "admin"

    async def _ingest():
        result = await ingest_pdf(pdf_bytes, source_name)
        print(f"📚 Ingestion complete: {result}")

        if result.get("success") and result.get("ingested", 0) > 0:
            db = get_db()
            await db[ICAR_DOCUMENTS_COLLECTION].insert_one({
                "source":       source_name,
                "filename":     original_name,
                "chunk_ids":    result.get("ids", []),
                "chunk_count":  result.get("ingested", 0),
                "uploaded_by":  uploaded_by,
                "uploaded_at":  datetime.utcnow()
            })

    background_tasks.add_task(_ingest)

    return {
        "success": True,
        "message": f"Ingesting '{file.filename}' in background",
        "note":    "Wait 2-3 minutes. Check GET /rag/documents after."
    }


# ── Admin — List ingested documents ──────────────────────────────────────────

@router.get("/documents")
async def list_documents(admin: dict = Depends(get_current_admin)):
    """List every ICAR document that's been ingested into the RAG index —
    what the chat agent's search_farming_documents tool can actually draw
    from right now."""
    db = get_db()
    docs = []
    cursor = db[ICAR_DOCUMENTS_COLLECTION].find({}).sort("uploaded_at", -1)
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        doc.pop("chunk_ids", None)  # internal only — not needed by the admin UI
        docs.append(doc)

    return {"total": len(docs), "documents": docs}


# ── Admin — Remove an ingested document ──────────────────────────────────────

@router.delete("/documents/{document_id}")
async def delete_document(document_id: str, admin: dict = Depends(get_current_admin)):
    """
    Removes a document's chunks from Pinecone by their exact stored ids
    (not a metadata filter — precise and doesn't risk touching any other
    document), then removes the Mongo tracking record.
    """
    db = get_db()
    doc = await db[ICAR_DOCUMENTS_COLLECTION].find_one({"_id": ObjectId(document_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    chunk_ids = doc.get("chunk_ids", [])
    if chunk_ids:
        index = get_index()
        try:
            index.delete(ids=chunk_ids, namespace="farming-docs")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete vectors from Pinecone: {str(e)}")

    await db[ICAR_DOCUMENTS_COLLECTION].delete_one({"_id": ObjectId(document_id)})

    return {
        "success": True,
        "message": f"Removed '{doc.get('filename', doc.get('source'))}' ({len(chunk_ids)} chunks)"
    }


# ── RAG Status ────────────────────────────────────────────────────────────────

@router.get("/status")
async def rag_status():
    """Check how many vectors are stored in Pinecone."""
    try:
        stats = get_index_stats()
        return {
            "total_vectors": stats.get("total_vector_count", 0),
            "index_name":    "farmer-assistant",
            "ready":         stats.get("total_vector_count", 0) > 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pinecone status failed: {str(e)}")


# ── DEBUG — See raw Pinecone search results ───────────────────────────────────

@router.get("/debug-search")
async def debug_search(question: str, admin: dict = Depends(get_current_admin)):
    """
    DEBUG endpoint — shows raw Pinecone search results with scores.
    Use this to understand why RAG is or isn't matching.
    Remove this in production.
    """
    try:
        index = get_index()

        # Raw search
        results = index.search(
            namespace="farming-docs",
            query={
                "inputs": {"text": question},
                "top_k":  5
            },
            fields=["text", "source", "chunk"]
        )

        hits = results.get("result", {}).get("hits", [])

        return {
            "question":   question,
            "total_hits": len(hits),
            "hits": [
                {
                    "score":   hit.get("_score", 0),
                    "source":  hit.get("fields", {}).get("source", ""),
                    "chunk":   hit.get("fields", {}).get("chunk", 0),
                    "text_preview": hit.get("fields", {}).get("text", "")[:200]
                }
                for hit in hits
            ]
        }

    except Exception as e:
        return {"error": str(e), "question": question}


# ── RAG Question Answering ────────────────────────────────────────────────────

@router.post("/ask")
async def ask_question(question: str, current_user: dict = Depends(get_current_user)):
    """Answer farming question using RAG from ICAR documents.
    Username is derived from the authenticated user's token."""
    username = current_user["username"]

    # Search Pinecone
    rag_result = await retrieve_context(question, top_k=3)

    # Build farmer context if username provided
    system_prompt = "You are an expert Indian agricultural advisor. Answer based on the provided farming documents."
    if username:
        db      = get_db()
        profile = await db[FARMER_PROFILES_COLLECTION].find_one({"username": username})
        if profile:
            location = profile.get("current_location", {})
            try:
                weather = await get_current_weather(
                    lat=location.get("lat", 17.97),
                    lng=location.get("lng", 79.59)
                )
            except Exception:
                weather = {}

            farmer_context = {
                "profile":  profile,
                "location": location,
                "weather":  weather,
                "prices":   {},
                "news":     [],
                "season":   get_season_from_month(datetime.now().month)
            }
            system_prompt = build_system_prompt(farmer_context)

    # Answer with Groq
    try:
        answer = await chat_with_groq(
            messages=[{"role": "user", "content": question}],
            system_prompt=system_prompt,
            rag_context=rag_result["context"] if rag_result["found"] else None,
            max_tokens=500
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate answer: {str(e)}")

    return {
        "question": question,
        "answer":   answer,
        "sources":  rag_result.get("sources", []),
        "used_rag": rag_result["found"]
    }