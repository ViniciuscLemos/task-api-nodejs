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
