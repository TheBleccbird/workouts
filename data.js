/* ============ DATI ============ */
// cambio: secondi in più prima dell'esercizio successivo (posare il peso, cambiare posizione)
const yt = q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);

const RISC = {
  id:'risc', nome:'Riscaldamento', durata:'5 min', sottotitolo:'Prima di ogni sessione',
  nota:'Corsetta blanda sul posto, mantenuta per tutta la sequenza.',
  blocchi:[{serie:1, riposoEs:0, riposoSerie:0, esercizi:[
    {n:'Circonduzione dei polsi', d:'Braccia avanti, giri ampi', t:25, video:'circonduzione polsi riscaldamento'},
    {n:'Polsi con mani unite', d:'Dita intrecciate', t:25, video:'mobilità polsi mani intrecciate'},
    {n:'Spalle avanti, braccia larghe', d:'Cerchi grandi', t:25, video:'circonduzioni spalle avanti'},
    {n:'Spalle avanti, braccia strette', d:'Cerchi piccoli e veloci', t:25, video:'circonduzioni spalle avanti'},
    {n:'Spalle indietro, braccia larghe', d:'Apri il petto', t:25, video:'circonduzioni spalle indietro'},
    {n:'Spalle indietro, braccia strette', d:'Cerchi piccoli', t:25, video:'circonduzioni spalle indietro'},
    {n:'Apertura e chiusura braccia', d:'Abbraccio ampio', t:25, cambio:8, video:'apertura chiusura braccia riscaldamento'},
    {n:'Tocco piede controlaterale', d:'Busto flesso, gambe tese', t:25, cambio:5, video:'tocco piede controlaterale esercizio'},
    {n:'Mezzo affondo indietro', d:'Alterna le gambe', r:'20 rip', say:'20 ripetizioni', t:45, tipo:'rip', video:'mezzo affondo indietro tecnica'}
  ]}]
};

const SESS_A = {
  id:'A', nome:'Sessione A', durata:'~40 min', sottotitolo:'Gambe + spinta · 3 serie',
  nota:'3 serie di fila per esercizio, 45" di riposo tra le serie e prima del cambio. Nessuna tirata: la schiena arriva fresca alla sbarra.',
  blocchi:[
    {serie:3, riposoEs:45, riposoSerie:45, esercizi:[
      {n:'Goblet squat', d:'Manubrio al petto, discesa in 2"', r:'15', say:'15 ripetizioni', t:55, tipo:'rip', cambio:15, video:'goblet squat tecnica corretta'},
      {n:'Piegamenti sulle braccia', d:'Se duri: su rialzo o ginocchia', r:'max −2', say:'massimo meno due', t:45, tipo:'rip', cambio:10, video:'piegamenti sulle braccia tecnica'},
      {n:'Affondo indietro alternato', d:'Un manubrio per mano', r:'10 + 10', say:'10 per gamba', t:65, tipo:'rip', video:'affondo indietro alternato manubri'},
      {n:'Military press', d:'In piedi, core contratto', r:'10', say:'10 ripetizioni', t:40, tipo:'rip', cambio:10, video:'military press manubri in piedi'},
      {n:'Ponte glutei monopodalico', d:'Pausa 1" in alto', r:'12 + 12', say:'12 per gamba', t:65, tipo:'rip', cambio:10, video:'ponte glutei monopodalico'},
      {n:'Alzate laterali', d:'Peso leggero, movimento pulito', r:'15', say:'15 ripetizioni', t:45, tipo:'rip', cambio:10, video:'alzate laterali manubri tecnica'},
      {n:'Plank', d:'Bacino in linea, non alzarlo', t:40, video:'plank tecnica corretta'}
    ]},
    {serie:3, riposoEs:0, riposoSerie:60, titolo:'Finale', esercizi:[
      {n:'Farmer walk', d:'Tutto il peso, spalle basse', r:'30-40 m', say:'30, 40 metri', t:45, tipo:'rip', video:'farmer walk tecnica'}
    ]}
  ]
};

const SESS_B = {
  id:'B', nome:'Sessione B', durata:'~35 min', sottotitolo:'Full body + core · 3 serie',
  nota:'3 serie di fila per esercizio, 45" di riposo tra le serie e prima del cambio.',
  blocchi:[{serie:3, riposoEs:45, riposoSerie:45, esercizi:[
    {n:'Skip con battito sotto il ginocchio', d:'Ginocchia alte', t:40, video:'skip battito sotto ginocchio'},
    {n:'Piegamenti + negativi', d:'Negativi in 4" di discesa', r:'6 + 2', say:'6 completi più 2 negativi', t:50, tipo:'rip', cambio:10, video:'piegamenti negativi tecnica'},
    {n:'Rematore con manubrio', d:'Schiena piatta, gomito lungo il fianco', r:'12 + 12', say:'12 per braccio', t:70, tipo:'rip', video:'rematore con manubrio un braccio'},
    {n:'Stacco rumeno', d:'Ginocchia morbide, schiena neutra', r:'12', say:'12 ripetizioni', t:50, tipo:'rip', cambio:15, video:'stacco rumeno manubri tecnica'},
    {n:'Squat bulgaro', d:'Piede dietro su una sedia', r:'10 + 10', say:'10 per gamba', t:70, tipo:'rip', cambio:10, video:'squat bulgaro tecnica'},
    {n:'Barchetta facilitata', d:'Gambe alternate, braccia avanti', r:'12', say:'12 ripetizioni', t:45, tipo:'rip', video:'hollow body rocks facilitato'},
    {n:'Mountain climber', d:'Massima velocità', t:25, video:'mountain climber tecnica'}
  ]}]
};

const SBARRA = {
  1:{nome:'Fase 1 · Presa e spalle', settimane:'settimane 1-3',
     nota:'Passi alla fase 2 quando tieni 45-60" per serie di dead hang.',
     blocchi:[
       {serie:4, riposoEs:0, riposoSerie:60, esercizi:[{n:'Dead hang', d:'Appeso, spalle attive', r:'20-40"', t:35, video:'dead hang tecnica'}]},
       {serie:3, riposoEs:0, riposoSerie:60, esercizi:[{n:'Scapular pull-up', d:'Braccia tese, abbassi le spalle', r:'6-8', say:'6, 8 ripetizioni', t:30, tipo:'rip', video:'scapular pull up tecnica'}]}
     ]},
  2:{nome:'Fase 2 · Attivare la schiena', settimane:'settimane 4-6',
     nota:'Passi alla fase 3 quando fai 3 × 5 negative pulite da 5".',
     blocchi:[
       {serie:2, riposoEs:0, riposoSerie:60, esercizi:[{n:'Dead hang', d:'Solo come riscaldamento', r:'45"', t:45, video:'dead hang tecnica'}]},
       {serie:3, riposoEs:0, riposoSerie:60, esercizi:[{n:'Scapular pull-up', d:'Braccia tese', r:'10', say:'10 ripetizioni', t:35, tipo:'rip', video:'scapular pull up tecnica'}]},
       {serie:3, riposoEs:0, riposoSerie:120, esercizi:[{n:'Negative', d:'Salti su, scendi in 5"', r:'3', say:'3 discese da 5 secondi', t:35, tipo:'rip', video:'negative pull up 5 secondi'}]}
     ]},
  3:{nome:'Fase 3 · La prima trazione', settimane:'settimane 7+',
     nota:'Riposo pieno tra i tentativi di trazione: 2-3 minuti.',
     blocchi:[
       {serie:2, riposoEs:0, riposoSerie:60, esercizi:[{n:'Dead hang', d:'Riscaldamento', r:'45"', t:45, video:'dead hang tecnica'}]},
       {serie:5, riposoEs:0, riposoSerie:150, esercizi:[{n:'Trazione completa', d:'Riposo pieno tra i tentativi', r:'1', say:'una trazione', t:20, tipo:'rip', video:'prima trazione pull up tecnica'}]},
       {serie:3, riposoEs:0, riposoSerie:120, esercizi:[{n:'Negative', d:'A completamento, 5" di discesa', r:'5', say:'5 discese', t:50, tipo:'rip', video:'negative pull up 5 secondi'}]},
       {serie:3, riposoEs:0, riposoSerie:90, esercizi:[{n:'Rematore australiano', d:'Se trovi una sbarra bassa', r:'10', say:'10 ripetizioni', t:45, tipo:'rip', video:'rematore australiano tecnica'}]}
     ]}
};
function sbarraSess(f){
  const s = SBARRA[f];
  return {id:'sbarra'+f, nome:'Sbarra · '+s.nome.split('·')[1].trim(), durata:'10-15 min',
          sottotitolo:s.settimane, nota:s.nota, blocchi:s.blocchi};
}

const STRETCH = {
  id:'stretch', nome:'Defaticamento', durata:'5 min', sottotitolo:'Fine allenamento',
  nota:'Oppure in seduta a parte, facendo prima il riscaldamento.',
  blocchi:[{serie:1, riposoEs:10, riposoSerie:0, esercizi:[
    {n:'Ischiocrurali da seduto', d:'10 respiri lenti', t:45, video:'stretching ischiocrurali da seduto'},
    {n:'Adduttori farfalla', d:'10 respiri lenti', t:45, cambio:5, video:'stretching farfalla adduttori'},
    {n:'Cat / Cow', d:'In quadrupedia, 4 giri da 3"', t:40, video:'cat cow esercizio'}
  ]}]
};
