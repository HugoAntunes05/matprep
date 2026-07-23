/** MatPrep Arena — bosses, XP, itens de ajuda leve */
export const ITENS = [
  {id:'dica50',nome:'Lente 50/50',desc:'Remove 2 opções erradas nesta pergunta.',icone:'eye',raridade:'comum',efeito:'elimina2'},
  {id:'escudo',nome:'Escudo de Erro',desc:'O próximo erro não tira HP.',icone:'shield',raridade:'comum',efeito:'escudo'},
  {id:'passo',nome:'Pergaminho do 1.º Passo',desc:'Revela o primeiro passo da resolução.',icone:'scroll-text',raridade:'incomum',efeito:'passo'},
  {id:'foco',nome:'Cristal de Foco',desc:'O próximo acerto causa +50% de dano.',icone:'sparkles',raridade:'incomum',efeito:'foco'},
  {id:'formula',nome:'Talismã de Fórmula',desc:'Mostra uma fórmula útil do tema.',icone:'sigma',raridade:'raro',efeito:'formula'},
  {id:'elixir',nome:'Elixir Menor',desc:'Recupera 25 HP imediatamente.',icone:'heart-pulse',raridade:'comum',efeito:'cura'}
];

export const BOSSES = [
  {id:'b1',tema:'comb',nome:'Conde Pascal',titulo:'Guardião das Combinações',hp:90,nivelMin:1,grad:'linear-gradient(135deg,#14b8a6,#0f766e)',icone:'layout-grid',lore:'Conta arranjos mais depressa do que piscas.',drop:'dica50',xpBonus:40},
  {id:'b2',tema:'prob',nome:'Sombra de Laplace',titulo:'Senhora das Probabilidades',hp:110,nivelMin:2,grad:'linear-gradient(135deg,#38bdf8,#0369a1)',icone:'dices',lore:'Só perde se a tua probabilidade for alta.',drop:'escudo',xpBonus:50},
  {id:'b3',tema:'func',nome:'Cavaleiro Afim',titulo:'Senhor das Retas',hp:120,nivelMin:3,grad:'linear-gradient(135deg,#34d399,#047857)',icone:'chart-spline',lore:'O declive dele é íngreme. O teu também tem de ser.',drop:'passo',xpBonus:55},
  {id:'b4',tema:'explog',nome:'Dragão Logarítmico',titulo:'Devorador de Expoentes',hp:140,nivelMin:4,grad:'linear-gradient(135deg,#fbbf24,#b45309)',icone:'trending-up',lore:'Cresce exponencialmente quando errares.',drop:'foco',xpBonus:65},
  {id:'b5',tema:'trig',nome:'Hidra Trigonométrica',titulo:'Três Cabeças, Três Razões',hp:150,nivelMin:5,grad:'linear-gradient(135deg,#fb7185,#e11d48)',icone:'triangle',lore:'Corta uma cabeça (seno) e nascem duas.',drop:'formula',xpBonus:70},
  {id:'b6',tema:'lim',nome:'Espectro do Limite',titulo:'Indeterminação Viva',hp:160,nivelMin:6,grad:'linear-gradient(135deg,#22d3ee,#0e7490)',icone:'infinity',lore:'Aproxima-se… mas nunca chega. Tu sim.',drop:'elixir',xpBonus:80},
  {id:'b7',tema:'der',nome:'Titã da Derivada',titulo:'Taxa de Variação Absoluta',hp:180,nivelMin:7,grad:'linear-gradient(135deg,#60a5fa,#1d4ed8)',icone:'activity',lore:'A tangente dele aponta para a tua derrota.',drop:'foco',xpBonus:90},
  {id:'b8',tema:'pg',nome:'Fénix Geométrica',titulo:'Razão Infinita',hp:170,nivelMin:8,grad:'linear-gradient(135deg,#a3e635,#4d7c0f)',icone:'list-ordered',lore:'Renascce em progressão. Derruba-a de uma vez.',drop:'dica50',xpBonus:85},
  {id:'b9',tema:null,nome:'Overlord do Exame',titulo:'Chefe Final · Todos os Temas',hp:220,nivelMin:10,grad:'linear-gradient(135deg,#a78bfa,#6d28d9)',icone:'crown',lore:'Mistura tudo. Só os verdadeiros MatPrep passam.',drop:'formula',xpBonus:120,misto:true}
];

export function xpParaNivel(nivel){
  return Math.round(80 + nivel * 45);
}

export function maxHpDeNivel(nivel){
  return 100 + (nivel - 1) * 12;
}

export function xpPorAcerto(dif){
  if(dif==='Difícil')return 50;
  if(dif==='Médio')return 30;
  return 15;
}

export function danoAoBoss(dif, nivel, foco){
  let d = dif==='Difícil'?32:dif==='Médio'?20:12;
  d += Math.floor((nivel - 1) * 1.5);
  if(foco)d = Math.round(d * 1.5);
  return d;
}

/** Ataque do boss quando falhas a pergunta */
export function danoAoJogador(dif){
  if(dif==='Difícil')return 22;
  if(dif==='Médio')return 14;
  return 8;
}

/** Regeneração de HP do boss após atacar */
export function regenBoss(dif){
  if(dif==='Difícil')return 18;
  if(dif==='Médio')return 12;
  return 8;
}

export function indiceBoss(bossId){
  return BOSSES.findIndex(b=>b.id===bossId);
}

/** Todos os bosses liberados (bloqueio sequencial desativado) */
export function bossLiberado(bossId, bossesMortos){
  return true;
}

export function bossAnterior(bossId){
  const i=indiceBoss(bossId);
  if(i<=0)return null;
  return BOSSES[i-1];
}

export function gameDefault(){
  return {
    nivel:1,
    xp:0,
    hp:100,
    maxHp:100,
    inventario:{},
    bossesMortos:[],
    vitorias:0,
    derrotas:0,
    combate:null
  };
}

export function aplicarXp(game, ganho){
  let g = JSON.parse(JSON.stringify(game));
  if(!ganho||ganho<=0)return {game:g, subiu:0};
  g.xp += ganho;
  let subiu = 0;
  while(g.xp >= xpParaNivel(g.nivel)){
    g.xp -= xpParaNivel(g.nivel);
    g.nivel += 1;
    g.maxHp = maxHpDeNivel(g.nivel);
    g.hp = g.maxHp;
    subiu += 1;
  }
  return {game:g, subiu};
}

export function itemPorId(id){
  return ITENS.find(i=>i.id===id)||null;
}

export function bossPorId(id){
  return BOSSES.find(b=>b.id===id)||null;
}

/** Frases engraçadas estilo 67 / aura / farm */
export const FRASES = {
  hit: [
    '67 — farmaste aura!',
    'HIT confirmado. Aura ++',
    'Bro… isso foi cinema.',
    'Boss a sentir o skill issue.',
    'Matemática goated. Aura farmada.',
    'W move. Aura unlocked.',
    'Não foi sorte — foi aura.',
    '67 🔥 o boss nem viu vir',
    'Cooked. Literalmente cooked.',
    'Acerto limpo. Aura no teto.',
    'Tu és o main character.',
    'Diff: easy. Aura: max.',
    'Boss: “espera o quê—”',
    'Farm session a bater certo.',
    'Isto é conteúdo. Aura content.',
    'Sigma grindset: acertar a pergunta.',
    'Ratio + L + matemática.',
    'Aura check: passou com distinção.',
    'O Sandro ia gostar disto.',
    'Hitbox perfeita. 67.',
    'Boss HP a evaporar. W.',
    'Tu farmaste isto no gym? Porque wow.',
    'Não há plot armor — há exercício.',
    'Aura drip + dano real.',
    'Isto não é sorte, é revisão.'
  ],
  miss: [
    'Aura drain… foste.',
    'L move. Boss regenerou.',
    'Skill issue detetado.',
    'Aura a −1000. Tragic.',
    'Boss: “gg ez” (mentira, ainda dá)',
    'Falhaste. Aura freemium activated.',
    'Isto doeu na alma e no HP.',
    'Não era esta… aura down.',
    'Boss farmou-TE a ti.',
    'Plot twist: eras o NPC.',
    'Aura check: reprovado.',
    'O erro comprou skin pro boss.',
    '67… ao contrário.',
    'Foste ratioed pela matemática.',
    'Boss regenerou e ainda riu.',
    'Isso não era aura, era cope.',
    'Miss. Instant regret.',
    'A tua aura foi pro lixo reciclável.',
    'Erro clássico. Aura clássica a cair.',
    'Boss: +aura. Tu: −esperança.',
    'Não era difícil… era aura low.',
    'Foste. Mas com estilo. (não)',
    'HP down. Ego down. Ainda dá.',
    'Aura drain complete. Tenta outra.',
    'Boss bebeu a tua aura de café.'
  ],
  escudo: [
    'Escudo salvou a aura! Quase L.',
    'Blocked. Aura intacta (por agora).',
    'Escudo: “não hoje, boss.”',
    'Plot armor de bolso. W.',
    'Boss falhou o hit — escudo goated.'
  ],
  idle: [
    'Hora de farmar aura — acerta e dá hit!',
    'Lock in. Boss à espera.',
    'Farm session started. Não faças L.',
    'Aura check incoming…',
    'Escolhe certo. Farm infinite.',
    '67 mode: ON. Não falhes.',
    'Boss a olhar. Não chores.',
    'Grind time. Matemática = dano.'
  ],
  vitoriaTitulo: [
    'Boss deleted. Aura infinita.',
    'GG. Aura maxed out.',
    'Tu farmaste o boss. Literalmente.',
    '67 — boss no chão.',
    'W final. Aura lendária.',
    'Boss: uninstall. Tu: aura++',
    'Cinema ending. Aura forever.',
    'Diff closed. Aura unlocked.',
    'Boss cooked. Tu és o chef.',
    'Vitória goated. Aura no céu.'
  ],
  vitoriaExtra: [
    'Farmaste +{xp} XP.',
    '+{xp} XP no bag. Aura paid off.',
    'Loot run: +{xp} XP.',
    'Boss drop XP: +{xp}. W.',
    'Aura convertida em +{xp} XP.'
  ],
  derrotaTitulo: [
    'Aura a 0… foste.',
    'Game over (temporário). Aura flat.',
    'Boss ganhou o round. Tragic.',
    'HP zero. Ego também. Respawn.',
    'Foste deleted. Mas dá rematch.',
    'L screen. Farma e volta.',
    'Aura evaporated. Touch grass + rever.',
    'Boss: “ez”. Tu: “ainda não”.',
    'Down bad. Up next: revanche.',
    'Foste. Com carinho. Agora respawna.'
  ],
  derrotaExtra: [
    'Farma a zona, recupera aura e volta. O HP já resetou.',
    'Respawn free. Aura não. Vai estudar 2 min e rematch.',
    'Boss ainda aí. Tu também (depois de farm).',
    'HP full outra vez. Aura? Tens de farmar.',
    'Não é rage quit — é strategic farm break.'
  ],
  feedHit: [
    '67 — farmaste aura!',
    'HIT! Aura ++',
    'W answer. Boss a chorar.',
    'Correct + aura drip.',
    'Acerto goated.',
    'Isto é farm puro.',
    'Boss took an L.',
    'Matemática W. Aura W.'
  ],
  feedMiss: [
    'Aura drain… boss regenerou',
    'L answer. Boss healed.',
    'Skill issue + regen boss',
    'Erraste. Aura down.',
    'Boss: free heal. Tu: free damage.',
    'Missed. Aura no lixo.',
    'Não era… tragic.',
    'Foste ratioed nesta.'
  ],
  ajuda: [
    'Ajuda usada — sem loot (aura freemium)',
    'Help = loot off. Aura freemium.',
    'Usaste item: loot cancelled. Fair.',
    'Freemium mode: ajuda sim, drop não.'
  ],
  nivel: [
    'Subiste pro nível {n} — aura up!',
    'Level {n} unlocked. Aura glowing.',
    'Nível {n}. Diff aumentou. Tu também.',
    'Level up {n}! Main character arc.',
    'Nível {n}. Aura check: approved.'
  ],
  dropOk: [
    'Loot unlocked: {item}!',
    'Drop: {item}. Aura paid rent.',
    'Boss largou {item}. W bag.',
    'Item get: {item}!'
  ],
  dropNo: [
    'Sem loot — usaste ajuda (aura freemium).',
    'No drop. Freemium tax.',
    'Ajuda = sem loot. Rules are rules.',
    'Loot locked. Aura freemium moment.'
  ],
  proxBoss: [
    ' · Desbloqueaste: {nome}',
    ' · Next boss unlocked: {nome}',
    ' · Novo target: {nome}',
    ' · {nome} já te espera'
  ]
};

export function pickFrase(tipo, vars){
  const arr=FRASES[tipo];
  if(!arr||!arr.length)return '';
  let s=arr[Math.floor(Math.random()*arr.length)];
  if(vars){
    Object.keys(vars).forEach(k=>{
      s=s.split('{'+k+'}').join(String(vars[k]));
    });
  }
  return s;
}
