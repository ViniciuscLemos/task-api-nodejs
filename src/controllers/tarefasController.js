const pool = require('../../config/database');

// Controller de Tarefas
// Todas as rotas aqui passam pelo middleware de autenticação
// Por isso, req.usuario sempre existe e contém { id, email }

// GET /tarefas
async function listar(req, res) {
  const { concluida, prioridade, ordem } = req.query;

  // Monta a query dinamicamente com filtros opcionais
  let query = 'SELECT * FROM tarefas WHERE usuario_id = $1';
  const params = [req.usuario.id];
  let paramIndex = 2;

  if (concluida !== undefined) {
    query += ` AND concluida = $${paramIndex}`;
    params.push(concluida === 'true');
    paramIndex++;
  }

  if (prioridade) {
    query += ` AND prioridade = $${paramIndex}`;
    params.push(prioridade);
    paramIndex++;
  }

  // Ordenação: padrão por data de criação
  const ordens = { recente: 'criado_em DESC', antiga: 'criado_em ASC', prioridade: 'prioridade DESC' };
  query += ` ORDER BY ${ordens[ordem] || 'criado_em DESC'}`;

  try {
    const resultado = await pool.query(query, params);
    return res.json({ total: resultado.rows.length, tarefas: resultado.rows });
  } catch (err) {
    console.error('Erro ao listar tarefas:', err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

// GET /tarefas/:id
async function buscarPorId(req, res) {
  const { id } = req.params;

  try {
    const resultado = await pool.query(
      // Filtra por id E por usuario_id para garantir que o usuário só acessa as próprias tarefas
      'SELECT * FROM tarefas WHERE id = $1 AND usuario_id = $2',
      [id, req.usuario.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Tarefa não encontrada' });
    }

    return res.json(resultado.rows[0]);
  } catch (err) {
    console.error('Erro ao buscar tarefa:', err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

// POST /tarefas
async function criar(req, res) {
  const { titulo, descricao, prioridade } = req.body;

  if (!titulo) {
    return res.status(400).json({ erro: 'O título da tarefa é obrigatório' });
  }

  const prioridadesValidas = ['baixa', 'media', 'alta'];
  if (prioridade && !prioridadesValidas.includes(prioridade)) {
    return res.status(400).json({ erro: 'Prioridade deve ser: baixa, media ou alta' });
  }

  try {
    const resultado = await pool.query(
      `INSERT INTO tarefas (titulo, descricao, prioridade, usuario_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [titulo, descricao || null, prioridade || 'media', req.usuario.id]
    );

    return res.status(201).json(resultado.rows[0]);
  } catch (err) {
    console.error('Erro ao criar tarefa:', err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

// PUT /tarefas/:id
async function atualizar(req, res) {
  const { id } = req.params;
  const { titulo, descricao, concluida, prioridade } = req.body;

  try {
    // Verifica se a tarefa existe e pertence ao usuário
    const tarefa = await pool.query(
      'SELECT * FROM tarefas WHERE id = $1 AND usuario_id = $2',
      [id, req.usuario.id]
    );

    if (tarefa.rows.length === 0) {
      return res.status(404).json({ erro: 'Tarefa não encontrada' });
    }

    // Usa os valores atuais se não forem enviados novos (COALESCE)
    const atual = tarefa.rows[0];
    const resultado = await pool.query(
      `UPDATE tarefas
       SET titulo = $1, descricao = $2, concluida = $3, prioridade = $4
       WHERE id = $5 AND usuario_id = $6
       RETURNING *`,
      [
        titulo ?? atual.titulo,
        descricao ?? atual.descricao,
        concluida ?? atual.concluida,
        prioridade ?? atual.prioridade,
        id,
        req.usuario.id,
      ]
    );

    return res.json(resultado.rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar tarefa:', err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

// DELETE /tarefas/:id
async function remover(req, res) {
  const { id } = req.params;

  try {
    const resultado = await pool.query(
      'DELETE FROM tarefas WHERE id = $1 AND usuario_id = $2 RETURNING id',
      [id, req.usuario.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Tarefa não encontrada' });
    }

    // 204 No Content: sucesso sem corpo de resposta
    return res.status(204).send();
  } catch (err) {
    console.error('Erro ao remover tarefa:', err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { listar, buscarPorId, criar, atualizar, remover };
