-- Restrict direct client mutations until booking status transitions are
-- performed through a server-validated RPC.
-- Safe for the current app: the client reads bookings but does not update or
-- delete them. Apply in staging first, then verify booking flows before prod.

begin;

drop policy if exists "involved user updates booking" on public.bookings;

revoke update, delete, truncate, references, trigger
  on table public.bookings
  from public, anon, authenticated;

commit;
