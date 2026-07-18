/**
 * Semeia TEMAS / QUESTOES / ABERTAS / MATERIAIS no Supabase.
 * Usa SUPABASE_SERVICE_ROLE_KEY (ou service_role) para contornar RLS no write.
 *
 * Uso:
 *   set SUPABASE_SERVICE_ROLE_KEY=...
 *   npm run seed
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const url = process.env.SUPABASE_URL || 'https://rnxyxernvliyxpwldjee.supabase.co';
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY;

if (!key) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY (recomendado) ou SUPABASE_PUBLISHABLE_KEY.');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function loadDados() {
  const dadosPath = path.join(root, 'dados.js');
  const mod = await import(pathToFileURL(dadosPath).href);
  return mod;
}

function chunk(arr, size = 100) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function upsert(table, rows, onConflict = 'id') {
  for (const part of chunk(rows, 80)) {
    const { error } = await sb.from(table).upsert(part, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(`  ${table}: ${part.length} linhas`);
  }
}

const dados = await loadDados();
const ordem = { comb: 1, prob: 2, func: 3, explog: 4, trig: 5, lim: 6, der: 7, pg: 8 };

const temas = dados.TEMAS.map((t) => ({
  id: t.id,
  titulo: t.titulo,
  icone: t.icone,
  dif: t.dif,
  duracao: t.duracao,
  grad: t.grad,
  descricao: t.desc,
  video: t.video
    ? Object.assign({}, t.video, t.dicaFacil ? {dicaFacil: t.dicaFacil} : {})
    : null,
  teoria: t.teoria || [],
  formulas: t.formulas || [],
  exemplo: t.exemplo || null,
  erros: t.erros || [],
  ordem: ordem[t.id] || 99,
}));

const questoes = dados.QUESTOES.map((q) => ({
  id: q.id,
  tema: q.tema,
  dif: q.dif,
  enunciado: q.q,
  ops: q.ops,
  correta: q.c,
  passos: q.passos || [],
  fonte: q.fonte || null,
}));

const abertas = dados.ABERTAS.map((a) => ({
  id: a.id,
  tema: a.tema,
  enunciado: a.q,
  resolucao: a.res,
  fonte: a.fonte || null,
}));

const materiais = dados.MATERIAIS.map((m) => ({
  id: m.id,
  tipo: m.tipo,
  tema: m.tema,
  titulo: m.titulo,
  ficheiro: m.ficheiro,
  video: m.video || null,
}));

console.log('A semear MatPrep em', url);
await upsert('temas', temas);
await upsert('questoes', questoes);
await upsert('abertas', abertas);
await upsert('materiais', materiais);
console.log('Seed concluído:', {
  temas: temas.length,
  questoes: questoes.length,
  abertas: abertas.length,
  materiais: materiais.length,
});
