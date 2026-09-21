-- El mapa de Inicio pintaba once puntos pero un plan sólo podía vivir en cinco:
-- los otros seis salían siempre apagados y al tocarlos no había nada que ver.
-- La lista queda igual que `lib/community/places.ts`, que es la que leen el mapa,
-- el filtro de lugar de Explorar y el formulario de crear plan.
alter table public.universe_plans drop constraint if exists universe_plans_place_check;
alter table public.universe_plans add constraint universe_plans_place_check
  check (place in (
    'Benimaclet',
    'Torres de Serranos',
    'La Malvarrosa',
    'L’Albufera · Gola de Pujol',
    'Campus de Vera · Ágora',
    'Ruzafa · Café',
    'Mercado de Colón · Restaurantes',
    'Biblioteca Pública',
    'Marina · Discotecas',
    'Cines Lys',
    'Jardín del Turia'
  ));
