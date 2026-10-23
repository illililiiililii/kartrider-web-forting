import { createServer } from 'node:http';
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { readFile, stat } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {createPlayerStore} from './player-store.mjs';
import {createMultiplayer} from './multiplayer-server.mjs';

const scrypt = promisify(scryptCallback);
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), 'web-preview');
const types = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.wasm', 'application/wasm'],
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.ogg', 'audio/ogg'], ['.ktrk', 'application/octet-stream'],
]);
const sessionAgeSeconds = 7 * 24 * 60 * 60;
const attempts = new Map();

function json(response, status, value, extraHeaders = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', ...extraHeaders,
  });
  response.end(JSON.stringify(value));
}

function limited(ip) {
  const now = Date.now();
  const entry = attempts.get(ip) ?? { start: now, count: 0 };
  if (now - entry.start > 10 * 60 * 1000) { entry.start = now; entry.count = 0; }
  entry.count++;
  attempts.set(ip, entry);
  return entry.count > 15;
}

async function bodyJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) throw new Error('BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('INVALID_JSON'); }
}

function cookieToken(request,name='kart_session') {
  const cookies=new Map((request.headers.cookie??'').split(';').map(value=>value.trim().split('=')));
  const token=cookies.get(name);
  return typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)?token:null;
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function createKartServer({
  root = webRoot,
  databasePath = resolve(webRoot, '..', 'local-data', 'accounts.sqlite'),
  secureCookies = false,
  catalogPath = resolve(webRoot,'assets','catalog.json'),
  now = Date.now,
  sessionCookieName = 'kart_session',
  multiplayerPhysicsFactory,
} = {}) {
  if(!/^[A-Za-z0-9_]+$/.test(sessionCookieName))throw new Error('Invalid session cookie name');
  const resolvedRoot = resolve(root);
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, handle TEXT NOT NULL UNIQUE COLLATE NOCASE,
      salt BLOB NOT NULL, password_hash BLOB NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      expires_at INTEGER NOT NULL
    );`);
  const findUser = database.prepare('SELECT id, handle, salt, password_hash FROM users WHERE handle = ?');
  const findSession = database.prepare(`SELECT users.id, users.handle FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?`);
  const addUser = database.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)');
  const addSession = database.prepare('INSERT INTO sessions VALUES (?, ?, ?)');
  const deleteSession = database.prepare('DELETE FROM sessions WHERE token_hash = ?');
  const players=createPlayerStore(database,{catalogPath,now});
  database.exec(`CREATE TABLE IF NOT EXISTS multiplayer_results(race_id TEXT NOT NULL,user_id TEXT NOT NULL,track TEXT NOT NULL,rank INTEGER,time_ms INTEGER,dnf INTEGER NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(race_id,user_id));`);
  const saveMultiplayerResult=database.prepare('INSERT OR IGNORE INTO multiplayer_results VALUES(?,?,?,?,?,?,?)');
  const multiplayer=createMultiplayer({players,root:resolvedRoot,catalogPath,now,createPhysics:multiplayerPhysicsFactory,
    recordResult:r=>saveMultiplayerResult.run(r.race,r.id,r.track,r.rank,r.time,+r.dnf,now())});
  // Existing login records gain persistent profiles without changing credentials.
  for(const user of database.prepare('SELECT id,handle FROM users').all())players.profile(user);

  function currentUser(request) {
    const token = cookieToken(request,sessionCookieName);
    return token ? findSession.get(tokenHash(token), Date.now()) : null;
  }

  async function auth(request, response, pathname) {
    if (request.method === 'GET' && pathname === '/api/auth/me') {
      const user = currentUser(request);
      return json(response, 200, { user: user ? { id: user.id, handle: user.handle } : null });
    }
    if (request.method !== 'POST') return json(response, 405, { error: 'METHOD_NOT_ALLOWED' });
    const origin = request.headers.origin;
    let sameOrigin = !origin;
    try { if (origin) sameOrigin = new URL(origin).host === request.headers.host; }
    catch { sameOrigin = false; }
    if (!sameOrigin ||
        request.headers['sec-fetch-site'] === 'cross-site') {
      return json(response, 403, { error: 'ORIGIN_DENIED' });
    }
    if (pathname === '/api/auth/logout') {
      const user=currentUser(request);if(user)multiplayer.command(user,'leave',{});
      const token = cookieToken(request,sessionCookieName);
      if (token) deleteSession.run(tokenHash(token));
      return json(response, 200, { user: null }, {
        'Set-Cookie': `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureCookies ? '; Secure' : ''}`,
      });
    }
    if (limited(request.socket.remoteAddress ?? 'unknown')) {
      return json(response, 429, { error: 'RATE_LIMITED' });
    }
    let fields;
    try { fields = await bodyJson(request); }
    catch { return json(response, 400, { error: 'INVALID_REQUEST' }); }
    const handle = typeof fields?.handle === 'string' ? fields.handle.trim() : '';
    const password = fields?.password;
    if (!/^[\p{L}\p{N}_]{3,20}$/u.test(handle) ||
        typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return json(response, 400, { error: 'INVALID_CREDENTIAL_FORMAT' });
    }
    let user;
    if (pathname === '/api/auth/register') {
      if (findUser.get(handle)) return json(response, 409, { error: 'HANDLE_TAKEN' });
      const id = randomUUID();
      const salt = randomBytes(16);
      const passwordHash = await scrypt(password, salt, 64);
      try { addUser.run(id, handle, salt, passwordHash, Date.now()); }
      catch { return json(response, 409, { error: 'HANDLE_TAKEN' }); }
      user = { id, handle };
    } else if (pathname === '/api/auth/login') {
      const record = findUser.get(handle);
      const comparison = await scrypt(password, record?.salt ?? Buffer.alloc(16), 64);
      if (!record || !timingSafeEqual(comparison, record.password_hash)) {
        return json(response, 401, { error: 'INVALID_CREDENTIALS' });
      }
      user = { id: record.id, handle: record.handle };
    } else return json(response, 404, { error: 'NOT_FOUND' });
    const token = randomBytes(32).toString('hex');
    players.profile(user);
    addSession.run(tokenHash(token), user.id, Date.now() + sessionAgeSeconds * 1000);
    return json(response, 200, { user }, {
      'Set-Cookie': `${sessionCookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionAgeSeconds}${secureCookies ? '; Secure' : ''}`,
    });
  }

  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
      if (pathname.startsWith('/api/auth/')) return await auth(request, response, pathname);
      if(pathname.startsWith('/api/multi/')){
        const user=currentUser(request);if(!user)return json(response,401,{error:'SIGN_IN_REQUIRED'});
        let allowed=request.headers['sec-fetch-site']!=='cross-site';
        try{if(request.headers.origin)allowed=allowed&&new URL(request.headers.origin).host===request.headers.host;}catch{allowed=false;}
        if(!allowed)return json(response,403,{error:'ORIGIN_DENIED'});
        const action=pathname.slice('/api/multi/'.length);
        try{
          if(request.method==='GET'&&action==='events')return multiplayer.connect(user,response,()=>Boolean(currentUser(request)));
          if(request.method==='GET'&&action==='rooms')return json(response,200,multiplayer.list());
          if(request.method==='GET'&&action==='current')return json(response,200,multiplayer.current(user));
          if(request.method!=='POST')return json(response,405,{error:'METHOD_NOT_ALLOWED'});
          return json(response,200,multiplayer.command(user,action,await bodyJson(request)));
        }catch(error){return json(response,error.status??503,{error:error.status?error.message:'MULTIPLAYER_UNAVAILABLE'});}
      }
      if(pathname.startsWith('/api/player/')) {
        const user=currentUser(request);
        if(!user)return json(response,401,{error:'SIGN_IN_REQUIRED'});
        const action=pathname.slice('/api/player/'.length);
        if(request.method==='GET'&&['profile','shop'].includes(action)) {
          try{return json(response,200,players[action](user));}
          catch(error){return json(response,error.status??500,{error:error.status?error.message:'SERVER_ERROR'});}
        }
        const mutations={purchase:'purchase',equip:'equip',rename:'rename',daily:'daily','race/start':'start','race/finish':'finish'};
        if(request.method!=='POST'||!mutations[action])return json(response,405,{error:'METHOD_NOT_ALLOWED'});
        let allowed=request.headers['sec-fetch-site']!=='cross-site';
        try{if(request.headers.origin)allowed=allowed&&new URL(request.headers.origin).host===request.headers.host;}catch{allowed=false;}
        if(!allowed)return json(response,403,{error:'ORIGIN_DENIED'});
        try {
          const fields=await bodyJson(request);
          return json(response,200,players[mutations[action]](user,fields));
        } catch(error) {const malformed=['INVALID_JSON','BODY_TOO_LARGE'].includes(error.message);return json(response,error.status??(malformed?400:500),{error:error.status?error.message:malformed?'INVALID_REQUEST':'SERVER_ERROR'});}
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return json(response, 405, { error: 'METHOD_NOT_ALLOWED' });
      }
      const path = resolve(resolvedRoot, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
      if (path !== resolvedRoot && !path.startsWith(resolvedRoot + sep)) {
        return json(response, 403, { error: 'FORBIDDEN' });
      }
      const info = await stat(path);
      if (!info.isFile()) return json(response, 404, { error: 'NOT_FOUND' });
      response.writeHead(200, {
        'Content-Type': types.get(extname(path)) ?? 'application/octet-stream',
        'Content-Length': info.size,
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(request.method === 'HEAD' ? undefined : await readFile(path));
    } catch (error) {
      json(response, error.code === 'ENOENT' ? 404 : 500,
        { error: error.code === 'ENOENT' ? 'NOT_FOUND' : 'SERVER_ERROR' });
    }
  });
  const closeServer=server.close.bind(server);
  server.close=(callback)=>{multiplayer.close();return closeServer(callback);};
  server.on('close', () => database.close());
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.KART_PORT || 4174);
  const databasePath=process.env.KART_DATABASE_PATH||resolve(webRoot,'..','local-data',port===4174?'accounts-4174.sqlite':'accounts.sqlite');
  const server = createKartServer({databasePath,sessionCookieName:`kart_session_${port}`,secureCookies:process.env.KART_COOKIE_SECURE === '1'});
  const host = process.env.KART_HOST || '127.0.0.1';
  server.listen(port, host, () => console.log(`Kart web: http://${host}:${port}/\nUser DB: ${databasePath}`));
}
