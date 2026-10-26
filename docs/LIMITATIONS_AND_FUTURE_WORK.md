# Limitations and future work

## What was verified

| Check | Result |
| --- | --- |
| `npm test` (Vitest) | 63 tests pass: thresholds, insufficient evidence, MCQ/rubric grading, injection text in answers, citation validation, unsupported-claim rejection, generated-question rejection, option shuffling, planner time limits and re-planning, PDF extraction with page numbers, scanned-PDF detection, config/mode resolution, secrets absent from public config, full demo state flow. |
| `npm run typecheck`, `npm run build` | Pass. |
| Headless Chromium run of the demo journey against the production build | Pass: redirects, demo entry, upload (text PDF ✓, scanned PDF rejected), quiz → results with citations → retest → plan shift → gap report change → task completion persists after reload → tutor answer + refusal → mobile layout without horizontal overflow → logout. |
| SQL migration on embedded Postgres (PGlite) + pgvector with stubbed `auth`/`storage` schemas | Applies cleanly; profile trigger works; a user sees only own rows; answer keys invisible; users cannot write grades or rows for others; `match_chunks` and full-text search return only own chunks. |

## Not verified

- **Live Supabase and Gemini paths were not run against real services** (no credentials were available). The code is type-checked and the SQL was validated as above, but uploads to Storage, PostgREST RPC calls, Gemini generation/embedding responses and the judge account script are untested end-to-end. Test them after configuring (README → Supabase setup).
- No judge credentials exist yet; they are created by `npm run demo-user`, which verifies sign-in before reporting success.

## Known limitations

- **Mastery model**: windowed accuracy with fixed thresholds; difficulty is recorded but not weighted. Thresholds are heuristics, not validated boundaries.
- **Grounding check** is lexical (content-word overlap), not semantic entailment.
- **Short-answer rubric** (no AI) is keyword-based: paraphrases using different words can be under-credited.
- **No OCR**: scanned PDFs are rejected with an explanation.
- **Demo mode** stores data in `localStorage` (≈ 5 MB, one browser) and only quizzes the sample course; the demo cookie is not authentication.
- **Topic re-extraction** replaces the topic map and removes quiz data linked to old topics (the UI asks first).
- **Upload size** 4 MB (Vercel request limit); processing is synchronous within a 60 s function.
- The planner uses a 21-day horizon and does not yet place tasks at clock times; the preferred time of day is informational.
- Plan-shift comparison is shown for the plan change in the current session.

## Future work

- OCR for scanned documents (e.g. Tesseract or a vision model) with confidence reporting.
- Better mastery estimation: difficulty-weighted scoring, item response theory or Bayesian knowledge tracing, confidence intervals.
- Spaced repetition: schedule retests by forgetting curves.
- Entailment-based answer verification and question quality scoring.
- Background ingestion queue for large documents.
- Teacher analytics: class-level gap heatmaps.
- Multi-language support for materials and UI.
- LMS integration (LTI / Google Classroom / Moodle).
