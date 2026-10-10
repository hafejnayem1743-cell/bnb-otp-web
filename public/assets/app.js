const API="http://127.0.0.1:8080",A=document.getElementById("app");let countries=[],cid;
const esc=x=>String(x??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
async function api(p){
 const token=localStorage.getItem("otp_admin")||"";
 const headers=token?{Authorization:"Bearer "+token}:{};
 const r=await fetch(API+p,{cache:"no-store",headers});
 const j=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(j.error||("HTTP "+r.status));
 return j
}
function home(){A.innerHTML='<section class="hero"><b>📱</b><h1>BNB OTP</h1><p>Fast • Free • Simple</p><p>Browse public test numbers and view controlled SMS verification events.</p><button class="primary" onclick="countriesPage()">🚀 GET STARTED</button></section>'}
async function countriesPage(){let j=await api("/api/countries");countries=j.countries;A.innerHTML='<div class="wrap"><div class="title"><h2>🌍 Select a Country</h2><button onclick="countriesPage()">🔄 Refresh</button></div><input class="search" id="q" placeholder="Search country"><div id="list" class="grid"></div></div>';draw();q.oninput=draw}
function draw(){let qv=(q.value||"").toLowerCase();list.innerHTML=countries.filter(c=>(c.name+c.code+c.dial_code).toLowerCase().includes(qv)).map(c=>`<button class="card" onclick="numbersPage(${c.id})"><div class="flag">${esc(c.flag)}</div><b>${esc(c.name)}</b><div class="muted">${esc(c.dial_code)}</div></button>`).join("")||'<div class="empty">No countries found</div>'}
async function numbersPage(id){cid=id;let c=countries.find(x=>x.id==id),j=await api("/api/numbers?country_id="+id);A.innerHTML=`<div class="wrap"><button onclick="countriesPage()">← Countries</button><div class="title"><h2>${esc(c.flag)} ${esc(c.name)}</h2><button onclick="numbersPage(${id})">🔄</button></div><div class="grid">${j.numbers.map(n=>`<div class="card"><span class="badge">${n.status==="received"?"🟢 SMS RECEIVED":"🟡 AVAILABLE"}</span><div class="number">${esc(n.number)}</div><div class="actions"><button class="primary" onclick="inbox(${n.id})">OPEN</button><button onclick="navigator.clipboard.writeText('${esc(n.number)}')">📋</button></div></div>`).join("")||'<div class="empty">No numbers available.</div>'}</div>`}
async function inbox(id){let n=(await api("/api/numbers/"+id)).number,o=(await api("/api/numbers/"+id+"/otps")).otps;A.innerHTML=`<div class="wrap"><button onclick="numbersPage(${cid})">← Back</button><div class="title"><h2>📱 ${esc(n.number)}</h2><span class="badge">${n.status==="received"?"🟢 SMS RECEIVED":"🟡 Waiting"}</span></div><div class="actions"><button onclick="navigator.clipboard.writeText('${esc(n.number)}')">📋 Copy Number</button><button onclick="inbox(${id})">🔄 Refresh</button></div><h3>INBOX</h3>${o.length?o.map(x=>`<div class="sms"><b>🟢 SMS RECEIVED</b><div class="otp">${esc(x.code)}</div><button class="primary" onclick="navigator.clipboard.writeText('${esc(x.code)}')">📋 COPY OTP</button><p class="muted">${esc(x.source||"Controlled test SMS")}</p></div>`).join(""):'<div class="empty">📭 No messages yet.<br>Waiting for a controlled test SMS...</div>'}</div>`}
home();
