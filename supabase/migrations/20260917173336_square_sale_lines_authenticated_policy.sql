drop policy if exists "Allow authenticated full" on public.square_sale_lines;
create policy "Allow authenticated full" on public.square_sale_lines
  for all to authenticated using (true) with check (true);
