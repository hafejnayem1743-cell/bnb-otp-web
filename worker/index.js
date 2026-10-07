const json = (data, status=200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization"
  }
});

const now = () => Math.floor(Date.now()/1000);

function route(path) {
  return path.replace(/\/+/g,"/").replace(/\/$/,"") || "/";
}

async function publicApi(request, env, path) {
  if (path === "/api/countries") {
    const r = await env.DB.prepare(
      `SELECT c.id,c.code,c.name,c.flag,c.dial_code,c.enabled,
              (SELECT COUNT(*) FROM numbers n WHERE n.country_id=c.id) number_count
       FROM countries c
       WHERE c.enabled=1
       ORDER BY c.name`
    ).all();
    return json({countries:r.results||[]});
  }

  if (path === "/api/numbers") {
    const r = await env.DB.prepare(
      `SELECT n.id,n.number,n.status,n.label,n.country_id,
              c.code country_code,c.name country_name,c.flag country_flag,c.dial_code
       FROM numbers n
       INNER JOIN countries c ON c.id=n.country_id AND c.enabled=1
       ORDER BY n.id DESC`
    ).all();
    return json({numbers:r.results||[]});
  }

  const m = path.match(/^\/api\/numbers\/(\d+)$/);
  if (m) {
    const r = await env.DB.prepare(
      `SELECT n.id,n.number,n.status,n.label,n.country_id,
              c.code country_code,c.name country_name,c.flag country_flag,c.dial_code
       FROM numbers n LEFT JOIN countries c ON c.id=n.country_id
       WHERE n.id=?`
    ).bind(Number(m[1])).first();

    if (!r) return json({error:"Number not found"},404);
    return json({number:r});
  }

  const o = path.match(/^\/api\/numbers\/(\d+)\/otps$/);
  if (o) {
    const id = Number(o[1]);
    const r = await env.DB.prepare(
      `SELECT id,number_id,code,source,status,message,created_at,expires_at
       FROM otps WHERE number_id=? ORDER BY created_at DESC LIMIT 100`
    ).bind(id).all();

    return json({otps:r.results||[]});
  }

  if (path === "/health") {
    return json({status:"ok",service:"BNB OTP Web",version:"4.0.0"});
  }

  return null;
}

async function adminLogin(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({error:"Invalid JSON"},400); }

  const username = String(body.username||"").trim();
  const password = String(body.password||"");

  if (!username || !password) return json({error:"Username and password required"},400);

  const user = await env.DB.prepare(
    "SELECT id,username,password_hash,role FROM users WHERE username=?"
  ).bind(username).first();

  if (!user) return json({error:"Invalid credentials"},401);

  // Existing project stores SHA256 password hashes.
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(password)
  );
  const hash = [...new Uint8Array(digest)]
    .map(x=>x.toString(16).padStart(2,"0")).join("");

  if (hash !== user.password_hash) return json({error:"Invalid credentials"},401);

  const token = crypto.randomUUID()+"."+crypto.randomUUID();
  const expires = now()+604800;

  await env.DB.prepare(
    "INSERT INTO web_sessions(token,user_id,expires_at,created_at) VALUES(?,?,?,?)"
  ).bind(token,user.id,expires,now()).run();

  return json({
    token,
    user:{id:user.id,username:user.username,role:user.role}
  });
}

async function adminUser(request, env) {
  const auth = request.headers.get("Authorization")||"";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return json({error:"Authentication required"},401);

  const s = await env.DB.prepare(
    `SELECT u.id,u.username,u.role
     FROM web_sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token=? AND s.expires_at>?`
  ).bind(token,now()).first();

  if (!s) return json({error:"Authentication required"},401);
  return s;
}

async function adminApi(request, env, path) {
  if (path === "/api/admin/login" && request.method === "POST")
    return adminLogin(request,env);

  if (path === "/api/admin/me") {
    const u = await adminUser(request,env);
    if (u instanceof Response) return u;
    return json({user:u});
  }

  if (path === "/api/admin/logout" && request.method === "POST") {
    const auth=request.headers.get("Authorization")||"";
    const token=auth.startsWith("Bearer ")?auth.slice(7):"";
    if(token) await env.DB.prepare("DELETE FROM web_sessions WHERE token=?").bind(token).run();
    return json({ok:true});
  }

  if (!path.startsWith("/api/admin/")) return null;

  const u = await adminUser(request,env);
  if (u instanceof Response) return u;

  if (path === "/api/admin/stats") {
    const [c,n,o] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) total FROM countries WHERE enabled=1").first(),
      env.DB.prepare("SELECT COUNT(*) total FROM numbers").first(),
      env.DB.prepare("SELECT COUNT(*) total FROM otps").first()
    ]);
    return json({countries:c?.total||0,numbers:n?.total||0,otps:o?.total||0});
  }

  if (path === "/api/admin/countries") {
    const r=await env.DB.prepare(
      "SELECT * FROM countries ORDER BY name"
    ).all();
    return json({countries:r.results||[]});
  }

  if (path === "/api/admin/numbers") {
    const r=await env.DB.prepare(
      `SELECT n.*,c.name country_name,c.flag country_flag
       FROM numbers n LEFT JOIN countries c ON c.id=n.country_id
       ORDER BY n.id DESC`
    ).all();
    return json({numbers:r.results||[]});
  }

  if (path === "/api/admin/otps") {
    const r=await env.DB.prepare(
      `SELECT o.*,n.number
       FROM otps o JOIN numbers n ON n.id=o.number_id
       ORDER BY o.created_at DESC LIMIT 200`
    ).all();
    return json({otps:r.results||[]});
  }

  if (path === "/api/admin/countries/toggle" && request.method==="POST") {
    const b=await request.json();
    const id=Number(b.id||0);

    if(!id) return json({error:"Country id required"},400);

    const current=await env.DB.prepare(
      "SELECT id,enabled FROM countries WHERE id=?"
    ).bind(id).first();

    if(!current) return json({error:"Country not found"},404);

    const enabled =
      b.enabled===undefined
        ? (current.enabled ? 0 : 1)
        : (Number(b.enabled)?1:0);

    await env.DB.prepare(
      "UPDATE countries SET enabled=?,updated_at=? WHERE id=?"
    ).bind(enabled,now(),id).run();

    return json({ok:true,id,enabled});
  }

  if (path === "/api/admin/countries/save" && request.method==="POST") {
    const b=await request.json();
    const id=Number(b.id||0);

    if(id) {
      await env.DB.prepare(
        `UPDATE countries SET code=?,name=?,flag=?,dial_code=?,enabled=?,updated_at=? WHERE id=?`
      ).bind(
        String(b.code||""),
        String(b.name||""),
        String(b.flag||""),
        String(b.dial_code||""),
        Number(b.enabled??1)?1:0,
        now(),id
      ).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO countries(code,name,flag,dial_code,enabled,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?)`
      ).bind(
        String(b.code||""),
        String(b.name||""),
        String(b.flag||""),
        String(b.dial_code||""),
        Number(b.enabled??1)?1:0,
        now(),now()
      ).run();
    }
    return json({ok:true});
  }

  if (path === "/api/admin/numbers/save" && request.method==="POST") {
    const b=await request.json();
    const id=Number(b.id||0);

    if(id) {
      await env.DB.prepare(
        `UPDATE numbers SET number=?,status=?,label=?,country_id=?,updated_at=? WHERE id=?`
      ).bind(
        String(b.number||""),
        String(b.status||"waiting"),
        String(b.label||""),
        b.country_id?Number(b.country_id):null,
        now(),id
      ).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO numbers(number,status,label,created_at,updated_at,country_id)
         VALUES(?,?,?,?,?,?)`
      ).bind(
        String(b.number||""),
        String(b.status||"waiting"),
        String(b.label||""),
        now(),now(),
        b.country_id?Number(b.country_id):null
      ).run();
    }
    return json({ok:true});
  }

  if (path === "/api/admin/numbers/bulk" && request.method==="POST") {
    const d=await request.json();
    const country_id=Number(d.country_id||0);
    const numbers=Array.isArray(d.numbers)?d.numbers.map(x=>String(x).trim()).filter(Boolean):[];

    if(!country_id) return json({error:"Country is required"},400);
    if(!numbers.length) return json({error:"No numbers supplied"},400);
    if(numbers.length>1000) return json({error:"Maximum 1000 numbers per batch"},400);

    const country=await env.DB.prepare(
      "SELECT id,name FROM countries WHERE id=? AND enabled=1"
    ).bind(country_id).first();

    if(!country) return json({error:"Country not found or disabled"},404);

    const clean=[...new Set(numbers)];
    let added=0, skipped=0;
    const t=Math.floor(Date.now()/1000);

    for(const number of clean){
      try{
        const exists=await env.DB.prepare(
          "SELECT id FROM numbers WHERE number=?"
        ).bind(number).first();

        if(exists){
          skipped++;
          continue;
        }

        await env.DB.prepare(
          "INSERT INTO numbers(number,status,label,created_at,updated_at,country_id) VALUES(?,?,?,?,?,?)"
        ).bind(number,"waiting","",""+t,t,country_id).run();

        added++;
      }catch(e){
        skipped++;
      }
    }

    return json({
      ok:true,
      country_id,
      country_name:country.name,
      requested:numbers.length,
      unique:clean.length,
      added,
      skipped
    });
  }

  if (path === "/api/admin/otp" && request.method==="POST") {
    const b=await request.json();
    const numberId=Number(b.number_id);
    const code=String(b.code||"").trim();

    if(!numberId || !/^\d{4,8}$/.test(code))
      return json({error:"Valid number_id and 4-8 digit test OTP required"},400);

    const n=await env.DB.prepare(
      "SELECT id FROM numbers WHERE id=?"
    ).bind(numberId).first();

    if(!n) return json({error:"Number not found"},404);

    await env.DB.prepare(
      `INSERT INTO otps(number_id,code,source,status,message,created_at,expires_at)
       VALUES(?,?,?,?,?,?,?)`
    ).bind(
      numberId,code,"CONTROLLED_TEST","received",
      String(b.message||"BNB controlled test OTP"),
      now(),now()+600
    ).run();

    await env.DB.prepare(
      "UPDATE numbers SET status='received',updated_at=? WHERE id=?"
    ).bind(now(),numberId).run();

    return json({ok:true});
  }

  return json({error:"Admin route not found"},404);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS")
      return new Response(null,{headers:{
        "access-control-allow-origin":"*",
        "access-control-allow-methods":"GET,POST,OPTIONS",
        "access-control-allow-headers":"Content-Type, Authorization"
      }});

    const url=new URL(request.url);
    const path=route(url.pathname);

    try {
      let r=await publicApi(request,env,path);
      if(r) return r;

      r=await adminApi(request,env,path);
      if(r) return r;

      if(env.ASSETS) return env.ASSETS.fetch(request);

      return new Response("Not Found",{status:404});
    } catch(e) {
      return json({error:"Server error",detail:String(e?.message||e)},500);
    }
  }
};
