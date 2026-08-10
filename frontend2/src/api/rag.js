import client from "./client";

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
