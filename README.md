# API de Tarefas

![Testes](https://github.com/ViniciuscLemos/api-tarefas-nodejs/actions/workflows/testes.yml/badge.svg)

API REST de lista de tarefas com cadastro e login. Cada usuário só vê as próprias tarefas.

Feita com Node.js, Express e PostgreSQL. O login usa JWT e as senhas são salvas com hash (bcrypt).

## Rodando

O jeito mais fácil é com Docker, que já sobe o banco junto:

```bash
docker compose up --build
```

A API fica em http://localhost:3000.

Sem Docker, você precisa do Node 18+ e de um PostgreSQL rodando:

```bash
npm install
psql -U postgres -c "CREATE DATABASE tarefas_db;"
psql -U postgres -d tarefas_db -f config/schema.sql
cp .env.example .env   # e preenche com seus dados
npm run dev
```

## Testes

```bash
npm test
```

Os testes sobem um Postgres temporário sozinhos (pacote `embedded-postgres`), então não precisa ter o banco instalado pra rodar.

## Rotas

Login:
- `POST /api/auth/registro` cria uma conta
- `POST /api/auth/login` devolve o token
- `GET /api/auth/me` mostra o usuário logado

Tarefas (todas pedem o header `Authorization: Bearer <token>`):
- `GET /api/tarefas` lista as tarefas
- `GET /api/tarefas/resumo` mostra quantas estão concluídas e quantas estão pendentes
- `GET /api/tarefas/:id`
- `POST /api/tarefas`
- `PUT /api/tarefas/:id` (pode mandar só o campo que quer mudar)
- `DELETE /api/tarefas/:id`

A listagem aceita filtros pela URL, por exemplo:

```
GET /api/tarefas?concluida=false&prioridade=alta&busca=estudar&ordem=prioridade&pagina=1
```

`ordem` pode ser `recente`, `antiga`, `prioridade` ou `titulo`.

Exemplo de tarefa:

```json
{
  "titulo": "Estudar Node.js",
  "descricao": "Ver a parte de middlewares",
  "prioridade": "alta"
}
```

## Usando na prática

Cria a conta (a resposta já traz o token):

```bash
curl -X POST localhost:3000/api/auth/registro   -H "Content-Type: application/json"   -d '{"nome":"Vinicius","email":"vini@email.com","senha":"minhasenha"}'
```

```json
{
  "usuario": { "id": 1, "nome": "Vinicius", "email": "vini@email.com", "criado_em": "2026-10-08T12:53:57.402Z" },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Cria uma tarefa usando o token:

```bash
curl -X POST localhost:3000/api/tarefas   -H "Authorization: Bearer SEU_TOKEN"   -H "Content-Type: application/json"   -d '{"titulo":"Estudar Node.js","descricao":"Ver a parte de middlewares","prioridade":"alta"}'
```

```json
{
  "id": 1,
  "titulo": "Estudar Node.js",
  "descricao": "Ver a parte de middlewares",
  "concluida": false,
  "prioridade": "alta",
  "usuario_id": 1,
  "criado_em": "2026-10-08T12:53:57.418Z",
  "atualizado_em": "2026-10-08T12:53:57.418Z"
}
```

Depois de criar mais uma e marcar como concluída, o `GET /api/tarefas/resumo` fica assim:

```json
{ "total": 2, "concluidas": 1, "pendentes": 1, "pendentes_alta": 1 }
```

Essas respostas são de verdade, tirei rodando a API.

## Alguns cuidados que tomei

- Cada consulta filtra pelo `usuario_id` que vem do token, então não adianta trocar o id na URL pra ver tarefa de outra pessoa (tem teste pra isso).
- O `ORDER BY` nunca recebe texto do usuário: o parâmetro `ordem` só escolhe uma opção de uma lista fixa.
- Na busca, `%` e `_` são tratados como texto. Sem isso, buscar "100%" trazia qualquer tarefa com "100", porque no `ILIKE` eles são curingas.
- O login dá a mesma mensagem pra senha errada e pra e-mail que não existe, e demora o mesmo tempo nos dois casos. Senão dava pra descobrir quem tem conta medindo o tempo da resposta.
- E-mail repetido é barrado pela constraint `UNIQUE` do banco, e não por um `SELECT` antes do `INSERT`, que deixaria duas requisições ao mesmo tempo criarem a mesma conta.

## Estrutura

```
src/
  app.js          configuração do Express
  server.js       sobe o servidor
  routes/         rotas
  controllers/    lógica de login e de tarefas
  middleware/     validação do token e do id
config/
  database.js     conexão com o Postgres
  schema.sql      criação das tabelas
tests/
```
