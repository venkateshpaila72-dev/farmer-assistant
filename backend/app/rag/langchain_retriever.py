"""
LangChain retriever for the ICAR farming-documents RAG pipeline.

IMPORTANT DESIGN NOTE — why this isn't langchain-pinecone's PineconeVectorStore:
langchain-pinecone's VectorStore expects an Embeddings object and computes
vectors client-side before calling index.query(vector=...). This index was
built with Pinecone's *hosted/integrated* inference instead — the index
embeds text server-side via index.search(query={"inputs": {"text": ...}})
and index.upsert_records(...), with no separate embedding client anywhere
in this codebase (NVIDIA_API_KEY is declared in settings but unused —
dead config, not what's actually powering retrieval).

Swapping to PineconeVectorStore would mean embedding queries with a
DIFFERENT model than whatever embedded the already-ingested documents —
same index, incompatible vector space, silently wrong or empty results.
So instead: wrap the exact same proven Pinecone hosted-search call in a
real LangChain BaseRetriever. This is genuinely idiomatic LangChain (the
core retrieval abstraction used everywhere, including inside agent tools)
without gambling with a working, already-ingested index.
"""

from typing import List
from langchain_core.retrievers import BaseRetriever
from langchain_core.documents import Document
from langchain_core.callbacks import CallbackManagerForRetrieverRun
from pydantic import Field

from app.rag.pinecone_client import get_index

FARMING_DOCS_NAMESPACE = "farming-docs"


class PineconeHostedRetriever(BaseRetriever):
    """
    LangChain BaseRetriever backed by Pinecone's hosted-inference search
    over the 'farming-docs' namespace (ICAR documents ingested via
    app/rag/ingest.py). Embedding happens server-side in Pinecone — this
    retriever just shapes the query/response through LangChain's standard
    Document interface so it composes with the rest of the LangChain/
    LangGraph stack (create_retriever_tool, other chains, etc).

    min_score matters here specifically because this index doesn't cover
    every topic a farmer might ask about (e.g. it's rice/Indian-crop
    focused ICAR material) — Pinecone's search always returns its top_k
    nearest results even when NONE of them are actually a good match for
    the query. Without a floor, a question about a topic the corpus
    doesn't cover still comes back with "results" — just irrelevant ones
    — and the agent has no way to tell the difference from a genuinely
    good match. This was confirmed as a real bug: a disease-treatment
    query returned document chunks about entirely different diseases.

    NOTE: 0.3 is a reasonable starting floor for Pinecone's hosted
    reranking scores, but hasn't been calibrated against this specific
    index's real score distribution — _get_relevant_documents logs every
    rejected hit's score, so watch the logs after deploying and adjust
    min_score up/down based on what good vs. bad matches actually score.
    """

    top_k: int = Field(default=3)
    min_score: float = Field(default=0.3)

    def _get_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> List[Document]:
        # BaseRetriever requires a sync method; the async path below
        # (_aget_relevant_documents) is what the chat agent actually uses,
        # this sync fallback exists only so the class is a fully valid
        # BaseRetriever for any sync LangChain code that might call it.
        index = get_index()
        results = index.search(
            namespace=FARMING_DOCS_NAMESPACE,
            query={"inputs": {"text": query}, "top_k": self.top_k},
            fields=["text", "source", "chunk"],
        )
        return self._hits_to_documents(results, query)

    async def _aget_relevant_documents(
        self, query: str, *, run_manager
    ) -> List[Document]:
        index = get_index()
        results = index.search(
            namespace=FARMING_DOCS_NAMESPACE,
            query={"inputs": {"text": query}, "top_k": self.top_k},
            fields=["text", "source", "chunk"],
        )
        return self._hits_to_documents(results, query)

    def _hits_to_documents(self, results, query: str) -> List[Document]:
        hits = results.get("result", {}).get("hits", [])
        docs = []
        for hit in hits:
            fields = hit.get("fields", {})
            text = (fields.get("text") or "").strip()
            score = hit.get("_score", 0)

            if not text:
                continue
            if score < self.min_score:
                print(f"   RAG hit below min_score ({score:.3f} < {self.min_score}) for query "
                      f"'{query[:60]}' — source: {fields.get('source', 'unknown')}, rejected")
                continue

            docs.append(
                Document(
                    page_content=text,
                    metadata={
                        "source": fields.get("source", "unknown"),
                        "chunk": fields.get("chunk"),
                        "score": score,
                    },
                )
            )
        return docs


def get_farming_docs_retriever(top_k: int = 3) -> PineconeHostedRetriever:
    """Factory — used by langchain_tools.py to build the RAG search tool."""
    return PineconeHostedRetriever(top_k=top_k)