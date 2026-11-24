# Redondo dos Taz — Bolão do Major de Singapura 2026

## Estrutura
- `index.html` — página (telas de login, palpites, ranking, resultados, regras e admin)
- `css/style.css` — visual (tema preto e vermelho, cartões de confronto, selos dos times)
- `js/app.js` — lógica do bolão (palpites, travamento 15 min antes, pontuação, ranking)
- `js/stack-tables.js` — ajuda as tabelas a empilharem no celular

## Como publicar (Supabase + GitHub Pages)

### 1. Supabase (login e banco de dados)
1. Entre em supabase.com > **Start your project** (pode entrar com sua conta do GitHub).
2. **New project**: nome `redondo-dos-taz`, crie uma senha do banco (guarde) e região **South America (São Paulo)**. Aguarde uns 2 minutos.
3. Menu **SQL Editor** > New query > cole o conteúdo de `setup.sql`, troque `seuemail@gmail.com` pelo seu e-mail e clique em **Run**.
4. **Authentication** > Sign In / Providers > **Email**: deixe ligado e **desligue "Confirm email"**. Salve.
5. **Project Settings** > **API** (ou Data API): copie o **Project URL** e a chave **anon public** (ou publishable) para `js/supabase-config.js`, e coloque seu e-mail em `ADMIN_EMAILS`.

### 2. GitHub Pages (hospedagem)
1. No GitHub, crie um repositório **público** chamado `redondo-dos-taz`.
2. Envie todos os arquivos desta pasta (Add file > Upload files) e faça o Commit.
3. Settings > **Pages** > Deploy from a branch > `main` / `(root)` > Save.
4. Em 1–2 minutos o site fica em `https://SEU-USUARIO.github.io/redondo-dos-taz/`.

### 3. Primeiro acesso
Abra o site, digite seu e-mail de admin e uma senha e toque em **Criar conta**. Depois escolha o apelido.
Mande o link para os amigos: cada um cria a conta dele do mesmo jeito.

## Dia a dia (admin)
- **Resultados do dia** (aba Admin): marque vencedores e placares e salve; o ranking atualiza na hora.
- **Adicionar partida**: cadastre os jogos seguintes no horário de Brasília (no mata-mata, escolher a fase já preenche formato e pontos).

## Segurança (garantida no banco, não só na página)
- Palpite confirmado não pode ser trocado nem apagado.
- Palpite novo só é aceito até 15 minutos antes do início da partida.
- Cada um só escreve os próprios palpites; partidas e resultados só o admin.
- A chave "anon/publishable" pode ficar no site; nunca coloque a chave "service_role/secret".
- Qualquer pessoa com o link pode criar conta. Para restringir, em Authentication > Sign In / Providers desative "Allow new users to sign up" depois que os 9 amigos se cadastrarem.

## Formato dos dados
Tabela `docs` (col, id, data jsonb):
- `league/config` — `{ name, prize, updatedAt }`
- `matches/{id}` — `{ a, b, start (ISO UTC), stage, bo, pts, winner: "a"|"b"|null, score }`
- `picks/{id do usuário}` — `{ name, manual?, picks: { [matchId]: { w: "a"|"b", s?: "2-1", at } } }`

## Pontuação
Acerto = `pts` da partida (MD1 Stage 1/2 = 1; MD3 Stage 1/2 e Stage 3 = 2; quartas = 3;
semi = 4; 3º lugar = 3; final = 5). Placar exato em MD3/MD5 = +1.
Desempate: placares exatos, depois acertos.

## Logos dos times
Coloque os arquivos em `img/times/`. Cada cartão de confronto mostra a logo acima do nome do time;
se o arquivo não existir, aparece o selo colorido com a sigla. Para usar outro formato (ex.: .webp),
mude `LOGO_EXT` no topo da seção "LOGOS DOS TIMES" em `js/app.js`.

| Time | Arquivo |
|---|---|
| Ninjas in Pyjamas | `ninjasinpyjamas.png` |
| Liquid | `liquid.png` |
| HEROIC | `heroic.png` |
| M80 | `m80.png` |
| Eternal Fire | `eternalfire.png` |
| 100 Thieves | `100thieves.png` |
| PARIVISION | `parivision.png` |
| FaZe | `faze.png` |
| Wildcard | `wildcard.png` |
| Lynn Vision | `lynnvision.png` |
| Imperial | `imperial.png` |
| FlyQuest | `flyquest.png` |
| 9z | `9z.png` |
| DENDELE | `dendele.png` |
| BC.Game | `bcgame.png` |
| Chinggis Warriors | `chinggiswarriors.png` |
| Spirit | `spirit.png` |
| Vitality | `vitality.png` |
| FURIA | `furia.png` |
| MOUZ | `mouz.png` |
| Aurora | `aurora.png` |
| Falcons | `falcons.png` |
| Legacy | `legacy.png` |
| BetBoom | `betboom.png` |
| FUT | `fut.png` |
| NAVI | `navi.png` |
| 1win | `1win.png` |
| MIBR | `mibr.png` |
| Nemiga | `nemiga.png` |
| G2 | `g2.png` |
| Astralis | `astralis.png` |
| The MongolZ | `themongolz.png` |

Se a tarefa diária cadastrar um time com nome diferente, o arquivo é o nome em minúsculas, só com letras e números.
