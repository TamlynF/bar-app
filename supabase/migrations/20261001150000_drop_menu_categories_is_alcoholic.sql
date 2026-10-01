-- The menu category Alcoholic tick is retired. It only fed Square's alcohol
-- setting (Send menu to Square, sandbox seeding and the Update alcohol in
-- Square button, all removed); that setting is now kept in the Square
-- dashboard, and square_catalog_variations.is_alcoholic copies it back.
-- Apply after the code that stopped reading the column is deployed.

alter table public.menu_categories
  drop column if exists is_alcoholic;
