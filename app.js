/* ============ IMPOSTAZIONI ============ */
const S = {voce:true, bip:true, modo:'auto', ritmo:1, fase:1, variante:1, voceNome:null, velocita:1};
const mem = {};
let dovesalvo = 'memoria';
const store = {
  async get(k){
    try{ if(window.storage){ const r = await window.storage.get('lg_' + k); if(r) return JSON.parse(r.value); } }catch(e){}
    try{ const v = localStorage.getItem('lg_' + k); if(v !== null) return JSON.parse(v); }catch(e){}
    return k in mem ? mem[k] : null;
  },
  async set(k, v){
    mem[k] = v;
    try{ if(window.storage){ await window.storage.set('lg_' + k, JSON.stringify(v)); dovesalvo = 'Claude'; } }catch(e){}
    try{ localStorage.setItem('lg_' + k, JSON.stringify(v)); if(dovesalvo === 'memoria') dovesalvo = 'telefono'; }catch(e){}
  }
};
function provaSalvataggio(){
  try{ localStorage.setItem('lg_test','1'); localStorage.removeItem('lg_test'); return 'telefono'; }catch(e){}
  return window.storage ? 'Claude' : 'memoria';
}

/* ============ AUDIO ============ */
let ctx = null, voceIT = null;
function initAudio(){
  try{
    if(!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if(ctx.state === 'suspended') ctx.resume();
  }catch(e){}
  if('speechSynthesis' in window){
    scegliVoce();
    try{ const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }catch(e){}
  }
}
let vociIT = [];
function qualita(v){
  const n = (v.name || '').toLowerCase();
  let p = 0;
  if(/premium|enhanced|migliorat|neural|natural|siri/.test(n)) p += 8;
  if(/network|rete|online|wavenet|studio/.test(n)) p += 6;
  if(/google/.test(n)) p += 4;
  if(v.localService === false) p += 3;
  if(/compact|compatt|eloquence|espeak|pico/.test(n)) p -= 10;
  return p;
}
function etichetta(v){
  const n = v.name.replace(/\s*\(.*?\)\s*/g, ' ').trim() || v.name;
  const q = qualita(v);
  let tag = '';
  if(/premium|enhanced|migliorat|neural|natural|siri/i.test(v.name)) tag = ' · migliorata';
  else if(v.localService === false || /network|online/i.test(v.name)) tag = ' · rete';
  return (q >= 6 ? '★ ' : '') + n + tag;
}
function scegliVoce(){
  try{
    const tutte = speechSynthesis.getVoices();
    if(!tutte.length) return;
    vociIT = tutte.filter(x => (x.lang || '').toLowerCase().startsWith('it'));
    if(!vociIT.length) vociIT = tutte.slice();
    vociIT.sort((a, b) => qualita(b) - qualita(a) || a.name.localeCompare(b.name));
    voceIT = vociIT.find(v => v.name === S.voceNome) || vociIT[0];
    S.voceNome = voceIT.name;
    popolaVoci();
  }catch(e){}
}
function popolaVoci(){
  const s = el('sel-voce');
  if(!s) return;
  if(!vociIT.length){
    s.innerHTML = '<option>Nessuna voce trovata</option>';
    el('voce-hint').textContent = 'Il telefono non espone voci al browser';
    return;
  }
  s.innerHTML = vociIT.map(v => `<option value="${v.name.replace(/"/g,'&quot;')}"${v.name===S.voceNome?' selected':''}>${etichetta(v)}</option>`).join('');
  el('voce-hint').textContent = vociIT.length + ' voci sul telefono · ★ = più naturale';
}
if('speechSynthesis' in window) speechSynthesis.addEventListener('voiceschanged', scegliVoce);

function bip(f=880, d=.13, vol=.32, tipo='square'){
  if(!S.bip || !ctx) return;
  try{
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo; o.frequency.value = f;
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + .012);
    g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + d + .03);
  }catch(e){}
}
const bipVia   = () => { bip(660,.1,.3); setTimeout(()=>bip(990,.22,.34), 130); };
const bipStop  = () => { bip(420,.22,.3,'sawtooth'); };
const bipConto = () => { bip(1180,.07,.26); };
const bipFine  = () => { bip(523,.16,.3); setTimeout(()=>bip(659,.16,.3),170); setTimeout(()=>bip(880,.4,.32),340); };

function parla(txt){
  if(!S.voce || !('speechSynthesis' in window)) return;
  try{
    speechSynthesis.cancel();
    setTimeout(()=>{
      const u = new SpeechSynthesisUtterance(txt);
      u.lang = 'it-IT'; u.rate = S.velocita; u.pitch = .96; u.volume = 1;
      if(voceIT) u.voice = voceIT;
      speechSynthesis.speak(u);
    }, 70);
  }catch(e){}
}

/* ============ COSTRUZIONE CODA ============ */
function costruisci(sess){
  const q = [];
  q.push({type:'prep', dur:10});
  sess.blocchi.forEach((b, bi) => {
    for(let g = 1; g <= b.giri; g++){
      b.esercizi.forEach((e, ei) => {
        const dur = e.tipo === 'rip' ? Math.round(e.t * S.ritmo) : e.t;
        q.push({type:'work', e, dur, giro:g, giri:b.giri, blocco:bi});
        const ultimoEs = ei === b.esercizi.length - 1;
        const ultimoGiro = g === b.giri;
        const ultimoBlocco = bi === sess.blocchi.length - 1;
        if(ultimoEs && ultimoGiro){
          if(!ultimoBlocco) q.push({type:'rest', dur:b.riposoGiro || 60});
        }else if(ultimoEs){
          q.push({type:'rest', dur:b.riposoGiro, giroDopo:g + 1, giri:b.giri});
        }else if(b.riposoEs > 0){
          q.push({type:'rest', dur:b.riposoEs});
        }
      });
    }
  });
  q.push({type:'done'});
  for(let i = 0; i < q.length; i++){
    if(q[i].type === 'rest' || q[i].type === 'prep'){
      for(let j = i + 1; j < q.length; j++){ if(q[j].type === 'work'){ q[i].next = q[j]; break; } }
    }
  }
  const lavori = q.filter(s => s.type === 'work');
  lavori.forEach((s, i) => { s.n = i + 1; s.tot = lavori.length; });
  return q;
}

/* ============ MOTORE ============ */
function adattaNome(t){
  const n = el('nome');
  n.textContent = t;
  const larg = Math.min(window.innerWidth, 620) - 34;
  const alt = window.innerHeight;
  const parole = t.split(/\s+/);
  const piuLunga = Math.max(...parole.map(x => x.length));
  const stretto = piuLunga > 11;
  const perChar = stretto ? .56 : .62;
  n.style.fontVariationSettings = stretto ? "'wdth' 84,'wght' 900" : "'wdth' 112,'wght' 900";
  const daParola = larg / (piuLunga * perChar);
  const daTotale = t.length <= 14 ? 999 : t.length <= 24 ? 46 : t.length <= 34 ? 38 : 32;
  const daAltezza = alt * .075;
  const px = Math.max(20, Math.min(daParola, daTotale, Math.max(30, daAltezza), 62));
  n.style.fontSize = px.toFixed(1) + 'px';
}

const R = {q:[], i:0, fineA:0, rimasti:0, inPausa:false, tick:null, sec:null, sess:null, avvio:0, su:false};
const el = id => document.getElementById(id);
const runEl = el('run');

function apri(sess){
  R.sess = sess; R.q = costruisci(sess); R.i = 0; R.inPausa = false; R.avvio = Date.now();
  runEl.classList.add('on'); runEl.classList.remove('pausa');
  document.body.style.overflow = 'hidden';
  initAudio(); wake();
  vaiA(0);
}

function chiudi(){
  clearInterval(R.tick); R.tick = null;
  runEl.classList.remove('on'); document.body.style.overflow = '';
  try{ speechSynthesis.cancel(); }catch(e){}
  rilasciaWake();
}

function vaiA(i){
  clearInterval(R.tick); R.tick = null;
  if(i < 0) i = 0;
  R.i = i;
  const s = R.q[i];
  if(!s) return chiudi();
  R.sec = null;

  if(s.type === 'done'){
    runEl.dataset.stato = 'done';
    el('stato').textContent = 'Finito';
    adattaNome('Sessione completata');
    el('rip').textContent = durataTot();
    el('nota').textContent = R.sess.id === 'A' || R.sess.id === 'B' ? 'Non recuperare quelle che salti: riprendi dalla prossima.' : '';
    el('tempo').textContent = '✓';
    el('dopo').textContent = '';
    el('pos').textContent = R.sess.nome;
    el('barra').style.width = '100%';
    const poi = R.sess._poi;
    if(poi){
      adattaNome('Riscaldamento fatto');
      el('nota').textContent = 'Pronto per ' + poi.nome.toLowerCase() + '.';
      el('avanti').textContent = 'Vai con ' + poi.nome;
      bipFine(); parla('Riscaldamento finito. Quando sei pronto, si comincia.');
    }else{
      el('avanti').textContent = 'Chiudi';
      bipFine(); parla('Allenamento completato. Bravo.');
    }
    salvaFatto();
    return;
  }

  const manuale = s.type === 'work' && s.e.tipo === 'rip' && S.modo === 'manuale';
  R.rimasti = s.dur;
  R.fineA = Date.now() + s.dur * 1000;
  R.manuale = manuale;
  R.inizioManuale = Date.now();

  runEl.dataset.stato = s.type === 'work' ? 'work' : 'rest';
  el('avanti').textContent = s.type === 'work' ? (manuale ? 'Fatto' : 'Avanti') : 'Salta riposo';

  if(s.type === 'prep'){
    el('stato').textContent = 'Si parte';
    adattaNome(R.sess.nome);
    el('rip').textContent = '';
    el('nota').textContent = R.sess.nota || '';
    el('dopo').textContent = s.next ? 'Si comincia con: ' + s.next.e.n : '';
    el('pos').textContent = R.sess.sottotitolo || '';
    parla('Si parte con ' + R.sess.nome + '. Primo esercizio: ' + s.next.e.n + '.');
  }
  else if(s.type === 'work'){
    const e = s.e;
    el('stato').textContent = s.giri > 1 ? 'Giro ' + s.giro + ' di ' + s.giri : 'Lavoro';
    adattaNome(e.n);
    el('rip').textContent = e.r ? e.r : (e.tipo === 'rip' ? '' : formatta(e.t));
    el('nota').textContent = e.d || '';
    el('dopo').textContent = prossimoTesto(s);
    el('pos').textContent = 'Esercizio ' + s.n + ' / ' + s.tot;
    bipVia();
    parla(e.n + (e.say ? ', ' + e.say : (e.tipo === 'rip' ? '' : ', ' + parlaTempo(e.t))) + '. Via.');
  }
  else if(s.type === 'rest'){
    el('stato').textContent = 'Riposo';
    adattaNome(s.next ? s.next.e.n : 'Pausa');
    el('rip').textContent = s.next && s.next.e.r ? s.next.e.r : '';
    el('nota').textContent = s.next && s.next.e.d ? s.next.e.d : '';
    el('dopo').textContent = s.giroDopo ? 'Poi giro ' + s.giroDopo + ' di ' + s.giri : 'Prossimo esercizio';
    el('pos').textContent = 'Riposo ' + s.dur + '"';
    bipStop();
    let t = 'Riposo ' + s.dur + ' secondi.';
    if(s.giroDopo) t += ' Poi giro ' + s.giroDopo + '.';
    if(s.next) t += ' Prossimo: ' + s.next.e.n + (s.next.e.say ? ', ' + s.next.e.say : '') + '.';
    parla(t);
  }

  disegna();
  R.tick = setInterval(passo, 120);
}

function prossimoTesto(s){
  for(let j = R.i + 1; j < R.q.length; j++){
    const x = R.q[j];
    if(x.type === 'work') return 'Poi: ' + x.e.n;
    if(x.type === 'done') return 'Ultimo esercizio';
  }
  return '';
}

function passo(){
  if(R.inPausa) return;
  const s = R.q[R.i];
  if(R.manuale){
    R.rimasti = -Math.floor((Date.now() - R.inizioManuale) / 1000);
    disegna();
    return;
  }
  const ms = R.fineA - Date.now();
  R.rimasti = Math.max(0, Math.ceil(ms / 1000));
  const sec = R.rimasti;
  if(sec !== R.sec){
    R.sec = sec;
    if(sec <= 3 && sec >= 1){ bipConto(); flash(); }
    if(sec === 10 && s.dur >= 25 && s.type !== 'work') parla('Dieci secondi.');
    if(sec === 10 && s.type === 'work' && s.dur >= 40) parla('Dieci secondi.');
  }
  disegna();
  if(ms <= 0) vaiA(R.i + 1);
}

function disegna(){
  const s = R.q[R.i];
  el('tempo').textContent = R.manuale ? formatta(Math.abs(R.rimasti)) : formatta(R.rimasti);
  if(R.manuale){ el('barra').style.width = '100%'; return; }
  const pct = s.dur ? Math.max(0, Math.min(100, (R.rimasti / s.dur) * 100)) : 0;
  el('barra').style.width = pct + '%';
}

function formatta(sec){
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), r = sec % 60;
  return m > 0 ? m + ':' + String(r).padStart(2, '0') : String(r);
}
function parlaTempo(t){ return t >= 60 ? Math.round(t/60) + ' minuti' : t + ' secondi'; }
function durataTot(){
  const m = Math.round((Date.now() - R.avvio) / 60000);
  return m + (m === 1 ? ' minuto' : ' minuti');
}
function flash(){
  const t = el('tempo');
  t.classList.remove('pulse'); void t.offsetWidth; t.classList.add('pulse');
}

/* wake lock */
let wl = null;
async function wake(){ try{ wl = await navigator.wakeLock.request('screen'); }catch(e){} }
function rilasciaWake(){ try{ wl && wl.release(); wl = null; }catch(e){} }
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'visible' && runEl.classList.contains('on')) wake();
});

/* comandi */
el('avanti').onclick = () => {
  const s = R.q[R.i];
  if(s.type === 'done'){
    const poi = R.sess._poi;
    if(poi){ R.sess._poi = null; return apri(poi); }
    return chiudi();
  }
  vaiA(R.i + 1);
};
el('indietro').onclick = () => {
  let j = R.i - 1;
  while(j > 0 && R.q[j].type === 'rest') j--;
  vaiA(Math.max(0, j));
};
el('piu').onclick = () => { R.fineA += 15000; R.rimasti += 15; disegna(); bip(700,.08,.2); };
el('pausa').onclick = () => {
  R.inPausa = !R.inPausa;
  runEl.classList.toggle('pausa', R.inPausa);
  el('pausa').textContent = R.inPausa ? 'Riprendi' : 'Pausa';
  if(R.inPausa){ R.pausaDa = Date.now(); try{ speechSynthesis.cancel(); }catch(e){} }
  else {
    const fermo = Date.now() - (R.pausaDa || Date.now());
    R.fineA = Date.now() + R.rimasti * 1000;
    R.inizioManuale += fermo;
  }
};
el('chiudi').onclick = chiudi;
document.addEventListener('keydown', e => {
  if(!runEl.classList.contains('on')) return;
  if(e.code === 'Space'){ e.preventDefault(); el('pausa').click(); }
  if(e.code === 'ArrowRight'){ e.preventDefault(); el('avanti').click(); }
  if(e.code === 'ArrowLeft'){ e.preventDefault(); el('indietro').click(); }
  if(e.code === 'Escape') chiudi();
});

/* ============ HOME ============ */
function sessioniDisponibili(){
  return [RISC, SESS_A, SESS_B, sbarraSess(S.fase), STRETCH];
}

function disegnaLista(){
  const box = el('lista');
  box.innerHTML = '';
  sessioniDisponibili().forEach(sess => {
    const c = document.createElement('div');
    c.className = 'card';
    const es = sess.blocchi.flatMap(b => b.esercizi.map(e => ({e, giri:b.giri})));
    c.innerHTML = `
      <button class="intestazione">
        <span class="nome"><strong>${sess.nome}</strong><em>${sess.sottotitolo} · ${sess.durata}</em></span>
        <span class="chev">›</span>
      </button>
      <div class="dettaglio">
        <p class="nota">${sess.nota || ''}</p>
        ${es.map(({e, giri}) => `
          <div class="riga">
            <span><a href="${yt(e.video || e.n)}" target="_blank" rel="noopener">${e.n}</a><i>${e.d || ''}</i></span>
            <span class="val">${giri > 1 ? giri + ' × ' : ''}${e.r || formatta(e.t) + '"'}</span>
          </div>`).join('')}
        ${sess.id.startsWith('sbarra') ? `
        <div class="fasi" role="group" aria-label="Fase sbarra">
          ${[1,2,3].map(f => `<button data-fase="${f}" aria-pressed="${S.fase===f}">Fase ${f}</button>`).join('')}
        </div>` : ''}
        <button class="avvia">Inizia ${sess.nome.toLowerCase()}</button>
      </div>`;
    c.querySelector('.intestazione').onclick = () => c.classList.toggle('aperta');
    c.querySelector('.avvia').onclick = () => apri(sess);
    c.querySelectorAll('[data-fase]').forEach(b => b.onclick = () => {
      S.fase = +b.dataset.fase; store.set('fase', S.fase); disegnaLista();
      const nuova = document.querySelectorAll('.card')[3]; if(nuova) nuova.classList.add('aperta');
    });
    box.appendChild(c);
  });
}

let giornoScelto = null;
const NOMI_G = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
const oggiIdx = () => (new Date().getDay() + 6) % 7;
const giornoAttivo = () => giornoScelto === null ? oggiIdx() : giornoScelto;

function pezziGiorno(testo){
  if(testo === 'Riposo') return {big:'—', sub:'riposo'};
  if(testo === 'Camminata') return {big:'~', sub:'camm.'};
  if(testo.includes('+')) return {big:testo[0], sub:'+ sbarra'};
  return {big:testo, sub:'casa'};
}

function disegnaSettimana(){
  const oggi = oggiIdx(), att = giornoAttivo();
  el('settimana').innerHTML = SETTIMANA.map((d, i) => {
    const testo = S.variante === 1 ? d.v1 : d.v2;
    const p = pezziGiorno(testo);
    const cls = [i === oggi ? 'oggi-g' : '', i === att && giornoScelto !== null ? 'scelto-g' : '', testo === 'Riposo' ? 'riposo-g' : ''].join(' ');
    return `<button class="giorno ${cls}" data-g="${i}" aria-label="${NOMI_G[i]}, ${testo}">
      <b>${d.g}</b><span>${p.big}</span><i>${p.sub}</i></button>`;
  }).join('');
  el('settimana').querySelectorAll('[data-g]').forEach(b => b.onclick = () => {
    const i = +b.dataset.g;
    giornoScelto = (giornoScelto === i || (giornoScelto === null && i === oggiIdx())) ? null : i;
    disegnaOggi(); disegnaSettimana();
  });
}

function disegnaOggi(){
  const i = giornoAttivo();
  const testo = S.variante === 1 ? SETTIMANA[i].v1 : SETTIMANA[i].v2;
  el('oggi-giorno').textContent = giornoScelto === null ? 'Oggi · ' + NOMI_G[i].toLowerCase() : NOMI_G[i];
  el('btn-settimana').textContent = 'Settimana ' + S.variante;

  const nota = el('nota-giorno');
  if(giornoScelto !== null && giornoScelto !== oggiIdx()){
    nota.hidden = false;
    nota.innerHTML = `<span>Stai guardando ${NOMI_G[i].toLowerCase()}, oggi è ${NOMI_G[oggiIdx()].toLowerCase()}</span><button id="reset-g">Torna a oggi</button>`;
    el('reset-g').onclick = () => { giornoScelto = null; disegnaOggi(); disegnaSettimana(); };
  }else{
    nota.hidden = true;
  }

  const btn = el('oggi-vai'), sec = el('oggi-secondo');
  sec.hidden = true;
  if(testo === 'Riposo'){
    el('oggi-titolo').textContent = 'Riposo';
    el('oggi-durata').textContent = 'Cammina se ti va. Oppure scegli un altro giorno qui sotto.';
    btn.textContent = 'Fai lo stretching';
    btn.onclick = () => apri(STRETCH);
  }else if(testo === 'Camminata'){
    el('oggi-titolo').textContent = 'Camminata';
    el('oggi-durata').textContent = '30-40 min · circa 8000 passi al giorno';
    btn.textContent = 'Fai lo stretching';
    btn.onclick = () => apri(STRETCH);
  }else{
    const sess = testo.startsWith('A') ? SESS_A : SESS_B;
    const conSbarra = testo.includes('Sbarra');
    el('oggi-titolo').textContent = sess.nome + (conSbarra ? ' + sbarra' : '');
    el('oggi-durata').textContent = conSbarra ? 'Riscaldamento, casa, parco · ~70 min' : sess.sottotitolo + ' · ' + sess.durata;
    btn.textContent = 'Inizia dal riscaldamento';
    btn.onclick = () => { RISC._poi = sess; apri(RISC); };
    if(conSbarra){
      sec.hidden = false;
      sec.textContent = 'Vai diretto alla sbarra · fase ' + S.fase;
      sec.onclick = () => apri(sbarraSess(S.fase));
    }
  }
}

/* ---- storico ---- */
let LOG = [];
function disegnaStorico(){
  const box = el('storico');
  const ora = Date.now();
  const ultimi7 = LOG.filter(x => ora - new Date(x.d).getTime() < 7 * 864e5).length;
  const ultimi30 = LOG.filter(x => ora - new Date(x.d).getTime() < 30 * 864e5).length;
  const minuti = LOG.filter(x => ora - new Date(x.d).getTime() < 30 * 864e5).reduce((a, x) => a + (x.min || 0), 0);
  let html = `<div class="conteggio">
      <div><strong>${ultimi7}</strong><em>ultimi 7 giorni</em></div>
      <div><strong>${ultimi30}</strong><em>ultimi 30 giorni</em></div>
      <div><strong>${minuti}</strong><em>minuti nel mese</em></div>
    </div>`;
  if(!LOG.length){
    html += `<p class="vuoto">Nessuna sessione registrata.<br>Quando arrivi in fondo a una sessione finisce qui dentro.</p>`;
  }else{
    html += LOG.slice(0, 12).map(x => {
      const d = new Date(x.d);
      const g = NOMI_G[(d.getDay() + 6) % 7].slice(0, 3).toLowerCase();
      const data = d.getDate() + '/' + (d.getMonth() + 1);
      const ora = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      return `<div class="storia"><b>${x.s}<i>${g} ${data} · ${ora}</i></b><span>${x.min || 0} min</span></div>`;
    }).join('');
    if(LOG.length > 12) html += `<p class="vuoto">e altre ${LOG.length - 12} sessioni salvate.</p>`;
  }
  box.innerHTML = html;
  const dove = provaSalvataggio();
  el('storico-stato').textContent = dove === 'telefono'
    ? 'Salvato su questo telefono, resta anche chiudendo'
    : dove === 'Claude' ? 'Salvato nell\'anteprima di Claude' : 'Solo in memoria: si perde chiudendo';
}

el('esporta').onclick = () => {
  const testo = JSON.stringify(LOG, null, 2);
  try{
    const b = new Blob([testo], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'allenamenti-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }catch(e){
    try{ navigator.clipboard.writeText(testo); alert('Storico copiato negli appunti.'); }
    catch(e2){ alert(testo); }
  }
};
el('svuota').onclick = async () => {
  if(!confirm('Cancello tutto lo storico?')) return;
  LOG = []; await store.set('log', LOG); disegnaStorico();
};

/* impostazioni */
function bindSwitch(id, chiave){
  const b = el(id);
  b.onclick = () => {
    S[chiave] = !S[chiave];
    b.setAttribute('aria-pressed', S[chiave]);
    store.set(chiave, S[chiave]);
    if(S[chiave]){ initAudio(); chiave === 'bip' ? bipVia() : parla('Voce attiva'); }
  };
}
bindSwitch('sw-voce','voce');
bindSwitch('sw-bip','bip');
function bindSeg(id, chiave, cast){
  el(id).querySelectorAll('button').forEach(b => b.onclick = () => {
    S[chiave] = cast(b.dataset.v);
    store.set(chiave, S[chiave]);
    el(id).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
  });
}
bindSeg('seg-modo','modo', v => v);
bindSeg('seg-ritmo','ritmo', v => parseFloat(v));
bindSeg('seg-vel','velocita', v => parseFloat(v));
el('seg-vel').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
  initAudio(); parla('Rematore con manubrio, 12 per braccio. Via.');
}));
el('sel-voce').onchange = e => {
  S.voceNome = e.target.value;
  voceIT = vociIT.find(v => v.name === S.voceNome) || voceIT;
  store.set('voceNome', S.voceNome);
  initAudio();
  parla('Goblet squat, 15 ripetizioni. Via.');
};
el('prova').onclick = () => { initAudio(); scegliVoce(); bipVia(); parla('Goblet squat, 15 ripetizioni. Via.'); };

el('btn-settimana').onclick = () => { S.variante = S.variante === 1 ? 2 : 1; store.set('variante', S.variante); disegnaOggi(); disegnaSettimana(); };

async function salvaFatto(){
  if(R.sess.id === 'risc' && R.sess._poi) return;
  const min = Math.max(1, Math.round((Date.now() - R.avvio) / 60000));
  LOG.unshift({d:new Date().toISOString(), s:R.sess.nome, min});
  LOG = LOG.slice(0, 200);
  await store.set('log', LOG);
  disegnaStorico();
}

/* avvio */
(async () => {
  for(const k of ['voce','bip','modo','ritmo','fase','variante','voceNome','velocita']){
    const v = await store.get(k);
    if(v !== null && v !== undefined) S[k] = v;
  }
  el('sw-voce').setAttribute('aria-pressed', S.voce);
  el('sw-bip').setAttribute('aria-pressed', S.bip);
  el('seg-modo').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === S.modo));
  el('seg-ritmo').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', parseFloat(b.dataset.v) === S.ritmo));
  el('seg-vel').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', parseFloat(b.dataset.v) === S.velocita));
  scegliVoce();
  setTimeout(scegliVoce, 400);
  setTimeout(scegliVoce, 1500);
  LOG = (await store.get('log')) || [];
  disegnaOggi(); disegnaSettimana(); disegnaLista(); disegnaStorico();
  window.addEventListener('resize', () => { if(runEl.classList.contains('on')) adattaNome(el('nome').textContent); });
})();

/* ============ SERVICE WORKER ============ */
if('serviceWorker' in navigator){
  let ricarica = false;
  const mostraAggiornamento = reg => {
    el('avviso-agg').hidden = false;
    el('btn-agg').onclick = () => {
      // mai a metà sessione: l'avviso è solo nella home, ma controllo comunque
      if(runEl.classList.contains('on')) return;
      ricarica = true;
      reg.waiting && reg.waiting.postMessage('aggiorna');
    };
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => { if(ricarica) location.reload(); });
  window.addEventListener('load', async () => {
    try{
      const reg = await navigator.serviceWorker.register('sw.js');
      if(reg.waiting && navigator.serviceWorker.controller) mostraAggiornamento(reg);
      reg.addEventListener('updatefound', () => {
        const nuovo = reg.installing;
        nuovo && nuovo.addEventListener('statechange', () => {
          if(nuovo.state === 'installed' && navigator.serviceWorker.controller) mostraAggiornamento(reg);
        });
      });
    }catch(e){}
  });
}
