# RAG pipeline

Each stage is a separate module so the flow can be explained and tested stage by stage.

| # | Stage | Module | Detail |
| --- | --- | --- | --- |
| 1 | Validation | `lib/rag/extract.ts` | PDF, .txt, .md only; ≤ 4 MB; non-empty. |
| 2 | Extraction | `lib/rag/extract.ts` | unpdf (PDF.js) per page → `{ page, text }`. Text files have no pages (sections are used). Fewer than 40 readable characters → explicit error (“probably a scanned PDF”). Corrupt PDFs → explicit error. |
| 3 | Chunking | `lib/rag/chunk.ts` | Heading detection (Markdown `#`, “Unit/Module/Chapter n”, numbered “4.2 Title”). Sections are packed by paragraph up to `maxChars` (1400) with sentence-level `overlapChars` (200); small sub-sections merge into their parent. Chunks never cross pages, so each has one page and one section label. |
| 4 | Topic linking | `lib/rag/link.ts` | Section numbers matched to syllabus codes (“4.2” → topic 4.2 and its unit); otherwise ≥ 60 % overlap with a leaf topic name. |
| 5 | Embeddings | `lib/ai/gemini.ts` | `gemini-embedding-001`, `RETRIEVAL_DOCUMENT` / `RETRIEVAL_QUERY`, `outputDimensionality: 768`, normalised. Shape is validated. Failure marks the document `embedding_status = failed` and retrieval falls back. |
| 6 | Vector storage | migration | `document_chunks.embedding vector(768)` with HNSW cosine index. |
| 7 | Retrieval | `lib/data/live-retrieval.ts`, `lib/rag/lexical.ts` | Live: `match_chunks` RPC (similarity), else Postgres full-text (`search_chunks_fulltext`, OR-ed terms). Demo: BM25. The method is returned with every passage and shown in the UI. |
| 8 | Filtering | same | By topic (topic + descendants via `topic_ids && filter`) and document. |
| 9 | Passage assembly | `lib/ai/tasks.ts → formatSources` | Passages wrapped in `<source id="S1" document=… section=… page=…>`; nested tags stripped. |
| 10 | Grounded generation | `lib/ai/tasks.ts` | Prompts forbid outside knowledge and demand cited source IDs. |
| 11 | Citation validation | `lib/rag/citations.ts` | Aliases mapped back to chunk IDs; IDs not in the retrieved set are rejected. Citation text (document, section, page, excerpt) is built from the stored chunk, never from model output. |
| 12 | Insufficient evidence | `lib/rag/lexical.ts → isEvidenceSufficient`, `lib/rag/tutor.ts` | Semantic: top similarity ≥ 0.55. Lexical/full-text: ≥ 50 % of query terms present in the top passages. Otherwise the user gets an explicit “not enough evidence” response. The model can also declare insufficiency; an answer with zero valid citations is withheld. |

## Grounding check for questions

`isClaimSupported(claim, evidence)` requires ≥ 60 % of the content words of *question + keyed answer* (or the expected short answer) to appear in the cited passages. It is a deterministic lexical heuristic that catches answers about absent content; it is **not** a full entailment check. The 36 seeded questions all pass it (tested).

## Failure handling

Every document carries `status` (`processing` / `ready` / `failed`) and `error`. Failed documents keep their original file in Storage and can be retried. Embedding failures do not fail ingestion; they are recorded and visible.
