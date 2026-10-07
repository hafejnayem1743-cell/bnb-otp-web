const API="https://bnb-otp-web.hafejnayem1743.workers.dev";
const root=document.getElementById("admin");
let T=localStorage.otp_admin||"",S={st:{},c:[],n:[],o:[]};

async function api(path,opt={}){
  opt.headers={...(opt.headers||{}),...(T?{Authorization:"Bearer "+T}:{})};
  const r=await fetch(API+path,opt);
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(j.error||"Request failed");
  return j;
}

const esc=x=>String(x??"").replace(/[&<>"']/g,m=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[m]));

function login(){
root.innerHTML=`
<div class="admin-login">
  <div class="login-card">
    <div class="login-logo">BD NAYEM <span>BOSS</span></div>
    <div class="login-icon">🔐</div>
    <h1>Admin Control Center</h1>
    <p>Manage countries, testing numbers and controlled OTP data.</p>
    <input id="u" placeholder="Username" autocomplete="username">
    <input id="p" type="password" placeholder="Password" autocomplete="current-password">
    <button class="primary wide" onclick="go()">LOGIN</button>
    <div id="e" class="error"></div>
  </div>
</div>`;
}

async function go(){
 try{
  const j=await api("/api/admin/login",{
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({username:u.value.trim(),password:p.value})
  });
  T=j.token;
  localStorage.otp_admin=T;
  dash();
 }catch(x){e.textContent=x.message}
}

async function load(){
 S.st=await api("/api/admin/stats");
 S.c=(await api("/api/admin/countries")).countries;
 S.n=(await api("/api/admin/numbers")).numbers;
 S.o=(await api("/api/admin/otps")).otps;
}

async function dash(){
 try{await api("/api/admin/me")}
 catch(x){T="";localStorage.removeItem("otp_admin");return login()}
 try{await load()}catch(x){return root.innerHTML=`<div class="fatal">API connection failed.<br><small>${esc(x.message)}</small></div>`}

 root.innerHTML=`
 <div class="admin-shell">
  <aside class="sidebar">
   <div class="side-brand">BD NAYEM <b>BOSS</b></div>
   <button onclick="overview()">⌂ <span>Dashboard</span></button>
   <button onclick="countries()">🌍 <span>Countries</span></button>
   <button onclick="numbers()">📱 <span>Numbers</span></button>
   <button onclick="otps()">📨 <span>OTP Inbox</span></button>
   <button onclick="test()">🧪 <span>Test OTP</span></button>
   <div class="side-bottom">
    <button onclick="toggleTheme()">◐ <span>Theme</span></button>
    <button onclick="logout()">↪ <span>Logout</span></button>
   </div>
  </aside>

  <main class="admin-main">
   <header class="topbar">
    <div>
     <div class="eyebrow">CONTROL CENTER</div>
     <h1>Admin Dashboard</h1>
    </div>
    <div class="admin-user">● ADMIN</div>
   </header>
   <section id="panel"></section>
  </main>
 </div>
 <style>${adminCSS}</style>`;
 overview();
}

function overview(){
 panel.innerHTML=`
 <div class="stats">
  ${stat("🌍","Countries",S.st.countries)}
  ${stat("📱","Numbers",S.st.numbers)}
  ${stat("📨","OTP Messages",S.st.otps)}
  ${stat("👤","Admins",S.st.users)}
 </div>
 <div class="welcome-panel">
  <div>
   <div class="eyebrow">BD NAYEM BOSS</div>
   <h2>OTP Testing Control Center</h2>
   <p>Manage your controlled testing numbers, countries and test SMS/OTP messages from one place.</p>
  </div>
  <button class="primary" onclick="addNumber()">＋ Add Numbers</button>
 </div>
 <div class="quick-grid">
  <button onclick="countries()">🌍<b>Countries</b><small>Manage availability</small></button>
  <button onclick="numbers()">📱<b>Numbers</b><small>Add up to 1000 at once</small></button>
  <button onclick="otps()">📨<b>OTP Inbox</b><small>View controlled messages</small></button>
 </div>`;
}

function stat(icon,name,value){
 return `<div class="stat"><span>${icon}</span><div><small>${name}</small><strong>${value??0}</strong></div></div>`;
}

function countries(){
 panel.innerHTML=`
 <div class="section-title"><div><div class="eyebrow">MANAGEMENT</div><h2>Countries</h2></div>
 <button class="primary" onclick="addCountry()">＋ Add Country</button></div>
 <div class="table-wrap"><table>
 <thead><tr><th>Country</th><th>Code</th><th>Dial</th><th>Status</th><th>Action</th></tr></thead>
 <tbody>${S.c.map(c=>`
 <tr>
  <td><b>${esc(c.flag)} ${esc(c.name)}</b></td>
  <td>${esc(c.code)}</td>
  <td>${esc(c.dial_code)}</td>
  <td>${c.enabled?'<span class="pill on">ACTIVE</span>':'<span class="pill off">OFF</span>'}</td>
  <td><button class="small" onclick="toggle(${c.id},${c.enabled?1:0})">Toggle</button></td>
 </tr>`).join("")}</tbody></table></div>`;
}

function addCountry(){
 panel.innerHTML=`
 <div class="form-card">
  <button class="back" onclick="countries()">← Countries</button>
  <h2>Add Country</h2>
  <div class="form-grid">
   <input id="cn" placeholder="Country name">
   <input id="cc" placeholder="Country code e.g. BD">
   <input id="cf" placeholder="Flag emoji e.g. 🇧🇩">
   <input id="cd" placeholder="Dial code e.g. +880">
  </div>
  <button class="primary" onclick="saveC()">SAVE COUNTRY</button>
 </div>`;
}

async function saveC(){
 await api("/api/admin/countries/save",{
  method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({name:cn.value.trim(),code:cc.value.trim(),flag:cf.value||"🌍",dial_code:cd.value.trim()})
 });
 await load();countries();
}

async function toggle(id, currentEnabled){
 try{
  const next = Number(currentEnabled) ? 0 : 1;

  const result = await api("/api/admin/countries/toggle",{
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({id,enabled:next})
  });

  const c = S.c.find(x=>Number(x.id)===Number(id));
  if(c) c.enabled = Number(result.enabled);

  countries();
 }catch(e){
  alert(e.message || "Country toggle failed");
 }
}

function numbers(){
 panel.innerHTML=`
 <div class="section-title">
  <div><div class="eyebrow">MANAGEMENT</div><h2>Testing Numbers</h2></div>
  <button class="primary" onclick="addNumber()">＋ Add Numbers</button>
 </div>
 <div class="toolbar">
  <input id="nsearch" placeholder="Search numbers..." oninput="filterNumbers()">
  <select id="ncountry" onchange="filterNumbers()">
   <option value="">All countries</option>
   ${S.c.map(c=>`<option value="${c.id}">${esc(c.flag)} ${esc(c.name)}</option>`).join("")}
  </select>
 </div>
 <div id="numberTable"></div>`;
 renderNumberTable(S.n);
}

function filterNumbers(){
 const q=(nsearch.value||"").toLowerCase();
 const cid=ncountry.value;
 renderNumberTable(S.n.filter(n=>
  (!q||String(n.number).toLowerCase().includes(q))&&
  (!cid||String(n.country_id)===cid)
 ));
}

const selectedNumbers=new Set();

function renderNumberTable(list){
 const ids=list.map(n=>Number(n.id));
 const selectedVisible=ids.filter(id=>selectedNumbers.has(id)).length;
 const allVisible=ids.length>0 && selectedVisible===ids.length;

 numberTable.innerHTML=`
 <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
  <button class="secondary" onclick='toggleSelectVisible(${JSON.stringify(ids)})'>
   ${allVisible?"☐ Clear Visible":"☑ Select Visible"}
  </button>
  <button class="primary" onclick="deleteSelectedNumbers()" ${selectedNumbers.size?"":"disabled"}>
   🗑 Delete Selected (${selectedNumbers.size})
  </button>
  <span class="muted">${selectedNumbers.size} selected · Maximum 1000 per delete</span>
 </div>

 <div class="table-wrap"><table>
 <thead><tr>
  <th style="width:45px">
   <input type="checkbox" ${allVisible?"checked":""}
    onchange='toggleSelectVisible(${JSON.stringify(ids)})'>
  </th>
  <th>Number</th>
  <th>Country</th>
  <th>Status</th>
  <th>Label</th>
  <th>Action</th>
 </tr></thead>

 <tbody>
 ${list.map(n=>`
  <tr>
   <td>
    <input type="checkbox"
     ${selectedNumbers.has(Number(n.id))?"checked":""}
     onchange="toggleNumberSelection(${Number(n.id)},this.checked)">
   </td>
   <td><b>${esc(n.number)}</b></td>
   <td>${esc(n.country_flag||"🌍")} ${esc(n.country_name||"-")}</td>
   <td><span class="pill">${esc(n.status)}</span></td>
   <td>${esc(n.label||"-")}</td>
   <td>
    <button class="small" onclick="deleteOneNumber(${Number(n.id)})">
     🗑 Delete
    </button>
   </td>
  </tr>`).join("") ||
  '<tr><td colspan="6" class="empty">No numbers found</td></tr>'}
 </tbody>
 </table></div>`;
}

function toggleNumberSelection(id,checked){
 id=Number(id);
 if(checked) selectedNumbers.add(id);
 else selectedNumbers.delete(id);
 filterNumbers();
}

function toggleSelectVisible(ids){
 const nums=ids.map(Number);
 const allSelected=nums.length>0 && nums.every(id=>selectedNumbers.has(id));

 nums.forEach(id=>{
  if(allSelected) selectedNumbers.delete(id);
  else selectedNumbers.add(id);
 });

 filterNumbers();
}

async function deleteOneNumber(id){
 id=Number(id);
 const n=S.n.find(x=>Number(x.id)===id);
 const label=n?.number||("ID "+id);

 if(!confirm(
   `Delete number ${label}?\n\n`+
   `Its OTP records will also be deleted.`
 )) return;

 await deleteNumbers([id]);
}

async function deleteSelectedNumbers(){
 const ids=[...selectedNumbers].map(Number).filter(Boolean);

 if(!ids.length){
  alert("Select at least one number.");
  return;
 }

 if(ids.length>1000){
  alert("Maximum 1000 numbers can be deleted at once.");
  return;
 }

 if(!confirm(
   `Delete ${ids.length} selected number${ids.length===1?"":"s"}?\n\n`+
   `Their OTP records will also be deleted.\n\n`+
   `This action cannot be undone.`
 )) return;

 await deleteNumbers(ids);
}

async function deleteNumbers(ids){
 try{
  const r=await api("/api/admin/numbers/delete",{
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({ids})
  });

  ids.forEach(id=>selectedNumbers.delete(Number(id)));

  alert(
   `✓ Deleted ${r.deleted||0} number${Number(r.deleted||0)===1?"":"s"}.`
  );

  await load();
  numbers();
 }catch(x){
  alert(x.message||"Number deletion failed");
 }
}

function addNumber(){
 panel.innerHTML=`
 <div class="form-card">
  <button class="back" onclick="numbers()">← Numbers</button>
  <div class="eyebrow">NUMBER MANAGEMENT</div>
  <h2>Add Testing Numbers</h2>
  <p class="muted">Choose a country and add 1–1000 controlled testing numbers in one batch.</p>

  <label>Country</label>
  <select id="nc">${S.c.filter(c=>c.enabled).map(c=>`<option value="${c.id}">${esc(c.flag)} ${esc(c.name)} (${esc(c.dial_code)})</option>`).join("")}</select>

  <label>Numbers</label>
  <textarea id="bulk" rows="12" placeholder="+8801700000001
+8801700000002
+8801700000003"></textarea>

  <div class="hint">One number per line · Maximum 1000 · Duplicate numbers are skipped.</div>

  <div class="bulk-actions">
   <button class="secondary" onclick="generateNumbers()">Generate</button>
   <button class="primary" onclick="saveBulk()">＋ ADD NUMBERS</button>
  </div>
  <div id="bulkMsg"></div>
 </div>`;
}

function generateNumbers(){
 const c=S.c.find(x=>x.id===Number(nc.value));
 if(!c)return;
 const prefix=prompt("Enter number prefix, e.g. "+c.dial_code);
 if(!prefix)return;
 const count=Math.min(1000,Number(prompt("How many numbers?","100"))||0);
 if(!count)return;
 bulk.value=Array.from({length:count},(_,i)=>prefix+String(i+1).padStart(7,"0")).join("\\n");
}

async function saveBulk(){
 const numbers=bulk.value.split(/\\r?\\n|,/).map(x=>x.trim()).filter(Boolean);
 if(!numbers.length)return bulkMsg.innerHTML='<div class="error">Enter at least one number.</div>';
 if(numbers.length>1000)return bulkMsg.innerHTML='<div class="error">Maximum 1000 numbers.</div>';

 try{
  bulkMsg.innerHTML='<div class="loading">Adding numbers...</div>';
  const r=await api("/api/admin/numbers/bulk",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({country_id:Number(nc.value),numbers})
  });
  bulkMsg.innerHTML=`<div class="success">✓ Added ${r.added} numbers · ${r.skipped} skipped</div>`;
  await load();
 }catch(x){bulkMsg.innerHTML=`<div class="error">${esc(x.message)}</div>`}
}

function otps(){
 panel.innerHTML=`
 <div class="section-title"><div><div class="eyebrow">CONTROLLED DATA</div><h2>OTP Inbox</h2></div></div>
 <div class="table-wrap"><table>
 <thead><tr><th>Number</th><th>Country</th><th>OTP</th><th>Source</th><th>Time</th></tr></thead>
 <tbody>${S.o.map(o=>`
 <tr>
  <td><b>${esc(o.number)}</b></td>
  <td>${esc(o.country_name||"-")}</td>
  <td><span class="otp-code">${esc(o.code)}</span></td>
  <td><span class="pill">CONTROLLED</span></td>
  <td>${new Date(o.created_at*1000).toLocaleString()}</td>
 </tr>`).join("")}</tbody></table></div>`;
}

function test(){
 panel.innerHTML=`
 <div class="form-card">
  <div class="eyebrow">CONTROLLED TEST</div>
  <h2>Create Test OTP</h2>
  <p class="muted">Creates controlled test data only.</p>
  <label>Number</label>
  <select id="tn">${S.n.map(n=>`<option value="${n.id}">${esc(n.number)} · ${esc(n.country_name||"-")}</option>`).join("")}</select>
  <label>OTP</label>
  <input id="tc" inputmode="numeric" maxlength="8" placeholder="482731">
  <label>Message</label>
  <input id="tm" placeholder="Controlled test SMS">
  <button class="primary" onclick="makeOTP()">CREATE TEST OTP</button>
  <div id="msg"></div>
 </div>`;
}

async function makeOTP(){
 try{
  await api("/api/admin/otp",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({number_id:Number(tn.value),code:tc.value.trim(),message:tm.value||"Controlled test SMS"})
  });
  msg.innerHTML='<div class="success">✓ Controlled OTP created</div>';
  await load();
 }catch(x){msg.innerHTML=`<div class="error">${esc(x.message)}</div>`}
}

async function logout(){
 await api("/api/admin/logout",{method:"POST"}).catch(()=>{});
 localStorage.removeItem("otp_admin");T="";login();
}

function toggleTheme(){
 document.documentElement.classList.toggle("dark");
 localStorage.admin_theme=document.documentElement.classList.contains("dark")?"dark":"light";
}

const adminCSS=`
*{box-sizing:border-box}
body{margin:0;font-family:Inter,system-ui,-apple-system,sans-serif;background:#f6f8fb;color:#111827}
.admin-shell{display:flex;min-height:100vh}
.sidebar{width:245px;background:#fff;border-right:1px solid #e5e7eb;padding:22px 14px;display:flex;flex-direction:column;position:fixed;inset:0 auto 0 0}
.side-brand{font-weight:900;font-size:19px;padding:10px 12px 30px;letter-spacing:.03em}.side-brand b{color:#2563eb}
.sidebar button{border:0;background:none;text-align:left;padding:13px 14px;border-radius:12px;margin:2px 0;cursor:pointer;font-size:14px;color:#475569}.sidebar button:hover{background:#f1f5f9;color:#111827}
.side-bottom{margin-top:auto}
.admin-main{margin-left:245px;width:calc(100% - 245px);padding:28px 34px}
.topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px}.topbar h1{margin:3px 0 0;font-size:28px}.eyebrow{font-size:11px;letter-spacing:.14em;font-weight:800;color:#64748b}.admin-user{font-size:12px;font-weight:800;color:#16a34a}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.stat{background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:22px;display:flex;gap:15px;align-items:center;box-shadow:0 5px 20px #00000008}.stat>span{font-size:27px}.stat small{display:block;color:#64748b}.stat strong{font-size:28px}
.welcome-panel{margin-top:20px;background:linear-gradient(135deg,#111827,#1e3a8a);color:#fff;border-radius:22px;padding:30px;display:flex;justify-content:space-between;align-items:center;gap:25px}.welcome-panel h2{margin:5px 0;font-size:26px}.welcome-panel p{opacity:.75;max-width:650px}
.quick-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:20px}.quick-grid button{border:1px solid #e5e7eb;background:#fff;border-radius:18px;padding:24px;text-align:left;cursor:pointer;font-size:28px}.quick-grid b,.quick-grid small{display:block}.quick-grid b{font-size:16px;margin-top:12px}.quick-grid small{font-size:12px;color:#64748b;margin-top:5px}
.section-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.section-title h2{margin:4px 0 0}
.primary,.secondary,.small,.back{border:0;border-radius:10px;padding:11px 17px;cursor:pointer;font-weight:700}.primary{background:#2563eb;color:#fff}.primary:disabled{opacity:.45;cursor:not-allowed}.secondary{background:#e2e8f0;color:#0f172a}.small{padding:7px 11px;background:#e2e8f0}.back{background:transparent;padding-left:0}
.table-wrap{overflow:auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px}table{width:100%;border-collapse:collapse;min-width:650px}th,td{text-align:left;padding:14px 16px;border-bottom:1px solid #eef2f7;font-size:13px}th{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em}
.pill{display:inline-block;padding:5px 9px;border-radius:999px;background:#eef2ff;font-size:10px;font-weight:800}.pill.on{background:#dcfce7;color:#166534}.pill.off{background:#fee2e2;color:#991b1b}
.form-card{max-width:850px;background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:28px}.form-card h2{margin:8px 0}.form-card label{display:block;margin:18px 0 7px;font-size:12px;font-weight:800;color:#475569}
input,select,textarea{width:100%;border:1px solid #dbe2ea;border-radius:10px;padding:12px 13px;background:#fff;color:#111827;font:inherit;outline:none}textarea{resize:vertical;line-height:1.6}input:focus,select:focus,textarea:focus{border-color:#2563eb;box-shadow:0 0 0 3px #2563eb15}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.bulk-actions{display:flex;gap:10px;margin-top:16px}.hint,.muted{font-size:12px;color:#64748b;margin-top:8px}.success,.error,.loading{margin-top:14px;padding:11px 13px;border-radius:10px;font-size:13px}.success{background:#dcfce7;color:#166534}.error{background:#fee2e2;color:#991b1b}.loading{background:#eff6ff;color:#1d4ed8}.otp-code{font-size:20px;font-weight:900;letter-spacing:.12em}
.admin-login{min-height:100vh;display:grid;place-items:center;padding:20px;background:radial-gradient(circle at top,#dbeafe,#f8fafc 55%)}.login-card{width:min(430px,100%);background:#fff;border:1px solid #e5e7eb;border-radius:24px;padding:34px;box-shadow:0 25px 70px #00000012;text-align:center}.login-logo{font-size:20px;font-weight:900}.login-logo span{color:#2563eb}.login-icon{font-size:35px;margin:25px 0 5px}.login-card h1{margin:5px}.login-card p{font-size:13px;color:#64748b;margin-bottom:24px}.login-card input{margin-bottom:10px}.wide{width:100%;margin-top:6px}.fatal{padding:50px;text-align:center}
@media(max-width:850px){.sidebar{width:70px}.sidebar span{display:none}.side-brand{font-size:0}.side-brand:after{content:"BNB";font-size:18px}.admin-main{margin-left:70px;width:calc(100% - 70px);padding:20px}.stats{grid-template-columns:1fr 1fr}.quick-grid{grid-template-columns:1fr}.welcome-panel{display:block}.welcome-panel button{margin-top:10px}}
@media(max-width:520px){.admin-main{padding:14px}.stats{gap:9px}.stat{padding:14px}.stat strong{font-size:22px}.form-grid{grid-template-columns:1fr}.topbar h1{font-size:22px}}
`;

if(localStorage.admin_theme==="dark")document.documentElement.classList.add("dark");
T?dash():login();

async function bulkNumbers(){
  const enabledCountries=S.c.filter(c=>Number(c.enabled)===1);

  panel.innerHTML=`
  <div class="card">
    <h2>📱 Bulk Add Numbers</h2>
    <p class="muted">Select a country and add up to 1000 numbers.</p>

    <label>Country</label>
    <select id="bulkCountry">
      ${enabledCountries.map(c=>`
        <option value="${c.id}">
          ${esc(c.flag||"🌍")} ${esc(c.name)} • ${esc(c.dial_code||"")}
        </option>
      `).join("")}
    </select>

    <label>Numbers — one per line</label>
    <textarea id="bulkInput"
      rows="12"
      placeholder="+8801700000001
+8801700000002
+8801700000003"></textarea>

    <div id="bulkCount" class="muted">0 / 1000</div>

    <button class="primary" onclick="saveBulkNumbers()">
      ADD NUMBERS
    </button>

    <p id="bulkMsg"></p>
  </div>`;

  bulkInput.addEventListener("input",()=>{
    const n=bulkInput.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    bulkCount.textContent=`${n.length} / 1000`;

    if(n.length>1000)
      bulkCount.style.color="red";
    else
      bulkCount.style.color="";
  });
}

async function saveBulkNumbers(){
  const country_id=Number(bulkCountry.value);
  const numbers=bulkInput.value
    .split(/\r?\n/)
    .map(x=>x.trim())
    .filter(Boolean);

  if(!country_id){
    bulkMsg.textContent="Select a country.";
    return;
  }

  if(!numbers.length){
    bulkMsg.textContent="Enter at least one number.";
    return;
  }

  if(numbers.length>1000){
    bulkMsg.textContent="Maximum 1000 numbers at once.";
    return;
  }

  try{
    bulkMsg.textContent="Adding numbers...";

    const r=await api("/api/admin/numbers/bulk",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({country_id,numbers})
    });

    bulkMsg.textContent=
      `✅ Added ${r.added} numbers • Skipped ${r.skipped} duplicates • Country total: ${r.country_total}`;

    await load();
  }catch(x){
    bulkMsg.textContent="❌ "+x.message;
  }
}
