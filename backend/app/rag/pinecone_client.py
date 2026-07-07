from pinecone import Pinecone
from app.core.config import settings

# Initialize Pinecone client
pc = Pinecone(api_key=settings.PINECONE_API_KEY)

# Connect to inference index
index = pc.Index(settings.PINECONE_INDEX_NAME)

print(f"✅ Pinecone connected — index: {settings.PINECONE_INDEX_NAME}")


def get_pinecone_client():
    """Returns the Pinecone client."""
    return pc


def get_index():
    """Returns the Pinecone index object."""
    return index


def get_index_stats() -> dict:
    """Returns stats about the Pinecone index."""
    return index.describe_index_stats()