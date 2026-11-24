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
Na aba **Admin > Logos dos times**, toque em **Enviar** ao lado do time e escolha a imagem.
Ela é reduzida para 256 px, salva no Supabase (pasta "logos") e aparece acima do nome do time.

## Administradores
Na aba **Admin > Administradores**, adicione o e-mail de quem também pode cadastrar partidas,
lançar resultados e trocar logos. A pessoa entra no site com esse e-mail. O último admin não pode ser removido.

## Atualização de 24/11 (rodar uma vez)
Se o banco foi criado antes desta versão, rode `atualizacao-admins-logos.sql` no SQL Editor.
