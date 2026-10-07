-- Vistaire — explicit Data API grants (Supabase Oct 30, 2026 breaking change)
--
-- Contexte : le 30 octobre 2026, Supabase n'accorde plus automatiquement
-- anon/authenticated/service_role sur les nouvelles tables de `public`.
-- Les tables existantes gardent leurs grants (prod OK), MAIS :
--   1. toute nouvelle table creee apres le 30/10 sans GRANT explicite -> 42501
--   2. si les migrations sont rejouees sur un environnement neuf
--      (nouveau projet, preview branch, db reset — deja le cas depuis le
--      30 mai 2026 pour les nouveaux projets), les tables ci-dessous
--      n'auraient AUCUN grant, meme pour service_role.
--
-- public.qr_codes et public.owner_3d_ar_source_uploads sont documentees
-- "service role only" dans leurs migrations d'origine, mais n'ont jamais
-- recu de GRANT explicite : elles ne fonctionnent aujourd'hui que grace
-- aux default privileges implicites. Cette migration rend le modele
-- de securite declare explicite (meme pattern que 0007/0008/0013).
--
-- Les tables media_capacity_* sont volontairement exclues : acces via
-- fonctions SECURITY DEFINER (EXECUTE deja accorde a service_role),
-- tables explicitement REVOKEes — ne pas y toucher.
--
-- Appliquer : ajouter ce fichier dans supabase/migrations/ puis appliquer
-- via `supabase db push` (ou executer le bloc GRANT dans le SQL editor).
-- Autorisé : Marc uniquement.

-- 0001_qr_codes.sql — route publique /q/[token], acces serveur uniquement
grant select, insert, update, delete
  on table public.qr_codes
  to service_role;

-- 0003_owner_3d_ar_source_uploads.sql — APIs owner serveur uniquement
grant select, insert, update, delete
  on table public.owner_3d_ar_source_uploads
  to service_role;
