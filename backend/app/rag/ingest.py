import uuid
from pypdf import PdfReader
import io
from app.rag.pinecone_client import get_index


def split_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list:
    """Split text into overlapping chunks for better retrieval."""
    chunks = []
    start  = 0
    while start < len(text):
        end   = start + chunk_size
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start = end - overlap
    return chunks


async def ingest_pdf(pdf_bytes: bytes, source_name: str) -> dict:
    """
    PDF → text → chunks → Pinecone inference index.

    IMPORTANT: Field name MUST be 'text' — this is what Pinecone
    inference index uses for embedding. Any other name causes the
    'Missing field_mapping field' error.
    """
    # Extract text from PDF
    reader    = PdfReader(io.BytesIO(pdf_bytes))
    full_text = ""
    for page in reader.pages:
        extracted = page.extract_text()
        if extracted:
            full_text += extracted + "\n"

    if not full_text.strip():
        return {
            "success": False,
            "message": "No text extracted from PDF — may be scanned/image PDF",
            "chunks":  0
        }

    # Split into chunks
    chunks = split_text(full_text, chunk_size=500, overlap=50)
    print(f"\n📄 '{source_name}': {len(chunks)} chunks to ingest")

    index      = get_index()
    records    = []
    failed     = 0
    batch_size = 50

    for i, chunk in enumerate(chunks):
        try:
            records.append({
                "_id":    f"{source_name}_{i}_{str(uuid.uuid4())[:8]}",
                "text":   chunk,        # ← MUST be "text" for Pinecone inference
                "source": source_name,
                "chunk":  i
            })
        except Exception as e:
            print(f"⚠️ Record build failed chunk {i}: {e}")
            failed += 1
            continue

        # Upsert in batches of 50
        if len(records) >= batch_size:
            try:
                index.upsert_records(
                    namespace="farming-docs",
                    records=records
                )
                print(f"  ✅ Batch upserted: {i+1}/{len(chunks)} chunks")
                records = []
            except Exception as e:
                print(f"  ❌ Batch upsert failed: {e}")
                failed += len(records)
                records = []

    # Upsert remaining
    if records:
        try:
            index.upsert_records(
                namespace="farming-docs",
                records=records
            )
            print(f"  ✅ Final batch upserted: {len(records)} chunks")
        except Exception as e:
            print(f"  ❌ Final batch failed: {e}")
            failed += len(records)

    success_count = len(chunks) - failed
    print(f"✅ Done: {success_count}/{len(chunks)} chunks ingested from '{source_name}'")

    return {
        "success":      True,
        "source":       source_name,
        "total_chunks": len(chunks),
        "ingested":     success_count,
        "failed":       failed,
        "message":      f"Ingested {success_count} chunks from {source_name}"
    }