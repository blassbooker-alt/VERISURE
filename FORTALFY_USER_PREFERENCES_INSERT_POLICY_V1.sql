-- Allow a signed-in user to create only their own onboarding preferences.
grant insert on public.user_preferences to authenticated;

drop policy if exists "users insert own preferences" on public.user_preferences;
create policy "users insert own preferences" on public.user_preferences
  for insert to authenticated
  with check (auth.uid() = user_id);
