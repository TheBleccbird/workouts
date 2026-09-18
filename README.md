# Allenamento

PWA per allenamento guidato a voce (casa + parco + sbarra). File statici, nessuna dipendenza, nessun build.

## File

| File | Cosa contiene |
|---|---|
| `index.html` | markup di home, storico e schermo di allenamento |
| `app.css` | stile, font locali |
| `data.js` | il piano: sessioni, esercizi, fasi della sbarra, settimana |
| `db.js` | archivio IndexedDB (ripiego su localStorage) |
| `storico.js` | schermata Storico, esporta/importa |
| `app.js` | motore dei timer, audio, voce, ripresa, home |
| `sw.js` | service worker: precache e funzionamento offline |
| `manifest.webmanifest`, `icons/`, `fonts/` | installazione come app |

## Provarla sul computer

```sh
python3 -m http.server 8000
```

Poi apri <http://localhost:8000>. Il service worker funziona solo su `localhost` o in HTTPS.

## Pubblicare una modifica

Il service worker serve i file dalla cache. Per far arrivare una modifica al telefono **cambia `VERSIONE` in `sw.js`** (es. `'v5'` → `'v6'`) e pubblica. Se aggiungi un file, mettilo anche nella lista `ASSET`. Alla prossima apertura dell'app compare "Nuova versione disponibile · Aggiorna".

## Dati

Lo storico resta solo sul telefono. Ogni tanto fai **Storico › Esporta** e tieni il file JSON su Drive. **Importa** fonde il file con lo storico esistente senza creare doppioni, e accetta anche il vecchio formato di `allenamento.html`.
