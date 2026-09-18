/* ============ IMPOSTAZIONI ============ */
const S = {voce:true, bip:true, modo:'auto', ritmo:1, fase:1, variante:1, voceNome:null, velocita:1};
const store = {get: k => DB.get(k), set: (k, v) => DB.set(k, v).catch(() => {})};

/* ---- migrazione dal vecchio localStorage (lg_*) ---- */
// sessione del piano a partire dal nome salvato nel vecchio storico
function sessDaNome(nome){
  return [RISC, SESS_A, SESS_B, sbarraSess(1), sbarraSess(2), sbarraSess(3), STRETCH].find(x => x.nome === nome) || null;
}
const tipoSess = id => id.startsWith('sbarra') ? 'sbarra' : id;
const faseSess = id => id.startsWith('sbarra') ? +id.slice(6) : null;

// voce del vecchio formato {d, s, min} → nuovo record
function daVecchioFormato(x){
  const sess = sessDaNome(x.s);
  const id = sess ? sess.id : 'altro';
  return {d:x.d, inizio:null, sessId:id, nome:x.s, tipo:tipoSess(id), fase:faseSess(id),
          min:x.min || 0, esercizi:null, eserciziTot:null, parziale:false, v:2};
}

async function migraVecchioStorage(){
  if(await DB.get('migrato')) return;
  try{
    for(const k of ['voce','bip','modo','ritmo','fase','variante','voceNome','velocita']){
      const v = localStorage.getItem('lg_' + k);
      if(v !== null && (await DB.get(k)) === null) await DB.set(k, JSON.parse(v));
    }
    const log = JSON.parse(localStorage.getItem('lg_log') || '[]');
    if(Array.isArray(log) && log.length) await DB.fondi('sessioni', log.filter(x => x && x.d).map(daVecchioFormato));
  }catch(e){}
  // le chiavi lg_* restano in localStorage come copia di sicurezza
  await DB.set('migrato', new Date().toISOString());
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

// dopo = secondi di ritardo sull'orologio dell'AudioContext: il suono parte
// all'ora giusta anche se il JavaScript rallenta a schermo spento
function bip(f=880, d=.13, vol=.32, tipo='square', dopo=0){
  if(!S.bip || !ctx) return null;
  try{
    const t = ctx.currentTime + Math.max(0, dopo), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo; o.frequency.value = f;
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + .012);
    g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + d + .03);
    return o;
  }catch(e){ return null; }
}
const bipVia   = (dopo=0) => [bip(660,.1,.3,'square',dopo), bip(990,.22,.34,'square',dopo+.13)];
const bipStop  = (dopo=0) => [bip(420,.22,.3,'sawtooth',dopo)];
const bipConto = (dopo=0) => [bip(1180,.07,.26,'square',dopo)];
const bipFine  = (dopo=0) => [bip(523,.16,.3,'square',dopo), bip(659,.16,.3,'square',dopo+.17), bip(880,.4,.32,'square',dopo+.34)];

/* bip programmati per lo step corrente: 3-2-1 e segnale del cambio */
let programmati = [];
function annullaBip(){
  programmati.forEach(o => { try{ o.stop(); o.disconnect(); }catch(e){} });
  programmati = [];
}
function programmaBip(){
  annullaBip();
  R.bipCambio = false;
  if(!ctx || R.manuale || R.inPausa) return;
  const s = R.q[R.i];
  if(!s || s.type === 'done') return;
  const resto = (R.fineA - Date.now()) / 1000;
  for(const k of [3, 2, 1]) if(resto - k > .05) programmati.push(...bipConto(resto - k));
  // suono dello step che segue, allo scadere
  const dopo = R.q[R.i + 1];
  if(dopo && resto > .05){
    programmati.push(...(dopo.type === 'work' ? bipVia(resto) : dopo.type === 'rest' ? bipStop(resto) : bipFine(resto)));
    R.bipCambio = true;
  }
  programmati = programmati.filter(Boolean);
}

/* ---- tenere viva l'app a schermo spento ----
   Chrome non sospende né rallenta una pagina che riproduce audio udibile:
   un <audio> in loop con un tono a 40 Hz a -60 dB (non si sente, ma per Chrome
   è "audio in riproduzione") tiene vivi timer, voce e bip. Con MediaSession
   compaiono anche i comandi nella schermata di blocco.                      */
let vivo = null;
function wavVivo(){
  const hz = 8000, n = hz * 2, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const str = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, hz, true); v.setUint32(28, hz * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  for(let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * 40 * i / hz) * 33), true);
  return URL.createObjectURL(new Blob([buf], {type:'audio/wav'}));
}
function avviaVivo(){
  try{
    if(!vivo){
      vivo = new Audio(wavVivo());
      vivo.loop = true;
      vivo.setAttribute('playsinline', '');
    }
    const p = vivo.play();
    if(p) p.catch(() => {});
  }catch(e){}
  impostaComandiMedia();
}
function fermaVivo(){
  try{ vivo && vivo.pause(); }catch(e){}
  if('mediaSession' in navigator){
    try{ navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'; }catch(e){}
  }
}
// se Android mette in pausa l'audio (ad es. mentre parla la sintesi vocale) lo riavvio
function controllaVivo(){
  if(vivo && vivo.paused && runEl.classList.contains('on')){
    const p = vivo.play(); if(p) p.catch(() => {});
  }
  if(ctx && ctx.state !== 'running' && ctx.state !== 'closed' && runEl.classList.contains('on')){
    try{ ctx.resume(); }catch(e){}
  }
}

let comandiMedia = false;
function impostaComandiMedia(){
  if(comandiMedia || !('mediaSession' in navigator)) return;
  comandiMedia = true;
  const ms = navigator.mediaSession;
  const azione = (a, f) => { try{ ms.setActionHandler(a, f); }catch(e){} };
  azione('play', () => { if(R.inPausa) el('pausa').click(); });
  azione('pause', () => { if(!R.inPausa) el('pausa').click(); });
  azione('nexttrack', () => el('avanti').click());
  azione('previoustrack', () => el('indietro').click());
  azione('stop', () => {});
}
// titolo e avanzamento nella notifica / schermata di blocco
function aggiornaMedia(){
  if(!('mediaSession' in navigator) || !runEl.classList.contains('on')) return;
  const ms = navigator.mediaSession, s = R.q[R.i];
  try{
    const titolo = s.type === 'work' ? s.e.n
      : s.type === 'rest' ? 'Riposo' + (s.next ? ' · poi ' + s.next.e.n : '')
      : s.type === 'prep' ? 'Si parte' : 'Sessione completata';
    ms.metadata = new MediaMetadata({
      title: titolo,
      artist: R.sess.nome + (s.n ? ' · esercizio ' + s.n + '/' + s.tot : ''),
      album: 'Allenamento',
      artwork: [192, 512].map(n => ({src:'icons/icona-' + n + '.png', sizes:n + 'x' + n, type:'image/png'}))
    });
    ms.playbackState = R.inPausa ? 'paused' : 'playing';
    if(ms.setPositionState){
      if(s.dur && !R.manuale && s.type !== 'done'){
        const tot = Math.max(s.dur, R.rimasti);
        ms.setPositionState({duration:tot, playbackRate:1, position:Math.max(0, Math.min(tot, tot - R.rimasti))});
      }else ms.setPositionState();
    }
  }catch(e){}
}

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

const R = {q:[], i:0, fineA:0, rimasti:0, inPausa:false, tick:null, sec:null, sess:null, avvio:0, su:false,
           poi:null, pausaTot:0, fatti:new Set(), riscMs:0, riscAvvio:0, salvato:false};
const el = id => document.getElementById(id);
const runEl = el('run');

// opz.poi: sessione da fare dopo (riscaldamento concatenato)
// opz.riscMs/riscAvvio: tempo del riscaldamento appena fatto, da sommare a questa sessione
function apri(sess, opz = {}){
  R.sess = sess; R.q = costruisci(sess); R.i = 0; R.inPausa = false; R.avvio = Date.now();
  R.poi = opz.poi || null; R.riscMs = opz.riscMs || 0; R.riscAvvio = opz.riscAvvio || 0;
  R.pausaTot = 0; R.fatti = new Set(); R.salvato = false;
  el('pausa').textContent = 'Pausa';
  runEl.classList.add('on'); runEl.classList.remove('pausa');
  document.body.style.overflow = 'hidden';
  initAudio(); wake(); avviaVivo();
  vaiA(0);
}

function chiudi(){
  clearInterval(R.tick); R.tick = null;
  annullaBip(); fermaVivo();
  runEl.classList.remove('on'); document.body.style.overflow = '';
  try{ speechSynthesis.cancel(); }catch(e){}
  rilasciaWake();
}

// opz.daTimer: lo step precedente è scaduto da solo, il suo bip di cambio è già programmato
function vaiA(i, opz = {}){
  clearInterval(R.tick); R.tick = null;
  const giaSuonato = opz.daTimer && R.bipCambio;
  if(giaSuonato) programmati = [];   // lascio finire i bip in corso
  else annullaBip();
  R.bipCambio = false;
  if(i < 0) i = 0;
  // un esercizio lasciato in avanti (timer scaduto, Avanti o Fatto) conta come fatto
  if(i > R.i && R.q[R.i] && R.q[R.i].type === 'work') R.fatti.add(R.i);
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
    const poi = R.poi;
    if(poi){
      adattaNome('Riscaldamento fatto');
      el('nota').textContent = 'Pronto per ' + poi.nome.toLowerCase() + '.';
      el('avanti').textContent = 'Vai con ' + poi.nome;
      if(!giaSuonato) bipFine();
      parla('Riscaldamento finito. Quando sei pronto, si comincia.');
    }else{
      el('avanti').textContent = 'Chiudi';
      if(!giaSuonato) bipFine();
      parla('Allenamento completato. Bravo.');
    }
    aggiornaMedia();
    salvaFatto(false);
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
    if(!giaSuonato) bipVia();
    parla(e.n + (e.say ? ', ' + e.say : (e.tipo === 'rip' ? '' : ', ' + parlaTempo(e.t))) + '. Via.');
  }
  else if(s.type === 'rest'){
    el('stato').textContent = 'Riposo';
    adattaNome(s.next ? s.next.e.n : 'Pausa');
    el('rip').textContent = s.next && s.next.e.r ? s.next.e.r : '';
    el('nota').textContent = s.next && s.next.e.d ? s.next.e.d : '';
    el('dopo').textContent = s.giroDopo ? 'Poi giro ' + s.giroDopo + ' di ' + s.giri : 'Prossimo esercizio';
    el('pos').textContent = 'Riposo ' + s.dur + '"';
    if(!giaSuonato) bipStop();
    let t = 'Riposo ' + s.dur + ' secondi.';
    if(s.giroDopo) t += ' Poi giro ' + s.giroDopo + '.';
    if(s.next) t += ' Prossimo: ' + s.next.e.n + (s.next.e.say ? ', ' + s.next.e.say : '') + '.';
    parla(t);
  }

  disegna();
  programmaBip();
  aggiornaMedia();
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
  controllaVivo();
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
    if(sec <= 3 && sec >= 1) flash();   // i bip 3-2-1 sono già programmati
    if(sec === 10 && s.dur >= 25 && s.type !== 'work') parla('Dieci secondi.');
    if(sec === 10 && s.type === 'work' && s.dur >= 40) parla('Dieci secondi.');
  }
  disegna();
  if(ms <= 0) vaiA(R.i + 1, {daTimer:true});
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
// tempo reale di allenamento in ms, pause escluse
function tempoEffettivo(){
  const ora = Date.now();
  return ora - R.avvio - R.pausaTot - (R.inPausa ? ora - (R.pausaDa || ora) : 0);
}
function durataTot(){
  const m = Math.round((tempoEffettivo() + R.riscMs) / 60000);
  return m + (m === 1 ? ' minuto' : ' minuti');
}
function flash(){
  const t = el('tempo');
  t.classList.remove('pulse'); void t.offsetWidth; t.classList.add('pulse');
}

/* wake lock */
// il sistema rilascia il lock quando l'app va in background: lo richiedo al ritorno
let wl = null;
async function wake(){
  if(!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  if(wl && !wl.released) return;   // già attivo: niente doppioni (es. riscaldamento → sessione)
  try{
    wl = await navigator.wakeLock.request('screen');
    wl.addEventListener('release', () => { wl = null; });
  }catch(e){ wl = null; }
}
function rilasciaWake(){ try{ wl && wl.release(); }catch(e){} wl = null; }
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState !== 'visible' || !runEl.classList.contains('on')) return;
  wake();
  controllaVivo();
  // al ritorno in primo piano rimetto in pari lo schermo e i bip
  if(!R.inPausa && !R.manuale) programmaBip();
  disegna(); aggiornaMedia();
});

/* comandi */
el('avanti').onclick = () => {
  const s = R.q[R.i];
  if(s.type === 'done'){
    const poi = R.poi;
    if(poi) return apri(poi, {riscMs:tempoEffettivo(), riscAvvio:R.avvio});
    return chiudi();
  }
  vaiA(R.i + 1);
};
el('indietro').onclick = () => {
  let j = R.i - 1;
  while(j > 0 && R.q[j].type === 'rest') j--;
  vaiA(Math.max(0, j));
};
el('piu').onclick = () => {
  R.fineA += 15000; R.rimasti += 15; disegna(); bip(700,.08,.2);
  programmaBip(); aggiornaMedia();
};
el('pausa').onclick = () => {
  R.inPausa = !R.inPausa;
  runEl.classList.toggle('pausa', R.inPausa);
  el('pausa').textContent = R.inPausa ? 'Riprendi' : 'Pausa';
  if(R.inPausa){ R.pausaDa = Date.now(); annullaBip(); try{ speechSynthesis.cancel(); }catch(e){} }
  else {
    const fermo = Date.now() - (R.pausaDa || Date.now());
    R.fineA = Date.now() + R.rimasti * 1000;
    R.inizioManuale += fermo;
    R.pausaTot += fermo;
    programmaBip();
  }
  aggiornaMedia();
};
// Esci: se c'è almeno un esercizio fatto la sessione finisce nello storico come parziale
function esci(){
  const s = R.q[R.i];
  if(s && s.type !== 'done' && R.fatti.size > 0){
    if(!confirm('Esci dalla sessione?\nLa salvo nello storico come parziale.')) return;
    salvaFatto(true);
  }
  chiudi();
}
el('chiudi').onclick = esci;
document.addEventListener('keydown', e => {
  if(!runEl.classList.contains('on')) return;
  if(e.code === 'Space'){ e.preventDefault(); el('pausa').click(); }
  if(e.code === 'ArrowRight'){ e.preventDefault(); el('avanti').click(); }
  if(e.code === 'ArrowLeft'){ e.preventDefault(); el('indietro').click(); }
  if(e.code === 'Escape') esci();
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
      const f = +b.dataset.fase;
      if(f !== S.fase) segnaFase(f);
      S.fase = f; store.set('fase', S.fase); disegnaLista();
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
    btn.onclick = () => apri(RISC, {poi:sess});
    if(conSbarra){
      sec.hidden = false;
      sec.textContent = 'Vai diretto alla sbarra · fase ' + S.fase;
      sec.onclick = () => apri(sbarraSess(S.fase));
    }
  }
}

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

// registra la sessione corrente; parziale = interrotta prima della fine
async function salvaFatto(parziale){
  if(R.salvato) return;
  // riscaldamento concatenato finito: i suoi minuti passano alla sessione che segue
  if(!parziale && R.sess.id === 'risc' && R.poi) return;
  const esercizi = R.fatti.size;
  if(parziale && esercizi === 0) return;
  R.salvato = true;
  const lavori = R.q.filter(x => x.type === 'work');
  const rec = {
    d: new Date().toISOString(),
    inizio: new Date(R.riscAvvio || R.avvio).toISOString(),
    sessId: R.sess.id, nome: R.sess.nome, tipo: tipoSess(R.sess.id), fase: faseSess(R.sess.id),
    min: Math.max(1, Math.round((tempoEffettivo() + R.riscMs) / 60000)),
    esercizi, eserciziTot: lavori.length, parziale, v:2
  };
  if(R.riscMs) rec.conRisc = true;
  if(parziale){
    // ultimo esercizio raggiunto: da lì ricavo blocco e giro
    let j = R.i;
    while(j > 0 && R.q[j].type !== 'work') j--;
    const w = R.q[j];
    if(w && w.type === 'work'){
      const b = R.sess.blocchi[w.blocco];
      rec.arrivo = {blocco:w.blocco + 1, blocchi:R.sess.blocchi.length, titolo:b.titolo || null,
                    giro:w.giro, giri:w.giri, esercizio:w.n};
    }
  }
  try{ await DB.metti('sessioni', rec); }catch(e){}
  await ricaricaStorico();
}

// registra la fase della sbarra con la data del cambio
async function segnaFase(fase){
  try{ await DB.metti('fasi', {d:new Date().toISOString(), fase}); }catch(e){}
  await ricaricaStorico();
}

/* avvio */
(async () => {
  await DB.apri();
  await migraVecchioStorage();
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
  LOG = await DB.tutte('sessioni').catch(() => []);
  FASI = await DB.tutte('fasi').catch(() => []);
  // prima volta: segno la fase di partenza della sbarra
  if(!FASI.length) segnaFase(S.fase);
  DB.persistente().then(p => { PERSISTENTE = p; disegnaStatoDati(); });
  disegnaOggi(); disegnaSettimana(); disegnaLista(); disegnaStorico();
  initStorico();
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
