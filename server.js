require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const supabaseUrl = process.env.SUPABASE_URL || 'https://rnxyxernvliyxpwldjee.supabase.co';
const supabaseKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_hLCpmcyokTzZZy1FmWiF4A_ReNOGxEq';
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'passe123';

const adminTokens = new Map();

function adminSb() {
  if (!serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function clientIp(req) {
  const candidates = [
    req.headers['cf-connecting-ip'],
    req.headers['true-client-ip'],
    req.headers['x-real-ip'],
    req.headers['x-forwarded-for'],
    req.socket && req.socket.remoteAddress,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    let ip = String(raw).split(',')[0].trim();
    ip = ip.replace(/^::ffff:/i, '');
    if (ip === '::1') ip = '127.0.0.1';
    if (ip) return ip;
  }
  return null;
}

function eventIp(ev) {
  if (!ev) return null;
  if (ev.ip) return ev.ip;
  if (ev.meta && ev.meta._ip) return ev.meta._ip;
  return null;
}

async function saveUltimoIp(sb, userId, ip) {
  if (!sb || !userId || !ip) return;
  const now = new Date().toISOString();
  try {
    const { data } = await sb.from('aluno_metricas').select('user_id').eq('user_id', userId).maybeSingle();
    if (data) {
      const r = await sb.from('aluno_metricas').update({ ultimo_ip: ip, ultimo_acesso: now, updated_at: now }).eq('user_id', userId);
      if (r.error) {
        await sb.from('aluno_metricas').update({ ultimo_acesso: now, updated_at: now }).eq('user_id', userId);
      }
    } else {
      const r = await sb.from('aluno_metricas').insert({ user_id: userId, ultimo_ip: ip, ultimo_acesso: now, updated_at: now });
      if (r.error) {
        await sb.from('aluno_metricas').insert({ user_id: userId, ultimo_acesso: now, updated_at: now });
      }
    }
  } catch (e) {
    console.warn('saveUltimoIp', e.message || e);
  }
}

async function enrichAlunosComIp(sb, list) {
  const out = (list || []).map((a) => Object.assign({}, a));
  const need = out.filter((a) => !a.ultimo_ip).map((a) => a.user_id);
  if (!need.length) return out;
  let data = null;
  let r = await sb
    .from('atividade_eventos')
    .select('user_id, ip, meta, created_at')
    .in('user_id', need)
    .order('created_at', { ascending: false })
    .limit(800);
  if (r.error) {
    r = await sb
      .from('atividade_eventos')
      .select('user_id, meta, created_at')
      .in('user_id', need)
      .order('created_at', { ascending: false })
      .limit(800);
  }
  data = r.data;
  const map = {};
  for (const ev of data || []) {
    if (map[ev.user_id]) continue;
    const ip = eventIp(ev);
    if (ip) map[ev.user_id] = ip;
  }
  return out.map((a) => Object.assign(a, { ultimo_ip: a.ultimo_ip || map[a.user_id] || null }));
}

function temAtividade(a) {
  if (!a) return false;
  if (a.ultimo_acesso) return true;
  const keys = [
    'perguntas_vistas',
    'perguntas_respondidas',
    'segundos_estudo',
    'segundos_video',
    'licoes_abertas',
    'licoes_concluidas',
    'materiais_abertos',
    'exames_feitos',
  ];
  return keys.some((k) => Number(a[k]) > 0);
}

/** Uma pessoa real = um IP (várias contas anónimas no mesmo IP juntam-se) */
function agruparAlunosPorIp(list) {
  const groups = new Map();
  const SUM = [
    'perguntas_vistas',
    'perguntas_respondidas',
    'perguntas_certas',
    'segundos_video',
    'segundos_estudo',
    'licoes_abertas',
    'licoes_concluidas',
    'materiais_abertos',
    'exames_feitos',
  ];

  for (const raw of list || []) {
    if (!temAtividade(raw) && !raw.ultimo_ip) continue; // fantasma vazio
    const a = Object.assign({}, raw);
    const key = a.ultimo_ip ? 'ip:' + a.ultimo_ip : 'uid:' + a.user_id;
    if (!groups.has(key)) {
      groups.set(key, Object.assign({}, a, {
        user_ids: [a.user_id],
        sessoes: 1,
        agrupado_por_ip: Boolean(a.ultimo_ip),
      }));
      continue;
    }
    const g = groups.get(key);
    if (!g.user_ids.includes(a.user_id)) {
      g.user_ids.push(a.user_id);
      g.sessoes += 1;
    }
    for (const k of SUM) g[k] = (Number(g[k]) || 0) + (Number(a[k]) || 0);
    if (a.favorito) g.favorito = true;
    const ta = a.ultimo_acesso ? new Date(a.ultimo_acesso).getTime() : 0;
    const tg = g.ultimo_acesso ? new Date(g.ultimo_acesso).getTime() : 0;
    if (ta >= tg) {
      g.user_id = a.user_id;
      g.nome = a.nome || g.nome;
      g.ultimo_acesso = a.ultimo_acesso || g.ultimo_acesso;
      g.streak = a.streak || g.streak;
    }
  }

  return Array.from(groups.values()).map((g) => {
    const resp = Number(g.perguntas_respondidas) || 0;
    const certas = Number(g.perguntas_certas) || 0;
    g.precisao_pct = resp ? Math.round((100 * certas) / resp) : 0;
    if (g.nome && String(g.nome).includes(' · ')) {
      g.nome = String(g.nome).split(' · ')[0];
    }
    return g;
  });
}

async function carregarAlunosAgrupados(sb) {
  let data, error;
  ({ data, error } = await sb.from('admin_alunos_resumo').select('*'));
  if (error) {
    const r = await sb.from('perfis').select('id, nome, created_at');
    if (r.error) throw error;
    data = (r.data || []).map((p) => ({
      user_id: p.id,
      nome: p.nome,
      registado_em: p.created_at,
      favorito: false,
    }));
  }
  let list = await enrichAlunosComIp(sb, data || []);
  list = agruparAlunosPorIp(list);
  list.sort((a, b) => {
    const fa = a.favorito ? 1 : 0;
    const fb = b.favorito ? 1 : 0;
    if (fa !== fb) return fb - fa;
    const ta = a.ultimo_acesso ? new Date(a.ultimo_acesso).getTime() : 0;
    const tb = b.ultimo_acesso ? new Date(b.ultimo_acesso).getTime() : 0;
    return tb - ta;
  });
  return list;
}

async function userFromBearer(req) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : '';
  if (!token) return null;
  const sb = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data || !data.user) return null;
  return data.user;
}

function issueToken() {
  const token = crypto.randomBytes(32).toString('hex');
  adminTokens.set(token, Date.now() + 12 * 60 * 60 * 1000);
  return token;
}

function requireAdmin(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : '';
  const exp = adminTokens.get(token);
  if (!token || !exp || exp < Date.now()) {
    return res.status(401).json({ error: 'Não autorizado. Faz login no backoffice.' });
  }
  next();
}

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'matprep',
    supabase: Boolean(supabaseUrl && supabaseKey),
    adminApi: Boolean(serviceKey),
  });
});

app.get('/config.js', (_req, res) => {
  res
    .type('application/javascript')
    .set('Cache-Control', 'no-store')
    .send(
      `window.__MATPREP__=${JSON.stringify({
        supabaseUrl,
        supabaseKey,
      })};`
    );
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(ROOT, 'Plataforma de Estudo.dc.html'));
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(ROOT, 'admin.html'));
});
app.get('/backoffice', (_req, res) => {
  res.sendFile(path.join(ROOT, 'admin.html'));
});

/** Regista presença + IP (sempre) */
app.post('/api/aluno/presence', async (req, res) => {
  try {
    const user = await userFromBearer(req);
    if (!user) return res.status(401).json({ error: 'Sem sessão.' });
    const ip = clientIp(req);
    const sb = adminSb();
    if (sb) {
      await saveUltimoIp(sb, user.id, ip);
      const row = {
        user_id: user.id,
        tipo: 'presence',
        segundos: 0,
        meta: { _ip: ip, ua: (req.headers['user-agent'] || '').slice(0, 120) },
      };
      if (ip) row.ip = ip;
      let { error } = await sb.from('atividade_eventos').insert(row);
      if (error && row.ip) {
        delete row.ip;
        ({ error } = await sb.from('atividade_eventos').insert(row));
      }
      if (error) console.warn('presence insert', error.message);
    }
    res.json({ ok: true, ip });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

/** Regista evento com IP real (Cloudflare / proxy) */
app.post('/api/aluno/track', async (req, res) => {
  try {
    const user = await userFromBearer(req);
    if (!user) return res.status(401).json({ error: 'Sem sessão.' });
    const body = req.body || {};
    const ip = clientIp(req);
    const meta = body.meta && typeof body.meta === 'object' ? Object.assign({}, body.meta) : {};
    if (ip) meta._ip = ip;
    const row = {
      user_id: user.id,
      tipo: String(body.tipo || 'evento'),
      tema: body.tema || null,
      licao: body.licao || null,
      questao_id: body.questao_id || null,
      material_id: body.material_id || null,
      video_id: body.video_id || null,
      segundos: Number(body.segundos) || 0,
      meta,
    };
    if (ip) row.ip = ip;
    const sb = adminSb();
    if (sb) {
      let { error } = await sb.from('atividade_eventos').insert(row);
      if (error && row.ip) {
        delete row.ip;
        ({ error } = await sb.from('atividade_eventos').insert(row));
      }
      if (error) throw error;
      await saveUltimoIp(sb, user.id, ip);
    } else {
      const userSb = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: req.headers.authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      let { error } = await userSb.from('atividade_eventos').insert(row);
      if (error && row.ip) {
        delete row.ip;
        ({ error } = await userSb.from('atividade_eventos').insert(row));
      }
      if (error) throw error;
    }
    res.json({ ok: true, ip });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.get('/api/aluno/ip', (req, res) => {
  res.json({ ip: clientIp(req) });
});

app.post('/api/admin/login', (req, res) => {
  const password = String((req.body && req.body.password) || '');
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Password incorreta.' });
  }
  if (!serviceKey) {
    return res.status(503).json({
      error:
        'Falta SUPABASE_SERVICE_ROLE_KEY no servidor. Define esta variável no Railway/.env para o backoffice ler todos os alunos.',
    });
  }
  res.json({ token: issueToken(), expiresInHours: 12 });
});

app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
  const sb = adminSb();
  try {
    const list = await carregarAlunosAgrupados(sb);
    const now = Date.now();
    const ativosHoje = list.filter((a) => a.ultimo_acesso && now - new Date(a.ultimo_acesso).getTime() < 864e5).length;
    const sum = (k) => list.reduce((n, a) => n + (Number(a[k]) || 0), 0);
    const { count: eventosCount } = await sb
      .from('atividade_eventos')
      .select('*', { count: 'exact', head: true });
    res.json({
      totalAlunos: list.length,
      ativosHoje,
      perguntasRespondidas: sum('perguntas_respondidas'),
      perguntasVistas: sum('perguntas_vistas'),
      perguntasCertas: sum('perguntas_certas'),
      minutosVideo: Math.round(sum('segundos_video') / 60),
      minutosEstudo: Math.round(sum('segundos_estudo') / 60),
      licoesConcluidas: sum('licoes_concluidas'),
      materiaisAbertos: sum('materiais_abertos'),
      examesFeitos: sum('exames_feitos'),
      totalEventos: eventosCount || 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.get('/api/admin/alunos', requireAdmin, async (_req, res) => {
  const sb = adminSb();
  try {
    const list = await carregarAlunosAgrupados(sb);
    res.json({ alunos: list });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.delete('/api/admin/alunos/:id', requireAdmin, async (req, res) => {
  const sb = adminSb();
  const id = req.params.id;
  try {
    const { error } = await sb.auth.admin.deleteUser(id);
    if (error) throw error;
    res.json({ ok: true, deleted: id });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.post('/api/admin/limpar-alunos', requireAdmin, async (req, res) => {
  const sb = adminSb();
  if (!req.body || req.body.confirm !== 'LIMPAR') {
    return res.status(400).json({ error: 'Confirma com { "confirm": "LIMPAR" }.' });
  }
  try {
    let deleted = 0;
    let page = 1;
    for (;;) {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw error;
      const users = (data && data.users) || [];
      if (!users.length) break;
      for (const u of users) {
        const r = await sb.auth.admin.deleteUser(u.id);
        if (!r.error) deleted += 1;
      }
      if (users.length < 100) break;
      page += 1;
    }
    res.json({ ok: true, deleted });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.post('/api/admin/alunos/:id/favorito', requireAdmin, async (req, res) => {
  const sb = adminSb();
  const id = req.params.id;
  try {
    const { data: existing } = await sb.from('admin_favoritos').select('user_id').eq('user_id', id).maybeSingle();
    if (existing) {
      const { error } = await sb.from('admin_favoritos').delete().eq('user_id', id);
      if (error) throw error;
      return res.json({ favorito: false });
    }
    const { error } = await sb.from('admin_favoritos').insert({ user_id: id });
    if (error) throw error;
    res.json({ favorito: true });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.get('/api/admin/alunos/:id', requireAdmin, async (req, res) => {
  const sb = adminSb();
  const id = req.params.id;
  const ipQ = req.query.ip ? String(req.query.ip) : null;
  try {
    const agrupados = await carregarAlunosAgrupados(sb);
    const grupo =
      agrupados.find((a) => a.user_id === id) ||
      (ipQ && agrupados.find((a) => a.ultimo_ip === ipQ)) ||
      null;
    const ids = grupo && grupo.user_ids && grupo.user_ids.length ? grupo.user_ids : [id];

    const [resumo, videos, licoes, perguntas, eventos, progresso] = await Promise.all([
      sb.from('admin_alunos_resumo').select('*').eq('user_id', id).maybeSingle(),
      sb.from('video_progresso').select('*').in('user_id', ids).order('updated_at', { ascending: false }),
      sb.from('licao_progresso').select('*').in('user_id', ids).order('ultima_abertura', { ascending: false }),
      sb.from('pergunta_vistas').select('*').in('user_id', ids).order('ultima_vista', { ascending: false }),
      sb
        .from('atividade_eventos')
        .select('*')
        .in('user_id', ids)
        .order('created_at', { ascending: false })
        .limit(400),
      sb.from('progresso').select('*').eq('user_id', id).maybeSingle(),
    ]);
    if (resumo.error) throw resumo.error;
    let aluno = grupo
      ? Object.assign({}, grupo)
      : resumo.data
        ? Object.assign({}, resumo.data)
        : null;
    if (aluno && !aluno.ultimo_ip) {
      const enriched = await enrichAlunosComIp(sb, [aluno]);
      aluno.ultimo_ip = enriched[0] && enriched[0].ultimo_ip;
    }
    const eventosLimpos = (eventos.data || []).map((ev) =>
      Object.assign({}, ev, { ip: eventIp(ev) })
    );
    res.json({
      aluno,
      videos: videos.data || [],
      licoes: licoes.data || [],
      perguntas: perguntas.data || [],
      eventos: eventosLimpos,
      progresso: progresso.data || null,
      user_ids: ids,
      errors: {
        videos: videos.error?.message,
        licoes: licoes.error?.message,
        perguntas: perguntas.error?.message,
        eventos: eventos.error?.message,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.get('/api/admin/eventos', requireAdmin, async (req, res) => {
  const sb = adminSb();
  const lim = Math.min(500, Number(req.query.limit) || 100);
  try {
    let q = sb
      .from('atividade_eventos')
      .select('*, perfis:user_id(nome)')
      .order('created_at', { ascending: false })
      .limit(lim);
    if (req.query.tipo) q = q.eq('tipo', req.query.tipo);
    if (req.query.user_id) q = q.eq('user_id', req.query.user_id);
    const { data, error } = await q;
    if (error) {
      // fallback sem join
      const r = await sb
        .from('atividade_eventos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(lim);
      if (r.error) throw r.error;
      return res.json({ eventos: r.data || [] });
    }
    res.json({ eventos: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.use(express.static(ROOT, { extensions: ['html', 'js', 'css'] }));

app.listen(PORT, () => {
  console.log(`MatPrep a ouvir em http://localhost:${PORT}`);
  console.log(`Backoffice: http://localhost:${PORT}/admin`);
  if (!serviceKey) console.warn('AVISO: SUPABASE_SERVICE_ROLE_KEY em falta — backoffice não consegue listar alunos.');
});
