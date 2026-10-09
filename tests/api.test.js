const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { startDatabase } = require('./test-db');

let db;
let app;

before(async () => {
  db = await startDatabase();
  app = require('../src/app');
}, { timeout: 120_000 });

after(async () => {
  await db?.stop();
});

beforeEach(async () => {
  await db.clear();
});

async function register(email = 'ana@email.com', name = 'Ana') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: '123456' });
  assert.equal(res.status, 201);
  return res.body.token;
}

function withToken(token) {
  return {
    get: (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url, body) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body),
    put: (url, body) => request(app).put(url).set('Authorization', `Bearer ${token}`).send(body),
    delete: (url) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
  };
}

describe('health and general errors', () => {
  it('GET / answers ok', async () => {
    const res = await request(app).get('/');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  it('unknown route returns 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    assert.equal(res.status, 404);
  });

  it('malformed JSON returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    assert.equal(res.status, 400);
  });
});

describe('authentication', () => {
  it('registers, logs in and checks /auth/me', async () => {
    await register('Ana@Email.com');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@email.com', password: '123456' });
    assert.equal(login.status, 200);
    assert.ok(login.body.token);
    assert.equal(login.body.user.password, undefined);

    const me = await withToken(login.body.token).get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.email, 'ana@email.com');
  });

  it('rejects a duplicate email (case insensitive)', async () => {
    await register('ana@email.com');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Someone else', email: 'ANA@email.com', password: '123456' });
    assert.equal(res.status, 409);
  });

  it('validates register fields', async () => {
    const cases = [
      [{ email: 'a@b.com', password: '123456' }, 'Name, email and password are required'],
      [{ name: 'A', email: 'invalid', password: '123456' }, 'Invalid email'],
      [{ name: 'A', email: 'a@b.com', password: '123' }, 'Password must have at least 6 characters'],
    ];
    for (const [body, error] of cases) {
      const res = await request(app).post('/api/auth/register').send(body);
      assert.equal(res.status, 400);
      assert.equal(res.body.error, error);
    }
  });

  it('login with the wrong password returns 401', async () => {
    await register();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@email.com', password: 'wrong' });
    assert.equal(res.status, 401);
  });

  it('protected routes need a valid token', async () => {
    assert.equal((await request(app).get('/api/tasks')).status, 401);
    assert.equal((await withToken('fake-token').get('/api/tasks')).status, 401);
    const noBearer = await request(app).get('/api/tasks').set('Authorization', 'abc');
    assert.equal(noBearer.status, 401);
  });
});

describe('tasks', () => {
  it('full CRUD', async () => {
    const api = withToken(await register());

    const created = await api.post('/api/tasks', { title: '  Study Node  ', priority: 'high' });
    assert.equal(created.status, 201);
    assert.equal(created.body.title, 'Study Node');
    assert.equal(created.body.completed, false);
    const id = created.body.id;

    const fetched = await api.get(`/api/tasks/${id}`);
    assert.equal(fetched.status, 200);

    // only completed changes
    const updated = await api.put(`/api/tasks/${id}`, { completed: true });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.completed, true);
    assert.equal(updated.body.title, 'Study Node');
    assert.equal(updated.body.priority, 'high');

    await api.put(`/api/tasks/${id}`, { description: 'temporary' });
    const noDescription = await api.put(`/api/tasks/${id}`, { description: null });
    assert.equal(noDescription.body.description, null);

    assert.equal((await api.delete(`/api/tasks/${id}`)).status, 204);
    assert.equal((await api.get(`/api/tasks/${id}`)).status, 404);
  });

  it('validates task data', async () => {
    const api = withToken(await register());
    assert.equal((await api.post('/api/tasks', {})).status, 400);
    assert.equal((await api.post('/api/tasks', { title: '   ' })).status, 400);
    assert.equal((await api.post('/api/tasks', { title: 'x'.repeat(201) })).status, 400);
    assert.equal((await api.post('/api/tasks', { title: 'A', priority: 'urgent' })).status, 400);

    const { body } = await api.post('/api/tasks', { title: 'A' });
    assert.equal((await api.put(`/api/tasks/${body.id}`, { priority: 'urgent' })).status, 400);
    assert.equal((await api.put(`/api/tasks/${body.id}`, { completed: 'yes' })).status, 400);
  });

  it('invalid ID returns 400 instead of a 500 error', async () => {
    const api = withToken(await register());
    assert.equal((await api.get('/api/tasks/abc')).status, 400);
    assert.equal((await api.delete('/api/tasks/-1')).status, 400);
  });

  it("a user can't access someone else's tasks", async () => {
    const ana = withToken(await register('ana@email.com'));
    const bia = withToken(await register('bia@email.com', 'Bia'));

    const { body } = await ana.post('/api/tasks', { title: "Ana's" });

    assert.equal((await bia.get(`/api/tasks/${body.id}`)).status, 404);
    assert.equal((await bia.put(`/api/tasks/${body.id}`, { title: 'stolen' })).status, 404);
    assert.equal((await bia.delete(`/api/tasks/${body.id}`)).status, 404);
    assert.equal((await bia.get('/api/tasks')).body.total, 0);
  });

  it('filters, searches, sorts by priority and paginates', async () => {
    const api = withToken(await register());
    await api.post('/api/tasks', { title: 'Medium', priority: 'medium' });
    await api.post('/api/tasks', { title: 'Low', priority: 'low' });
    await api.post('/api/tasks', { title: 'High', priority: 'high', description: 'study SQL' });

    const sorted = await api.get('/api/tasks?sort=priority');
    assert.deepEqual(sorted.body.tasks.map((t) => t.title), ['High', 'Medium', 'Low']);

    const search = await api.get('/api/tasks?search=sql');
    assert.deepEqual(search.body.tasks.map((t) => t.title), ['High']);

    const filtered = await api.get('/api/tasks?priority=low');
    assert.equal(filtered.body.total, 1);

    const page2 = await api.get('/api/tasks?sort=title&limit=2&page=2');
    assert.equal(page2.body.total, 3);
    assert.equal(page2.body.total_pages, 2);
    assert.deepEqual(page2.body.tasks.map((t) => t.title), ['Medium']);

    assert.equal((await api.get('/api/tasks?sort=;DROP TABLE')).status, 400);
    assert.equal((await api.get('/api/tasks?completed=maybe')).status, 400);
  });

  it('search treats % and _ as plain text', async () => {
    const api = withToken(await register());
    await api.post('/api/tasks', { title: 'Battery at 100%' });
    await api.post('/api/tasks', { title: 'Got 100 on the exam' });
    await api.post('/api/tasks', { title: 'rename file_final' });
    await api.post('/api/tasks', { title: 'file final' });

    const percent = await api.get(`/api/tasks?search=${encodeURIComponent('100%')}`);
    assert.deepEqual(percent.body.tasks.map((t) => t.title), ['Battery at 100%']);

    const underscore = await api.get('/api/tasks?search=file_');
    assert.deepEqual(underscore.body.tasks.map((t) => t.title), ['rename file_final']);

    assert.equal((await api.get('/api/tasks?search=a&search=b')).status, 400);
  });

  it('summary counts tasks by status', async () => {
    const api = withToken(await register());
    const { body } = await api.post('/api/tasks', { title: 'A', priority: 'high' });
    await api.post('/api/tasks', { title: 'B', priority: 'high' });
    await api.post('/api/tasks', { title: 'C' });
    await api.put(`/api/tasks/${body.id}`, { completed: true });

    const res = await api.get('/api/tasks/summary');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { total: 3, completed: 1, pending: 2, pending_high: 1 });
  });
});

describe('attempt limit', () => {
  it('blocks the IP after too many login attempts', async () => {
    // separate app with a limit of 3, so it doesn't depend on the high limit used in the other tests
    const express = require('express');
    const loginLimiter = require('../src/middleware/loginLimiter');
    const limitedApp = express();
    limitedApp.post('/login', loginLimiter(3), (req, res) => res.status(401).json({ error: 'wrong password' }));

    for (let i = 0; i < 3; i++) {
      assert.equal((await request(limitedApp).post('/login')).status, 401);
    }
    const blocked = await request(limitedApp).post('/login');
    assert.equal(blocked.status, 429);
    assert.match(blocked.body.error, /Too many attempts/);
  });
});
