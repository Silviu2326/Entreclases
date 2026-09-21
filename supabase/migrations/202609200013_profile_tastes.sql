-- The shelf of the profile: what each person watches, plays and listens to, and
-- the quick picks. Both are filled by tapping, never typed.
-- Favourites arrive already resolved from the public catalogues (title, subtitle
-- and cover path), so reading a profile never calls an external API. The shape
-- is checked in lib/community/tastes.ts; here we only bound size and vocabulary.
alter table public.universe_profiles
  add column favorites jsonb not null default '[]'::jsonb
    check (jsonb_typeof(favorites) = 'array'
           and jsonb_array_length(favorites) <= 20
           and length(favorites::text) <= 4000),
  add column picks text[] not null default '{}'
    check (cardinality(picks) <= 12 and picks <@ array[
      'madrugar','trasnochar','biblioteca','cocina','horchata','cafe',
      'mano','tablet','bus','bici','playa','montana',
      'ultima-noche','al-dia','maraton','capitulo','auriculares','altavoz',
      'salir','sofa','menu','tupper','contesto','silenciado'
    ]::text[]);

grant update(favorites, picks) on public.universe_profiles to authenticated;
