// ── Config — swap this URL after deploying your Cloudflare Worker ──────────────
const WORKER_URL = 'https://cart-scheduler-proxy.normbottie.workers.dev';

// ── Helpers ───────────────────────────────────────────────────────────────────
function t(h,m,pm=false){if(pm&&h!==12)h+=12;if(!pm&&h===12)h=0;return h*60+m;}
function minsToStr(m){const h=Math.floor(m/60),mn=m%60,ap=h>=12?'PM':'AM',h12=h%12||12;return`${h12}:${mn.toString().padStart(2,'0')} ${ap}`;}
function timeToMins(s){if(!s)return null;s=s.trim().toLowerCase();const m=s.match(/(\d+):(\d+)\s*(am|pm)/);if(!m)return null;let h=parseInt(m[1]),mn=parseInt(m[2]),ap=m[3];if(ap==='pm'&&h!==12)h+=12;if(ap==='am'&&h===12)h=0;return h*60+mn;}
function timeInputToMins(v){if(!v)return null;const[h,m]=v.split(':').map(Number);return h*60+m;}
function firstLast(n){const p=n.trim().split(' ');return p.length===1?n:p[0]+' '+p[p.length-1][0]+'.';}

// ── State ─────────────────────────────────────────────────────────────────────
let employees=[], scheduleDate='', slotCaps={}, slotTypes={}, lastSchedule=null;
let excludeFromCarts=new Set(), excludeFromSweep=new Set();
const SLOTS=[];for(let m=7*60;m<22*60;m+=30)SLOTS.push(m);

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener('load',()=>{
  initSlots();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  document.getElementById('file-input').addEventListener('change',e=>{if(e.target.files[0])setFile(e.target.files[0]);});
  const dz=document.getElementById('drop-zone');
  dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('drag');});
  dz.addEventListener('dragleave',()=>dz.classList.remove('drag'));
  dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('drag');if(e.dataTransfer.files[0])setFile(e.dataTransfer.files[0]);});
});

function initSlots(){
  SLOTS.forEach(m=>{slotCaps[m]=getDefaultCap(m);slotTypes[m]='cart';});
  renderSlotTable();
}
function getDefaultCap(m){
  if(m>=t(10,30)&&m<t(18,30))return 2;
  return 1;
}

// ── File ──────────────────────────────────────────────────────────────────────
let currentFile=null;
function setFile(f){
  currentFile=f;
  document.getElementById('drop-zone').style.display='none';
  document.getElementById('file-chip').style.display='flex';
  document.getElementById('file-chip-name').textContent=f.name;
  document.getElementById('parse-btn').disabled=false;
  setStatus('');
}
function clearFile(){
  currentFile=null;
  document.getElementById('drop-zone').style.display='block';
  document.getElementById('file-chip').style.display='none';
  document.getElementById('parse-btn').disabled=true;
  employees=[];
  ['assoc-section','config-section','slots-section','generate-wrap','results-section','sched-preview'].forEach(id=>{
    document.getElementById(id).style.display='none';
  });
  setStatus('');
}

// ── Parse PDF ─────────────────────────────────────────────────────────────────
async function parsePDF(){
  if(!currentFile)return;
  setStatus('Reading PDF...');
  document.getElementById('parse-btn').disabled=true;

  try{
    const b64=await fileToB64(currentFile);

    const now=new Date();
    scheduleDate=`${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getDate().toString().padStart(2,'0')}/${now.getFullYear().toString().slice(-2)}`;
    // Try to extract date from PDF filename
    const dm=currentFile.name.match(/(\d{1,2})[_\-\/](\d{1,2})[_\-\/](\d{2,4})/);
    if(dm) scheduleDate=`${dm[1].padStart(2,'0')}/${dm[2].padStart(2,'0')}/${dm[3].slice(-2)}`;
    document.getElementById('sched-date').textContent=scheduleDate;

    setStatus('Analyzing with AI...');

    const prompt=`Parse this retail "Daily Overview" shift schedule PDF. Extract ALL associates whose job class is one of: Front Service Clerk, Cashier, Customer Service Staff, Cust Serv Team Leader, Customer Service Manager, or any Manager role. Skip all other job classes.

For each qualifying associate return:
- name: "First Last" (convert "Last, First" format; strip [m] [mm] prefixes)
- job: exactly one of "fsc", "cashier", "css", "cstl", "csm", "mgr"
- cartStart: start of their earliest CS-Bag segment (e.g. "9:00am"), null if no CS-Bag
- cartEnd: end of their latest CS-Bag segment, null if no CS-Bag
- mealStart: from Meals column (rightmost), null if none
- mealEnd: from Meals column, null if none
- autoFecSegments: [{start,end}] for any CS-FEC role segments, [] if none
- csCleaningSegments: [{start,end}] for CS-Cleaning segments, [] if none
- csFloorCareSegments: [{start,end}] for CS-Floor Care segments, [] if none

Time format: "9:00am", "1:30pm". Ignore handwritten annotations. Return ONLY a valid JSON array, no markdown fences.`;

    const res=await fetch(WORKER_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-5',
        max_tokens:2000,
        messages:[{role:'user',content:[
          {type:'document',source:{type:'base64',media_type:'application/pdf',data:b64}},
          {type:'text',text:prompt}
        ]}]
      })
    });

    if(!res.ok){
      let errText='';try{errText=await res.text();}catch(e){}
      throw new Error(`Worker error ${res.status}: ${errText}`);
    }
    const data=await res.json();
    if(data.error) throw new Error(data.error.message||JSON.stringify(data.error));

    const rawTxt=data.content.map(b=>b.text||'').join('');
    let employees_parsed=null;
    // Strategy 1: direct parse
    try{ employees_parsed=JSON.parse(rawTxt); }catch(e){}
    // Strategy 2: strip markdown, find array, unescape
    if(!Array.isArray(employees_parsed)){
      try{
        let st=rawTxt.replace(/```json|```/gi,'');
        // unescape double-escaped quotes
        st=st.replace(/\\"/g,'"').replace(/\\n/g,'\n').replace(/\\t/g,'\t');
        const s=st.indexOf('['),en=st.lastIndexOf(']');
        if(s!==-1&&en>s) employees_parsed=JSON.parse(st.substring(s,en+1));
      }catch(e){ console.log('strategy2 fail:',e.message); }
    }
    // Strategy 3: the whole thing is a JSON string - double parse
    if(!Array.isArray(employees_parsed)){
      try{
        const inner=JSON.parse(rawTxt);
        if(typeof inner==='string'){
          const st=inner.replace(/```json|```/gi,'');
          const s=st.indexOf('['),en=st.lastIndexOf(']');
          if(s!==-1&&en>s) employees_parsed=JSON.parse(st.substring(s,en+1));
        } else if(Array.isArray(inner)){
          employees_parsed=inner;
        }
      }catch(e){ console.log('strategy3 fail:',e.message); }
    }
    if(!Array.isArray(employees_parsed)){ console.error('Raw:',rawTxt); throw new Error('Could not parse AI response. Check browser console.'); }
    employees=employees_parsed;
    const raw=rawTxt;
    // Strip any markdown fences and find the JSON array
    // parsing handled above
    excludeFromSweep=new Set();

    setStatus('');
    renderAssociates();
    renderFECOptions();
    ['assoc-section','config-section','slots-section','generate-wrap'].forEach(id=>{
      document.getElementById(id).style.display='block';
    });
    document.getElementById('assoc-section').scrollIntoView({behavior:'smooth'});
  }catch(err){
    setStatus('Error: '+err.message);
    document.getElementById('parse-btn').disabled=false;
  }
}

function setStatus(msg){
  const el=document.getElementById('status');
  el.style.display=msg?'flex':'none';
  if(msg) document.getElementById('status-text').textContent=msg;
}
function fileToB64(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=function(e){
      try{
        const result=e.target.result;
        const base64=result.split(',')[1];
        if(!base64)throw new Error('Empty file result');
        res(base64);
      }catch(err){rej(err);}
    };
    r.onerror=function(e){rej(new Error('FileReader error: '+e.target.error));};
    r.onabort=function(){rej(new Error('FileReader aborted'));};
    try{r.readAsDataURL(file);}catch(err){rej(err);}
  });
}

// ── Render associates ─────────────────────────────────────────────────────────
function renderAssociates(){
  const grid=document.getElementById('assoc-grid');
  grid.innerHTML='';
  const seen=new Set();
  employees.forEach(e=>{
    if(seen.has(e.name))return;seen.add(e.name);
    const noCart=excludeFromCarts.has(e.name),noSweep=excludeFromSweep.has(e.name);
    const div=document.createElement('div');div.className='assoc-card';
    const range=e.cartStart?`${e.cartStart}–${e.cartEnd}`:'No CS-Bag';
    const meal=e.mealStart?`<div class="meal">Meal: ${e.mealStart}–${e.mealEnd}</div>`:'';
    const fecNote=(e.autoFecSegments&&e.autoFecSegments.length)?`<div class="meal" style="color:var(--blue)">Auto-FEC: ${e.autoFecSegments.map(s=>`${s.start}–${s.end}`).join(', ')}</div>`:'';
    div.innerHTML=`
      <div class="name">${e.name}</div>
      <div class="meta">${jobLabel(e.job)} · ${range}</div>
      ${meal}${fecNote}
      <div class="toggles">
        <button class="tog ${noCart?'active-no-cart':''}" onclick="toggleExclude('cart','${e.name.replace(/'/g,"\\'")}',this)">${noCart?'✕ No carts':'No carts'}</button>
        <button class="tog ${noSweep?'active-no-sweep':''}" onclick="toggleExclude('sweep','${e.name.replace(/'/g,"\\'")}',this)">${noSweep?'✕ No sweep':'No sweep'}</button>
      </div>`;
    grid.appendChild(div);
  });
}

function jobLabel(j){return{fsc:'Front Svc Clerk',cashier:'Cashier',css:'CS Staff',cstl:'CS Team Leader',csm:'CS Manager',mgr:'Manager'}[j]||j;}

function toggleExclude(type,name,btn){
  const set=type==='cart'?excludeFromCarts:excludeFromSweep;
  const cls=type==='cart'?'active-no-cart':'active-no-sweep';
  const label=type==='cart'?'No carts':'No sweep';
  if(set.has(name)){set.delete(name);btn.classList.remove(cls);btn.textContent=label;}
  else{set.add(name);btn.classList.add(cls);btn.textContent=`✕ ${label}`;}
}

// ── FEC options ───────────────────────────────────────────────────────────────
function renderFECOptions(){
  const candidates=employees.filter(e=>['css','cstl','csm','mgr'].includes(e.job));
  const seen=new Set();
  ['fec1-select','fec2-select'].forEach(id=>{
    const sel=document.getElementById(id);
    sel.innerHTML='<option value="">— None —</option>';
    candidates.forEach(e=>{
      if(seen.has(e.name+id))return;seen.add(e.name+id);
      const o=document.createElement('option');
      o.value=e.name;o.textContent=`${e.name} (${jobLabel(e.job)})`;
      sel.appendChild(o);
    });
  });
}

// ── Slot table ────────────────────────────────────────────────────────────────
function renderSlotTable(){
  const tbody=document.getElementById('slot-tbody');tbody.innerHTML='';
  SLOTS.forEach(m=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td class="time-cell">${minsToStr(m)}</td>
      <td><input type="number" min="0" max="10" value="${slotCaps[m]}" onchange="slotCaps[${m}]=parseInt(this.value)||0"></td>
      <td><select onchange="slotTypes[${m}]=this.value">
        <option value="cart"${slotTypes[m]==='cart'?' selected':''}>Cart</option>
        <option value="lot"${slotTypes[m]==='lot'?' selected':''}>Lot/Bag</option>
      </select></td>`;
    tbody.appendChild(tr);
  });
}
function setAllCap(){const v=parseInt(document.getElementById('bulk-cap').value)||1;SLOTS.forEach(m=>{slotCaps[m]=v;});renderSlotTable();}
function setAllType(){const tp=document.getElementById('bulk-type').value;SLOTS.forEach(m=>{slotTypes[m]=tp;});renderSlotTable();}

// ── Scheduler ─────────────────────────────────────────────────────────────────
function buildSchedule(){
  const fec1Name=document.getElementById('fec1-select').value;
  const fec1Start=timeInputToMins(document.getElementById('fec1-start').value);
  const fec1End=timeInputToMins(document.getElementById('fec1-end').value);
  const fec2Name=document.getElementById('fec2-select').value;
  const fec2Start=timeInputToMins(document.getElementById('fec2-start').value);
  const fec2End=timeInputToMins(document.getElementById('fec2-end').value);

  const state=employees.map(e=>({
    name:e.name,job:e.job,
    cartStart:timeToMins(e.cartStart),cartEnd:timeToMins(e.cartEnd),
    mealStart:e.mealStart?timeToMins(e.mealStart):null,
    mealEnd:e.mealEnd?timeToMins(e.mealEnd):null,
    autoFecSegs:(e.autoFecSegments||[]).map(s=>({fs:timeToMins(s.start),fe:timeToMins(s.end)})),
    cleanSegs:(e.csCleaningSegments||[]).map(s=>({cs:timeToMins(s.start),ce:timeToMins(s.end)})),
    floorSegs:(e.csFloorCareSegments||[]).map(s=>({cs:timeToMins(s.start),ce:timeToMins(s.end)})),
    last_idx:-2,consec:0,total:0
  }));

  const isOnMeal=(e,ss,se)=>e.mealStart!==null&&ss<e.mealEnd&&se>e.mealStart;
  const isAvail=(e,ss,se)=>e.cartStart!==null&&e.cartStart<=ss&&e.cartEnd>=se&&!isOnMeal(e,ss,se);
  const isAutoFecBlocked=(e,ss,se)=>e.autoFecSegs.some(f=>ss<f.fe&&se>f.fs);
  const isFecWin=(name,ss,fStart,fEnd)=>!!name&&fStart!==null&&fEnd!==null&&ss>=fStart&&ss<fEnd;

  // PM cleaner detection
  const cleanersList=[];const seenC=new Set();
  employees.forEach(e=>{
    if(seenC.has(e.name))return;seenC.add(e.name);
    if(e.csCleaningSegments&&e.csCleaningSegments.length){
      cleanersList.push({name:e.name,earliest:Math.min(...e.csCleaningSegments.map(s=>timeToMins(s.start)))});
    }
  });
  cleanersList.sort((a,b)=>a.earliest-b.earliest);
  const pmCleaner=cleanersList.length>1?cleanersList[cleanersList.length-1].name:null;
  const pmCleanSegs=pmCleaner?state.find(e=>e.name===pmCleaner)?.cleanSegs||[]:[];

  // Floor care sweep at 9:30pm
  const floorCareTime=t(21,30);
  const floorWorkers=[];const fcSeen=new Set();
  state.forEach(e=>{if(fcSeen.has(e.name))return;if(e.floorSegs.some(s=>s.cs<=floorCareTime&&s.ce>=floorCareTime+30)){floorWorkers.push(e.name);fcSeen.add(e.name);}});

  const slotCounts={};const sweepCounts={};
  [...new Set(employees.map(e=>e.name))].forEach(n=>{slotCounts[n]=0;sweepCounts[n]=0;});

  const schedule=SLOTS.map((ss,i)=>{
    const se=ss+30,cap=slotCaps[ss]||0,stype=slotTypes[ss]||'cart',maxC=stype==='lot'?2:1;
    const inF1=isFecWin(fec1Name,ss,fec1Start,fec1End);
    const inF2=isFecWin(fec2Name,ss,fec2Start,fec2End);

    const canAssign=(e,exCSTL,exFec)=>{
      if(!isAvail(e,ss,se))return false;
      if(isAutoFecBlocked(e,ss,se))return false;
      if(exFec&&((inF1&&e.name===fec1Name)||(inF2&&e.name===fec2Name)))return false;
      if(excludeFromCarts.has(e.name))return false;
      if(exCSTL&&['cstl','csm','mgr'].includes(e.job))return false;
      if(e.last_idx===i-1&&e.consec>=maxC)return false;
      return true;
    };
    const sk=e=>[(e.last_idx===i-1?e.consec:0),e.total];
    const sf=(a,b)=>{const ka=sk(a),kb=sk(b);return ka[0]-kb[0]||ka[1]-kb[1];};

    let assigned=state.filter(e=>canAssign(e,true,true)).sort(sf).slice(0,cap);
    if(assigned.length<cap){
      const mgrs=state.filter(e=>['cstl','csm','mgr'].includes(e.job)&&canAssign(e,false,true)&&!assigned.includes(e)).sort(sf);
      assigned=[...assigned,...mgrs.slice(0,cap-assigned.length)];
    }
    const fecOnCarts=[];
    if(assigned.length<cap){
      [[fec1Name,inF1],[fec2Name,inF2]].forEach(([fname,inWin])=>{
        if(!fname||!inWin)return;
        const fe=state.find(e=>e.name===fname&&isAvail(e,ss,se)&&!assigned.includes(e));
        if(fe&&assigned.length<cap){assigned.push(fe);fecOnCarts.push(fname);}
      });
    }

    assigned.forEach(e=>{
      e.consec=e.last_idx===i-1?e.consec+1:1;e.last_idx=i;e.total++;
      slotCounts[e.name]=(slotCounts[e.name]||0)+1;
    });
    state.forEach(e=>{if(!assigned.includes(e)&&e.last_idx===i-1)e.consec=0;});

    return{start:ss,cap,type:stype,
      assigned:assigned.map(e=>({name:e.name,job:e.job,fecOn:fecOnCarts.includes(e.name),isMgr:['cstl','csm','mgr'].includes(e.job)})),
      fecOnCarts};
  });

  // Sweeps
  const cartAt={};schedule.forEach(s=>{cartAt[s.start]=new Set(s.assigned.map(a=>a.name));});
  const SWEEP_IDEAL=[t(9,0),t(11,0),t(13,0),t(15,0),t(17,0),t(19,0)];
  const validSlots=new Set(SLOTS);
  const sweepAssign={};
  if(floorWorkers.length) sweepAssign[floorCareTime]=floorWorkers;

  const getSweepPerson=(ss,cartNames)=>{
    const se=ss+30;
    const inPmClean=pmCleanSegs.some(s=>ss>=s.cs&&ss<s.ce);
    const inF1sw=isFecWin(fec1Name,ss,fec1Start,fec1End);
    const inF2sw=isFecWin(fec2Name,ss,fec2Start,fec2End);
    const pool=state.filter(e=>{
      if(!['fsc','css','cstl','csm','mgr'].includes(e.job))return false;
      if(e.cartStart===null||e.cartStart>ss||e.cartEnd<se)return false;
      if(isOnMeal(e,ss,se))return false;
      if(cartNames.has(e.name))return false;
      if(excludeFromSweep.has(e.name))return false;
      if(pmCleaner&&e.name===pmCleaner&&inPmClean)return false;
      if(inF1sw&&e.name===fec1Name)return false;
      if(inF2sw&&e.name===fec2Name)return false;
      return true;
    });
    if(!pool.length)return null;
    pool.sort((a,b)=>(sweepCounts[a.name]||0)-(sweepCounts[b.name]||0)||a.total-b.total);
    return pool[0].name;
  };

  SWEEP_IDEAL.forEach(ideal=>{
    for(const cand of[ideal,ideal+30,ideal-30]){
      if(!validSlots.has(cand)||sweepAssign[cand])continue;
      const p=getSweepPerson(cand,cartAt[cand]||new Set());
      if(p){sweepAssign[cand]=p;sweepCounts[p]=(sweepCounts[p]||0)+1;break;}
    }
  });

  schedule.forEach(s=>{s.sweep=sweepAssign[s.start]||null;});
  lastSchedule={schedule,slotCounts,fec1Name,fec2Name,scheduleDate};
  renderResults();
}

// ── Render results ────────────────────────────────────────────────────────────
function renderResults(){
  const{schedule,slotCounts,fec1Name,fec2Name}=lastSchedule;
  ['results-section','sched-preview'].forEach(id=>document.getElementById(id).style.display='block');
  document.getElementById('results-section').scrollIntoView({behavior:'smooth'});

  const tbody=document.getElementById('counts-tbody');tbody.innerHTML='';
  const seen=new Set();
  employees.forEach(e=>{
    if(seen.has(e.name))return;seen.add(e.name);
    const isFec=e.name===fec1Name||e.name===fec2Name;
    const isAFec=e.autoFecSegments&&e.autoFecSegments.length;
    const isMgr=['cstl','csm','mgr'].includes(e.job);
    const xc=excludeFromCarts.has(e.name),xs=excludeFromSweep.has(e.name);
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${e.name}${isFec?`<span class="badge badge-fec">FEC</span>`:''}${isAFec?`<span class="badge badge-autofec">Auto-FEC</span>`:''}${isMgr?`<span class="badge badge-cstl">CSTL</span>`:''}${xc?`<span class="badge badge-excluded">No carts</span>`:''}${xs?`<span class="badge badge-excluded">No sweep</span>`:''}</td>
    <td style="font-size:11px;color:var(--muted)">${e.cartStart?`${e.cartStart}–${e.cartEnd}`:'—'}</td>
    <td style="font-size:11px;color:var(--muted)">${e.mealStart?`${e.mealStart}–${e.mealEnd}`:'—'}</td>
    <td style="text-align:center;font-weight:500">${slotCounts[e.name]||0}</td>`;
    tbody.appendChild(tr);
  });

  const stbody=document.getElementById('sched-tbody');stbody.innerHTML='';
  schedule.forEach(s=>{
    const tr=document.createElement('tr');
    const numCell=s.type==='lot'?`<span class="lot-type">Lot/Bag</span>`:s.cap;
    const names=s.assigned.length
      ?s.assigned.map(a=>{
        let cls='sched-name';
        if(a.fecOn)cls+=' fec-on';
        else if(a.isMgr)cls+=' cstl';
        else if(s.type==='lot')cls+=' lot';
        return`<span class="${cls}">${a.name}${a.fecOn?' *':a.isMgr?' †':''}</span>`;
      }).join('')
      :'<span style="color:var(--muted);font-size:11px">—</span>';
    const sw=s.sweep?(Array.isArray(s.sweep)?s.sweep:[s.sweep]).map(n=>`<span class="sched-name sweep">${n}</span>`).join(''):'';
    tr.innerHTML=`<td class="time-cell">${minsToStr(s.start)}</td><td class="num-cell">${numCell}</td><td>${names}</td><td class="sweep-cell">${sw}</td>`;
    stbody.appendChild(tr);
  });
}

// ── PDF Export ────────────────────────────────────────────────────────────────
async function exportPDF(){
  if(!lastSchedule)return;
  if(!window.jspdf){alert('PDF library loading, please try again in a moment.');return;}
  const{jsPDF}=window.jspdf;
  const{schedule,fec1Name,fec2Name,scheduleDate}=lastSchedule;
  const doc=new jsPDF({orientation:'portrait',unit:'pt',format:'letter'});

  const PW=612,MARGIN=36,ROW_H=14;
  const COL_TIME=MARGIN,COL_NUM=MARGIN+50,COL_A=MARGIN+88;
  const A_SUB_W=88,MAX_A=3;
  const SWEEP_RIGHT=PW-MARGIN,SWEEP_W=132,SW_SUB_W=66,MAX_SW=2;
  const COL_SW=SWEEP_RIGHT-SWEEP_W;

  const drawHeader=y=>{
    doc.setFillColor(224,222,216);doc.rect(MARGIN,y-3,PW-2*MARGIN,ROW_H,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(80,80,80);
    doc.text('Time',COL_TIME,y+ROW_H-5);
    doc.text('#',COL_NUM,y+ROW_H-5);
    doc.text('Associate(s)',COL_A,y+ROW_H-5);
    doc.text('Store Sweep',COL_SW,y+ROW_H-5);
    doc.setDrawColor(200,200,200);doc.setLineWidth(0.5);
    doc.line(COL_SW-4,y-3,COL_SW-4,y+ROW_H-3);
    doc.setTextColor(0,0,0);
    return y+ROW_H+2;
  };

  const newPage=()=>{
    doc.addPage();let y=40;
    doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(150,150,150);
    doc.text(`Cart Schedule ${scheduleDate} (continued)`,MARGIN,y);
    doc.setTextColor(0,0,0);y+=14;
    return drawHeader(y);
  };

  let y=50;
  doc.setFont('helvetica','bold');doc.setFontSize(16);doc.setTextColor(0,0,0);
  doc.text(`Cart Schedule ${scheduleDate}`,MARGIN,y);
  y+=26;y=drawHeader(y);

  let hasFec=false,hasMgr=false;
  schedule.forEach((s,idx)=>{
    if(y>730)y=newPage();
    if(idx%2===0){doc.setFillColor(251,251,249);doc.rect(MARGIN,y-3,PW-2*MARGIN,ROW_H,'F');}
    doc.setFont('helvetica','normal');doc.setFontSize(8);
    doc.setDrawColor(210,210,210);doc.setLineWidth(0.5);
    doc.line(COL_SW-4,y-3,COL_SW-4,y+ROW_H-3);

    doc.setTextColor(120,120,120);doc.text(minsToStr(s.start),COL_TIME,y+ROW_H-5);

    if(s.type==='lot'){doc.setTextColor(26,79,160);doc.text('Lot/Bag',COL_NUM,y+ROW_H-5);}
    else{doc.setTextColor(0,0,0);doc.text(String(s.cap),COL_NUM,y+ROW_H-5);}
    doc.setTextColor(0,0,0);

    s.assigned.slice(0,MAX_A).forEach((a,ci)=>{
      if(a.fecOn)hasFec=true;if(a.isMgr)hasMgr=true;
      doc.text(firstLast(a.name)+(a.fecOn?' *':a.isMgr?' \u2020':''),COL_A+ci*A_SUB_W,y+ROW_H-5);
    });

    if(s.sweep){
      doc.setTextColor(26,107,58);
      const sw=Array.isArray(s.sweep)?s.sweep:[s.sweep];
      sw.slice(0,MAX_SW).forEach((n,si)=>{
        const cx=COL_SW+si*SW_SUB_W+SW_SUB_W/2;
        doc.text(firstLast(n),cx,y+ROW_H-5,{align:'center'});
      });
      doc.setTextColor(0,0,0);
    }
    y+=ROW_H;
  });

  // Footnotes
  const notes=[];
  if(hasFec){
    if(fec1Name) notes.push(`* ${firstLast(fec1Name)} is a designated FEC — placed on carts due to insufficient coverage`);
    if(fec2Name&&fec2Name!==fec1Name) notes.push(`* ${firstLast(fec2Name)} is a designated FEC — placed on carts due to insufficient coverage`);
  }
  if(hasMgr) notes.push('\u2020 CS Team Leader/Manager placed on carts only where no other associate was available');
  if(notes.length){
    y+=6;if(y>740)y=newPage();
    doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(150,150,150);
    notes.forEach(n=>{doc.text(n,MARGIN,y);y+=9;});
  }

  // Watermark
  doc.setFont('helvetica','italic');doc.setFontSize(7);doc.setTextColor(190,190,190);
  doc.text('Made by Norm Bottie',PW-MARGIN,780,{align:'right'});

  doc.save(`Cart Schedule ${scheduleDate.replace(/\//g,'-')}.pdf`);
}
