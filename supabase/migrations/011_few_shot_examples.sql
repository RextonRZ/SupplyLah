-- Few-shot examples table for dynamic semantic retrieval at intake time.
-- Embeddings use paraphrase-multilingual-MiniLM-L12-v2 (384 dimensions).

create table if not exists few_shot_examples (
  example_id    uuid primary key default gen_random_uuid(),
  raw_message   text not null unique,
  parsed_output jsonb not null,
  embedding     vector(384),
  created_at    timestamptz default now()
);

-- HNSW index — works well on small datasets without minimum row count constraint.
create index if not exists idx_few_shot_embedding
  on few_shot_examples using hnsw (embedding vector_cosine_ops);

-- Cosine similarity search RPC called from the intake agent.
create or replace function match_few_shot_examples(
  query_embedding vector(384),
  match_count     int default 3
)
returns table (
  raw_message   text,
  parsed_output jsonb,
  similarity    float
)
language sql stable
as $$
  select
    raw_message,
    parsed_output,
    1 - (embedding <=> query_embedding) as similarity
  from few_shot_examples
  where embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;
