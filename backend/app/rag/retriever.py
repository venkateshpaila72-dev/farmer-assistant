from app.rag.pinecone_client import get_index


async def retrieve_context(question: str, top_k: int = 3) -> dict:
    """
    Search Pinecone inference index for relevant ICAR document chunks.
    Pinecone embeds the question internally — no external embedding API needed.
    """
    try:
        index = get_index()

        # Search Pinecone inference index
        results = index.search(
            namespace="farming-docs",
            query={
                "inputs": {"text": question},
                "top_k":  top_k
            },
            fields=["text", "source", "chunk"]
        )

        # Debug — print raw results to terminal
        hits = results.get("result", {}).get("hits", [])
        print(f"\n🔍 RAG search: '{question[:60]}'")
        print(f"   Total hits: {len(hits)}")
        for hit in hits:
            score  = hit.get("_score", 0)
            source = hit.get("fields", {}).get("source", "?")
            text   = hit.get("fields", {}).get("text", "")[:80]
            print(f"   score={score:.4f} | source={source} | text='{text}...'")

        if not hits:
            print("   ❌ No hits from Pinecone")
            return {"context": "", "sources": [], "found": False}

        # Build context from all hits — no score threshold
        context_parts = []
        sources       = []

        for hit in hits:
            fields = hit.get("fields", {})
            text   = fields.get("text", "").strip()
            source = fields.get("source", "unknown")

            if text:
                context_parts.append(text)
                if source not in sources:
                    sources.append(source)

        context = "\n\n".join(context_parts)

        if context:
            print(f"   ✅ RAG context built from: {sources}")
        else:
            print("   ❌ Hits found but no text content")

        return {
            "context": context,
            "sources": sources,
            "found":   bool(context)
        }

    except Exception as e:
        print(f"⚠️ Pinecone retrieval error: {type(e).__name__}: {e}")
        return {"context": "", "sources": [], "found": False}