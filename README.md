# Task Manager API

![Testes](https://github.com/ViniciuscLemos/api-tarefas-nodejs/actions/workflows/testes.yml/badge.svg)

API REST de gerenciamento de tarefas com autenticação JWT e PostgreSQL. Cada usuário só acessa as próprias tarefas.

## Tecnologias
- **Node.js** + **Express** — servidor e roteamento
- **PostgreSQL** — banco de dados relacional
- **JWT (jsonwebtoken)** — autenticação stateless
- **bcryptjs** — hash seguro de senhas
- **node:test** + **supertest** — testes de integração com um PostgreSQL real
- **Docker Compose** — sobe API + banco com um comando

## O que você vai aprender com este projeto
- Como estruturar uma API REST em camadas (routes → middlewares → controllers → database)
- Autenticação com JWT: geração e validação de tokens
- Como usar middlewares no Express (autenticação, validação de parâmetros, erros)
- Queries parametrizadas para evitar SQL Injection — inclusive no `ORDER BY`
- Paginação com `LIMIT/OFFSET` e `COUNT(*) OVER ()`
- Agregações com `COUNT(*) FILTER (WHERE ...)`
- Boas práticas de segurança (nunca salvar senha em texto puro, mensagens genéricas no login)
- Testes de integração de uma API de verdade

## Como rodar

### Opção 1 — Docker (mais fácil)
```bash
docker compose up --build
```
A API sobe em `http://localhost:3000` com o banco já criado.

### Opção 2 — Local
Pré-requisitos: Node.js 18+ e PostgreSQL rodando.

```bash
npm install

# Banco de dados (o script pode ser executado mais de uma vez)
psql -U postgres -c "CREATE DATABASE tarefas_db;"
psql -U postgres -d tarefas_db -f config/schema.sql

# Variáveis de ambiente
cp .env.example .env      # edite com suas credenciais e um JWT_SECRET

npm run dev   # com auto-reload (desenvolvimento)
npm start     # sem auto-reload (produção)
```

## Testes
```bash
npm test
```
Não precisa ter PostgreSQL instalado: os testes sobem um PostgreSQL temporário automaticamente (pacote `embedded-postgres`). No GitHub Actions, rodam contra um container PostgreSQL em Node 20 e 22.

Cobrem: registro/login, proteção das rotas, CRUD, validações, isolamento entre usuários, filtros, busca, ordenação e paginação.

## Endpoints

### Autenticação
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/registro` | Cria um novo usuário |
| POST | `/api/auth/login` | Faz login e retorna o token |
| GET | `/api/auth/me` | Dados do usuário logado 🔒 |

### Tarefas 🔒 (requerem token JWT no header)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/tarefas` | Lista as tarefas do usuário (com filtros e paginação) |
| GET | `/api/tarefas/resumo` | Contagem de tarefas por status |
| GET | `/api/tarefas/:id` | Busca uma tarefa específica |
| POST | `/api/tarefas` | Cria uma nova tarefa |
| PUT | `/api/tarefas/:id` | Atualiza só os campos enviados |
| DELETE | `/api/tarefas/:id` | Remove uma tarefa |

### Como usar o token
Após o login, adicione o token em todas as requisições protegidas:
```
Authorization: Bearer <seu_token_aqui>
```

### Exemplos de requisição

**Registro:**
```json
POST /api/auth/registro
{
  "nome": "João Silva",
  "email": "joao@email.com",
  "senha": "123456"
}
```

**Criar tarefa:**
```json
POST /api/tarefas
{
  "titulo": "Estudar Node.js",
  "descricao": "Ver módulo de Express",
  "prioridade": "alta"
}
```

**Concluir tarefa (atualização parcial):**
```json
PUT /api/tarefas/1
{ "concluida": true }
```

**Listar com filtros:**
```
GET /api/tarefas?concluida=false&prioridade=alta&busca=node&ordem=prioridade&pagina=1&limite=20
```

| Parâmetro | Valores |
|-----------|---------|
| `concluida` | `true` / `false` |
| `prioridade` | `baixa` / `media` / `alta` |
| `busca` | texto procurado no título ou na descrição |
| `ordem` | `recente` (padrão), `antiga`, `prioridade`, `titulo` |
| `pagina` | a partir de 1 |
| `limite` | 1 a 100 (padrão 20) |

**Resposta:**
```json
{
  "total": 42,
  "pagina": 1,
  "limite": 20,
  "total_paginas": 3,
  "tarefas": [ ... ]
}
```

## Estrutura do projeto
```
src/
├── server.js              # Inicia o servidor (listen, conexão, encerramento)
├── app.js                 # Configuração do Express (usada também nos testes)
├── routes/
│   └── index.js           # Definição de todas as rotas
├── controllers/
│   ├── authController.js  # Registro, login e /me
│   └── tarefasController.js # CRUD, filtros e resumo
└── middleware/
    ├── auth.js            # Validação do token JWT
    └── validarId.js       # Validação do :id da URL
config/
├── database.js            # Pool de conexão com o PostgreSQL
└── schema.sql             # Script de criação das tabelas
tests/
├── banco-de-teste.js      # Sobe um PostgreSQL temporário
└── api.test.js            # Testes de integração
```
