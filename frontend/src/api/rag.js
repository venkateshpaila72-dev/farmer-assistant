import client from "./client";

// Admin-only — uploads an ICAR PDF, ingested into Pinecone in the
// background so the chat agent's search_farming_documents tool can draw
// on it. Multipart, not JSON — it's a file upload.
export async function ingestDocument(file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await client.post("/rag/ingest", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getDocuments() {
  const { data } = await client.get("/rag/documents");
  return data;
}

export async function deleteDocument(id) {
  const { data } = await client.delete(`/rag/documents/${id}`);
  return data;
}   