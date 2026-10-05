-- ============================================
-- Schema do banco de dados - API de Tarefas
-- Execute este arquivo antes de iniciar a API
-- Pode ser executado mais de uma vez sem erro.
-- ============================================

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id        SERIAL PRIMARY KEY,
  nome      VARCHAR(100) NOT NULL,
  email     VARCHAR(150) UNIQUE NOT NULL,
  senha     VARCHAR(255) NOT NULL,         -- armazena o hash bcrypt
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Tabela de tarefas
-- Cada tarefa pertence a um usuário (chave estrangeira)
CREATE TABLE IF NOT EXISTS tarefas (
  id          SERIAL PRIMARY KEY,
  titulo      VARCHAR(200) NOT NULL,
  descricao   TEXT,
  concluida   BOOLEAN DEFAULT FALSE,
  prioridade  VARCHAR(10) CHECK (prioridade IN ('baixa', 'media', 'alta')) DEFAULT 'media',
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em   TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

-- Index para acelerar buscas por usuário
CREATE INDEX IF NOT EXISTS idx_tarefas_usuario ON tarefas(usuario_id);

-- Função que atualiza o campo atualizado_em automaticamente
CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger que chama a função acima antes de qualquer UPDATE na tabela tarefas
-- (DROP antes do CREATE para o script poder ser executado novamente)
DROP TRIGGER IF EXISTS trigger_atualizar_tarefas ON tarefas;
CREATE TRIGGER trigger_atualizar_tarefas
  BEFORE UPDATE ON tarefas
  FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();
