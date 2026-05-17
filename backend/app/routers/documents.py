from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.services.rag import rag

router = APIRouter(prefix="/documents", tags=["documents"])

@router.post("/upload")
async def upload_document(file: UploadFile = File(...), doc_name: str = Form(None)):
    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("utf-8", errors="ignore")

    name = doc_name or file.filename or "document"
    chunks = rag.ingest(text, name)
    return {"status": "ok", "doc_name": name, "chunks": chunks}

@router.get("/list")
def list_documents():
    return {"documents": rag.list_docs()}

@router.post("/search")
async def search_documents(query: str = Form(...), k: int = Form(3)):
    if not query.strip():
        raise HTTPException(status_code=400, detail="query is required")
    results = rag.retrieve(query, k=k)
    return {"query": query, "results": results, "count": len(results)}
