# Task Manager API
API REST de gerenciamento de tarefas com autenticação JWT e PostgreSQL.

API de gerenciamento de tarefas com autenticação JWT. Cada usuário só acessa as próprias tarefas.

## Tecnologias
- **Node.js** + **Express** — servidor e roteamento
- **PostgreSQL** — banco de dados relacional
- **JWT (jsonwebtoken)** — autenticação stateless
- **bcryptjs** — hash seguro de senhas

## O que você vai aprender com este projeto
- Como estruturar uma API REST em camadas (routes → controllers → database)
- Autenticação com JWT: geração e validação de tokens
- Como usar middlewares no Express
- Queries parametrizadas para evitar SQL Injection
- Boas práticas de segurança (nunca salvar senha em texto puro)

## Pré-requisitos
- Node.js 18+
- PostgreSQL instalado e rodando

## Como rodar

### 1. Instale as dependências
```bash
npm install
```

### 2. Configure o banco de dados
Crie um banco chamado `tarefas_db` no PostgreSQL e execute o schema:
```bash
psql -U postgres -c "CREATE DATABASE tarefas_db;"
psql -U postgres -d tarefas_db -f config/schema.sql
```

### 3. Configure as variáveis de ambiente
```bash
cp .env.example .env
# Edite o arquivo .env com suas credenciais
```

### 4. Inicie o servidor
```bash
npm run dev   # com auto-reload (desenvolvimento)
npm start     # sem auto-reload (produção)
```

## Endpoints

### Autenticação
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/registro` | Cria um novo usuário |
| POST | `/api/auth/login` | Faz login e retorna o token |

### Tarefas (requerem token JWT no header)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/tarefas` | Lista todas as tarefas do usuário |
| GET | `/api/tarefas/:id` | Busca uma tarefa específica |
| POST | `/api/tarefas` | Cria uma nova tarefa |
| PUT | `/api/tarefas/:id` | Atualiza uma tarefa |
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

**Filtrar tarefas:**
```
GET /api/tarefas?concluida=false&prioridade=alta&ordem=recente
```

## Estrutura do projeto
```
src/
├── server.js              # Ponto de entrada da aplicação
├── routes/
│   └── index.js           # Definição de todas as rotas
├── controllers/
│   ├── authController.js  # Lógica de registro e login
│   └── tarefasController.js # CRUD de tarefas
└── middleware/
    └── auth.js            # Validação do token JWT
config/
├── database.js            # Pool de conexão com o PostgreSQL
└── schema.sql             # Script de criação das tabelas
```
