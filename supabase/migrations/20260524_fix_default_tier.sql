-- Fix handle_new_user() to default new accounts to 'free' tier (opt-in trial)
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, tier, trial_started_at, language, welcome_dismissed)
  values (new.id, 'free', null, 'en', false)
  on conflict (id) do nothing;
  return new;
exception when others then
  return new;
end;
$$ language plpgsql security definer;
