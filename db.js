/* ============ ARCHIVIO ============
   IndexedDB nativo, con ripiego su localStorage (e infine sulla memoria).
   Archivi:
   - kv        impostazioni, chiave esterna (voce, bip, fase…)
   - sessioni  una voce per sessione, chiave = d (ISO di fine sessione)
   - fasi      cambi di fase della sbarra, chiave = d                      */
const DB = (() => {
  const NOME = 'allenamento', VERSIONE_DB = 1;
  const CHIAVI = {sessioni:'d', fasi:'d'};
  let db = null;
  let tipo = 'memoria';
  const mem = {kv:{}, sessioni:{}, fasi:{}};

  const req2p = r => new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
  const fineTx = tx => new Promise((ok, ko) => { tx.oncomplete = () => ok(); tx.onabort = tx.onerror = () => ko(tx.error); });

  function apriIDB(){
    return new Promise((ok, ko) => {
      const r = indexedDB.open(NOME, VERSIONE_DB);
      r.onupgradeneeded = () => {
        const d = r.result;
        if(!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
        for(const [s, k] of Object.entries(CHIAVI)){
          if(!d.objectStoreNames.contains(s)) d.createObjectStore(s, {keyPath:k});
        }
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
      r.onblocked = () => ko(new Error('bloccato'));
    });
  }

  /* --- ripiego su localStorage: ogni archivio è un oggetto chiave → valore --- */
  const LS = 'lg2_';
  function lsLeggi(s){
    try{ return JSON.parse(localStorage.getItem(LS + s)) || {}; }catch(e){ return {}; }
  }
  function lsScrivi(s, o){ localStorage.setItem(LS + s, JSON.stringify(o)); }
  function lsOk(){
    try{ localStorage.setItem(LS + 't', '1'); localStorage.removeItem(LS + 't'); return true; }catch(e){ return false; }
  }

  // legge/scrive l'oggetto di un archivio nei due ripieghi
  const ogg = s => tipo === 'localStorage' ? lsLeggi(s) : mem[s];
  const salvaOgg = (s, o) => { if(tipo === 'localStorage') lsScrivi(s, o); else mem[s] = o; };

  return {
    get tipo(){ return tipo; },

    async apri(){
      if(db || tipo !== 'memoria') return tipo;
      try{
        if(!window.indexedDB) throw new Error('assente');
        db = await apriIDB();
        // se un'altra scheda aggiorna lo schema, chiudo per non bloccarla
        db.onversionchange = () => { db.close(); db = null; };
        tipo = 'indexedDB';
      }catch(e){
        tipo = lsOk() ? 'localStorage' : 'memoria';
      }
      return tipo;
    },

    async get(k){
      if(db) return (await req2p(db.transaction('kv').objectStore('kv').get(k))) ?? null;
      const o = ogg('kv'); return k in o ? o[k] : null;
    },

    async set(k, v){
      if(db){
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(v, k);
        return fineTx(tx);
      }
      const o = ogg('kv'); o[k] = v; salvaOgg('kv', o);
    },

    // tutte le voci di un archivio, dalla più recente
    async tutte(s){
      const arr = db ? await req2p(db.transaction(s).objectStore(s).getAll()) : Object.values(ogg(s));
      return arr.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
    },

    async metti(s, v){
      if(db){
        const tx = db.transaction(s, 'readwrite');
        tx.objectStore(s).put(v);
        return fineTx(tx);
      }
      const o = ogg(s); o[v[CHIAVI[s]]] = v; salvaOgg(s, o);
    },

    // aggiunge solo le voci con chiave nuova: niente sovrascritture
    async fondi(s, voci){
      let aggiunte = 0, presenti = 0;
      if(db){
        const tx = db.transaction(s, 'readwrite');
        const st = tx.objectStore(s);
        for(const v of voci){
          const r = st.add(v);
          r.onsuccess = () => aggiunte++;
          // chiave già presente: annullo l'errore così la transazione prosegue
          r.onerror = e => { e.preventDefault(); e.stopPropagation(); presenti++; };
        }
        await fineTx(tx);
      }else{
        const o = ogg(s), k = CHIAVI[s];
        for(const v of voci){
          if(v[k] in o) presenti++;
          else { o[v[k]] = v; aggiunte++; }
        }
        salvaOgg(s, o);
      }
      return {aggiunte, presenti};
    },

    async svuota(s){
      if(db){
        const tx = db.transaction(s, 'readwrite');
        tx.objectStore(s).clear();
        return fineTx(tx);
      }
      salvaOgg(s, {});
    },

    // chiede a Chrome di non cancellare i dati sotto pressione di spazio
    async persistente(){
      try{
        if(!navigator.storage || !navigator.storage.persist) return false;
        if(await navigator.storage.persisted()) return true;
        return await navigator.storage.persist();
      }catch(e){ return false; }
    }
  };
})();
