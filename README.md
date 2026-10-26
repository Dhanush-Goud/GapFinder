# GapFinder AI

**GapFinder AI identifies what a student does not know, explains why, and tells them what to study next.**

Students upload their syllabus, notes, textbook chapters and past papers. GapFinder maps the material into topics, generates diagnostic questions grounded in retrieved passages, grades the answers, labels each topic weak / developing / strong from the actual answers, and builds a revision plan that is recalculated after every quiz.

## Problem

Students spend revision time on what they already know and miss what they don't — and they often can't tell which is which. Most study tools wait for a question. GapFinder proactively diagnoses the gaps.

## Features

| Area | What it does |
| --- | --- |
| Materials | PDF / .txt / .md upload (≤ 4 MB), validation, text extraction with page numbers, heading-aware chunking, status, errors, retry, preview, deletion. Scanned (image-only) PDFs are reported as unreadable, not silently accepted. |
| Topic map | Built from the syllabus (“Unit 3: …”, “3.2 …” parsed deterministically; AI fallback accepted only for topics whose quoted source text exists in the syllabus). Shows weightage, mastery, sources and topics with no supporting material. |
| Diagnostic quiz | Topic selection, 3–15 questions, difficulty, MCQ + short answer, progress, explanations, misconceptions, citations, history. Answer keys stay on the server. |
| Gap report | Per-unit label, recent and all-time accuracy, answers behind the rating, misconceptions, why wrong answers were wrong (with sources), mastery history, sub-topic table, next action. |
| Revision plan | Exam date + hours/day → day-by-day tasks (study, practice, retest, review) with durations, objectives and reasons; never exceeds the daily limit; recalculated after every quiz, showing how time moved between topics. |
| Progress | Score trend, unit mastery over time, first-vs-latest per unit, task completion, recently improved, still needing attention — all from stored data. |
| Explain a topic | Retrieval → sufficiency check → grounded answer → validated citations; refuses when the material doesn't cover the question. |
| Settings | Profile, study preferences, document management, data deletion, a “what is real in this mode” panel, logout. |

## Tech stack

Next.js 15 (App Router) · TypeScript · React 19 · Tailwind CSS 3 · Lucide · Recharts · Zod · Supabase (Postgres, Auth, Storage, pgvector, RLS) · Google Gemini via REST behind a provider interface · unpdf (PDF.js) · Vitest.

## Two modes

| | Demo mode (no configuration) | Live mode (Supabase configured) |
| --- | --- | --- |
| Access | “Enter demo” cookie — **not authentication**, labelled as such | Supabase Auth email/password, protected routes, optional one-click judge login |
| Storage | Browser `localStorage` | Postgres with Row Level Security + Storage bucket |
| Questions | 36 seeded questions over the sample DSA course, each citing a notes section | Seeded sample questions (after “Load sample course”) + Gemini-generated questions from your uploads, validated before saving |
| Grading | Server-side key; short answers by key-point rubric | Same; short answers by Gemini evaluator when configured (rubric fallback) |
| Retrieval | BM25 keyword search (labelled) | pgvector semantic search with Gemini embeddings, or Postgres full-text if no key (labelled) |
| External calls | None | Supabase, Gemini |

Demo results are flagged: one pre-loaded attempt from a fictional student is marked **Example data** everywhere and can be removed in Settings.

## Prerequisites

- Node.js 20.9+ (tested with Node 22) and npm
- Optional: a Supabase project, a Google AI Studio (Gemini) API key

## Run locally (demo mode)

```bash
# macOS: double-click gapfinder-ai.zip, or
unzip gapfinder-ai.zip && cd gapfinder-ai
npm install
npm run dev            # http://localhost:3000 → “Try the demo”
```

Other commands:

```bash
npm test               # Vitest unit/integration tests
npm run typecheck      # tsc --noEmit
npm run build          # production build
npm start              # serve the production build
```

## Environment

Copy `.env.example` to `.env.local`. Which variables enable what:

| Variable | Needed for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Live mode: auth, persistence, storage. All three or none. The service-role key is server-only. |
| `GEMINI_API_KEY` (+ `AI_MODEL`, `EMBEDDING_MODEL`) | Question generation, AI short-answer grading, semantic retrieval, AI tutor answers, AI topic-extraction fallback |
| `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD` | One-click judge login on the login page |
| `APP_MODE` | `auto` (default), `demo`, or `live` |

`GET /api/health` reports which features are active (never the values).

## Supabase setup

1. Create a project at supabase.com.
2. **SQL editor** → paste and run `supabase/migrations/20261026000001_init.sql` (or `supabase link` + `supabase db push`). It creates tables, pgvector (768-d), RLS policies, the `match_chunks` and `search_chunks_fulltext` functions and the private `documents` storage bucket.
3. **Authentication → Providers → Email**: enabled. For a hackathon you may turn off “Confirm email”; otherwise set **URL Configuration → Site URL** to your deployment URL so confirmation links hit `/auth/callback`.
4. **Project settings → API**: copy the URL, anon key and service-role key into `.env.local` (and Vercel).
5. Create and verify the judge account: set `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD`, then `npm run demo-user`. The script signs in with the credentials and only reports success if that works.
6. Sign in (judge button) → **Materials → Load sample DSA course** to seed that account.

## AI provider

`lib/ai/provider.ts` defines the interface; `lib/ai/gemini.ts` implements it over the REST API. To use another vendor, implement `generateJson` and `embed` and return it from `lib/ai/index.ts`. If you change the embedding dimension, change `EMBEDDING_DIMENSION` and the `vector(768)` columns/functions in the migration together.

## GitHub

```bash
cd gapfinder-ai
git init
git add .
git commit -m "GapFinder AI MVP"
git branch -M main
git remote add origin https://github.com/<you>/gapfinder-ai.git
git push -u origin main
```

`.gitignore` excludes `.env*` (except `.env.example`), `node_modules`, `.next` and zips.

## Vercel

1. vercel.com → **Add New → Project** → import the GitHub repo (framework auto-detected: Next.js).
2. **Environment variables**: none for demo mode; for live mode add the variables above (Production + Preview).
3. **Deploy**. Then verify:
   - `https://<app>.vercel.app/api/health` shows the expected `mode`, `aiConfigured`, `judgeAccess`.
   - Demo mode: landing → *Try the demo* → take a quiz → gap report updates.
   - Live mode: register or judge login → refresh after uploading; data should still be there.
4. If using Supabase email confirmation, set Supabase Site URL to the Vercel URL.

Upload limit is 4 MB because Vercel functions accept ~4.5 MB bodies. Long routes set `maxDuration = 60` (the Hobby plan allows this).

## Demo walkthrough (≈3 minutes)

1. **Landing → Try the demo** (or judge login in live mode).
2. **Dashboard**: overall mastery, weak/developing/strong counts, ranked topics, plan tasks. The pre-loaded attempt is marked *Example data*.
3. **Gap report**: *Graphs — Weak (25%)*, with the answers behind it, misconceptions, why each wrong answer was wrong and the cited notes section.
4. **Revision plan**: Graphs and Recursion get the most time; note the reasons.
5. **Quiz** → *Retest* Graphs, answer, submit. Results show explanations + sources, and a banner shows how the plan moved time (e.g. *Graphs 3 h 20 min → 20 min*).
6. **Gap report** again: the label changed from your answers; mastery history shows the change.
7. **Progress**: score trend and first-vs-latest charts. **Explain a topic**: ask “When should BFS mark a vertex visited?”, then ask about photosynthesis to see the insufficient-evidence refusal.
8. **Materials**: upload `sample-materials/dsa-notes.txt` or any text PDF to see extraction/chunking; upload a scanned PDF to see the honest failure.

## Sample data

`sample-materials/` holds an original syllabus and study notes for Data Structures & Algorithms (arrays, linked lists, stacks & queues, trees, graphs, recursion), with numbered sections. They run through the same extraction → chunking → syllabus parsing → linking pipeline as uploads. `lib/demo/bank.ts` holds 36 questions; tests verify every citation resolves to a real chunk and every answer is supported by its passage.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| App says demo mode although you set Supabase vars | All three Supabase variables are required; check `/api/health` → `problems`. Redeploy after changing Vercel env vars. |
| “Not enough grounded questions” | The selected topics have < 3 questions. Load the sample course, or set `GEMINI_API_KEY` and upload notes covering the topic. |
| PDF “No readable text” | It is image-only; OCR isn't supported. Export a text PDF or upload .txt. |
| Embeddings “failed” on a document | Check the Gemini key/quota; retrieval falls back to full-text search and says so. |
| Judge button errors | Run `npm run demo-user` with the same env values as the deployment. |
| Demo storage full | Delete uploads in Materials or reset the demo workspace in Settings. |

## Testing status

See `docs/LIMITATIONS_AND_FUTURE_WORK.md` for what is and isn't verified. Summary: unit tests, the production build and a headless-browser run of the demo journey pass; the SQL migration was executed against embedded Postgres + pgvector with RLS checks; **the live Supabase and Gemini paths have not been exercised against real services.**

More: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/RAG_PIPELINE.md`](docs/RAG_PIPELINE.md) · [`docs/AI_WORKFLOW.md`](docs/AI_WORKFLOW.md) · [`docs/LIMITATIONS_AND_FUTURE_WORK.md`](docs/LIMITATIONS_AND_FUTURE_WORK.md)
