import os
import re
from typing import List, Dict, Any, Optional

try:
    import chromadb
    from chromadb.config import Settings
except ImportError:
    chromadb = None

try:
    from langchain_google_genai import GoogleGenerativeAIEmbeddings
except ImportError:
    GoogleGenerativeAIEmbeddings = None

try:
    from langchain_openai import OpenAIEmbeddings
except ImportError:
    OpenAIEmbeddings = None


CHROMA_DIR = os.getenv("CHROMA_PERSIST_DIR", "/app/chroma_db")
os.makedirs(CHROMA_DIR, exist_ok=True)

# Shared persistent ChromaDB vector database client
_chroma_client = None


def get_chroma_client():
    global _chroma_client
    if _chroma_client is None and chromadb is not None:
        try:
            _chroma_client = chromadb.PersistentClient(
                path=CHROMA_DIR,
                settings=Settings(anonymized_telemetry=False, allow_reset=True),
            )
        except Exception as err:
            print(f"[CHROMA DB INIT ERROR]: {err}")
    return _chroma_client


def _sanitize_collection_name(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]", "_", name).strip("_").lower()
    if len(cleaned) < 3:
        cleaned = f"tenant_{cleaned}"
    if len(cleaned) > 63:
        cleaned = cleaned[:63]
    return f"t_{cleaned}"


# Cache tracking which collections have already been synced with current tenant data
_SYNCED_COLLECTIONS: set[str] = set()


def index_tenant_knowledge(tenant: Dict[str, Any]):
    """Index tenant profile, pricing, and FAQs into a dedicated tenant ChromaDB collection."""
    client = get_chroma_client()
    if client is None:
        return None

    business_name = tenant.get("businessName") or "Tenant"
    pricing_str = tenant.get("pricing", "").strip()
    faqs = tenant.get("faqs", [])
    
    col_name = _sanitize_collection_name(business_name)
    cache_key = f"{col_name}_{hash(pricing_str)}_{len(faqs)}"

    if cache_key in _SYNCED_COLLECTIONS:
        try:
            return client.get_collection(col_name)
        except Exception:
            pass

    collection = client.get_or_create_collection(
        name=col_name,
        metadata={"tenant": business_name, "hnsw:space": "cosine"},
    )

    docs: List[str] = []
    metadatas: List[Dict[str, Any]] = []
    ids: List[str] = []

    # 1. Business Overview Chunk
    tone = tenant.get("tone", "Professional")
    lang = tenant.get("language", "English")
    docs.append(f"{business_name} sales assistant. Tone: {tone}. Language guideline: {lang}.")
    metadatas.append({"category": "overview", "title": f"Business Profile of {business_name}"})
    ids.append(f"{col_name}_overview")

    # 2. Pricing Chunks
    if pricing_str:
        docs.append(pricing_str)
        metadatas.append({"category": "pricing", "title": f"Pricing Overview for {business_name}"})
        ids.append(f"{col_name}_pricing_overview")

        sentences = [s.strip() for s in re.split(r"[.\n]", pricing_str) if len(s.strip()) > 5]
        for idx, sentence in enumerate(sentences):
            docs.append(sentence)
            metadatas.append({"category": "pricing", "title": f"Pricing Item #{idx+1}"})
            ids.append(f"{col_name}_pricing_item_{idx+1}")

    # 3. FAQ Chunks
    for idx, faq in enumerate(faqs):
        q = faq.get("q") or faq.get("question", "")
        a = faq.get("a") or faq.get("answer", "")
        if q and a:
            docs.append(f"Question: {q}\nAnswer: {a}")
            metadatas.append({"category": "faq", "title": f"FAQ: {q}"})
            ids.append(f"{col_name}_faq_{idx+1}")

    # Upsert documents into ChromaDB Vector Store
    if docs:
        collection.upsert(documents=docs, metadatas=metadatas, ids=ids)

    _SYNCED_COLLECTIONS.add(cache_key)
    return collection


def retrieve_tenant_knowledge(tenant: Dict[str, Any], query: str, top_k: int = 4) -> List[Dict[str, Any]]:
    """Query the tenant's ChromaDB vector store collection using dense neural embeddings."""
    collection = index_tenant_knowledge(tenant)
    clean_query = query.strip()
    if not clean_query:
        return []

    if collection is not None:
        try:
            count = collection.count()
            if count > 0:
                n_results = min(top_k, count)
                query_res = collection.query(
                    query_texts=[clean_query],
                    n_results=n_results,
                    include=["documents", "metadatas", "distances"],
                )

                results = []
                docs = query_res.get("documents", [[]])[0]
                metas = query_res.get("metadatas", [[]])[0]
                dists = query_res.get("distances", [[]])[0]
                ids = query_res.get("ids", [[]])[0]

                for i, doc in enumerate(docs):
                    meta = metas[i] if i < len(metas) else {}
                    dist = dists[i] if i < len(dists) else 1.0
                    chunk_id = ids[i] if i < len(ids) else f"chunk_{i}"
                    # Cosine distance to similarity: 1.0 - (dist / 2.0)
                    sim_score = max(0.0, round(1.0 - (dist / 2.0), 4))
                    results.append({
                        "chunk_id": chunk_id,
                        "category": meta.get("category", "general"),
                        "title": meta.get("title", "Document"),
                        "content": doc,
                        "score": sim_score,
                    })

                # Sort by highest similarity
                results.sort(key=lambda r: r["score"], reverse=True)
                if results:
                    return results
        except Exception as query_err:
            print(f"[CHROMA QUERY ERROR]: {query_err}")

    # Fallback heuristic if vector database is empty or uninitialized
    pricing = tenant.get("pricing", "")
    business = tenant.get("businessName", "Business")
    return [{
        "chunk_id": "fallback_pricing",
        "category": "pricing",
        "title": f"Pricing for {business}",
        "content": pricing,
        "score": 0.5,
    }]


def format_retrieved_context(results: List[Dict[str, Any]]) -> str:
    """Format retrieved vector knowledge chunks into structured prompt context."""
    if not results:
        return "No specific knowledge articles found in vector database."

    lines = []
    for item in results:
        lines.append(f"[{item['category'].upper()} | {item['title']}]: {item['content']}")

    return "\n".join(lines)


def get_rag_telemetry() -> Dict[str, Any]:
    """Return RAG system architecture info for telemetry and audits."""
    client = get_chroma_client()
    collections = client.list_collections() if client else []
    col_names = [getattr(c, "name", str(c)) for c in collections]
    return {
        "vectorDatabase": "ChromaDB (Persistent)",
        "storagePath": CHROMA_DIR,
        "embeddingEngine": "ONNX all-MiniLM-L6-v2 (384-dimensional dense semantic vectors)",
        "activeTenantCollections": col_names,
        "collectionsCount": len(col_names),
    }
