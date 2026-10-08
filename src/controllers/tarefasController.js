const pool = require('../../config/database');

// todas as rotas daqui passam pelo autenticar, então req.usuario sempre existe

const PRIORIDADES = ['baixa', 'media', 'alta'];
const TITULO_MAX = 200;

// o usuário só escolhe uma chave daqui, o texto dele nunca vai pro ORDER BY.
// prioridade usa CASE porque em ordem alfabética 'media' viria antes de 'alta'
const ORDENS = {
  recente: 'criado_em DESC',
  antiga: 'criado_em ASC',
  prioridade: "CASE prioridade WHEN 'alta' THEN 3 WHEN 'media' THEN 2 ELSE 1 END DESC, criado_em DESC",
  titulo: 'titulo ASC',
};

// devolve a mensagem de erro ou null. No PUT (parcial) os campos são opcionais
function validarTarefa(body, parcial) {
  const { titulo, descricao, concluida, prioridade } = body;

  if (!parcial || titulo !== undefined) {
    if (typeof titulo !== 'string' || !titulo.trim()) {
      return 'O título da tarefa é obrigatório';
    }
    if (titulo.trim().length > TITULO_MAX) {
      return `O título deve ter no máximo ${TITULO_MAX} caracteres`;
    }
  }
  if (descricao !== undefined && descricao !== null && typeof descricao !== 'string') {
    return 'A descrição deve ser um texto';
  }
  if (concluida !== undefined && typeof concluida !== 'boolean') {
    return 'O campo concluida deve ser true ou false';
  }
  if (prioridade !== undefined && !PRIORIDADES.includes(prioridade)) {
    return 'Prioridade deve ser: baixa, media ou alta';
  }
  return null;
}

// GET /tarefas?concluida=false&prioridade=alta&busca=estudar&ordem=prioridade&pagina=1&limite=20
async function listar(req, res) {
  const { concluida, prioridade, ordem, busca } = req.query;

  if (concluida !== undefined && !['true', 'false'].includes(concluida)) {
    return res.status(400).json({ erro: 'Filtro concluida deve ser true ou false' });
  }
  if (prioridade !== undefined && !PRIORIDADES.includes(prioridade)) {
    return res.status(400).json({ erro: 'Prioridade deve ser: baixa, media ou alta' });
  }
  // ?busca=a&busca=b vira array no Express
  if (busca !== undefined && typeof busca !== 'string') {
    return res.status(400).json({ erro: 'Busca deve ser um texto só' });
  }
  if (ordem !== undefined && !ORDENS[ordem]) {
    return res.status(400).json({ erro: `Ordem deve ser: ${Object.keys(ORDENS).join(', ')}` });
  }

  const pagina = Math.max(parseInt(req.query.pagina, 10) || 1, 1);
  const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 20, 1), 100);

  let filtros = 'WHERE usuario_id = $1';
  const params = [req.usuario.id];

  if (concluida !== undefined) {
    params.push(concluida === 'true');
    filtros += ` AND concluida = $${params.length}`;
  }

  if (prioridade) {
    params.push(prioridade);
    filtros += ` AND prioridade = $${params.length}`;
  }

  if (busca) {
    // % e _ são curingas no ILIKE: sem escapar, buscar "100%" trazia qualquer tarefa com "100"
    const literal = busca.replace(/[\\%_]/g, '\\$&');
    params.push(`%${literal}%`);
    filtros += ` AND (titulo ILIKE $${params.length} OR descricao ILIKE $${params.length})`;
  }

  try {
    // COUNT(*) OVER () traz o total junto, aí não precisa de outra query pra paginação
    const resultado = await pool.query(
      `SELECT *, COUNT(*) OVER () AS total_filtrado
       FROM tarefas ${filtros}
       ORDER BY ${ORDENS[ordem] || ORDENS.recente}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limite, (pagina - 1) * limite]
    );

    const total = resultado.rows.length ? Number(resultado.rows[0].total_filtrado) : 0;
    const tarefas = resultado.rows.map(({ total_filtrado, ...tarefa }) => tarefa);

    return res.json({
      total,
      pagina,
      limite,
      total_paginas: Math.ceil(total / limite),
      tarefas,
    });
  } catch (err) {
    console.error('Erro ao listar tarefas:', err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

// GET /tarefas/resumo
async function resumo(req, res) {
  try {
    const resultado = await pool.query(
      `SELECT
         COUNT(*)                                         AS total,
         COUNT(*) FILTER (WHERE concluida)                AS concluidas,
         COUNT(*) FILTER (WHERE NOT concluida)            AS pendentes,
         COUNT(*) FILTER (WHERE NOT concluida AND prioridade = 'alta') AS pendentes_alta
       FROM tarefas WHERE usuario_id = $1`,
      [req.usuario.id]
    );

    // o pg devolve COUNT como string
    const linha = resultado.rows[0];
    const dados = Object.fromEntries(Object.entries(linha).map(([k, v]) => [k, Number(v)]));
    return res.json(dados);
  } catch (err) {
    console.error('Erro ao gerar resumo:', err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

// GET /tarefas/:id
async function buscarPorId(req, res) {
  const { id } = req.params;

  try {
    const resultado = await pool.query(
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
  const erro = validarTarefa(req.body, false);
  if (erro) {
    return res.status(400).json({ erro });
  }

  const { titulo, descricao, prioridade } = req.body;

  try {
    const resultado = await pool.query(
      `INSERT INTO tarefas (titulo, descricao, prioridade, usuario_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [titulo.trim(), descricao || null, prioridade || 'media', req.usuario.id]
    );

    return res.status(201).json(resultado.rows[0]);
  } catch (err) {
    console.error('Erro ao criar tarefa:', err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

// PUT /tarefas/:id (só os campos enviados)
async function atualizar(req, res) {
  const { id } = req.params;

  const erro = validarTarefa(req.body, true);
  if (erro) {
    return res.status(400).json({ erro });
  }

  const { titulo, descricao, concluida, prioridade } = req.body;

  try {
    // COALESCE mantém o valor atual quando o campo não veio.
    // descricao é separada porque dá pra apagar mandando null
    const resultado = await pool.query(
      `UPDATE tarefas
       SET titulo     = COALESCE($1, titulo),
           descricao  = CASE WHEN $2 THEN $3 ELSE descricao END,
           concluida  = COALESCE($4, concluida),
           prioridade = COALESCE($5, prioridade)
       WHERE id = $6 AND usuario_id = $7
       RETURNING *`,
      [
        titulo !== undefined ? titulo.trim() : null,
        descricao !== undefined,
        descricao ?? null,
        concluida ?? null,
        prioridade ?? null,
        id,
        req.usuario.id,
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Tarefa não encontrada' });
    }

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

    return res.status(204).send();
  } catch (err) {
    console.error('Erro ao remover tarefa:', err);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { listar, resumo, buscarPorId, criar, atualizar, remover };
