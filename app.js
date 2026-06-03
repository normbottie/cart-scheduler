// ── Config ────────────────────────────────────────────────────────────────────
const WORKER_URL = 'https://cart-scheduler-proxy.normbottie.workers.dev';


// ── KV sync helpers ───────────────────────────────────────────────────────────
async function kvGet(key){
  try{
    const r=await fetch(WORKER_URL+'/kv/'+key);
    if(!r.ok)return null;
    const d=await r.json();
    return d.value??null;
  }catch(e){return null;}
}
async function kvPut(key,value){
  try{
    await fetch(WORKER_URL+'/kv/'+key,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({value})});
  }catch(e){}
}
function showKvToast(msg,ok=false){
  let t=document.getElementById('kv-toast');
  if(!t){t=document.createElement('div');t.id='kv-toast';t.style.cssText='position:fixed;bottom:70px;left:50%;transform:translateX(-50%);padding:6px 14px;border-radius:20px;font-size:12px;z-index:9999;transition:opacity .4s';document.body.appendChild(t);}
  t.textContent=msg;t.style.background=ok?'#2d7a3a':'#b44';t.style.color='#fff';t.style.opacity='1';
  clearTimeout(t._t);t._t=setTimeout(()=>t.style.opacity='0',2500);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function t(h,m,pm=false){if(pm&&h!==12)h+=12;if(!pm&&h===12)h=0;return h*60+m;}
function minsToStr(m){const h=Math.floor(m/60),mn=m%60,ap=h>=12?'PM':'AM',h12=h%12||12;return`${h12}:${mn.toString().padStart(2,'0')} ${ap}`;}
function timeToMins(s){if(!s)return null;s=s.trim().toLowerCase();const m=s.match(/(\d+):(\d+)\s*(am|pm)/);if(!m)return null;let h=parseInt(m[1]),mn=parseInt(m[2]),ap=m[3];if(ap==='pm'&&h!==12)h+=12;if(ap==='am'&&h===12)h=0;return h*60+mn;}
function timeInputToMins(v){if(!v)return null;const[h,m]=v.split(':').map(Number);return h*60+m;}

// Convert "JOHN DOE" or "john doe" to "John Doe"
function toTitleCase(n){return n.replace(/\w\S*/g,w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase());}
// Normalize name: fix all-caps, return "First Last"
function normalizeName(n){
  if(!n)return n;
  n=n.trim();
  if(n===n.toUpperCase()&&n.length>2)n=toTitleCase(n);
  return n;
}
// First name + last initial for PDF
const NAME_SUFFIXES=new Set(['jr','sr','ii','iii','iv','v','jr.','sr.']);
function firstLast(n){
  n=normalizeName(n);
  const p=n.trim().split(' ').filter(Boolean);
  if(p.length===1)return n;
  // Find last non-suffix part
  let lastIdx=p.length-1;
  while(lastIdx>0&&NAME_SUFFIXES.has(p[lastIdx].toLowerCase().replace('.',''))){lastIdx--;}
  return p[0]+' '+p[lastIdx][0]+'.';
}

// ── Debug mode (bypasses AI, uses mock data) ─────────────────────────────────
let DEBUG_MODE = false;
const MOCK_EMPLOYEES = [
  {name:"Tony Lafayette",job:"fsc",cartStart:"6:45am",cartEnd:"1:00pm",mealStart:"9:00am",mealEnd:"9:30am",autoFecSegments:[],csCleaningSegments:[],csFloorCareSegments:[]},
  {name:"Mark Saleh",job:"fsc",cartStart:"8:00am",cartEnd:"2:00pm",mealStart:"10:00am",mealEnd:"10:30am",autoFecSegments:[],csCleaningSegments:[],csFloorCareSegments:[]},
  {name:"Alexis Bergman",job:"cashier",cartStart:"12:00pm",cartEnd:"3:00pm",mealStart:null,mealEnd:null,autoFecSegments:[],csCleaningSegments:[],csFloorCareSegments:[]},
  {name:"Mariah Dorvil",job:"fsc",cartStart:"10:00am",cartEnd:"6:30pm",mealStart:"2:30pm",mealEnd:"3:30pm",autoFecSegments:[],csCleaningSegments:[],csFloorCareSegments:[]},
  {name:"Norm Bottie",job:"csm",cartStart:null,cartEnd:null,mealStart:"10:00am",mealEnd:"11:00am",autoFecSegments:[{start:"11:00am",end:"1:00pm"}],csCleaningSegments:[],csFloorCareSegments:[]},
  {name:"Hannah Lyons",job:"csm",cartStart:null,cartEnd:null,mealStart:"12:00pm",mealEnd:"1:00pm",autoFecSegments:[{start:"1:00pm",end:"4:00pm"}],csCleaningSegments:[],csFloorCareSegments:[]},
  {name:"Athena Elbert",job:"css",cartStart:"6:30pm",cartEnd:"10:00pm",mealStart:null,mealEnd:null,autoFecSegments:[],csCleaningSegments:[],csFloorCareSegments:[]},
  {name:"Juan Rodriguez",job:"fsc",cartStart:"5:00pm",cartEnd:"10:00pm",mealStart:"7:30pm",mealEnd:"8:00pm",autoFecSegments:[],csCleaningSegments:[],csFloorCareSegments:[]},
  {name:"Layla Baker",job:"cashier",cartStart:"4:00pm",cartEnd:"8:00pm",mealStart:null,mealEnd:null,autoFecSegments:[],csCleaningSegments:[],csFloorCareSegments:[]},
  {name:"Cliff Norwood",job:"fsc",cartStart:"3:00pm",cartEnd:"7:15pm",mealStart:null,mealEnd:null,autoFecSegments:[],csCleaningSegments:[{start:"11:00am",end:"2:00pm"}],csFloorCareSegments:[]},
  {name:"Trent Eary",job:"fsc",cartStart:"3:15pm",cartEnd:"6:00pm",mealStart:null,mealEnd:null,autoFecSegments:[],csCleaningSegments:[{start:"6:45pm",end:"9:30pm"}],csFloorCareSegments:[{start:"9:30pm",end:"10:30pm"}]},
];

// ── Debug mode toggle ─────────────────────────────────────────────────────────
function toggleDebugMode(){
  DEBUG_MODE=!DEBUG_MODE;
  const btn=document.getElementById('debug-btn');
  btn.textContent=DEBUG_MODE?'🐛 Debug ON':'🐛 Debug';
  btn.style.background=DEBUG_MODE?'var(--red)':'';
  btn.style.color=DEBUG_MODE?'white':'';
}

// ── Persistent no-carts list (localStorage) ───────────────────────────────────
const PERM_KEY='cart-scheduler-permanent-no-carts';
function loadPermNoCart(){try{return new Set(JSON.parse(localStorage.getItem(PERM_KEY)||'[]'));}catch(e){return new Set();}}
function savePermNoCart(set){localStorage.setItem(PERM_KEY,JSON.stringify([...set]));kvPut('perm-no-carts',[...set]).catch(()=>showKvToast('Sync failed — saved locally only'));}
let permNoCart=loadPermNoCart();

// ── Name corrections (persisted) ──────────────────────────────────────────────
const CORRECTIONS_KEY='cart-scheduler-name-corrections';
function loadCorrections(){try{return JSON.parse(localStorage.getItem(CORRECTIONS_KEY)||'{}');}catch(e){return {};}}
function saveCorrections(obj){localStorage.setItem(CORRECTIONS_KEY,JSON.stringify(obj));kvPut('name-corrections',obj).catch(()=>showKvToast('Sync failed — saved locally only'));}
let nameCorrections=loadCorrections(); // {wrongName: correctName}

function applyCorrections(empList){
  return empList.map(e=>{
    const corrected=nameCorrections[e.name];
    return corrected?{...e,name:corrected}:e;
  });
}

// ── State ─────────────────────────────────────────────────────────────────────
let employees=[], scheduleDate='', slotCaps={}, slotTypes={}, lastSchedule=null;
let excludeFromCarts=new Set(), excludeFromSweep=new Set();
const BASE_SLOTS=[];for(let m=7*60;m<22*60;m+=30)BASE_SLOTS.push(m);
let SLOTS=[...BASE_SLOTS]; // actual slots used in scheduling (may include 15-min)
let slotIntervals={}; // slotStart -> 15 or 30
let scannedPages=[]; // array of {dataUrl, b64, name}
let cartSchedImage=null; // single cart service schedule image


// ── Load from KV on startup ───────────────────────────────────────────────────
async function loadFromKV(){
  // No-carts
  const kvNoCart=await kvGet('perm-no-carts');
  if(kvNoCart&&Array.isArray(kvNoCart)){
    kvNoCart.forEach(n=>permNoCart.add(n));
    savePermNoCart(permNoCart);
    renderPermNoCartMenu();
  }
  // Name corrections
  const kvCorr=await kvGet('name-corrections');
  if(kvCorr&&typeof kvCorr==='object'){
    nameCorrections={...nameCorrections,...kvCorr};
    saveCorrections(nameCorrections);
    renderPermNoCartMenu();
  }
  // Split range
  const kvSplit=await kvGet('split-range');
  if(kvSplit){
    const ss=document.getElementById('split-start');
    const se=document.getElementById('split-end');
    if(ss&&kvSplit['split-start'])ss.value=kvSplit['split-start'];
    if(se&&kvSplit['split-end'])se.value=kvSplit['split-end'];
    applySplitRange();
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener('load',()=>{
  checkTerms();
  initSlots();
  loadFromKV();
  renderPermNoCartMenu();
  renderHistory();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  // PDF upload removed
  // Close menu on outside click
  document.getElementById('cart-sched-input').addEventListener('change',e=>{
    const file=e.target.files[0];
    if(file) setCartSchedImage(file, e.target);
  });

  document.getElementById('scan-input').addEventListener('change',e=>{
    const file=e.target.files[0];
    if(file) addScannedPage(file, e.target);
  });

  document.addEventListener('click',e=>{
    const menu=document.getElementById('perm-menu');
    if(menu&&!menu.contains(e.target)&&!document.getElementById('menu-btn').contains(e.target)){
      menu.style.display='none';
    }
  });
});

// ── Terms agreement ──────────────────────────────────────────────────────────
const PIN='1117'; // store number as default PIN
const PIN_KEY='cart-scheduler-pin-ok';

function checkTerms(){
  const modal=document.getElementById('terms-modal');
  modal.style.display='flex';
  // If PIN already verified on this device, skip straight to terms
  if(localStorage.getItem(PIN_KEY)==='1'){
    document.getElementById('pin-section').style.display='none';
    document.getElementById('terms-section').style.display='block';
  } else {
    document.getElementById('pin-section').style.display='block';
    document.getElementById('terms-section').style.display='none';
    setTimeout(()=>document.getElementById('pin-0').focus(),300);
  }
}

function pinInput(idx){
  const inp=document.getElementById('pin-'+idx);
  // Only allow digits
  inp.value=inp.value.replace(/[^0-9]/g,'');
  if(inp.value&&idx<3){
    document.getElementById('pin-'+(idx+1)).focus();
  }
  // Auto-submit when last digit entered
  if(idx===3&&inp.value) checkPin();
}

function checkPin(){
  const entered=[0,1,2,3].map(i=>document.getElementById('pin-'+i).value).join('');
  if(entered===PIN){
    localStorage.setItem(PIN_KEY,'1');
    document.getElementById('pin-section').style.display='none';
    document.getElementById('terms-section').style.display='block';
    document.getElementById('pin-error').style.display='none';
  } else {
    document.getElementById('pin-error').style.display='block';
    [0,1,2,3].forEach(i=>document.getElementById('pin-'+i).value='');
    document.getElementById('pin-0').focus();
  }
}

function acceptTerms(){
  document.getElementById('terms-modal').style.display='none';
}

// ── Permanent no-cart menu ────────────────────────────────────────────────────
function toggleMenu(){
  const m=document.getElementById('perm-menu');
  const opening=m.style.display!=='block';
  m.style.display=opening?'block':'none';

}
function renderPermNoCartMenu(){
  const list=document.getElementById('perm-list');
  if(!list)return;
  list.innerHTML='';
  if(permNoCart.size===0){
    list.innerHTML='<div style="font-size:12px;color:var(--muted);padding:6px 0">No permanent exclusions</div>';
  } else {
    permNoCart.forEach(name=>{
      const div=document.createElement('div');div.className='perm-row';
      const btn=document.createElement('button');btn.textContent='✕';
      btn.onclick=()=>removePermNoCart(name);
      div.innerHTML='<span>'+name+'</span>';
      div.appendChild(btn);list.appendChild(div);
    });
  }
  // Corrections section
  const corrKeys=Object.keys(nameCorrections);
  const corrSection=document.getElementById('corrections-section');
  const corrList=document.getElementById('corrections-list');
  if(!corrSection||!corrList)return;
  if(corrKeys.length===0){corrSection.style.display='none';return;}
  corrSection.style.display='block';
  corrList.innerHTML='';
  corrKeys.forEach(wrong=>{
    const right=nameCorrections[wrong];
    const div=document.createElement('div');div.className='perm-row';
    const btn=document.createElement('button');btn.textContent='✕';
    btn.onclick=()=>removeCorrection(wrong);
    div.innerHTML='<span style="font-size:11px"><em>'+wrong+'</em> → <strong>'+right+'</strong></span>';
    div.appendChild(btn);corrList.appendChild(div);
  });
}

async function removeCorrection(wrong){
  const latest=await kvGet('name-corrections');
  if(latest&&typeof latest==='object') nameCorrections={...latest};
  delete nameCorrections[wrong];
  localStorage.setItem(CORRECTIONS_KEY,JSON.stringify(nameCorrections));
  try{await kvPut('name-corrections',nameCorrections);}catch(e){showKvToast('Sync failed — saved locally only');}
  renderPermNoCartMenu();
}


function addPermNoCart(){
  const inp=document.getElementById('perm-input');
  const name=inp.value.trim();
  if(!name)return;
  permNoCart.add(normalizeName(name));
  savePermNoCart(permNoCart);
  inp.value='';
  renderPermNoCartMenu();
}

// ── Feedback ──────────────────────────────────────────────────────────────────
let feedbackType = 'bug';

function openFeedback(){
  document.getElementById('feedback-modal').style.display='flex';
  document.getElementById('feedback-text').value='';
  document.getElementById('feedback-name').value='';
  document.getElementById('feedback-status').textContent='';
  feedbackType='bug';
  document.querySelectorAll('.feedback-type-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('ftype-bug').classList.add('active');
  setTimeout(()=>document.getElementById('feedback-text').focus(),100);
}

function closeFeedback(){
  document.getElementById('feedback-modal').style.display='none';
}

function setFeedbackType(btn, type){
  feedbackType=type;
  document.querySelectorAll('.feedback-type-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

async function submitFeedback(){
  const msg=document.getElementById('feedback-text').value.trim();
  const status=document.getElementById('feedback-status');
  const name=document.getElementById('feedback-name').value.trim();
  if(!name){status.textContent='Please enter your name.';return;}
  if(!msg){status.textContent='Please enter a message.';return;}
  status.textContent='Sending...';
  try{
    const r=await fetch(WORKER_URL+'/feedback',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message:msg,type:feedbackType,name})});
    if(r.ok){
      status.style.color='var(--green,#2d7a3a)';
      status.textContent='Sent! Thank you.';
      setTimeout(closeFeedback,1500);
    } else {
      status.style.color='var(--red)';
      status.textContent='Failed to send. Try again.';
    }
  }catch(e){
    status.style.color='var(--red)';
    status.textContent='Network error. Try again.';
  }
}

function toggleFeedbackInbox(){
  const section=document.getElementById('feedback-inbox-section');
  if(!section)return;
  const opening=section.style.display==='none';
  section.style.display=opening?'block':'none';
  if(opening) loadFeedbackInbox();
}

async function loadFeedbackInbox(){
  const section=document.getElementById('feedback-inbox-section');
  const list=document.getElementById('feedback-inbox-list');
  if(!section||!list)return;
  section.style.display='block';
  try{
    const r=await fetch(WORKER_URL+'/feedback?pin=1117');
    if(!r.ok){list.textContent='Could not load feedback.';return;}
    const data=await r.json();
    if(!data.list||data.list.length===0){list.textContent='No feedback yet.';return;}
    const clearBtn=document.createElement('button');
    clearBtn.textContent='Clear all';
    clearBtn.className='sm-btn';
    clearBtn.style.cssText='font-size:10px;padding:3px 8px;margin-bottom:8px;background:var(--red);color:#fff;border:none';
    clearBtn.onclick=async()=>{if(!confirm('Clear all feedback?'))return;await fetch(WORKER_URL+'/kv/feedback',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:[]})});loadFeedbackInbox();};
    list.innerHTML='';
    list.appendChild(clearBtn);
    const items=document.createElement('div');
    items.innerHTML=data.list.map(f=>{
      const d=new Date(f.ts);
      const dateStr=d.toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
      return`<div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border)">
        <div style="display:flex;gap:6px;margin-bottom:3px;flex-wrap:wrap">
          <span style="font-size:10px;font-weight:600;text-transform:uppercase;color:var(--accent)">${f.type}</span>
          ${f.name?`<span style="font-size:10px;font-weight:600;color:var(--text)">${f.name}</span>`:''}
          <span style="font-size:10px;color:var(--muted)">${dateStr}</span>
        </div>
        <div style="font-size:12px;color:var(--text)">${f.message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
      </div>`;
    }).join('');
    list.appendChild(items);
  }catch(e){list.textContent='Error loading feedback.';}
}

function removePermNoCart(name){
  permNoCart.delete(name);
  savePermNoCart(permNoCart);
  renderPermNoCartMenu();
}

// ── Collapsible steps ─────────────────────────────────────────────────────────
function collapseStep(id){
  const body=document.getElementById(id+'-body');
  const icon=document.getElementById(id+'-icon');
  if(!body)return;
  const isOpen=body.style.display!=='none';
  body.style.display=isOpen?'none':'block';
  if(icon)icon.textContent=isOpen?'▸':'▾';
}
function openStep(id){
  const body=document.getElementById(id+'-body');
  const icon=document.getElementById(id+'-icon');
  if(body){body.style.display='block';if(icon)icon.textContent='▾';}
}
function closeStep(id){
  const body=document.getElementById(id+'-body');
  const icon=document.getElementById(id+'-icon');
  if(body){body.style.display='none';if(icon)icon.textContent='▸';}
}

// ── Slots ─────────────────────────────────────────────────────────────────────
function initSlots(){
  SLOTS=[...BASE_SLOTS];
  BASE_SLOTS.forEach(m=>{
    slotCaps[m]=getDefaultCap(m);
    slotTypes[m]='cart';
    slotIntervals[m]=30;
  });
  populateSplitSelectors();
  renderSlotTable();
}

function populateSplitSelectors(){
  const saved=JSON.parse(localStorage.getItem('cart-scheduler-split-range')||'{}');
  ['split-start','split-end'].forEach(id=>{
    const sel=document.getElementById(id);
    if(!sel)return;
    sel.innerHTML='<option value="">None</option>';
    BASE_SLOTS.forEach(m=>{
      const o=document.createElement('option');
      o.value=m;o.textContent=minsToStr(m);
      sel.appendChild(o);
    });
    if(saved[id])sel.value=saved[id];
  });
}

function applySplitRange(){
  const startVal=document.getElementById('split-start').value;
  const endVal=document.getElementById('split-end').value;
  // Persist selection
  const splitVal={'split-start':startVal,'split-end':endVal};
  localStorage.setItem('cart-scheduler-split-range',JSON.stringify(splitVal));
  kvPut('split-range',splitVal).catch(()=>{});
  // Reset all to 30-min first
  BASE_SLOTS.forEach(m=>{
    slotIntervals[m]=30;
    delete slotIntervals[m+15];
    delete slotCaps[m+15];
    delete slotTypes[m+15];
  });
  if(startVal&&endVal){
    const s=parseInt(startVal),e=parseInt(endVal);
    if(s<e){
      for(let m=s;m<e;m+=30){
        if(BASE_SLOTS.includes(m)){
          slotIntervals[m]=15;
          slotIntervals[m+15]=15;
          slotCaps[m+15]=slotCaps[m];
          slotTypes[m+15]=slotTypes[m];
        }
      }
    }
  }
  rebuildSlots();
  renderSlotTable();
}

// splitSlot/mergeSlot replaced by applySplitRange

function rebuildSlots(){
  SLOTS=[];
  for(let m=7*60;m<22*60;m+=30){
    if(slotIntervals[m]===15){
      SLOTS.push(m);
      SLOTS.push(m+15);
    } else {
      SLOTS.push(m);
    }
  }
}
function getDefaultCap(m){
  if(m>=t(10,30)&&m<t(18,30))return 2;
  return 1;
}

// ── File ──────────────────────────────────────────────────────────────────────
let currentFile=null;
function setFile(f){
  // PDF upload removed - no-op
}
function clearFile(){
  currentFile=null;
  scannedPages=[];
  cartSchedImage=null;
  clearCartSched();
  renderScanPreviews();

  document.getElementById('parse-btn').disabled=true;
  employees=[];
  ['step2','step3','step4','generate-wrap','step5','step6'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.style.display='none';
  });
  setStatus('');
}

// ── Scan functions ───────────────────────────────────────────────────────────
async function compressImage(file, maxWidth=2400, quality=0.92){
  return new Promise((resolve)=>{
    const img=new Image();
    const url=URL.createObjectURL(file);
    img.onload=()=>{
      const scale=Math.min(1, maxWidth/img.width);
      const w=Math.round(img.width*scale);
      const h=Math.round(img.height*scale);
      const canvas=document.createElement('canvas');
      canvas.width=w; canvas.height=h;
      const ctx=canvas.getContext('2d');
      ctx.drawImage(img,0,0,w,h);
      canvas.toBlob(blob=>{
        URL.revokeObjectURL(url);
        const reader=new FileReader();
        reader.onload=e=>{
          const dataUrl=e.target.result;
          const b64=dataUrl.split(',')[1];
          console.log('Compressed image: '+Math.round(b64.length/1024)+'KB');
          resolve({b64,mediaType:'image/jpeg'});
        };
        reader.readAsDataURL(blob);
      },'image/jpeg',quality);
    };
    img.onerror=()=>resolve(null);
    img.src=url;
  });
}

function addScannedPage(file, inputEl){
  const objectUrl=URL.createObjectURL(file); // for display only
  setStatus('Processing image...');
  compressImage(file).then(compressed=>{
    setStatus('');
    if(!compressed){alert('Could not read image.');return;}
    scannedPages.push({objectUrl,b64:compressed.b64,mediaType:compressed.mediaType,name:file.name});
    renderScanPreviews();
    document.getElementById('parse-btn').disabled=false;
    if(inputEl) inputEl.value='';
  });
}

function removeScannedPage(idx){
  scannedPages.splice(idx,1);
  renderScanPreviews();
  if(scannedPages.length===0){
    document.getElementById('parse-btn').disabled=true;
  }
}

function renderScanPreviews(){
  const thumbs=document.getElementById('scan-thumbs');
  const label=document.getElementById('scan-label');
  const count=document.getElementById('scan-count');
  if(label) label.style.display=scannedPages.length>0?'block':'none';
  if(count) count.textContent=scannedPages.length;
  thumbs.innerHTML=scannedPages.map((p,i)=>`
    <div class="scan-thumb">
      <img src="${p.objectUrl}" alt="Page ${i+1}">
      <div class="scan-thumb-label">Page ${i+1}</div>
      <button class="scan-thumb-rm" onclick="removeScannedPage(${i})">X</button>
    </div>
  `).join('');
}

function setCartSchedImage(file, inputEl){
  const objectUrl=URL.createObjectURL(file);
  compressImage(file).then(compressed=>{
    if(!compressed){alert('Could not read image.');return;}
    cartSchedImage={objectUrl,b64:compressed.b64,mediaType:compressed.mediaType};
    const thumbs=document.getElementById('cart-sched-thumbs');
    const addBtn=document.getElementById('cart-sched-add-btn');
    thumbs.innerHTML=`<div class="scan-thumb"><img src="${objectUrl}" alt="Cart schedule"><div class="scan-thumb-label">Cart Schedule</div><button class="scan-thumb-rm" onclick="clearCartSched()">X</button></div>`;
    if(addBtn) addBtn.style.display='none'; // hide add button once scanned
    if(inputEl) inputEl.value='';
  });
}

function clearCartSched(){
  cartSchedImage=null;
  const thumbs=document.getElementById('cart-sched-thumbs');
  const addBtn=document.getElementById('cart-sched-add-btn');
  if(thumbs) thumbs.innerHTML='';
  if(addBtn) addBtn.style.display='flex'; // show add button again
}

// ── Parse PDF ─────────────────────────────────────────────────────────────────
async function parsePDF(){
  if(scannedPages.length===0)return;
  setStatus('Preparing...');
  document.getElementById('parse-btn').disabled=true;

  try{
    if(DEBUG_MODE){
      setStatus('');
      const now=new Date();
      scheduleDate=`${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getDate().toString().padStart(2,'0')}/${now.getFullYear().toString().slice(-2)}`;
      document.getElementById('sched-date').textContent=scheduleDate+'  [DEBUG]';
      employees=MOCK_EMPLOYEES.map(e=>({...e,name:normalizeName(e.name)}));
      excludeFromCarts=new Set([...permNoCart].filter(n=>employees.some(e=>e.name===n)));
      excludeFromSweep=new Set();
      closeStep('step1');
      renderAssociates();renderFECOptions();
      ['step2','step3','step4','generate-wrap'].forEach(id=>document.getElementById(id).style.display='block');
      closeStep('step2');openStep('step3');closeStep('step4');
      document.getElementById('step2').scrollIntoView({behavior:'smooth'});
      document.getElementById('parse-btn').disabled=false;
      return;
    }

    // Extract date from the schedule image
    const now=new Date();
    scheduleDate=`${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getDate().toString().padStart(2,'0')}/${now.getFullYear().toString().slice(-2)}`;
    try{
      const dateRes=await fetch(WORKER_URL,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({model:'claude-sonnet-4-5',max_tokens:20,
          messages:[{role:'user',content:[
            {type:'image',source:{type:'base64',media_type:scannedPages[0].mediaType||'image/jpeg',data:scannedPages[0].b64}},
            {type:'text',text:'What is the date shown on this schedule? Reply with ONLY the date in MM/DD/YY format, e.g. 05/24/26. Nothing else.'}
          ]}],_rawParse:true})});
      if(dateRes.ok){
        const dateData=await dateRes.json();
        const dateTxt=((dateData.content||[]).map(b=>b.text||'').join('')).trim();
        const dateMatch=dateTxt.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if(dateMatch) scheduleDate=`${dateMatch[1].padStart(2,'0')}/${dateMatch[2].padStart(2,'0')}/${dateMatch[3].slice(-2)}`;
      }
    }catch(e){console.warn('Date extraction failed:',e.message);}
    // sched-date removed from header
    // scheduleDate is still used for PDF filename

    setStatus('Analyzing with AI...');

    const prompt=`You are reading a retail store Daily Overview shift schedule shown in the attached image(s). Each image is one page.

The schedule has columns: Associate name | Job class | Shift/Roles (time ranges with role codes) | Meals (rightmost).

IMPORTANT - Names that wrap to two lines: Some associate names are too long to fit on one line and wrap to the next line within the same row. For example "Gogibedashvili," on one line and "Sandro" on the next are ONE person named "Gogibedashvili, Sandro". Always combine wrapped name parts into a single name before processing.

Extract ALL associates whose Job class says: Front Service Clerk, Cashier, Customer Service Staff, Cust Serv Team Leader, Customer Service Manager, or any Manager. Skip all others.

Return a JSON array where each object has these exact keys:
"name" (string: Names are listed as "Last, First" — you MUST reverse them to "First Last". Example: "Giordano, Cyan" becomes "Cyan Giordano", "Lafayette, Tony" becomes "Tony Lafayette". Strip [m]/[mm] prefixes. Fix ALL CAPS to Title Case. If name wraps two lines, combine before reversing),
"job" (string: "fsc"=Front Service Clerk, "cashier"=Cashier, "css"=Customer Service Staff, "cstl"=Cust Serv Team Leader, "csm"=CS Manager, "mgr"=other manager),
"cartStart" (string: start time of CS-Bag role. CRITICAL: 06:45 AM = "6:45am", 01:00 PM = "1:00pm", 12:00 PM = "12:00pm". Times before 12 with AM are morning, times with PM are afternoon/evening. null if no CS-Bag),
"cartEnd" (string: end time of CS-Bag role, same format, null if none),
"mealStart" (string: time from rightmost Meals column, same format, null if none),
"mealEnd" (string: end time from Meals column, same format, null if none),
"autoFecSegments" (array of {start,end} for CS-FEC roles, or []),
"csCleaningSegments" (array of {start,end} for CS-Cleaning roles, or []),
"csFloorCareSegments" (array of {start,end} for CS-Floor Care roles, or []).

Rules: Multiple CS-Bag segments = use earliest start and latest end. Ignore handwriting. Start response with [ and end with ]. No markdown.`

    // Validate that scanned pages look like a Daily Overview
    setStatus('Checking scanned pages...');
    const validatePrompt='Look at this image. Is it a retail store "Daily Overview" shift schedule? It should have columns for Associate name, Job class, Shift/Roles, and Meals. Answer only YES or NO.';
    for(let pi=0;pi<scannedPages.length;pi++){
      const vRes=await fetch(WORKER_URL,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({model:'claude-sonnet-4-5',max_tokens:10,
          messages:[{role:'user',content:[
            {type:'image',source:{type:'base64',media_type:scannedPages[pi].mediaType||'image/jpeg',data:scannedPages[pi].b64}},
            {type:'text',text:validatePrompt}
          ]}],_rawParse:true})});
      if(vRes.ok){
        const vData=await vRes.json();
        const vTxt=((vData.content||[]).map(b=>b.text||'').join('')).trim().toUpperCase();
        if(vTxt.startsWith('NO')){
          throw new Error(`Page ${pi+1} doesn't look like a Daily Overview Schedule. Please make sure you're scanning the correct document.`);
        }
      }
    }

    // Build content array from scanned images
    setStatus(`Reading ${scannedPages.length} page(s)...`);
    // Force supported media types - Claude supports jpeg, png, gif, webp
    const supportedTypes=['image/jpeg','image/png','image/gif','image/webp'];
    const contentArr=[
      {type:'text',text:`This is a ${scannedPages.length}-page retail Daily Overview shift schedule. Each image is one page.\n\n${prompt}`},
      ...scannedPages.map(p=>{
        let mt=p.mediaType||'image/jpeg';
        if(!supportedTypes.includes(mt)) mt='image/jpeg';
        console.log('Sending image with media_type:',mt,'b64 length:',p.b64.length);
        return {type:'image',source:{type:'base64',media_type:mt,data:p.b64}};
      }),
    ];

    const res=await fetch(WORKER_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-5',
        max_tokens:4000,
        messages:[{role:'user',content:contentArr}]
      })
    });

    if(!res.ok){let e='';try{e=await res.text();}catch(x){}throw new Error(`Worker error ${res.status}: ${e}`);}
    const data=await res.json();
    if(data.error) throw new Error(data.error.message||JSON.stringify(data.error));
    if(!data.success){
      console.error('Worker response:', JSON.stringify(data).substring(0,500));
      throw new Error('AI could not read the schedule: '+(data.raw?data.raw.substring(0,200):'unknown error'));
    }

    // Normalize names and apply saved corrections
    employees=applyCorrections(data.employees.map(e=>({...e,name:normalizeName(e.name)})));

    // Parse cart schedule image if provided
    if(cartSchedImage){
      setStatus('Reading cart schedule...');
      await parseCartScheduleImage();
    }
    excludeFromCarts=new Set([...permNoCart].filter(n=>employees.some(e=>e.name===n)));
    excludeFromSweep=new Set();

    setStatus('');
    closeStep('step1');
    renderAssociates();
    renderFECOptions();
    ['step2','step3','step4','generate-wrap'].forEach(id=>{
      document.getElementById(id).style.display='block';
    });
    closeStep('step2');openStep('step3');closeStep('step4');
    document.getElementById('step2').scrollIntoView({behavior:'smooth'});
  }catch(err){
    setStatus('Error: '+err.message);
    document.getElementById('parse-btn').disabled=false;
  }
}

function setStatus(msg){
  const el=document.getElementById('status');
  el.style.display=msg?'flex':'none';
  if(msg)document.getElementById('status-text').textContent=msg;
}
function fileToB64(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=e=>{try{const b=e.target.result.split(',')[1];if(!b)throw new Error('Empty');res(b);}catch(err){rej(err);}};
    r.onerror=()=>rej(new Error('FileReader error'));
    r.readAsDataURL(file);
  });
}

// ── Render associates ─────────────────────────────────────────────────────────
function renderAssociates(){
  const grid=document.getElementById('assoc-grid');
  grid.innerHTML='';
  const seen=new Set();
  employees.forEach((e,i)=>{
    if(seen.has(e.name))return;seen.add(e.name);
    const noCart=excludeFromCarts.has(e.name)||permNoCart.has(e.name);
    const noSweep=excludeFromSweep.has(e.name);
    const isPerm=permNoCart.has(e.name);
    const div=document.createElement('div');div.className='assoc-card';
    const range=e.cartStart?`${e.cartStart}–${e.cartEnd}`:'No CS-Bag';
    const meal=e.mealStart?`<div class="meal">Meal: ${e.mealStart}–${e.mealEnd}</div>`:'';
    const fecNote=(e.autoFecSegments&&e.autoFecSegments.length)?`<div class="meal" style="color:var(--blue)">Auto-FEC: ${e.autoFecSegments.map(s=>`${s.start}–${s.end}`).join(', ')}</div>`:'';
    const permNote=isPerm?`<div class="meal" style="color:var(--red)">Permanently excluded from carts</div>`:'';
    div.innerHTML='';
    // Header row with name and edit button
    const headerRow=document.createElement('div');
    headerRow.style.cssText='display:flex;align-items:flex-start;justify-content:space-between;gap:6px';
    const nameInfo=document.createElement('div');
    nameInfo.innerHTML='<div class="name" id="name-display-'+i+'">'+e.name+'</div><div class="meta">'+jobLabel(e.job)+' · '+range+'</div>'+meal+fecNote+permNote;
    const editBtn=document.createElement('button');
    editBtn.className='edit-name-btn';editBtn.title='Edit name';editBtn.textContent='✏️';
    editBtn.onclick=(()=>{const idx=i;return()=>startEditName(idx);})();
    headerRow.appendChild(nameInfo);headerRow.appendChild(editBtn);
    div.appendChild(headerRow);
    // Inline edit row
    const editRow=document.createElement('div');
    editRow.className='name-edit-row';editRow.id='name-edit-'+i;editRow.style.display='none';
    const inp=document.createElement('input');inp.type='text';inp.className='name-edit-input';
    inp.id='name-input-'+i;inp.value=e.name;
    inp.onkeydown=((idx)=>function(ev){if(ev.key==='Enter')saveEditName(idx);})(i);
    const saveBtn=document.createElement('button');saveBtn.className='sm-btn';saveBtn.textContent='Save';
    saveBtn.onclick=(()=>{const idx=i;return()=>saveEditName(idx);})();
    const cancelBtn=document.createElement('button');cancelBtn.className='sm-btn';cancelBtn.textContent='Cancel';
    cancelBtn.onclick=(()=>{const idx=i;return()=>cancelEditName(idx);})();
    editRow.appendChild(inp);editRow.appendChild(saveBtn);editRow.appendChild(cancelBtn);
    div.appendChild(editRow);
    // Toggles
    const toggles=document.createElement('div');toggles.className='toggles';toggles.style.marginTop='8px';
    const cartBtn=document.createElement('button');
    cartBtn.className='tog'+(noCart?' active-no-cart':'');
    if(isPerm){cartBtn.disabled=true;cartBtn.title='Permanently excluded';}
    cartBtn.textContent=noCart?'✕ No carts':'No carts';
    cartBtn.onclick=function(){toggleExclude('cart',e.name,this);};
    const sweepBtn=document.createElement('button');
    sweepBtn.className='tog'+(noSweep?' active-no-sweep':'');
    sweepBtn.textContent=noSweep?'✕ No sweep':'No sweep';
    sweepBtn.onclick=function(){toggleExclude('sweep',e.name,this);};
    toggles.appendChild(cartBtn);toggles.appendChild(sweepBtn);
    div.appendChild(toggles)
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


// ── Name editing ──────────────────────────────────────────────────────────────
function cancelEditName(i){
  document.getElementById('name-edit-'+i).style.display='none';
  document.getElementById('name-input-'+i).value=employees[i].name;
}
function saveEditName(i){
  const newName=document.getElementById('name-input-'+i).value.trim();
  if(!newName)return;
  const oldName=employees[i].name;
  if(oldName===newName){document.getElementById('name-edit-'+i).style.display='none';return;}
  // Ask if they want to save this correction permanently
  const savePerm=confirm('Save "'+oldName+'" → "'+newName+'" as a permanent correction?\nNext time this name appears it will be auto-fixed.');
  if(savePerm){
    nameCorrections[oldName]=newName;
    // Also carry forward any previous corrections pointing to oldName
    Object.keys(nameCorrections).forEach(k=>{if(nameCorrections[k]===oldName)nameCorrections[k]=newName;});
    saveCorrections(nameCorrections);
  }
  // Update all entries with this name (split shifts)
  employees.forEach(e=>{if(e.name===oldName)e.name=newName;});
  // Update exclusion sets
  if(excludeFromCarts.has(oldName)){excludeFromCarts.delete(oldName);excludeFromCarts.add(newName);}
  if(excludeFromSweep.has(oldName)){excludeFromSweep.delete(oldName);excludeFromSweep.add(newName);}
  document.getElementById('name-edit-'+i).style.display='none';
  renderAssociates();
  renderFECOptions();
}

// ── FEC options ───────────────────────────────────────────────────────────────
function renderFECOptions(){
  const candidates=employees.filter(e=>['css','cstl','csm','mgr'].includes(e.job));
  const autoFecs=employees.filter(e=>e.autoFecSegments&&e.autoFecSegments.length>0);

  // Auto-FEC callout
  const autoFecDiv=document.getElementById('auto-fec-callout');
  const fec1Box=document.getElementById('fec1-box');
  if(autoFecs.length>0){
    autoFecDiv.innerHTML='<div class="lbl" style="margin-bottom:6px">Auto-detected CS-FEC</div>'+
      autoFecs.map(e=>`<div class="auto-fec-row"><span class="auto-fec-tag">Auto-FEC</span> ${e.name} — ${e.autoFecSegments.map(s=>`${s.start}–${s.end}`).join(', ')}</div>`).join('');
    autoFecDiv.style.display='block';
    if(fec1Box) fec1Box.style.display='none'; // hide day FEC if auto-detected
  } else {
    autoFecDiv.style.display='none';
    if(fec1Box) fec1Box.style.display='block';
  }

  // Suggest closing FEC — CSS with latest CS-Bag end time
  const cssBag=employees.filter(e=>e.job==='css'&&e.cartEnd);
  const suggestedFec2=cssBag.sort((a,b)=>timeToMins(b.cartEnd)-timeToMins(a.cartEnd))[0];

  const fecSuggest=document.getElementById('fec-suggestion');
  if(suggestedFec2){
    fecSuggest.innerHTML='';
    const sugBox=document.createElement('div');
    sugBox.className='fec-suggest-box';
    sugBox.style.cssText='flex-direction:column;gap:10px;background:#eef4ff;border-color:#1a4fa0';
    sugBox.innerHTML='<div style="display:flex;align-items:center;gap:10px"><span style="font-size:22px">&#x1F4A1;</span><div><div style="font-weight:600;font-size:14px">Suggested Closing FEC: <em>'+suggestedFec2.name+'</em></div><div style="font-size:12px;color:#666">CS-Bag until '+suggestedFec2.cartEnd+'</div></div></div>';
    const btnRow=document.createElement('div');btnRow.style.display='flex';btnRow.style.gap='8px';
    const confirmBtn=document.createElement('button');
    confirmBtn.className='parse-btn';confirmBtn.style.cssText='padding:8px 16px;font-size:13px;width:auto;margin-top:0';
    confirmBtn.textContent='✓ Confirm as Closing FEC';
    confirmBtn.onclick=()=>confirmSuggestedFec(suggestedFec2.name);
    const changeBtn=document.createElement('button');changeBtn.className='sm-btn';changeBtn.textContent='Change';
    changeBtn.onclick=()=>{document.getElementById('fec2-select').value='';fecSuggest.style.display='none';};
    btnRow.appendChild(confirmBtn);btnRow.appendChild(changeBtn);
    sugBox.appendChild(btnRow);fecSuggest.appendChild(sugBox);
    fecSuggest.style.display='block';
  } else {
    fecSuggest.style.display='none';
  }
  const seen=new Set();
  employees.forEach(e=>{
    if(seen.has(e.name))return;seen.add(e.name);
    const noCart=excludeFromCarts.has(e.name)||permNoCart.has(e.name);
    const noSweep=excludeFromSweep.has(e.name);
    const isPerm=permNoCart.has(e.name);
    const div=document.createElement('div');div.className='assoc-card';
    const range=e.cartStart?`${e.cartStart}–${e.cartEnd}`:'No CS-Bag';
    const meal=e.mealStart?`<div class="meal">Meal: ${e.mealStart}–${e.mealEnd}</div>`:'';
    const fecNote=(e.autoFecSegments&&e.autoFecSegments.length)?`<div class="meal" style="color:var(--blue)">Auto-FEC: ${e.autoFecSegments.map(s=>`${s.start}–${s.end}`).join(', ')}</div>`:'';
    const permNote=isPerm?`<div class="meal" style="color:var(--red)">Permanently excluded from carts</div>`:'';
    div.innerHTML=`
      <div class="name">${e.name}</div>
      <div class="meta">${jobLabel(e.job)} · ${range}</div>
      ${meal}${fecNote}${permNote}
      <div class="toggles">
        <button class="tog ${noCart?'active-no-cart':''}" ${isPerm?'disabled title="Permanently excluded"':''} onclick="toggleExclude('cart','${e.name.replace(/'/g,"\\'")}',this)">${noCart?'✕ No carts':'No carts'}</button>
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


// ── Name editing ──────────────────────────────────────────────────────────────
function startEditName(i){
  document.getElementById('name-edit-'+i).style.display='flex';
  const inp=document.getElementById('name-input-'+i);
  inp.focus();inp.select();
}
function cancelEditName(i){
  document.getElementById('name-edit-'+i).style.display='none';
  document.getElementById('name-input-'+i).value=employees[i].name;
}
function saveEditName(i){
  const newName=document.getElementById('name-input-'+i).value.trim();
  if(!newName)return;
  const oldName=employees[i].name;
  if(oldName===newName){document.getElementById('name-edit-'+i).style.display='none';return;}
  // Ask if they want to save this correction permanently
  const savePerm=confirm('Save "'+oldName+'" → "'+newName+'" as a permanent correction?\nNext time this name appears it will be auto-fixed.');
  if(savePerm){
    nameCorrections[oldName]=newName;
    // Also carry forward any previous corrections pointing to oldName
    Object.keys(nameCorrections).forEach(k=>{if(nameCorrections[k]===oldName)nameCorrections[k]=newName;});
    saveCorrections(nameCorrections);
  }
  // Update all entries with this name (split shifts)
  employees.forEach(e=>{if(e.name===oldName)e.name=newName;});
  // Update exclusion sets
  if(excludeFromCarts.has(oldName)){excludeFromCarts.delete(oldName);excludeFromCarts.add(newName);}
  if(excludeFromSweep.has(oldName)){excludeFromSweep.delete(oldName);excludeFromSweep.add(newName);}
  document.getElementById('name-edit-'+i).style.display='none';
  renderAssociates();
  renderFECOptions();
}

// ── FEC options ───────────────────────────────────────────────────────────────
function renderFECOptions(){
  const candidates=employees.filter(e=>['css','cstl','csm','mgr'].includes(e.job));
  const autoFecs=employees.filter(e=>e.autoFecSegments&&e.autoFecSegments.length>0);

  // Auto-FEC callout
  const autoFecDiv=document.getElementById('auto-fec-callout');
  const fec1Box=document.getElementById('fec1-box');
  if(autoFecs.length>0){
    autoFecDiv.innerHTML='<div class="lbl" style="margin-bottom:6px">Auto-detected CS-FEC</div>'+
      autoFecs.map(e=>`<div class="auto-fec-row"><span class="auto-fec-tag">Auto-FEC</span> ${e.name} — ${e.autoFecSegments.map(s=>`${s.start}–${s.end}`).join(', ')}</div>`).join('');
    autoFecDiv.style.display='block';
    if(fec1Box) fec1Box.style.display='none'; // hide day FEC if auto-detected
  } else {
    autoFecDiv.style.display='none';
    if(fec1Box) fec1Box.style.display='block';
  }

  // Suggest closing FEC — CSS with latest CS-Bag end time
  const cssBag=employees.filter(e=>e.job==='css'&&e.cartEnd);
  const suggestedFec2=cssBag.sort((a,b)=>timeToMins(b.cartEnd)-timeToMins(a.cartEnd))[0];

  const fecSuggest=document.getElementById('fec-suggestion');
  if(suggestedFec2){
    // FEC suggestion handled above
    fecSuggest.style.display='block';
  } else {
    fecSuggest.style.display='none';
  }

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

  // Pre-select suggested closing FEC
  if(suggestedFec2){
    document.getElementById('fec2-select').value=suggestedFec2.name;
  }
}

function confirmSuggestedFec(name){
  document.getElementById('fec2-select').value=name;
  document.getElementById('fec-suggestion').style.display='none';
}

// ── Slot table ────────────────────────────────────────────────────────────────
function renderSlotTable(){
  const tbody=document.getElementById('slot-tbody');tbody.innerHTML='';
  for(let m=7*60;m<22*60;m+=30){
    if(slotIntervals[m]===15){
      [m, m+15].forEach(s=>{
        const tr=document.createElement('tr');
        tr.className='slot-15';
        tr.innerHTML=`<td class="time-cell"><span class="slot-15-indicator">15</span>${minsToStr(s)}</td>
          <td><input type="number" min="0" max="10" value="${slotCaps[s]||0}" onchange="slotCaps[${s}]=parseInt(this.value)||0"></td>
          <td><select onchange="slotTypes[${s}]=this.value">
            <option value="cart"${slotTypes[s]==='cart'?' selected':''}>Cart</option>
            <option value="lot"${slotTypes[s]==='lot'?' selected':''}>Lot/Bag</option>
          </select></td>`;
        tbody.appendChild(tr);
      });
    } else {
      const tr=document.createElement('tr');
      tr.innerHTML=`<td class="time-cell">${minsToStr(m)}</td>
        <td><input type="number" min="0" max="10" value="${slotCaps[m]||0}" onchange="slotCaps[${m}]=parseInt(this.value)||0"></td>
        <td><select onchange="slotTypes[${m}]=this.value">
          <option value="cart"${slotTypes[m]==='cart'?' selected':''}>Cart</option>
          <option value="lot"${slotTypes[m]==='lot'?' selected':''}>Lot/Bag</option>
        </select></td>`;
      tbody.appendChild(tr);
    }
  }
}
function setAllCap(){
  const v=parseInt(document.getElementById('bulk-cap').value)||1;
  SLOTS.forEach(m=>{slotCaps[m]=v;});
  renderSlotTable();
}
function setAllType(){
  const tp=document.getElementById('bulk-type').value;
  SLOTS.forEach(m=>{slotTypes[m]=tp;});
  renderSlotTable();
}

// ── Parse Cart Schedule Image ─────────────────────────────────────────────────
async function parseCartScheduleImage(){
  try{
    // Validate it's a cart service schedule
    const cvRes=await fetch(WORKER_URL,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:'claude-sonnet-4-5',max_tokens:10,
        messages:[{role:'user',content:[
          {type:'image',source:{type:'base64',media_type:cartSchedImage.mediaType||'image/jpeg',data:cartSchedImage.b64}},
          {type:'text',text:'Is this a "Cart Service" or "Express Schedule" with a Parking Lot column showing number of associates needed per time slot? Answer YES or NO only.'}
        ]}],_rawParse:true})});
    if(cvRes.ok){
      const cvData=await cvRes.json();
      const cvTxt=((cvData.content||[]).map(b=>b.text||'').join('')).trim().toUpperCase();
      if(cvTxt.startsWith('NO')){
        setStatus('');
        alert('That image doesn\'t look like a Cart Service Schedule. The Cart Service Schedule slot config was not applied — you can set it manually in Step 4.');
        return;
      }
    }
    const cartPrompt=`This is a Cart Service / Express Schedule printed form. Look at the "Parking Lot" column (third column).

For EVERY row that has a time slot (e.g. "7:00 AM - 7:30 AM"), read the Parking Lot cell and return:
- "time": the start time only, as "7:00am", "7:30am", "1:00pm" etc (lowercase, no leading zero for hours 1-9... wait, use "7:00am" not "07:00am")
- "capacity": the integer in that cell. If it says "lot/bag" or is blank with lot/bag written, use 1. If blank or 0, use 0.
- "type": "lot" if the cell contains "lot/bag", "lot bag", or "lot", otherwise "cart"

Important: look carefully — some cells say "lot/bag" as text instead of a number. Those should have type "lot".

Return ONLY a JSON array. No markdown. Start with [ end with ].
Example: [{"time":"7:00am","capacity":1,"type":"lot"},{"time":"7:30am","capacity":1,"type":"lot"},{"time":"8:00am","capacity":1,"type":"cart"}]`;

    const res=await fetch(WORKER_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-5',
        max_tokens:2000,
        messages:[{role:'user',content:[
          {type:'image',source:{type:'base64',media_type:cartSchedImage.mediaType||'image/jpeg',data:cartSchedImage.b64}},
          {type:'text',text:cartPrompt}
        ]}],
        _rawParse:true
      })
    });
    if(!res.ok){console.warn('Cart schedule request failed:',res.status);return;}
    const data=await res.json();
    const rawTxt=(data.content||[]).map(b=>b.text||'').join('').trim();
    console.log('Cart schedule raw response:',rawTxt.substring(0,200));
    const s=rawTxt.indexOf('['),e=rawTxt.lastIndexOf(']');
    if(s===-1||e<s){console.warn('No JSON array in cart response');return;}
    const slots=JSON.parse(rawTxt.substring(s,e+1));
    let applied=0;
    slots.forEach(slot=>{
      const mins=timeToMins(slot.time);
      if(mins!==null&&BASE_SLOTS.includes(mins)){
        const cap=parseInt(slot.capacity)||0;
        const type=slot.type==='lot'?'lot':'cart';
        slotCaps[mins]=cap;
        slotTypes[mins]=type;
        // If this slot is split into 15-min halves, apply to both
        if(slotIntervals[mins]===15){
          slotCaps[mins+15]=cap;
          slotTypes[mins+15]=type;
        }
        applied++;
      }
    });
    renderSlotTable();
    console.log('Cart schedule applied:',applied,'slots updated from',slots.length,'returned');
  }catch(e){
    console.warn('Cart schedule parse failed:',e.message);
  }
}


// ── Print PDF ─────────────────────────────────────────────────────────────────


// ── History ───────────────────────────────────────────────────────────────────
const HISTORY_KEY='cart-scheduler-history';
const HISTORY_DAYS=7;

function loadHistory(){
  try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');}catch(e){return [];}
}

function saveToHistory(scheduleDate,pdfDataUri){
  const history=loadHistory();
  const now=Date.now();
  const cutoff=now-HISTORY_DAYS*24*60*60*1000;
  // Remove entries older than 7 days
  const filtered=history.filter(h=>h.ts>cutoff);
  // Remove duplicate for same date
  const deduped=filtered.filter(h=>h.date!==scheduleDate);
  // Add new entry (store compressed — just the dataUri)
  deduped.unshift({date:scheduleDate,ts:now,pdf:pdfDataUri});
  // Keep max 14 entries as safety
  try{
    localStorage.setItem(HISTORY_KEY,JSON.stringify(deduped.slice(0,14)));
  }catch(e){
    // Storage full — remove oldest and try again
    try{localStorage.setItem(HISTORY_KEY,JSON.stringify(deduped.slice(0,7)));}catch(e2){}
  }
  renderHistory();
}

function renderHistory(){
  const history=loadHistory();
  const container=document.getElementById('history-list');
  const section=document.getElementById('history-section');
  if(!container||!section)return;
  if(history.length===0){section.style.display='none';return;}
  section.style.display='block';
  container.innerHTML='';
  history.forEach(h=>{
    const div=document.createElement('div');div.className='history-row';
    const dateStr=h.date||'Unknown date';
    const viewBtn=document.createElement('button');
    viewBtn.className='sm-btn';viewBtn.textContent='View PDF';
    viewBtn.onclick=(function(d){return function(){viewHistoryPDF(d);};})(h.date);
    div.innerHTML='<span class="history-date"><i class="ti ti-calendar"></i> '+dateStr+'</span>';
    div.appendChild(viewBtn);
    container.appendChild(div);
  });
}

function viewHistoryPDF(date){
  const history=loadHistory();
  const entry=history.find(h=>h.date===date);
  if(!entry){alert('Could not find this schedule.');return;}
  const iframe=document.createElement('iframe');
  iframe.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:none;z-index:9999;background:white;';
  const closeBtn=document.createElement('button');
  closeBtn.textContent='✕ Close';
  closeBtn.style.cssText='position:fixed;top:12px;right:12px;z-index:10000;padding:8px 14px;background:#1a1a1a;color:white;border:none;border-radius:8px;font-size:14px;cursor:pointer;';
  closeBtn.onclick=()=>{document.body.removeChild(iframe);document.body.removeChild(closeBtn);};
  iframe.src=entry.pdf;
  document.body.appendChild(iframe);
  document.body.appendChild(closeBtn);
}

// ── Scheduler ─────────────────────────────────────────────────────────────────
function buildSchedule(){
  applySplitRange(); // apply any 15-min range settings first
  const fec1Name=document.getElementById('fec1-select').value;
  const fec1Start=timeInputToMins(document.getElementById('fec1-start').value);
  const fec1End=timeInputToMins(document.getElementById('fec1-end').value);
  const fec2Name=document.getElementById('fec2-select').value;
  const fec2Start=timeInputToMins(document.getElementById('fec2-start').value);
  const fec2End=timeInputToMins(document.getElementById('fec2-end').value);

  const allExcluded=new Set([...excludeFromCarts,...permNoCart]);

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
      if(allExcluded.has(e.name))return false;
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

    // Check if AM cleaner is available and on their cleaning shift
    const amCleanerEntry=cleanersList.length>0?cleanersList[0]:null;
    const amCleanerSegs=amCleanerEntry?state.find(e=>e.name===amCleanerEntry.name)?.cleanSegs||[]:[];
    const amInClean=amCleanerEntry&&amCleanerSegs.some(s=>ss>=s.cs&&ss<s.ce);

    const isEligible=(e)=>{
      if(!['fsc'].includes(e.job))return false;
      if(e.cartStart===null||e.cartStart>ss||e.cartEnd<se)return false;
      if(isOnMeal(e,ss,se))return false;
      if(cartNames.has(e.name))return false;
      if(excludeFromSweep.has(e.name))return false;
      if(allExcluded.has(e.name))return false;
      if(pmCleaner&&e.name===pmCleaner&&inPmClean)return false;
      if(inF1sw&&e.name===fec1Name)return false;
      if(inF2sw&&e.name===fec2Name)return false;
      return true;
    };

    // Priority 1: AM cleaner during their cleaning hours
    if(amCleanerEntry&&amInClean){
      const amEmp=state.find(e=>e.name===amCleanerEntry.name&&isEligible(e));
      if(amEmp)return amEmp.name;
    }

    // Priority 2: everyone else by fewest sweeps
    const pool=state.filter(e=>isEligible(e));
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
  closeStep('step2');closeStep('step3');closeStep('step4');
  renderResults();
}

// ── Render results ────────────────────────────────────────────────────────────
function renderResults(){
  const{schedule,slotCounts,fec1Name,fec2Name}=lastSchedule;
  // Show and open result steps
  document.getElementById('step5').style.display='block';
  document.getElementById('step6').style.display='block';
  closeStep('step5'); // collapsed by default
  openStep('step6');
  document.getElementById('step6').scrollIntoView({behavior:'smooth'});

  const tbody=document.getElementById('counts-tbody');tbody.innerHTML='';
  const seen=new Set();
  employees.forEach(e=>{
    if(seen.has(e.name))return;seen.add(e.name);
    const isFec=e.name===fec1Name||e.name===fec2Name;
    const isAFec=e.autoFecSegments&&e.autoFecSegments.length;
    const isMgr=['cstl','csm','mgr'].includes(e.job);
    const xc=excludeFromCarts.has(e.name)||permNoCart.has(e.name);
    const xs=excludeFromSweep.has(e.name);
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${e.name}${isFec?`<span class="badge badge-fec">FEC</span>`:''}${isAFec?`<span class="badge badge-autofec">Auto-FEC</span>`:''}${isMgr?`<span class="badge badge-cstl">${['cstl'].includes(e.job)?'CS Team Leader':'Manager'}</span>`:''}${xc?`<span class="badge badge-excluded">No carts</span>`:''}${xs?`<span class="badge badge-excluded">No sweep</span>`:''}</td>
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
    const sw=s.sweep?(Array.isArray(s.sweep)?s.sweep:[s.sweep]).map(n=>`<span class="sched-name sweep">${n}</span>`).join(''):'' ;
    tr.innerHTML=`<td class="time-cell">${minsToStr(s.start)}</td><td class="num-cell">${numCell}</td><td>${names}</td><td class="sweep-cell">${sw}</td>`;
    stbody.appendChild(tr);
  });
}

// ── PDF Export ────────────────────────────────────────────────────────────────
function buildPDFDoc(jsPDF,schedule,fec1Name,fec2Name,scheduleDate){
  const doc=new jsPDF({orientation:'portrait',unit:'pt',format:'letter'});
  const PW=612,PH=792,MARGIN=36,ROW_H=15;
  const COL_TIME=MARGIN,COL_NUM=MARGIN+50,COL_A=MARGIN+88;
  const A_SUB_W=88,MAX_A=3;
  const SWEEP_RIGHT=PW-MARGIN,SWEEP_W=132,SW_SUB_W=66;
  const COL_SW=SWEEP_RIGHT-SWEEP_W;
  const MID=ROW_H/2+2;
  const TITLE_H=20;
  const drawHeader=y=>{
    // Dark title banner
    doc.setFillColor(50,50,50);doc.rect(MARGIN,y,PW-2*MARGIN,TITLE_H,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(255,255,255);
    doc.text('Cart Schedule '+scheduleDate,PW/2,y+TITLE_H/2+4,{align:'center'});
    y+=TITLE_H;
    // Column headers
    doc.setFillColor(200,198,192);doc.rect(MARGIN,y,PW-2*MARGIN,ROW_H,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(60,60,60);
    doc.text('Time',COL_TIME,y+MID);doc.text('#',COL_NUM,y+MID);
    doc.text('Associate(s)',COL_A,y+MID);doc.text('Store Sweep',COL_SW,y+MID);
    doc.setDrawColor(180,178,172);doc.setLineWidth(0.5);
    doc.line(COL_SW-4,y,COL_SW-4,y+ROW_H);
    doc.setTextColor(0,0,0);return y+ROW_H+1;
  };
  const notes=[];let hasFec=false,hasMgr=false;
  schedule.forEach(s=>{s.assigned.forEach(a=>{if(a.fecOn)hasFec=true;if(a.isMgr)hasMgr=true;});});
  if(hasFec){
    if(fec1Name)notes.push('* '+firstLast(fec1Name)+' is a designated FEC — placed on carts due to insufficient coverage');
    if(fec2Name&&fec2Name!==fec1Name)notes.push('* '+firstLast(fec2Name)+' is a designated FEC — placed on carts due to insufficient coverage');
  }
  if(hasMgr)notes.push('\u2020 CS Team Leader/Manager placed on carts only where no other associate was available');
  const FOOTER_SPACE=notes.length*9+30;
  const newPage=()=>{
    doc.addPage();
    return drawHeader(MARGIN);
  };
  let y=MARGIN;
  y=drawHeader(y);
  schedule.forEach(function(s,idx){
    if(y>PH-FOOTER_SPACE-20)y=newPage();
    if(idx%2===0){doc.setFillColor(251,251,249);doc.rect(MARGIN,y-3,PW-2*MARGIN,ROW_H,'F');}
    doc.setFont('helvetica','normal');doc.setFontSize(8);
    doc.setDrawColor(210,210,210);doc.setLineWidth(0.5);
    doc.line(COL_SW-4,y-3,COL_SW-4,y+ROW_H-3);
    doc.setTextColor(120,120,120);doc.text(minsToStr(s.start),COL_TIME,y+ROW_H/2+3);
    if(s.type==='lot'){doc.setTextColor(26,79,160);doc.text('Lot/Bag',COL_NUM,y+ROW_H/2+3);}
    else{doc.setTextColor(0,0,0);doc.text(String(s.cap),COL_NUM,y+ROW_H/2+3);}
    doc.setTextColor(0,0,0);
    s.assigned.slice(0,MAX_A).forEach(function(a,ci){
      doc.text(firstLast(a.name)+(a.fecOn?' *':a.isMgr?' \u2020':''),COL_A+ci*A_SUB_W,y+ROW_H/2+3);
    });
    if(s.sweep){
      doc.setTextColor(26,107,58);
      var sw=Array.isArray(s.sweep)?s.sweep:[s.sweep];
      sw.slice(0,2).forEach(function(n,si){doc.text(firstLast(n),COL_SW+si*SW_SUB_W,y+ROW_H/2+3);});
      doc.setTextColor(0,0,0);
    }
    y+=ROW_H;
  });
  var totalPages=doc.getNumberOfPages();
  doc.setPage(totalPages);
  var footY=PH-FOOTER_SPACE+4;
  if(notes.length){
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(150,150,150);
    notes.forEach(function(n){doc.text(n,MARGIN,footY);footY+=9;});
  }
  doc.setFont('helvetica','italic');doc.setFontSize(8);doc.setTextColor(190,190,190);
  doc.text('Made by Norm Bottie',PW-MARGIN,PH-20,{align:'right'});
  return doc;
}

async function exportPDF(){
  if(!lastSchedule)return;
  if(!window.jspdf){alert('PDF library loading, please try again.');return;}
  var jsPDF=window.jspdf.jsPDF;
  var s=lastSchedule;
  var doc=buildPDFDoc(jsPDF,s.schedule,s.fec1Name,s.fec2Name,s.scheduleDate);
  // Save to history
  try{saveToHistory(s.scheduleDate,doc.output('datauristring'));}catch(e){console.warn('History save failed:',e);}
  doc.save('Cart Schedule '+s.scheduleDate.replace(/\//g,'-')+'.pdf');
}

async function printPDF(){
  if(!lastSchedule)return;
  if(!window.jspdf){alert('PDF library loading, please try again.');return;}
  var jsPDF=window.jspdf.jsPDF;
  var s=lastSchedule;
  var doc=buildPDFDoc(jsPDF,s.schedule,s.fec1Name,s.fec2Name,s.scheduleDate);
  var blob=doc.output('blob');
  var blobUrl=URL.createObjectURL(blob);
  var iframe=document.createElement('iframe');
  iframe.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:none;';
  document.body.appendChild(iframe);
  iframe.onload=function(){
    setTimeout(function(){
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(function(){document.body.removeChild(iframe);URL.revokeObjectURL(blobUrl);},3000);
    },500);
  };
  iframe.src=blobUrl;
}
