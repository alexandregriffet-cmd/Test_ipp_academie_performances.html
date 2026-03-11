
let questions = [], profiles = {}, phaseItems = [], stressItems = [];
let current = 0, answers = [], startTime = null;
const labels = {Vs:"Visionnaire", Cq:"Conquérant", Bv:"Bienveillant", Fb:"Fiable", Gt:"Garant", Sp:"Spontané"};
const opposites = {Vs:"Gt", Gt:"Vs", Cq:"Bv", Bv:"Cq", Sp:"Fb", Fb:"Sp"};

function shuffle(arr){ const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function fmtPct(n){ return `${n.toFixed(1)} %`; }
function show(id){ ["screen-start","screen-question","screen-phase","screen-stress","screen-report"].forEach(x=>document.getElementById(x).style.display=(x===id?"block":"none")); }
function page(title, body){ return `<section class="page"><div class="pageHeader"><span class="pill">Rapport IPP A4P</span><span class="small muted">${title}</span></div>${body}</section>`; }

async function loadData(){
  const [q,p,ph,st] = await Promise.all([
    fetch('questions_ipp_v3.json').then(r=>r.json()),
    fetch('profiles_36_ipp_v3.json').then(r=>r.json()),
    fetch('phase_items_v3.json').then(r=>r.json()),
    fetch('stress_items_v3.json').then(r=>r.json())
  ]);
  questions=q; profiles=p; phaseItems=ph; stressItems=st;
}

function renderQuestion(){
  const q = questions[current];
  document.getElementById('qCount').textContent = `Situation ${current+1} / ${questions.length}`;
  document.getElementById('progressBar').style.width = `${(current/questions.length)*100}%`;
  document.getElementById('questionText').textContent = q.text;
  const optionsWrap = document.getElementById('options'); optionsWrap.innerHTML = "";
  shuffle(q.options).forEach(opt=>{
    const btn=document.createElement('button');
    btn.className='option'; btn.textContent=opt.label;
    btn.onclick=()=>{
      answers.push({id:q.id, energy:opt.k, mirrorOf:q.mirrorOf || null});
      current++;
      if(current<questions.length) renderQuestion(); else renderPhase();
    };
    optionsWrap.appendChild(btn);
  });
  const elapsed=Math.floor((Date.now()-startTime)/1000);
  document.getElementById('timer').textContent = `Temps : ${Math.floor(elapsed/60)} min ${String(elapsed%60).padStart(2,'0')} s`;
}

function buildScale(namePrefix, wrapId, items){
  const wrap=document.getElementById(wrapId); wrap.innerHTML="";
  items.forEach(item=>{
    const box=document.createElement('div'); box.className='section subtle';
    box.innerHTML=`<p><strong>${item.id}. ${item.text}</strong></p>`;
    const row=document.createElement('div'); row.className='scoreGrid';
    [["0","Pas du tout"],["1","Un peu"],["2","Assez"],["3","Beaucoup"]].forEach(([v,label])=>{
      const lb=document.createElement('label'); lb.className='option small';
      lb.innerHTML=`<input type="radio" name="${namePrefix}_${item.id}" value="${v}" style="margin-right:8px">${label}`;
      row.appendChild(lb);
    });
    box.appendChild(row); wrap.appendChild(box);
  });
}

function renderPhase(){ show('screen-phase'); buildScale('phase','phaseWrap',phaseItems); }
function renderStress(){ show('screen-stress'); buildScale('stress','stressWrap',stressItems); }

function valFromScale(prefix, id){
  const el=document.querySelector(`input[name="${prefix}_${id}"]:checked`);
  return el ? Number(el.value) : 0;
}

function computeScores(){
  const raw={Vs:0,Cq:0,Bv:0,Fb:0,Gt:0,Sp:0};
  answers.forEach(a=>raw[a.energy]++);
  const pct={}, centered={};
  Object.keys(raw).forEach(k=>{ pct[k]=(raw[k]/questions.length)*100; centered[k]=raw[k]-10; });
  const ranking=Object.entries(raw).sort((a,b)=>b[1]-a[1]);
  const dominant=ranking[0][0], secondary=ranking[1][0], profile=profiles[`${dominant}_${secondary}`];

  const phaseRaw={Vs:0,Cq:0,Bv:0,Fb:0,Gt:0,Sp:0}, phaseMax={Vs:0,Cq:0,Bv:0,Fb:0,Gt:0,Sp:0};
  phaseItems.forEach(i=>{ const v=valFromScale('phase',i.id); phaseRaw[i.k]+=v; phaseMax[i.k]+=3; });
  const phasePct={}; Object.keys(phaseRaw).forEach(k=>phasePct[k]=phaseMax[k]?(phaseRaw[k]/phaseMax[k])*100:0);
  const phaseRank=Object.entries(phasePct).sort((a,b)=>b[1]-a[1])[0][0];

  const stressRaw={Vs:0,Cq:0,Bv:0,Fb:0,Gt:0,Sp:0}, stressMax={Vs:0,Cq:0,Bv:0,Fb:0,Gt:0,Sp:0};
  stressItems.forEach(i=>{ const v=valFromScale('stress',i.id); stressRaw[i.k]+=v; stressMax[i.k]+=3; });
  const stressPct={}; Object.keys(stressRaw).forEach(k=>stressPct[k]=stressMax[k]?(stressRaw[k]/stressMax[k])*100:0);

  const ansMap={}; answers.forEach(a=>ansMap[a.id]=a.energy);
  let checkedPairs=0, pairScore=0;
  questions.forEach(q=>{
    if(q.mirrorOf && q.id<q.mirrorOf && ansMap[q.id] && ansMap[q.mirrorOf]){
      checkedPairs++;
      const e1=ansMap[q.id], e2=ansMap[q.mirrorOf];
      if(e1===e2) pairScore+=1;
      else if(opposites[e1]===e2) pairScore+=0;
      else pairScore+=0.5;
    }
  });
  const coherence=checkedPairs?(pairScore/checkedPairs)*100:100;
  const elapsedSec=Math.floor((Date.now()-startTime)/1000);
  let timeScore=100;
  if(elapsedSec<420) timeScore=Math.max(30,(elapsedSec/420)*100);
  const spread=ranking[0][1]-ranking[ranking.length-1][1];
  let variabilityScore=100;
  if(spread>16) variabilityScore=80;
  if(spread>22) variabilityScore=60;
  const reliability=(coherence+timeScore+variabilityScore)/3;

  const tension = {
    vision_structure: Math.abs(raw.Vs-raw.Gt),
    action_relation: Math.abs(raw.Cq-raw.Bv),
    creativite_analyse: Math.abs(raw.Sp-raw.Fb)
  };
  tension.global=(tension.vision_structure+tension.action_relation+tension.creativite_analyse)/3;

  return {raw,pct,centered,ranking,dominant,secondary,profile,phasePct,phaseRank,stressPct,coherence,timeScore,variabilityScore,reliability,tension,elapsedSec};
}

function scoreLabel(v){ if(v>=85) return "élevée"; if(v>=70) return "bonne"; if(v>=50) return "prudente"; return "fragile"; }
function stressLevel(v){ if(v<25) return "fluide"; if(v<50) return "tension légère"; if(v<75) return "surcharge"; return "rigidification / dérive"; }

function drawRadar(scores){
  const canvas=document.createElement('canvas'); canvas.width=620; canvas.height=450;
  const ctx=canvas.getContext('2d'); const keys=["Vs","Cq","Bv","Fb","Gt","Sp"];
  const cx=310, cy=225, radius=150;
  ctx.strokeStyle='#d8e1ef'; ctx.fillStyle='#1f4b8f'; ctx.lineWidth=1;
  for(let layer=1; layer<=5; layer++){
    ctx.beginPath();
    keys.forEach((k,i)=>{ const angle=-Math.PI/2+i*2*Math.PI/keys.length; const r=radius*(layer/5); const x=cx+Math.cos(angle)*r; const y=cy+Math.sin(angle)*r; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);});
    ctx.closePath(); ctx.stroke();
  }
  keys.forEach((k,i)=>{ const angle=-Math.PI/2+i*2*Math.PI/keys.length; const x=cx+Math.cos(angle)*radius; const y=cy+Math.sin(angle)*radius; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(x,y); ctx.stroke();
    const lx=cx+Math.cos(angle)*(radius+34), ly=cy+Math.sin(angle)*(radius+20); ctx.fillStyle='#0f172a'; ctx.font='15px Arial'; ctx.textAlign='center'; ctx.fillText(labels[k],lx,ly);});
  ctx.beginPath();
  keys.forEach((k,i)=>{ const angle=-Math.PI/2+i*2*Math.PI/keys.length; const r=radius*(scores[k]/100); const x=cx+Math.cos(angle)*r; const y=cy+Math.sin(angle)*r; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);});
  ctx.closePath(); ctx.fillStyle='rgba(31,75,143,.18)'; ctx.strokeStyle='#1f4b8f'; ctx.lineWidth=2; ctx.fill(); ctx.stroke();
  return canvas;
}

function energyNarrative(code, score){
  const label=labels[code];
  if(score>=24) return `${label} apparaît comme un appui très structurant dans ton fonctionnement. Cette énergie influence fortement ta lecture des situations et tes décisions spontanées.`;
  if(score>=18) return `${label} est bien présente. Tu peux t’y appuyer souvent avec efficacité, surtout lorsque la situation te ressemble ou que le contexte est clair.`;
  if(score>=13) return `${label} est disponible mais pas dominante. Tu sais la mobiliser, surtout quand le contexte l’exige ou quand tu prends le temps d’y revenir consciemment.`;
  return `${label} semble moins spontanée chez toi aujourd’hui. Cela ne veut pas dire qu’elle est absente, mais qu’elle demande souvent plus d’effort ou un cadre extérieur pour s’exprimer.`;
}

function renderReport(){
  const s=computeScores(); const p=s.profile;
  show('screen-report');
  const wrap=document.getElementById('screen-report');
  const elapsed=`${Math.floor(s.elapsedSec/60)} min ${String(s.elapsedSec%60).padStart(2,'0')} s`;
  const scoreBoxes=Object.keys(labels).map(k=>`<div class="scoreBox"><strong>${labels[k]}</strong><br>Score brut : ${s.raw[k]} / ${questions.length}<br>Répartition : ${fmtPct(s.pct[k])}<br>Énergie de phase : ${fmtPct(s.phasePct[k])}<br>Stress : ${fmtPct(s.stressPct[k])}</div>`).join('');
  const top3 = s.ranking.slice(0,3).map(([k,v])=>`${labels[k]} (${v})`).join(' • ');
  let html = `
  <div class="no-print" style="display:flex;gap:12px;justify-content:flex-end;margin-bottom:14px">
    <button class="btn secondary" onclick="location.reload()">Recommencer</button>
    <button class="btn" onclick="window.print()">Imprimer / PDF</button>
  </div>`;
  html += page("Page 1 — Couverture", `
    <h1>${p.name}</h1>
    <p><strong>Profil principal :</strong> ${p.dominantLabel} – ${p.secondaryLabel}</p>
    <p><strong>Énergie de phase dominante :</strong> ${labels[s.phaseRank]}</p>
    <p>${p.description}</p>
    <div class="meta">
      <span class="badge">Temps de passation : ${elapsed}</span>
      <span class="badge">Cohérence : ${s.coherence.toFixed(1)}/100</span>
      <span class="badge">Fiabilité globale : ${scoreLabel(s.reliability)} (${s.reliability.toFixed(1)}/100)</span>
    </div>
  `);
  html += page("Page 2 — Cadre de lecture", `
    <h2>Comment lire ce rapport</h2>
    <p>Ce rapport décrit des <strong>tendances de fonctionnement</strong>. Il ne dit pas qui tu es de manière définitive. Il met en lumière les logiques mentales que tu mobilises le plus naturellement, les zones qui peuvent te soutenir sous pression, et celles qui demandent davantage de vigilance.</p>
    <p>La lecture hybride de l’IPP relie la personnalité à la performance dans la vie réelle : études, sport, travail, relation, prise de décision, gestion du stress et qualité de l’engagement.</p>
    <blockquote>Le but n’est pas de te mettre dans une case, mais de t’aider à mieux te comprendre pour mieux te réguler et mieux agir.</blockquote>
  `);
  html += page("Page 3 — Synthèse", `
    <h2>Synthèse immédiate</h2>
    <p><strong>Top 3 de tes énergies :</strong> ${top3}</p>
    <p>Ta dominante ${p.dominantLabel.toLowerCase()} dit ce que tu fais spontanément quand tu abordes une situation. Ta secondaire ${p.secondaryLabel.toLowerCase()} décrit la manière dont cette logique s’exprime le plus souvent. Ensemble, elles composent un style stable, auquel s’ajoute une énergie de phase ${labels[s.phaseRank].toLowerCase()} qui renseigne sur ton état du moment.</p>
    <ul>
      <li><strong>Tu apportes naturellement :</strong> ${p.strengths.slice(0,3).join(', ')}.</li>
      <li><strong>Tu valorises souvent :</strong> ${p.values.slice(0,3).join(', ')}.</li>
      <li><strong>Ta zone de vigilance :</strong> ${p.blindspots[0]}.</li>
    </ul>
  `);
  html += page("Page 4 — Carte des énergies", `
    <h2>Radar de fonctionnement</h2>
    <div id="radarHolder"></div>
    <div class="section scoreGrid">${scoreBoxes}</div>
  `);
  const keys=["Vs","Cq","Bv","Fb","Gt","Sp"];
  keys.forEach((k,idx)=>{
    html += page(`Page ${5+idx} — ${labels[k]}`, `
      <h2>${labels[k]}</h2>
      <p>${energyNarrative(k, s.raw[k])}</p>
      <p>Dans ton profil actuel, cette énergie s’exprime avec un score de <strong>${s.raw[k]}/60</strong> sur le module principal, un niveau de phase de <strong>${fmtPct(s.phasePct[k])}</strong> et un indicateur de stress de <strong>${fmtPct(s.stressPct[k])}</strong>.</p>
      <p>Lorsque ${labels[k].toLowerCase()} est bien régulée chez toi, elle devient une ressource précieuse. Lorsqu’elle monte en tension ou qu’elle est trop absente, ton équilibre général peut se déplacer.</p>
    `);
  });
  html += page("Page 11 — Identité de profil", `
    <h2>Ton style mental global</h2>
    ${p.identityParagraphs.map(x=>`<p>${x}</p>`).join('')}
  `);
  html += page("Page 12 — Forces naturelles", `
    <h2>Forces naturelles</h2>
    <ul>${p.strengths.map(x=>`<li>${x}</li>`).join('')}</ul>
    <p>Ces forces sont utiles quand elles restent reliées au réel, à la qualité du lien et à ton niveau d’énergie du moment. Elles peuvent devenir impressionnantes quand elles sont entraînées consciemment, mais moins efficaces lorsqu’elles se transforment en automatisme rigide.</p>
  `);
  html += page("Page 13 — Valeurs et motivation", `
    <h2>Valeurs qui nourrissent ton engagement</h2>
    <ul>${p.values.map(x=>`<li>${x}</li>`).join('')}</ul>
    <p>Plus ton quotidien est aligné avec ces valeurs, plus il devient facile pour toi de tenir l’effort, de traverser les moments creux et de choisir sans te disperser.</p>
  `);
  html += page("Page 14 — Étapes de stress", `
    <h2>Quand la pression monte</h2>
    <ul>${p.stressStages.map(x=>`<li>${x}</li>`).join('')}</ul>
    <p><strong>Lecture chiffrée :</strong> ton indicateur global de tension est de ${s.tension.global.toFixed(1)}. Les écarts les plus sensibles se situent entre vision/structure (${s.tension.vision_structure}), action/relation (${s.tension.action_relation}) et créativité/analyse (${s.tension.creativite_analyse}).</p>
  `);
  html += page("Page 15 — Stress actuel", `
    <h2>Stress par énergie</h2>
    <ul>${keys.map(k=>`<li><strong>${labels[k]} :</strong> ${fmtPct(s.stressPct[k])} — ${stressLevel(s.stressPct[k])}.</li>`).join('')}</ul>
    <p>Le module stress ne mesure pas une souffrance clinique. Il indique seulement les zones où ton fonctionnement peut se crisper aujourd’hui. Il aide à prioriser les leviers de régulation.</p>
  `);
  html += page("Page 16 — Régulation A4P", `
    <h2>Régulation mentale A4P</h2>
    <p><strong>Lucidité.</strong> ${p.a4p.lucidite}</p>
    <p><strong>Régulation.</strong> ${p.a4p.regulation}</p>
    <p><strong>Engagement.</strong> ${p.a4p.engagement}</p>
    <p><strong>Autonomie.</strong> ${p.a4p.autonomie}</p>
  `);
  html += page("Page 17 — Actions concrètes", `
    <h2>Actions à mener pour faire face au stress</h2>
    <ul>${p.regulation.map(x=>`<li>${x}</li>`).join('')}</ul>
    <p>Choisis deux actions seulement pour la semaine à venir. L’efficacité vient plus de la répétition que de la quantité.</p>
  `);
  html += page("Page 18 — Performance : sport", `
    <h2>Lecture sport / performance</h2>
    <p>${p.sport}</p>
    <p>Quand tu es bien régulé, tu peux gagner en lucidité de décision, en stabilité émotionnelle et en qualité d’engagement. Quand la pression monte sans régulation, tu risques davantage de surjouer ta dominante ou d’oublier une fonction complémentaire pourtant nécessaire.</p>
  `);
  html += page("Page 19 — Performance : études", `
    <h2>Lecture études / apprentissage</h2>
    <p>${p.studies}</p>
    <p>Pour apprendre efficacement, adapte ton organisation à tes préférences réelles plutôt qu’à une méthode idéale mais étrangère à ton fonctionnement. Le bon cadre est celui que tu es capable de tenir.</p>
  `);
  html += page("Page 20 — Vie professionnelle", `
    <h2>Lecture travail / projet</h2>
    <p>${p.work}</p>
    <p>Ton profil devient particulièrement utile quand ton rôle, ton niveau d’autonomie et les attentes du contexte sont lisibles. Plus le poste est flou, plus il est utile de clarifier ce qui relève de ta zone de force et ce qui demande un appui complémentaire.</p>
  `);
  html += page("Page 21 — Relation à l’autre", `
    <h2>Compatibilités et points de friction</h2>
    <p>${p.relationships}</p>
    <p><strong>Profils souvent compatibles :</strong> ${p.compatible.join(', ')}.</p>
    <p><strong>Profils plus délicats sans régulation :</strong> ${p.lessCompatible.join(', ')}.</p>
  `);
  html += page("Page 22 — Angles morts", `
    <h2>Angles morts possibles</h2>
    <ul>${p.blindspots.map(x=>`<li>${x}</li>`).join('')}</ul>
    <p>Repérer ces angles morts n’enlève rien à tes qualités. Au contraire, c’est souvent ce qui permet de rendre tes forces plus fiables et plus durables.</p>
  `);
  html += page("Page 23 — Développement", `
    <h2>Axes de développement</h2>
    <ul>${p.development.map(x=>`<li>${x}</li>`).join('')}</ul>
    <p>Le développement le plus utile n’est pas de devenir quelqu’un d’autre, mais d’élargir ton registre tout en restant fidèle à ton identité de fonctionnement.</p>
  `);
  html += page("Page 24 — Plan 30 jours", `
    <h2>Plan simple sur 30 jours</h2>
    <ol>
      <li>Identifier une situation récurrente où ton profil t’aide vraiment.</li>
      <li>Repérer un signal de stress précoce que tu veux apprendre à reconnaître.</li>
      <li>Choisir un rituel de régulation à répéter trois fois par semaine.</li>
      <li>Demander un retour extérieur à une personne de confiance après deux semaines.</li>
      <li>Noter ce qui change dans ton niveau de clarté, de calme et d’efficacité.</li>
    </ol>
  `);
  html += page("Page 25 — Conclusion", `
    <h2>Synthèse finale</h2>
    <p>${p.name} n’est pas une case fermée. C’est une carte de lecture. Elle te permet de mieux comprendre ce qui te met en mouvement, ce qui te stabilise, ce qui te fragilise et ce qui te fait grandir.</p>
    <p>Plus tu apprends à reconnaître tes préférences mentales, plus tu peux choisir au lieu de simplement réagir. C’est là que l’IPP devient utile : non pour juger, mais pour orienter une progression consciente.</p>
    <blockquote>Comprendre ton fonctionnement, ce n’est pas te limiter. C’est te donner une base plus juste pour progresser, performer et durer.</blockquote>
  `);

  wrap.innerHTML = html;
  const radarHolder=document.getElementById('radarHolder');
  radarHolder.appendChild(drawRadar(s.pct));
}

document.addEventListener('DOMContentLoaded', async ()=>{
  await loadData();
  document.getElementById('startBtn').onclick=()=>{ startTime=Date.now(); current=0; answers=[]; show('screen-question'); renderQuestion(); };
  document.getElementById('toStressBtn').onclick=()=>renderStress();
  document.getElementById('finishBtn').onclick=()=>renderReport();
});
