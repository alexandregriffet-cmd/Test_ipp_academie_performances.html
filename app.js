
let questions = [];
let profiles = {};
let phaseItems = [];
let current = 0;
let answers = [];
let startTime = null;

const labels = {Vs:"Visionnaire", Cq:"Conquérant", Bv:"Bienveillant", Fb:"Fiable", Gt:"Garant", Sp:"Spontané"};
const opposites = {Vs:"Gt", Gt:"Vs", Cq:"Bv", Bv:"Cq", Sp:"Fb", Fb:"Sp"};

function shuffle(array) {
  const clone = [...array];
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function fmtPct(n){ return `${n.toFixed(1)} %`; }

async function loadData() {
  const [q,p,ph] = await Promise.all([
    fetch('questions_ipp_18_25_v2.json').then(r=>r.json()),
    fetch('profiles_36_ipp_v2.json').then(r=>r.json()),
    fetch('phase_items_ipp_v2.json').then(r=>r.json())
  ]);
  questions = q;
  profiles = p;
  phaseItems = ph;
}

function show(id) {
  ["screen-start","screen-question","screen-phase","screen-report"].forEach(x => {
    document.getElementById(x).style.display = x===id ? "block" : "none";
  });
}

function renderQuestion() {
  const q = questions[current];
  document.getElementById('qCount').textContent = `Question ${current+1} sur ${questions.length}`;
  document.getElementById('progressBar').style.width = `${((current)/questions.length)*100}%`;
  document.getElementById('questionText').textContent = q.text;
  const optionsWrap = document.getElementById('options');
  optionsWrap.innerHTML = "";
  const opts = shuffle(q.options);
  opts.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option';
    btn.textContent = opt.label;
    btn.onclick = () => {
      answers.push({id:q.id, energy:opt.k, mirrorOf:q.mirrorOf || null});
      current += 1;
      if (current < questions.length) {
        renderQuestion();
      } else {
        renderPhase();
      }
    };
    optionsWrap.appendChild(btn);
  });
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  document.getElementById('timer').textContent = `${Math.floor(elapsed/60)} min ${elapsed%60}s`;
}

function renderPhase() {
  show('screen-phase');
  const wrap = document.getElementById('phaseWrap');
  wrap.innerHTML = "";
  phaseItems.forEach(item => {
    const box = document.createElement('div');
    box.className = "section";
    box.innerHTML = `<p><strong>${item.id}. ${item.text}</strong></p>`;
    const row = document.createElement('div');
    row.className = 'grid';
    row.style.gridTemplateColumns = "repeat(4, minmax(100px,1fr))";
    [["0","Pas du tout"],["1","Un peu"],["2","Assez"],["3","Beaucoup"]].forEach(([value,label]) => {
      const labelEl = document.createElement('label');
      labelEl.className = 'option small';
      labelEl.innerHTML = `<input type="radio" name="phase_${item.id}" value="${value}" style="margin-right:8px">${label}`;
      row.appendChild(labelEl);
    });
    box.appendChild(row);
    wrap.appendChild(box);
  });
}

function computeScores() {
  const raw = {Vs:0,Cq:0,Bv:0,Fb:0,Gt:0,Sp:0};
  answers.forEach(a => raw[a.energy]++);
  const pct = {};
  const centered = {};
  Object.keys(raw).forEach(k => {
    pct[k] = (raw[k] / questions.length) * 100;
    centered[k] = raw[k] - (questions.length/6);
  });
  const ranking = Object.entries(raw).sort((a,b) => b[1]-a[1]);
  const dominant = ranking[0][0];
  const secondary = ranking[1][0];
  const profile = profiles[`${dominant}_${secondary}`];

  const phase = {Vs:0,Cq:0,Bv:0,Fb:0,Gt:0,Sp:0};
  let phaseMax = {Vs:0,Cq:0,Bv:0,Fb:0,Gt:0,Sp:0};
  phaseItems.forEach(item => {
    const selected = document.querySelector(`input[name="phase_${item.id}"]:checked`);
    const value = selected ? Number(selected.value) : 0;
    phase[item.k] += value;
    phaseMax[item.k] += 3;
  });
  const phasePct = {};
  Object.keys(phase).forEach(k => phasePct[k] = phaseMax[k] ? (phase[k]/phaseMax[k])*100 : 0);
  const phaseRank = Object.entries(phasePct).sort((a,b) => b[1]-a[1])[0][0];

  const mirrorMap = {};
  answers.forEach(a => { mirrorMap[a.id] = a.energy; });
  let checkedPairs = 0;
  let pairScore = 0;
  questions.forEach(q => {
    if (q.mirrorOf && q.id < q.mirrorOf && mirrorMap[q.id] && mirrorMap[q.mirrorOf]) {
      checkedPairs++;
      const e1 = mirrorMap[q.id], e2 = mirrorMap[q.mirrorOf];
      if (e1 === e2) pairScore += 1;
      else if (opposites[e1] === e2) pairScore += 0;
      else pairScore += 0.5;
    }
  });
  const coherence = checkedPairs ? (pairScore / checkedPairs) * 100 : 100;
  const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
  let timeScore = 100;
  if (elapsedSec < 300) timeScore = Math.max(20, (elapsedSec/300)*100);
  else if (elapsedSec < 420) timeScore = 85;
  const maxRaw = ranking[0][1];
  const minRaw = ranking[ranking.length-1][1];
  const spread = maxRaw - minRaw;
  let variabilityScore = 100;
  if (spread > 18) variabilityScore = 75;
  if (spread > 24) variabilityScore = 55;
  const reliability = (coherence + timeScore + variabilityScore) / 3;

  const tension = {
    vision_structure: Math.abs(raw.Vs - raw.Gt),
    action_relation: Math.abs(raw.Cq - raw.Bv),
    creativite_analyse: Math.abs(raw.Sp - raw.Fb)
  };
  tension.global = (tension.vision_structure + tension.action_relation + tension.creativite_analyse) / 3;

  return {raw,pct,centered,dominant,secondary,profile,phasePct,phaseRank,coherence,timeScore,variabilityScore,reliability,tension,elapsedSec};
}

function scoreLabel(v){
  if (v >= 85) return "élevée";
  if (v >= 70) return "bonne";
  if (v >= 50) return "à interpréter avec prudence";
  return "fragile";
}

function drawRadar(scores) {
  const canvas = document.createElement('canvas');
  canvas.width = 520; canvas.height = 420;
  const ctx = canvas.getContext('2d');
  const keys = ["Vs","Cq","Bv","Fb","Gt","Sp"];
  const centerX = 260, centerY = 210, radius = 140;
  ctx.strokeStyle = '#cdd8e6';
  ctx.fillStyle = '#204d8d';
  ctx.lineWidth = 1;
  for (let layer=1; layer<=5; layer++){
    ctx.beginPath();
    keys.forEach((k,i) => {
      const angle = -Math.PI/2 + (i * 2*Math.PI / keys.length);
      const r = radius * (layer/5);
      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.closePath(); ctx.stroke();
  }
  keys.forEach((k,i) => {
    const angle = -Math.PI/2 + (i * 2*Math.PI / keys.length);
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.lineTo(x,y); ctx.stroke();
    const lx = centerX + Math.cos(angle) * (radius+28);
    const ly = centerY + Math.sin(angle) * (radius+18);
    ctx.fillStyle = '#1f2937';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(labels[k], lx, ly);
  });
  ctx.beginPath();
  keys.forEach((k,i) => {
    const angle = -Math.PI/2 + (i * 2*Math.PI / keys.length);
    const r = radius * (scores[k]/100);
    const x = centerX + Math.cos(angle) * r;
    const y = centerY + Math.sin(angle) * r;
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(32,77,141,0.18)';
  ctx.strokeStyle = '#204d8d';
  ctx.lineWidth = 2;
  ctx.fill(); ctx.stroke();
  return canvas;
}

function renderReport() {
  const s = computeScores();
  show('screen-report');
  const wrap = document.getElementById('screen-report');
  const p = s.profile;
  const phaseLabel = labels[s.phaseRank];
  const elapsed = `${Math.floor(s.elapsedSec/60)} min ${s.elapsedSec%60}s`;
  const scoreBoxes = Object.keys(labels).map(k => `
    <div class="scoreBox">
      <strong>${labels[k]}</strong><br>
      Brut : ${s.raw[k]} / ${questions.length}<br>
      Répartition : ${fmtPct(s.pct[k])}
    </div>
  `).join('');
  wrap.innerHTML = `
    <div class="no-print" style="display:flex;gap:12px;justify-content:flex-end;margin-bottom:12px">
      <button class="btn secondary" onclick="location.reload()">Recommencer</button>
      <button class="btn" onclick="window.print()">Imprimer / PDF</button>
    </div>
    <div class="page">
      <span class="pill">Rapport IPP A4P</span>
      <h1>${p.name}</h1>
      <p><strong>Profil de base :</strong> ${p.dominantLabel} – ${p.secondaryLabel}</p>
      <p><strong>Énergie de phase dominante :</strong> ${phaseLabel}</p>
      <p>${p.description}</p>
      <p class="muted">Temps de passation : ${elapsed}. Fiabilité globale : ${scoreLabel(s.reliability)} (${s.reliability.toFixed(1)}/100).</p>
    </div>

    <div class="page section">
      <h2>Carte de tes énergies</h2>
      <div id="radarHolder"></div>
      <div class="scores section">${scoreBoxes}</div>
    </div>

    <div class="page section">
      <h2>Lecture simple du profil</h2>
      <p>Ton énergie dominante décrit la logique que tu utilises le plus naturellement. Ton énergie secondaire indique le style par lequel cette logique s’exprime. Ensemble, elles forment ton profil principal. L’énergie de phase décrit davantage ton état actuel, c’est-à-dire la manière dont tu cherches de l’appui ou de l’équilibre en ce moment.</p>
      <p><strong>Dominante :</strong> ${p.dominantLabel}. <strong>Secondaire :</strong> ${p.secondaryLabel}. <strong>Phase :</strong> ${phaseLabel}.</p>
      <h3>Points forts naturels</h3>
      <ul>${p.strengths.map(x=>`<li>${x}</li>`).join('')}</ul>
      <h3>Valeurs souvent importantes pour ce profil</h3>
      <ul>${p.values.map(x=>`<li>${x}</li>`).join('')}</ul>
    </div>

    <div class="page section">
      <h2>Stress et dérive possible</h2>
      <p>Comme dans les modèles de personnalité dynamiques, ce rapport distingue plusieurs paliers de tension. Ils ne sont pas des diagnostics. Ils décrivent des tendances de fonctionnement observables quand la pression monte.</p>
      <ul>${p.stressStages.map(x=>`<li>${x}</li>`).join('')}</ul>
      <h3>Écarts de tension interne</h3>
      <p>Vision vs structure : ${s.tension.vision_structure} | Action vs relation : ${s.tension.action_relation} | Créativité vs analyse : ${s.tension.creativite_analyse}</p>
      <p>Plus ces écarts sont élevés, plus ton profil peut se polariser sous pression. Cela ne veut pas dire que c’est “mauvais”, mais qu’il y a des zones à réguler consciemment.</p>
    </div>

    <div class="page section">
      <h2>Actions utiles pour faire face au stress</h2>
      <p>Les actions ci-dessous sont liées à ton profil de base. Elles servent à remettre de la lucidité, de la régulation et une qualité d’action suffisante quand la pression monte.</p>
      <ul>${p.actions.map(x=>`<li>${x}</li>`).join('')}</ul>
      <p><strong>Repère A4P :</strong> commence toujours par nommer ce qui se passe, réduire à une priorité claire, puis agir sur un levier concret plutôt que sur dix à la fois.</p>
    </div>

    <div class="page section">
      <h2>Compatibilités relationnelles</h2>
      <p>Les compatibilités ne sont pas des verdicts. Elles indiquent les profils avec lesquels la coopération est souvent plus fluide, et ceux avec lesquels il faut davantage de conscience relationnelle.</p>
      <p><strong>Profils souvent compatibles :</strong> ${p.compatibility.compatibles.join(', ')}.</p>
      <p><strong>Profils avec vigilance :</strong> ${p.compatibility.vigilance.join(', ')}.</p>
      <p>En pratique, deux profils moins compatibles peuvent très bien travailler ensemble si le cadre, les rôles et la communication sont clarifiés.</p>
    </div>

    <div class="page section">
      <h2>Qualité de passation</h2>
      <p><strong>Indice de cohérence :</strong> ${s.coherence.toFixed(1)}/100.</p>
      <p><strong>Indice de temps :</strong> ${s.timeScore.toFixed(1)}/100.</p>
      <p><strong>Indice de variabilité :</strong> ${s.variabilityScore.toFixed(1)}/100.</p>
      <p><strong>Fiabilité globale :</strong> ${s.reliability.toFixed(1)}/100, soit une lecture ${scoreLabel(s.reliability)}.</p>
      <p class="muted">Le moteur utilise 10 paires miroir, un temps de passation observé et une lecture de dispersion des réponses. Cela aide à repérer les passations trop rapides, trop contradictoires ou trop uniformes.</p>
    </div>

    <div class="page section">
      <h2>Énergie de phase : ce que tu vis peut-être en ce moment</h2>
      <p>Ton énergie de phase dominante actuelle est : <strong>${phaseLabel}</strong>.</p>
      <div class="scores">
        ${Object.keys(labels).map(k => `
          <div class="scoreBox">
            <strong>${labels[k]}</strong><br>
            ${fmtPct(s.phasePct[k])}
          </div>
        `).join('')}
      </div>
      <p class="section">Cette partie ne remplace pas le profil de base. Elle indique plutôt le type d’appui psychologique que tu cherches davantage dans la période actuelle.</p>
    </div>

    <div class="page section">
      <h2>Comment lire ce rapport</h2>
      <p>Ce rapport ne dit pas “qui tu es une fois pour toutes”. Il met en évidence des préférences de fonctionnement mental. Le plus utile n’est pas de te coller une étiquette, mais de comprendre ce qui t’aide à être lucide, régulé, engagé et autonome dans les contextes importants de ta vie : études, sport, travail, relations, décisions et pression.</p>
      <p>Cette version du test est conçue pour être simple à lire, opérationnelle sur le terrain et évolutive. Une validation psychométrique plus complète demanderait ensuite des données réelles, des analyses de fidélité et un étalonnage sur échantillon.</p>
    </div>
  `;
  document.getElementById('radarHolder').appendChild(drawRadar(s.pct));
}

window.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  document.getElementById('startBtn').onclick = () => {
    startTime = Date.now();
    current = 0;
    answers = [];
    show('screen-question');
    renderQuestion();
  };
  document.getElementById('finishPhaseBtn').onclick = renderReport;
});
