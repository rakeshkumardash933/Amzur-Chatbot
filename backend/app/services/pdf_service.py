"""
PDF processing service.
Handles: upload → parse → chunk → embed → store in ChromaDB.
"""
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Document, User

# Lazy imports to avoid heavy load at module level
def _get_pypdf():
    from pypdf import PdfReader
    return PdfReader

def _get_text_splitter():
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    return RecursiveCharacterTextSplitter

def _get_chroma():
    import chromadb
    return chromadb

def _get_openai_ef():
    import chromadb.utils.embedding_functions as ef
    return ef.OpenAIEmbeddingFunction


PDF_UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads" / "pdfs"
MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB hard cap


class PDFService:
    CHUNK_SIZE = 1000
    CHUNK_OVERLAP = 150

    def __init__(self):
        self._chroma_client = None

    def _chroma(self):
        """Lazy-init persistent ChromaDB client."""
        if self._chroma_client is None:
            chromadb = _get_chroma()
            persist_dir = Path(settings.CHROMA_PERSIST_DIR).resolve()
            persist_dir.mkdir(parents=True, exist_ok=True)
            self._chroma_client = chromadb.PersistentClient(path=str(persist_dir))
        return self._chroma_client

    def _collection_name(self, user_id: int, document_id: int) -> str:
        """Stable, unique ChromaDB collection name per document."""
        return f"doc_u{user_id}_d{document_id}"

    # ------------------------------------------------------------------
    # File validation
    # ------------------------------------------------------------------

    @staticmethod
    def validate_pdf_file(filename: str, file_size: int) -> tuple[bool, Optional[str]]:
        if not filename.lower().endswith(".pdf"):
            return False, "Only PDF files are supported."
        if file_size > MAX_PDF_SIZE_BYTES:
            return False, f"File too large (max {MAX_PDF_SIZE_BYTES // (1024*1024)} MB)."
        return True, None

    # ------------------------------------------------------------------
    # Save file to disk
    # ------------------------------------------------------------------

    def save_pdf_file(self, file_bytes: bytes, original_filename: str) -> Path:
        PDF_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        safe_name = "".join(
            c for c in Path(original_filename).stem if c.isalnum() or c in ("_", "-")
        )[:80] or "document"
        unique_id = str(uuid.uuid4())[:8]
        dest = PDF_UPLOAD_DIR / f"{safe_name}_{unique_id}.pdf"
        dest.write_bytes(file_bytes)
        return dest

    # ------------------------------------------------------------------
    # Extract text from PDF
    # ------------------------------------------------------------------

    @staticmethod
    def extract_text(pdf_path: Path) -> str:
        PdfReader = _get_pypdf()
        reader = PdfReader(str(pdf_path))
        pages = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            if text.strip():
                pages.append(f"[Page {i + 1}]\n{text}")
        return "\n\n".join(pages)

    # ------------------------------------------------------------------
    # Split into chunks
    # ------------------------------------------------------------------

    def split_text(self, text: str) -> list[str]:
        RecursiveCharacterTextSplitter = _get_text_splitter()
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.CHUNK_SIZE,
            chunk_overlap=self.CHUNK_OVERLAP,
            separators=["\n\n", "\n", ". ", " ", ""],
        )
        return splitter.split_text(text)

    # ------------------------------------------------------------------
    # Store chunks + embeddings in ChromaDB
    # ------------------------------------------------------------------

    def index_chunks(
        self,
        chunks: list[str],
        collection_name: str,
        document_id: int,
        file_name: str,
    ) -> None:
        """Embed chunks with OpenAI text-embedding-3-large and persist in ChromaDB."""
        OpenAIEmbeddingFunction = _get_openai_ef()
        ef = OpenAIEmbeddingFunction(
            api_key=settings.LITELLM_API_KEY,
            api_base=settings.LITELLM_PROXY_URL,
            model_name=settings.LITELLM_EMBEDDING_MODEL,
        )
        client = self._chroma()

        # Delete existing collection if re-processing the same document
        try:
            client.delete_collection(name=collection_name)
        except Exception:
            pass

        collection = client.create_collection(
            name=collection_name,
            embedding_function=ef,
            metadata={"hnsw:space": "cosine"},
        )

        ids = [f"{collection_name}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [
            {
                "document_id": document_id,
                "file_name": file_name,
                "chunk_index": i,
            }
            for i in range(len(chunks))
        ]
        # Chroma add() batches internally; max 5461 per call
        batch = 500
        for start in range(0, len(chunks), batch):
            collection.add(
                documents=chunks[start : start + batch],
                ids=ids[start : start + batch],
                metadatas=metadatas[start : start + batch],
            )

    # ------------------------------------------------------------------
    # Retrieve relevant chunks for a query
    # ------------------------------------------------------------------

    def retrieve_chunks(
        self,
        query: str,
        collection_names: list[str],
        n_results: int = 5,
    ) -> list[dict]:
        """
        Search across one or more ChromaDB collections for the closest chunks.
        Returns list of {text, file_name, chunk_index, distance} dicts.
        """
        OpenAIEmbeddingFunction = _get_openai_ef()
        ef = OpenAIEmbeddingFunction(
            api_key=settings.LITELLM_API_KEY,
            api_base=settings.LITELLM_PROXY_URL,
            model_name=settings.LITELLM_EMBEDDING_MODEL,
        )
        client = self._chroma()
        results = []

        for col_name in collection_names:
            try:
                collection = client.get_collection(
                    name=col_name, embedding_function=ef
                )
                count = collection.count()
                if count == 0:
                    continue
                top_k = min(n_results, count)
                res = collection.query(query_texts=[query], n_results=top_k)
                docs = res.get("documents", [[]])[0]
                metas = res.get("metadatas", [[]])[0]
                dists = res.get("distances", [[]])[0]
                for doc, meta, dist in zip(docs, metas, dists):
                    results.append(
                        {
                            "text": doc,
                            "file_name": meta.get("file_name", ""),
                            "chunk_index": meta.get("chunk_index", 0),
                            "distance": dist,
                        }
                    )
            except Exception:
                continue

        # Sort by relevance (lowest cosine distance first) and limit
        results.sort(key=lambda x: x["distance"])
        return results[:n_results]

    # ------------------------------------------------------------------
    # Delete document embeddings
    # ------------------------------------------------------------------

    def delete_collection(self, collection_name: str) -> None:
        try:
            self._chroma().delete_collection(name=collection_name)
        except Exception:
            pass

    # ------------------------------------------------------------------
    # Full pipeline: process one document
    # ------------------------------------------------------------------

    def process_document(self, document: Document, db: Session) -> None:
        """
        Full pipeline: extract → chunk → embed → index.
        Updates document record in DB when done.
        """
        try:
            pdf_path = Path(document.file_path)
            text = self.extract_text(pdf_path)
            if not text.strip():
                raise ValueError("No extractable text found in PDF.")

            chunks = self.split_text(text)
            if not chunks:
                raise ValueError("Text splitting produced no chunks.")

            collection_name = self._collection_name(document.user_id, document.id)
            self.index_chunks(chunks, collection_name, document.id, document.file_name)

            document.is_processed = True
            document.chunk_count = len(chunks)
            document.collection_name = collection_name
            document.processed_at = datetime.utcnow()
            document.error_message = None
            db.commit()

        except Exception as exc:
            document.is_processed = False
            document.error_message = str(exc)[:500]
            db.commit()
            raise


pdf_service = PDFService()
