import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createKartServer } from '../server.mjs';

test('web accounts persist session identity with HttpOnly cookies and reject bad credentials', async () => {
  const server = createKartServer({ databasePath: ':memory:' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (route, value, headers = {}) => fetch(base + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(value),
  });
  try {
    assert.equal((await fetch(base + '/')).status, 200);
    assert.equal((await fetch(base + '/api/auth/me')).status, 200);
    const registration = await post('/api/auth/register', {
      handle: 'test_rider', password: 'correct horse 123',
    });
    assert.equal(registration.status, 200);
    const cookie = registration.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly; SameSite=Strict/);
    assert.equal((await registration.json()).user.handle, 'test_rider');
    assert.equal((await (await fetch(base + '/api/auth/me', {
      headers: { Cookie: cookie.split(';')[0] },
    })).json()).user.handle, 'test_rider');
    assert.equal((await post('/api/auth/register', {
      handle: 'test_rider', password: 'another password',
    })).status, 409);
    assert.equal((await post('/api/auth/login', {
      handle: 'test_rider', password: 'incorrect password',
    })).status, 401);
    assert.equal((await post('/api/auth/login', {
      handle: 'test_rider', password: 'correct horse 123',
    })).status, 200);
    assert.equal((await post('/api/auth/login', {
      handle: 'test_rider', password: 'correct horse 123',
    }, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await post('/api/auth/logout', {}, {
      Cookie: cookie.split(';')[0],
    })).status, 200);
    assert.equal((await (await fetch(base + '/api/auth/me', {
      headers: { Cookie: cookie.split(';')[0] },
    })).json()).user, null);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
