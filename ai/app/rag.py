import re
import math
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

try:
    import numpy as np
except ImportError:
    np = None


@dataclass
class KnowledgeChunk:
    chunk_id: str
    category: str
    title: str
    content: str
    keywords: List[str] = field(default_factory=list)
    vector: Optional[List[float]] = None


STOP_WORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "as", "at",
    "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "could", "did",
    "do", "does", "doing", "down", "during", "each", "few", "for", "from", "further", "had", "has", "have",
    "having", "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "i", "if", "in",
    "into", "is", "it", "its", "itself", "me", "more", "most", "my", "myself", "no", "nor", "not", "of",
    "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own",
    "same", "she", "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them",
    "themselves", "then", "there", "these", "they", "this", "those", "through", "to", "too", "under", "until",
    "up", "very", "was", "we", "were", "what", "when", "which", "while", "who", "whom", "why",
    "with", "would", "you", "your", "yours", "yourself", "yourselves", "tell", "kya", "hai", "mujhe"
}


def _tokenize(text: str) -> List[str]:
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    words = [word for word in cleaned.split() if len(word) > 1]
    filtered = [w for w in words if w not in STOP_WORDS]
    return filtered if filtered else words


class TenantVectorStore:
    """In-memory tenant-isolated semantic and lexical vector store."""

    def __init__(self, tenant_id: str, business_name: str):
        self.tenant_id = tenant_id
        self.business_name = business_name
        self.chunks: List[KnowledgeChunk] = []
        self._vocab: Dict[str, int] = {}
        self._idf: Dict[str, float] = {}
        self._tfidf_matrix: Optional[Any] = None

    def add_chunk(self, chunk_id: str, category: str, title: str, content: str):
        keywords = _tokenize(f"{title} {content}")
        self.chunks.append(
            KnowledgeChunk(
                chunk_id=chunk_id,
                category=category,
                title=title,
                content=content,
                keywords=keywords,
            )
        )

    def build_index(self):
        if not self.chunks:
            return

        doc_count = len(self.chunks)
        df: Dict[str, int] = {}
        for chunk in self.chunks:
            unique_terms = set(chunk.keywords)
            for term in unique_terms:
                df[term] = df.get(term, 0) + 1

        self._vocab = {term: idx for idx, term in enumerate(df.keys())}
        self._idf = {
            term: math.log((doc_count + 1) / (count + 1)) + 1.0
            for term, count in df.items()
        }

        if np is not None and self._vocab:
            matrix = np.zeros((doc_count, len(self._vocab)), dtype=np.float32)
            for row_idx, chunk in enumerate(self.chunks):
                tf: Dict[str, int] = {}
                for term in chunk.keywords:
                    tf[term] = tf.get(term, 0) + 1
                for term, freq in tf.items():
                    col_idx = self._vocab[term]
                    matrix[row_idx, col_idx] = freq * self._idf[term]

                norm = np.linalg.norm(matrix[row_idx])
                if norm > 0:
                    matrix[row_idx] /= norm
            self._tfidf_matrix = matrix

    def query(self, query_text: str, top_k: int = 4) -> List[Dict[str, Any]]:
        query_terms = _tokenize(query_text)
        if not query_terms or not self.chunks:
            return []

        scores = [0.0] * len(self.chunks)

        if np is not None and self._tfidf_matrix is not None and self._vocab:
            q_vec = np.zeros(len(self._vocab), dtype=np.float32)
            for term in query_terms:
                if term in self._vocab:
                    col = self._vocab[term]
                    q_vec[col] += self._idf.get(term, 1.0)
            q_norm = np.linalg.norm(q_vec)
            if q_norm > 0:
                q_vec /= q_norm
                dense_sims = np.dot(self._tfidf_matrix, q_vec)
                for i, sim in enumerate(dense_sims):
                    scores[i] = float(sim)
        else:
            query_set = set(query_terms)
            for idx, chunk in enumerate(self.chunks):
                overlap = len(query_set.intersection(set(chunk.keywords)))
                scores[idx] = overlap / max(1, len(chunk.keywords))

        # Rank and pick top_k
        ranked_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
        results = []
        for idx in ranked_indices[:top_k]:
            results.append({
                "chunk_id": self.chunks[idx].chunk_id,
                "category": self.chunks[idx].category,
                "title": self.chunks[idx].title,
                "content": self.chunks[idx].content,
                "score": round(scores[idx], 4),
            })

        return results


# Global tenant knowledge store cache: tenant_id -> TenantVectorStore
_TENANT_STORES: Dict[str, TenantVectorStore] = {}


def index_tenant_knowledge(tenant: Dict[str, Any]) -> TenantVectorStore:
    business_name = tenant.get("businessName") or "Business"
    tenant_key = f"{business_name}_{tenant.get('pricing', '')}"

    if tenant_key in _TENANT_STORES:
        return _TENANT_STORES[tenant_key]

    store = TenantVectorStore(tenant_id=tenant_key, business_name=business_name)

    # 1. Business Overview Chunk
    tone = tenant.get("tone", "Professional")
    language = tenant.get("language", "English")
    store.add_chunk(
        chunk_id="profile",
        category="overview",
        title=f"Business Profile of {business_name}",
        content=f"{business_name} sales assistant. Tone: {tone}. Language guideline: {language}."
    )

    # 2. Pricing Chunks (chunk by clauses/lines)
    pricing_text = tenant.get("pricing", "").strip()
    if pricing_text:
        store.add_chunk(
            chunk_id="pricing_overview",
            category="pricing",
            title=f"Pricing & Plans for {business_name}",
            content=pricing_text
        )
        sentences = [s.strip() for s in re.split(r"[.\n]", pricing_text) if len(s.strip()) > 5]
        for idx, sentence in enumerate(sentences):
            store.add_chunk(
                chunk_id=f"pricing_item_{idx+1}",
                category="pricing",
                title=f"Price Clause #{idx+1}",
                content=sentence
            )

    # 3. FAQ Chunks
    faqs = tenant.get("faqs", [])
    for idx, faq in enumerate(faqs):
        q = faq.get("q") or faq.get("question", "")
        a = faq.get("a") or faq.get("answer", "")
        if q and a:
            store.add_chunk(
                chunk_id=f"faq_{idx+1}",
                category="faq",
                title=f"FAQ: {q}",
                content=f"Question: {q}\nAnswer: {a}"
            )

    store.build_index()
    _TENANT_STORES[tenant_key] = store
    return store


def retrieve_tenant_knowledge(tenant: Dict[str, Any], query: str, top_k: int = 4) -> List[Dict[str, Any]]:
    """Retrieve top-k relevant knowledge chunks for a query strictly scoped to this tenant."""
    store = index_tenant_knowledge(tenant)
    return store.query(query, top_k=top_k)


def format_retrieved_context(results: List[Dict[str, Any]]) -> str:
    """Format retrieved knowledge chunks into structured prompt context."""
    if not results:
        return "No specific knowledge articles found."

    lines = []
    for item in results:
        lines.append(f"[{item['category'].upper()} | {item['title']}]: {item['content']}")

    return "\n".join(lines)
