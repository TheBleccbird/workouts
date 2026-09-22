/* ============ STORICO ============
   Riepilogo in home + vista #storico: calendario, minuti per mese,
   fase della sbarra, elenco per settimana, esporta/importa.            */
let LOG = [];          // sessioni, dalla più recente
let FASI = [];         // cambi di fase della sbarra, dal più recente
let PERSISTENTE = false;
let settimaneVisibili = 12;

const MESI = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
const MESI_LUNGHI = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
// colore e lettera per tipo di sessione (lettera = identità anche senza colore)
const TIPI = {
  A:      {nome:'Sessione A', lettera:'A', col:'var(--c-a)'},
  sbarra: {nome:'Sbarra', lettera:'S', col:'var(--c-sbarra)'},
  B:      {nome:'Sessione B', lettera:'B', col:'var(--c-b)'},
  risc:   {nome:'Riscaldamento', lettera:'R', col:'var(--c-altro)'},
  stretch:{nome:'Defaticamento', lettera:'D', col:'var(--c-altro)'},
  altro:  {nome:'Altro', lettera:'·', col:'var(--c-altro)'}
};
const ORDINE_TIPI = ['A', 'B', 'sbarra', 'risc', 'stretch', 'altro'];
const tipoDi = x => TIPI[x.tipo] ? x.tipo : 'altro';

const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const due = n => String(n).padStart(2, '0');
const chiaveGiorno = d => d.getFullYear() + '-' + due(d.getMonth() + 1) + '-' + due(d.getDate());
const oraDi = d => due(d.getHours()) + ':' + due(d.getMinutes());
const dataBreve = d => d.getDate() + ' ' + MESI[d.getMonth()];
function lunedi(d){
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - (x.getDay() + 6) % 7);
  return x;
}
const piu = (d, giorni) => { const x = new Date(d); x.setDate(x.getDate() + giorni); return x; };

async function ricaricaStorico(){
  try{ LOG = await DB.tutte('sessioni'); FASI = await DB.tutte('fasi'); }catch(e){}
  disegnaStorico();
}

function disegnaStorico(){
  // la prossima sessione e gli ultimi 7 giorni dipendono dallo storico
  disegnaOggi();
  disegnaUltimi();
  disegnaRiepilogoHome();
  disegnaConteggio();
  disegnaCalendario();
  disegnaMesi();
  disegnaFasi();
  disegnaElenco();
  disegnaStatoDati();
}

// dove si era fermata una sessione parziale (v3: serie di fila; prima: giri del circuito)
function arrivoTesto(x){
  const a = x.arrivo;
  if(!a) return '';
  if(a.serieTot != null) return ' · es. ' + a.esercizio + (a.serieTot > 1 ? ', serie ' + a.serie + '/' + a.serieTot : '');
  return ' · giro ' + a.giro + '/' + a.giri;
}

function rigaSessione(x){
  const d = new Date(x.d);
  const g = NOMI_G[(d.getDay() + 6) % 7].slice(0, 3).toLowerCase();
  let info = g + ' ' + d.getDate() + '/' + (d.getMonth() + 1) + ' · ' + oraDi(d);
  if(x.fase) info += ' · fase ' + x.fase;
  const parz = x.parziale
    ? `<em class="parz">parziale${arrivoTesto(x)}${x.esercizi != null ? ' · ' + x.esercizi + '/' + x.eserciziTot + (x.v >= 3 ? ' serie' : ' es.') : ''}</em>`
    : '';
  return `<div class="storia"><b><span class="punto" style="background:${TIPI[tipoDi(x)].col}"></span>${esc(x.nome || x.s)}<i>${info}</i>${parz}${rigaFeedback(x)}</b><span>${x.min || 0} min</span></div>`;
}

// riepilogo del questionario di fine sessione (testoFb è in app.js)
function rigaFeedback(x){
  const f = x.feedback;
  if(!f) return '';
  const parti = (f.esercizi || []).filter(y => y.fatto != null).map(y => y.n + ' ' + testoFb(y));
  if(f.fatica) parti.push('fatica ' + f.fatica + '/10');
  if(f.nota) parti.push('“' + f.nota + '”');
  return parti.length ? `<em class="fb">${esc(parti.join(' · '))}</em>` : '';
}

/* ---- riepilogo in home ---- */
function disegnaRiepilogoHome(){
  const ora = Date.now();
  const entro = gg => LOG.filter(x => ora - new Date(x.d).getTime() < gg * 864e5);
  const minuti = entro(30).reduce((a, x) => a + (x.min || 0), 0);
  let html = `<div class="conteggio">
      <div><strong>${entro(7).length}</strong><em>ultimi 7 giorni</em></div>
      <div><strong>${entro(30).length}</strong><em>ultimi 30 giorni</em></div>
      <div><strong>${minuti}</strong><em>minuti nel mese</em></div>
    </div>`;
  if(!LOG.length){
    html += `<p class="vuoto">Nessuna sessione registrata.<br>Quando arrivi in fondo a una sessione finisce qui dentro.</p>`;
  }else{
    html += LOG.slice(0, 3).map(rigaSessione).join('');
  }
  el('storico').innerHTML = html;
}

/* ---- vista storico ---- */
function disegnaConteggio(){
  const oggi = new Date();
  const dal = lunedi(oggi).getTime();
  const settimana = LOG.filter(x => new Date(x.d).getTime() >= dal).length;
  const mese = LOG.filter(x => { const d = new Date(x.d); return d.getMonth() === oggi.getMonth() && d.getFullYear() === oggi.getFullYear(); });
  el('st-conteggio').innerHTML = `<div class="conteggio">
      <div><strong>${settimana}</strong><em>questa settimana</em></div>
      <div><strong>${mese.length}</strong><em>a ${MESI_LUNGHI[oggi.getMonth()]}</em></div>
      <div><strong>${LOG.length}</strong><em>in totale</em></div>
    </div>`;
}

// sessioni raggruppate per giorno locale
function perGiorno(){
  const m = new Map();
  for(const x of LOG){
    const k = chiaveGiorno(new Date(x.d));
    if(!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

// uno spicchio verticale per tipo (max 2), separati da 2px di sfondo; lettera al centro di ognuno
function sfondoCella(voci){
  const tipi = ORDINE_TIPI.filter(t => voci.some(x => tipoDi(x) === t)).slice(0, 2);
  const [c1, c2] = tipi.map(t => TIPI[t].col);
  const bg = c2 ? `linear-gradient(90deg, ${c1} 0 calc(50% - 1px), var(--carta) calc(50% - 1px) calc(50% + 1px), ${c2} calc(50% + 1px))` : c1;
  return {bg, lettere:tipi.map(t => `<span>${TIPI[t].lettera}</span>`).join('')};
}

function disegnaCalendario(){
  const oggi = new Date();
  const inizio = lunedi(piu(oggi, -90));
  const fine = piu(lunedi(oggi), 6);
  const colonne = Math.round((fine - inizio) / (7 * 864e5)) + 1;
  const giorni = perGiorno();
  const kOggi = chiaveGiorno(oggi);
  let html = `<div class="cal" style="grid-template-columns:14px repeat(${colonne}, minmax(0,1fr))">`;
  // etichette dei mesi sopra la prima settimana che li contiene
  const etichette = [];
  for(let c = 0; c < colonne; c++){
    const m = piu(inizio, c * 7 + 6).getMonth();
    if(!etichette.length || etichette[etichette.length - 1].m !== m) etichette.push({c, m});
  }
  etichette.forEach((x, i) => {
    const prossima = etichette[i + 1];
    if(prossima && prossima.c - x.c < 3) return;   // non c'è spazio: la salto
    html += `<span class="cal-mese" style="grid-column:${x.c + 2} / span 3; grid-row:1">${MESI[x.m]}</span>`;
  });
  ['L','M','M','G','V','S','D'].forEach((g, r) => {
    html += `<span class="cal-g" style="grid-row:${r + 2}">${r % 2 === 0 ? g : ''}</span>`;
  });
  for(let c = 0; c < colonne; c++){
    for(let r = 0; r < 7; r++){
      const d = piu(inizio, c * 7 + r);
      const k = chiaveGiorno(d);
      const voci = giorni.get(k) || [];
      const pos = `grid-column:${c + 2}; grid-row:${r + 2}`;
      const futuro = k > kOggi;
      const cls = ['cal-c', k === kOggi ? 'oggi-c' : '', futuro ? 'futuro' : ''];
      let stile = pos, dentro = '';
      if(voci.length){
        const {bg, lettere} = sfondoCella(voci);
        cls.push('pieno');
        if(voci.every(x => x.parziale)) cls.push('parziale');
        stile += `; background:${bg}`;
        dentro = lettere;
      }
      const etichetta = `${NOMI_G[r]} ${dataBreve(d)}: ` + (voci.length ? voci.map(x => (x.nome || x.s) + (x.parziale ? ' parziale' : '')).join(', ') : 'niente');
      html += `<button class="${cls.join(' ')}" style="${stile}" data-k="${k}" aria-label="${esc(etichetta)}"${futuro ? ' disabled' : ''}>${dentro}</button>`;
    }
  }
  html += '</div>';
  html += `<p class="cal-dett" id="cal-dett">Tocca un giorno per vedere cosa hai fatto.</p>`;
  html += `<div class="legenda">${['A','B','sbarra'].map(t => `<span><i style="background:${TIPI[t].col}"></i>${TIPI[t].lettera} · ${TIPI[t].nome}</span>`).join('')}
      <span><i style="background:var(--c-altro)"></i>R/D · Riscaldamento, stretching</span>
      <span><i class="tratteggio"></i>Parziale</span></div>`;
  const box = el('st-calendario');
  box.innerHTML = html;
  box.querySelectorAll('.cal-c:not([disabled])').forEach(b => b.onclick = () => {
    box.querySelectorAll('.cal-c.scelta').forEach(x => x.classList.remove('scelta'));
    b.classList.add('scelta');
    const [a, m, g] = b.dataset.k.split('-').map(Number);
    const d = new Date(a, m - 1, g);
    const voci = (giorni.get(b.dataset.k) || []).slice().reverse();
    const titolo = NOMI_G[(d.getDay() + 6) % 7] + ' ' + dataBreve(d);
    el('cal-dett').innerHTML = voci.length
      ? `<b>${titolo}</b> · ` + voci.map(x => `${esc(x.nome || x.s)} ${x.min || 0} min${x.parziale ? ' (parziale)' : ''}`).join(' · ')
      : `<b>${titolo}</b> · nessuna sessione`;
  });
}

function disegnaMesi(){
  const oggi = new Date();
  const mesi = [];
  for(let i = 5; i >= 0; i--){
    const d = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1);
    const voci = LOG.filter(x => { const t = new Date(x.d); return t.getMonth() === d.getMonth() && t.getFullYear() === d.getFullYear(); });
    mesi.push({d, min:voci.reduce((a, x) => a + (x.min || 0), 0), n:voci.length});
  }
  const max = Math.max(1, ...mesi.map(m => m.min));
  el('st-mesi').innerHTML = mesi.map(m => `
    <div class="mese" title="${MESI_LUNGHI[m.d.getMonth()]} ${m.d.getFullYear()}: ${m.min} minuti in ${m.n} sessioni">
      <span class="mese-n">${MESI[m.d.getMonth()]}</span>
      <span class="mese-barra"><i style="width:${m.min ? Math.max(2, m.min / max * 100) : 0}%"></i></span>
      <span class="mese-v">${m.min} min<em>${m.n} sess.</em></span>
    </div>`).join('');
}

// periodi consecutivi nella stessa fase, ricavati dalle sessioni alla sbarra
function periodiFase(){
  const sb = LOG.filter(x => x.tipo === 'sbarra' && x.fase).slice().reverse();
  const out = [];
  for(const x of sb){
    const ult = out[out.length - 1];
    if(ult && ult.fase === x.fase){ ult.al = x.d; ult.n++; }
    else out.push({fase:x.fase, dal:x.d, al:x.d, n:1});
  }
  return out;
}

function disegnaFasi(){
  const periodi = periodiFase();
  const impostata = FASI[0];
  const nomi = {1:'Presa e spalle', 2:'Attivare la schiena', 3:'La prima trazione'};
  let html = '';
  if(periodi.length){
    const t0 = new Date(periodi[0].dal).getTime(), t1 = Date.now();
    const span = Math.max(1, t1 - t0);
    // banda nel tempo: ogni periodo dura fino all'inizio del successivo
    html += '<div class="fasi-banda">' + periodi.map((p, i) => {
      const a = new Date(p.dal).getTime();
      const b = i < periodi.length - 1 ? new Date(periodi[i + 1].dal).getTime() : t1;
      return `<i class="f${p.fase}" style="flex:${Math.max(.02, (b - a) / span)}" title="Fase ${p.fase}"><span>${p.fase}</span></i>`;
    }).join('') + '</div>';
    html += `<div class="fasi-asse"><span>${dataBreve(new Date(t0))}</span><span>oggi</span></div>`;
    html += periodi.slice().reverse().map(p => `
      <div class="storia"><b><span class="punto f${p.fase}"></span>Fase ${p.fase} · ${nomi[p.fase]}<i>${dataBreve(new Date(p.dal))}${p.al !== p.dal ? ' → ' + dataBreve(new Date(p.al)) : ''}</i></b><span>${p.n} ${p.n === 1 ? 'sessione' : 'sessioni'}</span></div>`).join('');
  }else{
    html += `<p class="vuoto">Nessuna sessione alla sbarra ancora.</p>`;
  }
  const fase = typeof S !== 'undefined' ? S.fase : (impostata && impostata.fase);
  html += `<p class="vuoto">Fase impostata ora: <b>${fase}</b>${impostata ? ' · scelta il ' + dataBreve(new Date(impostata.d)) + ' ' + new Date(impostata.d).getFullYear() : ''}</p>`;
  el('st-fasi').innerHTML = html;
}

function disegnaElenco(){
  const box = el('st-elenco');
  if(!LOG.length){
    box.innerHTML = `<p class="vuoto">Nessuna sessione registrata.</p>`;
    return;
  }
  const gruppi = [];
  for(const x of LOG){
    const k = chiaveGiorno(lunedi(new Date(x.d)));
    let g = gruppi[gruppi.length - 1];
    if(!g || g.k !== k){ g = {k, lun:lunedi(new Date(x.d)), voci:[]}; gruppi.push(g); }
    g.voci.push(x);
  }
  const kOra = chiaveGiorno(lunedi(new Date()));
  box.innerHTML = gruppi.slice(0, settimaneVisibili).map(g => {
    const dom = piu(g.lun, 6);
    const titolo = g.k === kOra ? 'Questa settimana'
      : g.lun.getMonth() === dom.getMonth() ? `${g.lun.getDate()}–${dom.getDate()} ${MESI[dom.getMonth()]}`
      : `${dataBreve(g.lun)} – ${dataBreve(dom)}`;
    const min = g.voci.reduce((a, x) => a + (x.min || 0), 0);
    const anno = g.lun.getFullYear() !== new Date().getFullYear() ? ' ' + g.lun.getFullYear() : '';
    return `<div class="settimana-g">
        <div class="settimana-t"><b>${titolo}${anno}</b><span>${g.voci.length} ${g.voci.length === 1 ? 'sessione' : 'sessioni'} · ${min} min</span></div>
        ${g.voci.map(rigaSessione).join('')}
      </div>`;
  }).join('') + (gruppi.length > settimaneVisibili
    ? `<button class="altre" id="altre-settimane">Mostra altre settimane (${gruppi.length - settimaneVisibili})</button>` : '');
  const altre = el('altre-settimane');
  if(altre) altre.onclick = () => { settimaneVisibili += 12; disegnaElenco(); };
}

async function disegnaStatoDati(){
  el('storico-stato').textContent = DB.tipo === 'memoria'
    ? 'Solo in memoria: si perde chiudendo'
    : 'Salvato su questo telefono' + (DB.tipo === 'localStorage' ? ' (archivio semplice)' : '')
      + (PERSISTENTE ? ', protetto dalla pulizia automatica' : '. Installa l\'app per proteggerlo');
  const ult = await DB.get('ultimoExport').catch(() => null);
  el('st-backup').textContent = ult
    ? 'Ultima copia: ' + dataBreve(new Date(ult)) + ' ' + new Date(ult).getFullYear()
    : 'File JSON da tenere su Drive · mai fatta';
}

/* ---- esporta / importa ---- */
async function datiEsportati(){
  return {app:'allenamento', versione:2, esportato:new Date().toISOString(),
          sessioni:await DB.tutte('sessioni'), fasi:await DB.tutte('fasi')};
}

async function esporta(){
  const testo = JSON.stringify(await datiEsportati(), null, 2);
  const nome = 'allenamenti-' + chiaveGiorno(new Date()) + '.json';
  let fatto = false;
  if(window.showSaveFilePicker){
    try{
      const h = await showSaveFilePicker({suggestedName:nome,
        types:[{description:'Storico allenamenti', accept:{'application/json':['.json']}}]});
      const w = await h.createWritable();
      await w.write(testo); await w.close();
      fatto = true;
    }catch(e){
      if(e.name === 'AbortError') return;   // annullato dall'utente
    }
  }
  if(!fatto){
    try{
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([testo], {type:'application/json'}));
      a.download = nome;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      fatto = true;
    }catch(e){
      try{ await navigator.clipboard.writeText(testo); alert('Storico copiato negli appunti.'); fatto = true; }
      catch(e2){ alert(testo); }
    }
  }
  if(fatto){ await DB.set('ultimoExport', new Date().toISOString()).catch(() => {}); disegnaStatoDati(); }
}

// accetta il vecchio formato (array di {d, s, min}) e il nuovo ({sessioni, fasi})
function leggiImport(dati){
  const grezze = Array.isArray(dati) ? dati : (dati && Array.isArray(dati.sessioni) ? dati.sessioni : null);
  if(!grezze) throw new Error('formato');
  const valida = x => x && typeof x.d === 'string' && !isNaN(Date.parse(x.d));
  const sessioni = grezze.filter(valida).map(x => x.sessId ? x : (x.s ? daVecchioFormato(x) : null)).filter(Boolean);
  const fasi = (dati && Array.isArray(dati.fasi) ? dati.fasi : [])
    .filter(x => valida(x) && [1, 2, 3].includes(x.fase)).map(x => ({d:x.d, fase:x.fase}));
  return {sessioni, fasi, scartate:grezze.length - sessioni.length};
}

async function importa(file){
  let dati;
  try{ dati = leggiImport(JSON.parse(await file.text())); }
  catch(e){ alert('Il file non sembra uno storico di allenamenti.'); return; }
  const r = await DB.fondi('sessioni', dati.sessioni);
  await DB.fondi('fasi', dati.fasi);
  await ricaricaStorico();
  alert(`Importazione fatta.\nSessioni aggiunte: ${r.aggiunte}\nGià presenti: ${r.presenti}` + (dati.scartate ? `\nNon valide, ignorate: ${dati.scartate}` : ''));
}

/* ---- navigazione: #storico, #impostazioni ---- */
const VISTE = {'#storico':'vista-storico', '#impostazioni':'vista-impostazioni'};
let daHome = false;
function mostraVista(){
  const vista = VISTE[location.hash] || 'home';
  ['home', ...Object.values(VISTE)].forEach(id => { el(id).hidden = id !== vista; });
  window.scrollTo(0, 0);
}

function initStorico(){
  window.addEventListener('hashchange', mostraVista);
  document.querySelectorAll('.apri-storico, .apri-imp').forEach(a => a.addEventListener('click', () => { daHome = true; }));
  document.querySelectorAll('main .indietro').forEach(a => a.onclick = e => {
    e.preventDefault();
    // torno indietro nella cronologia così il tasto Indietro di Android resta coerente
    if(daHome){ daHome = false; history.back(); }
    else{ history.replaceState(null, '', location.pathname); mostraVista(); }
  });
  el('esporta').onclick = esporta;
  el('importa').onclick = () => el('file-importa').click();
  el('file-importa').onchange = e => {
    const f = e.target.files[0];
    e.target.value = '';
    if(f) importa(f);
  };
  el('svuota').onclick = async () => {
    if(!confirm('Cancello tutto lo storico da questo telefono?\nSe non hai una copia esportata non si recupera.')) return;
    await DB.svuota('sessioni'); await DB.svuota('fasi');
    await ricaricaStorico();
  };
  mostraVista();
}
