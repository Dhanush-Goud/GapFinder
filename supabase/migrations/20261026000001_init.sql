-- GapFinder AI — initial schema.
-- Apply with the Supabase SQL editor or `supabase db push`. Safe to read top to bottom.
-- Embedding dimension 768 must match EMBEDDING_DIMENSION in lib/config.ts
-- (gemini-embedding-001 requested with outputDimensionality = 768).

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  exam_date date,
  hours_per_day numeric(4,2) check (hours_per_day is null or (hours_per_day >= 0.25 and hours_per_day <= 12)),
  preferred_slot text check (preferred_slot in ('morning', 'afternoon', 'evening')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- documents
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 255),
  kind text not null check (kind in ('syllabus', 'notes', 'textbook', 'question_paper')),
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 4194304),
  storage_path text,
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  error text,
  page_count integer,
  chunk_count integer not null default 0,
  embedding_status text not null default 'pending' check (embedding_status in ('complete', 'not_configured', 'failed', 'pending')),
  is_sample boolean not null default false,
  preview_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_user_idx on public.documents (user_id, created_at desc);

-- ---------------------------------------------------------------- topics
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid references public.topics (id) on delete cascade,
  code text,
  name text not null,
  description text not null default '',
  importance smallint check (importance between 1 and 3),
  source_refs jsonb not null default '[]'::jsonb,
  origin text not null check (origin in ('parsed', 'ai', 'sample')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index topics_user_idx on public.topics (user_id, position);

-- ---------------------------------------------------------------- chunks (+ vectors)
create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  document_name text not null,
  ordinal integer not null,
  page integer,
  section text,
  content text not null,
  topic_ids uuid[] not null default '{}',
  embedding extensions.vector(768),
  fts tsvector generated always as (to_tsvector('english', coalesce(section, '') || ' ' || content)) stored,
  created_at timestamptz not null default now(),
  unique (document_id, ordinal)
);
create index chunks_user_idx on public.document_chunks (user_id);
create index chunks_document_idx on public.document_chunks (document_id);
create index chunks_topics_idx on public.document_chunks using gin (topic_ids);
create index chunks_fts_idx on public.document_chunks using gin (fts);
create index chunks_embedding_idx on public.document_chunks using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------- questions (public part)
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  type text not null check (type in ('mcq', 'short')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  prompt text not null,
  options jsonb,
  citations jsonb not null check (jsonb_typeof(citations) = 'array' and jsonb_array_length(citations) > 0),
  origin text not null check (origin in ('sample', 'generated')),
  created_at timestamptz not null default now()
);
create index questions_user_topic_idx on public.questions (user_id, topic_id);

-- Answer keys live in a separate table with RLS enabled and NO policies for client roles,
-- so they can only be read by the server using the service-role key.
create table public.question_keys (
  question_id uuid primary key references public.questions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  correct_option smallint,
  expected_answer text,
  key_points jsonb not null default '[]'::jsonb,
  explanation text not null,
  option_rationales jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------- quizzes and answers
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_ids uuid[] not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard', 'mixed')),
  question_ids uuid[] not null check (cardinality(question_ids) > 0),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  score numeric(5,4),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index attempts_user_idx on public.quiz_attempts (user_id, created_at desc);

create table public.student_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  selected_option smallint,
  answer_text text check (answer_text is null or char_length(answer_text) <= 2000),
  score numeric(4,3) not null check (score between 0 and 1),
  is_correct boolean not null,
  evaluator text not null check (evaluator in ('deterministic', 'keyword-heuristic', 'llm')),
  -- Feedback revealed after submission: explanation, understood/missing points, misconceptions, citations.
  feedback jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);
create index answers_user_idx on public.student_answers (user_id, created_at);

create table public.topic_mastery_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  attempted integer not null,
  correct numeric(6,2) not null,
  accuracy numeric(5,4),
  level text not null check (level in ('weak', 'medium', 'strong', 'insufficient')),
  created_at timestamptz not null default now()
);
create index mastery_user_idx on public.topic_mastery_history (user_id, created_at);

-- ---------------------------------------------------------------- revision planning
create table public.revision_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  based_on_attempt_id uuid references public.quiz_attempts (id) on delete set null,
  settings jsonb not null,
  warnings jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index one_active_plan_per_user on public.revision_plans (user_id) where is_active;

create table public.revision_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.revision_plans (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('study', 'practice', 'retest', 'review')),
  minutes integer not null check (minutes > 0 and minutes <= 720),
  objective text not null,
  reason text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index tasks_plan_idx on public.revision_tasks (plan_id, day, position);
create index tasks_user_idx on public.revision_tasks (user_id, completed);

-- ---------------------------------------------------------------- Row Level Security
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.topics enable row level security;
alter table public.document_chunks enable row level security;
alter table public.questions enable row level security;
alter table public.question_keys enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.student_answers enable row level security;
alter table public.topic_mastery_history enable row level security;
alter table public.revision_plans enable row level security;
alter table public.revision_tasks enable row level security;

-- Owners can read and manage their own study material, topics and plans.
create policy "own profile" on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "own documents" on public.documents for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own topics" on public.topics for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own chunks" on public.document_chunks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own plans" on public.revision_plans for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own tasks" on public.revision_tasks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Grading data is read-only for owners. Inserts/updates happen on the server with the
-- service-role key, so a student cannot write their own grades or mastery levels.
create policy "read own questions" on public.questions for select to authenticated using (user_id = auth.uid());
create policy "read own attempts" on public.quiz_attempts for select to authenticated using (user_id = auth.uid());
create policy "read own answers" on public.student_answers for select to authenticated using (user_id = auth.uid());
create policy "read own mastery" on public.topic_mastery_history for select to authenticated using (user_id = auth.uid());
-- question_keys: intentionally no policies → no client access at all.

-- ---------------------------------------------------------------- retrieval functions
-- SECURITY INVOKER: RLS on document_chunks still applies, so users only search their own chunks.
create or replace function public.match_chunks(
  query_embedding extensions.vector(768),
  match_count integer default 6,
  filter_topic_ids uuid[] default null,
  filter_document_ids uuid[] default null
) returns table (
  id uuid, document_id uuid, document_name text, ordinal integer, page integer,
  section text, content text, topic_ids uuid[], similarity double precision
)
language sql stable security invoker set search_path = public, extensions as $$
  select c.id, c.document_id, c.document_name, c.ordinal, c.page, c.section, c.content, c.topic_ids,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c
  where c.user_id = auth.uid()
    and c.embedding is not null
    and (filter_topic_ids is null or c.topic_ids && filter_topic_ids)
    and (filter_document_ids is null or c.document_id = any (filter_document_ids))
  order by c.embedding <=> query_embedding
  limit least(match_count, 20);
$$;

create or replace function public.search_chunks_fulltext(
  query_text text,
  match_count integer default 6,
  filter_topic_ids uuid[] default null
) returns table (
  id uuid, document_id uuid, document_name text, ordinal integer, page integer,
  section text, content text, topic_ids uuid[], rank real
)
language sql stable security invoker set search_path = public as $$
  select c.id, c.document_id, c.document_name, c.ordinal, c.page, c.section, c.content, c.topic_ids,
         ts_rank(c.fts, websearch_to_tsquery('english', query_text)) as rank
  from public.document_chunks c
  where c.user_id = auth.uid()
    and c.fts @@ websearch_to_tsquery('english', query_text)
    and (filter_topic_ids is null or c.topic_ids && filter_topic_ids)
  order by rank desc
  limit least(match_count, 20);
$$;

grant execute on function public.match_chunks to authenticated;
grant execute on function public.search_chunks_fulltext to authenticated;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 4194304, array['application/pdf', 'text/plain', 'text/markdown'])
on conflict (id) do nothing;

-- Files are stored under <user_id>/<document_id>/<name>. Owners may read their own files;
-- uploads and deletes are performed by the server.
create policy "read own files" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
