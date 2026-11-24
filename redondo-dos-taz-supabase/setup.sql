-- ============================================================
--  REDONDO DOS TAZ — configuração do banco no Supabase
--  1) Troque seuemail@gmail.com pelo SEU e-mail (linha do is_admin)
--  2) Cole tudo no SQL Editor do Supabase e clique em Run
-- ============================================================

create table if not exists public.docs (
  col text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (col, id)
);

-- Quem é admin (pode cadastrar partidas e lançar resultados)
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in ('matheusbjj96@gmail.com');
$$;

alter table public.docs enable row level security;

-- Libera a tabela para a API do site (usuários logados); quem pode o quê é decidido pelas regras abaixo
grant select, insert, update, delete on public.docs to authenticated;
revoke all on public.docs from anon;

drop policy if exists "ler" on public.docs;
drop policy if exists "admin" on public.docs;
drop policy if exists "meu palpite insere" on public.docs;
drop policy if exists "meu palpite altera" on public.docs;

-- Todo mundo logado lê tudo (partidas, palpites, ranking)
create policy "ler" on public.docs for select to authenticated using (true);
-- O admin pode tudo
create policy "admin" on public.docs for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- Cada um só escreve o PRÓPRIO documento de palpites
create policy "meu palpite insere" on public.docs for insert to authenticated
  with check (col = 'picks' and id = auth.uid()::text);
create policy "meu palpite altera" on public.docs for update to authenticated
  using (col = 'picks' and id = auth.uid()::text)
  with check (col = 'picks' and id = auth.uid()::text);

-- Trava no servidor: palpite confirmado não muda, e novo palpite só até 15 min antes do jogo
create or replace function public.picks_guard() returns trigger
language plpgsql as $$
declare k text; oldp jsonb; newp jsonb;
begin
  if new.col <> 'picks' or public.is_admin() then return new; end if;
  oldp := case when tg_op = 'UPDATE' then coalesce(old.data -> 'picks', '{}'::jsonb) else '{}'::jsonb end;
  newp := coalesce(new.data -> 'picks', '{}'::jsonb);
  for k in select jsonb_object_keys(oldp) loop
    if not (newp ? k) or (newp -> k) is distinct from (oldp -> k) then
      raise exception 'Palpite já confirmado não pode ser alterado';
    end if;
  end loop;
  for k in select jsonb_object_keys(newp) loop
    if not (oldp ? k) and exists (
      select 1 from public.docs m
      where m.col = 'matches' and m.id = k
        and (m.data ->> 'start')::timestamptz - interval '15 minutes' <= now()
    ) then
      raise exception 'Prazo encerrado para esta partida';
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists picks_guard on public.docs;
create trigger picks_guard before insert or update on public.docs
  for each row execute function public.picks_guard();

-- Atualização em tempo real
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- Configuração do bolão
insert into public.docs (col, id, data) values
('league', 'config', '{"name":"REDONDO DOS TAZ","prize":"Acerte quem vence cada partida. Quem somar mais pontos até a final leva uma skin de CS."}')
on conflict (col, id) do nothing;

-- Jogos de 25/11/2026 (Stage 1, rodada 3) — horários em UTC
insert into public.docs (col, id, data) values
('matches','2026-11-25-heroic-m80','{"a":"HEROIC","b":"M80","start":"2026-11-25T06:00:00Z","stage":"Stage 1 · 1-1","bo":1,"pts":1,"winner":null,"score":null}'),
('matches','2026-11-25-eternalfire-100thieves','{"a":"Eternal Fire","b":"100 Thieves","start":"2026-11-25T06:00:00Z","stage":"Stage 1 · 1-1","bo":1,"pts":1,"winner":null,"score":null}'),
('matches','2026-11-25-parivision-faze','{"a":"PARIVISION","b":"FaZe","start":"2026-11-25T07:00:00Z","stage":"Stage 1 · 1-1","bo":1,"pts":1,"winner":null,"score":null}'),
('matches','2026-11-25-wildcard-lynnvision','{"a":"Wildcard","b":"Lynn Vision","start":"2026-11-25T07:00:00Z","stage":"Stage 1 · 1-1","bo":1,"pts":1,"winner":null,"score":null}'),
('matches','2026-11-25-imperial-flyquest','{"a":"Imperial","b":"FlyQuest","start":"2026-11-25T08:00:00Z","stage":"Stage 1 · 2-0 (vale vaga)","bo":3,"pts":2,"winner":null,"score":null}'),
('matches','2026-11-25-9z-dendele','{"a":"9z","b":"DENDELE","start":"2026-11-25T08:00:00Z","stage":"Stage 1 · 0-2 (eliminação)","bo":3,"pts":2,"winner":null,"score":null}'),
('matches','2026-11-25-nip-liquid','{"a":"Ninjas in Pyjamas","b":"Liquid","start":"2026-11-25T10:30:00Z","stage":"Stage 1 · 2-0 (vale vaga)","bo":3,"pts":2,"winner":null,"score":null}'),
('matches','2026-11-25-bcgame-chinggis','{"a":"BC.Game","b":"Chinggis Warriors","start":"2026-11-25T10:30:00Z","stage":"Stage 1 · 0-2 (eliminação)","bo":3,"pts":2,"winner":null,"score":null}')
on conflict (col, id) do nothing;
