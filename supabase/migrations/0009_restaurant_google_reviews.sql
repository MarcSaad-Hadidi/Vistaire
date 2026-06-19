-- Vistaire restaurant Google Reviews link
-- Optional public menu CTA used only when a valid Google review URL is set.

alter table public.restaurants
  add column if not exists google_review_enabled boolean not null default false,
  add column if not exists google_review_url text;
