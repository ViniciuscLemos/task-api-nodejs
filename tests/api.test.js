const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { iniciarBanco } = require('./banco-de-teste');

let banco;
let app;

before(async () => {
  banco = await iniciarBanco();
  app = require('../src/app');
}, { timeout: 120_000 });

after(async () => {
  await banco?.parar();
});

beforeEach(async () => {
  await banco.limpar();
});

async function registrar(email = 'ana@email.com', nome = 'Ana') {
  const res = await request(app)
    .post('/api/auth/registro')
    .send({ nome, email, senha: '123456' });
  assert.equal(res.status, 201);
  return res.body.token;
}

function comToken(token) {
  return {
    get: (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url, body) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body),
    put: (url, body) => request(app).put(url).set('Authorization', `Bearer ${token}`).send(body),
    delete: (url) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
  };
}

describe('saúde e erros gerais', () => {
  it('GET / responde ok', async () => {
    const res = await request(app).get('/');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  it('rota inexistente devolve 404', async () => {
    const res = await request(app).get('/api/nao-existe');
    assert.equal(res.status, 404);
  });

  it('JSON malformado devolve 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    assert.equal(res.status, 400);
  });
});

describe('autenticação', () => {
  it('registra, faz login e consulta /auth/me', async () => {
    await registrar('Ana@Email.com');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@email.com', senha: '123456' });
    assert.equal(login.status, 200);
    assert.ok(login.body.token);
    assert.equal(login.body.usuario.senha, undefined);

    const me = await comToken(login.body.token).get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.email, 'ana@email.com');
  });

  it('recusa e-mail duplicado (sem diferenciar maiúsculas)', async () => {
    await registrar('ana@email.com');
    const res = await request(app)
      .post('/api/auth/registro')
      .send({ nome: 'Outra', email: 'ANA@email.com', senha: '123456' });
    assert.equal(res.status, 409);
  });

  it('valida campos do registro', async () => {
    const casos = [
      [{ email: 'a@b.com', senha: '123456' }, 'Nome, email e senha são obrigatórios'],
      [{ nome: 'A', email: 'invalido', senha: '123456' }, 'Email inválido'],
      [{ nome: 'A', email: 'a@b.com', senha: '123' }, 'A senha deve ter pelo menos 6 caracteres'],
    ];
    for (const [body, erro] of casos) {
      const res = await request(app).post('/api/auth/registro').send(body);
      assert.equal(res.status, 400);
      assert.equal(res.body.erro, erro);
    }
  });

  it('login com senha errada devolve 401', async () => {
    await registrar();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@email.com', senha: 'errada' });
    assert.equal(res.status, 401);
  });

  it('rotas protegidas exigem token válido', async () => {
    assert.equal((await request(app).get('/api/tarefas')).status, 401);
    assert.equal((await comToken('token-falso').get('/api/tarefas')).status, 401);
    const semBearer = await request(app).get('/api/tarefas').set('Authorization', 'abc');
    assert.equal(semBearer.status, 401);
  });
});

describe('tarefas', () => {
  it('CRUD completo', async () => {
    const api = comToken(await registrar());

    const criada = await api.post('/api/tarefas', { titulo: '  Estudar Node  ', prioridade: 'alta' });
    assert.equal(criada.status, 201);
    assert.equal(criada.body.titulo, 'Estudar Node');
    assert.equal(criada.body.concluida, false);
    const id = criada.body.id;

    const buscada = await api.get(`/api/tarefas/${id}`);
    assert.equal(buscada.status, 200);

    // só o concluida muda
    const atualizada = await api.put(`/api/tarefas/${id}`, { concluida: true });
    assert.equal(atualizada.status, 200);
    assert.equal(atualizada.body.concluida, true);
    assert.equal(atualizada.body.titulo, 'Estudar Node');
    assert.equal(atualizada.body.prioridade, 'alta');

    await api.put(`/api/tarefas/${id}`, { descricao: 'temporária' });
    const semDescricao = await api.put(`/api/tarefas/${id}`, { descricao: null });
    assert.equal(semDescricao.body.descricao, null);

    assert.equal((await api.delete(`/api/tarefas/${id}`)).status, 204);
    assert.equal((await api.get(`/api/tarefas/${id}`)).status, 404);
  });

  it('valida dados da tarefa', async () => {
    const api = comToken(await registrar());
    assert.equal((await api.post('/api/tarefas', {})).status, 400);
    assert.equal((await api.post('/api/tarefas', { titulo: '   ' })).status, 400);
    assert.equal((await api.post('/api/tarefas', { titulo: 'x'.repeat(201) })).status, 400);
    assert.equal((await api.post('/api/tarefas', { titulo: 'A', prioridade: 'urgente' })).status, 400);

    const { body } = await api.post('/api/tarefas', { titulo: 'A' });
    assert.equal((await api.put(`/api/tarefas/${body.id}`, { prioridade: 'urgente' })).status, 400);
    assert.equal((await api.put(`/api/tarefas/${body.id}`, { concluida: 'sim' })).status, 400);
  });

  it('ID inválido devolve 400 em vez de erro 500', async () => {
    const api = comToken(await registrar());
    assert.equal((await api.get('/api/tarefas/abc')).status, 400);
    assert.equal((await api.delete('/api/tarefas/-1')).status, 400);
  });

  it('um usuário não acessa tarefas de outro', async () => {
    const ana = comToken(await registrar('ana@email.com'));
    const bia = comToken(await registrar('bia@email.com', 'Bia'));

    const { body } = await ana.post('/api/tarefas', { titulo: 'Da Ana' });

    assert.equal((await bia.get(`/api/tarefas/${body.id}`)).status, 404);
    assert.equal((await bia.put(`/api/tarefas/${body.id}`, { titulo: 'roubada' })).status, 404);
    assert.equal((await bia.delete(`/api/tarefas/${body.id}`)).status, 404);
    assert.equal((await bia.get('/api/tarefas')).body.total, 0);
  });

  it('filtra, busca, ordena por prioridade e pagina', async () => {
    const api = comToken(await registrar());
    await api.post('/api/tarefas', { titulo: 'Média', prioridade: 'media' });
    await api.post('/api/tarefas', { titulo: 'Baixa', prioridade: 'baixa' });
    await api.post('/api/tarefas', { titulo: 'Alta', prioridade: 'alta', descricao: 'estudar SQL' });

    const ordenadas = await api.get('/api/tarefas?ordem=prioridade');
    assert.deepEqual(ordenadas.body.tarefas.map((t) => t.titulo), ['Alta', 'Média', 'Baixa']);

    const busca = await api.get('/api/tarefas?busca=sql');
    assert.deepEqual(busca.body.tarefas.map((t) => t.titulo), ['Alta']);

    const filtradas = await api.get('/api/tarefas?prioridade=baixa');
    assert.equal(filtradas.body.total, 1);

    const pagina2 = await api.get('/api/tarefas?ordem=titulo&limite=2&pagina=2');
    assert.equal(pagina2.body.total, 3);
    assert.equal(pagina2.body.total_paginas, 2);
    assert.deepEqual(pagina2.body.tarefas.map((t) => t.titulo), ['Média']);

    assert.equal((await api.get('/api/tarefas?ordem=;DROP TABLE')).status, 400);
    assert.equal((await api.get('/api/tarefas?concluida=talvez')).status, 400);
  });

  it('busca trata % e _ como texto normal', async () => {
    const api = comToken(await registrar());
    await api.post('/api/tarefas', { titulo: 'Bateria em 100%' });
    await api.post('/api/tarefas', { titulo: 'Nota 100 na prova' });
    await api.post('/api/tarefas', { titulo: 'renomear arquivo_final' });
    await api.post('/api/tarefas', { titulo: 'arquivo final' });

    const porcento = await api.get(`/api/tarefas?busca=${encodeURIComponent('100%')}`);
    assert.deepEqual(porcento.body.tarefas.map((t) => t.titulo), ['Bateria em 100%']);

    const sublinhado = await api.get('/api/tarefas?busca=arquivo_');
    assert.deepEqual(sublinhado.body.tarefas.map((t) => t.titulo), ['renomear arquivo_final']);

    assert.equal((await api.get('/api/tarefas?busca=a&busca=b')).status, 400);
  });

  it('resumo conta tarefas por status', async () => {
    const api = comToken(await registrar());
    const { body } = await api.post('/api/tarefas', { titulo: 'A', prioridade: 'alta' });
    await api.post('/api/tarefas', { titulo: 'B', prioridade: 'alta' });
    await api.post('/api/tarefas', { titulo: 'C' });
    await api.put(`/api/tarefas/${body.id}`, { concluida: true });

    const res = await api.get('/api/tarefas/resumo');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { total: 3, concluidas: 1, pendentes: 2, pendentes_alta: 1 });
  });
});
