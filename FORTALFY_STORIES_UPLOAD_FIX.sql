-- Corrige permissão de upload para Stories sem depender da política genérica do Feed.
-- Seguro para reaplicar. Aplicar no projeto Supabase de produção.

insert into storage.buckets as current_bucket (id, name, public, file_size_limit, allowed_mime_types)
values (
  'social-media', 'social-media', false, 41943040,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']
)
on conflict (id) do update set
  public = false,
  file_size_limit = greatest(current_bucket.file_size_limit, excluded.file_size_limit),
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'];

drop policy if exists "users upload their own story media" on storage.objects;
create policy "users upload their own story media" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'social-media'
    and split_part(name, '/', 1) = auth.uid()::text
    and split_part(name, '/', 2) = 'stories'
    and name ~ ('^' || auth.uid()::text || '/stories/[0-9a-fA-F-]{36}[.](jpg|png|webp|mp4|webm)$')
  );
