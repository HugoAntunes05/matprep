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
    const { data: alunos, error } = await sb.from('admin_alunos_resumo').select('*');
    if (error) throw error;
    const list = alunos || [];
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
    const { data, error } = await sb
      .from('admin_alunos_resumo')
      .select('*')
      .order('ultimo_acesso', { ascending: false, nullsFirst: false });
    if (error) throw error;
    res.json({ alunos: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.get('/api/admin/alunos/:id', requireAdmin, async (req, res) => {
  const sb = adminSb();
  const id = req.params.id;
  try {
    const [resumo, videos, licoes, perguntas, eventos, progresso] = await Promise.all([
      sb.from('admin_alunos_resumo').select('*').eq('user_id', id).maybeSingle(),
      sb.from('video_progresso').select('*').eq('user_id', id).order('updated_at', { ascending: false }),
      sb.from('licao_progresso').select('*').eq('user_id', id).order('ultima_abertura', { ascending: false }),
      sb.from('pergunta_vistas').select('*').eq('user_id', id).order('ultima_vista', { ascending: false }),
      sb
        .from('atividade_eventos')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(300),
      sb.from('progresso').select('*').eq('user_id', id).maybeSingle(),
    ]);
    if (resumo.error) throw resumo.error;
    res.json({
      aluno: resumo.data,
      videos: videos.data || [],
      licoes: licoes.data || [],
      perguntas: perguntas.data || [],
      eventos: eventos.data || [],
      progresso: progresso.data || null,
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
