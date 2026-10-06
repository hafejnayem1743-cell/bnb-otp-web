#!/usr/bin/env python3
import os,re,json,time,sqlite3,secrets,hashlib
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlparse,parse_qs

ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"../.."))
DB=os.path.join(ROOT,"data","panel.db")
PORT=8080

def db():
    c=sqlite3.connect(DB); c.row_factory=sqlite3.Row; return c
def now(): return int(time.time())
def js(x): return json.dumps(x,ensure_ascii=False).encode()
def token(): return secrets.token_urlsafe(32)

def init():
    c=db()
    c.execute("""CREATE TABLE IF NOT EXISTS web_sessions(
      token TEXT PRIMARY KEY,user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL)""")
    c.execute("DROP TABLE IF EXISTS bot_claims")
    c.execute("DROP TABLE IF EXISTS bot_users")
    c.commit(); c.close()

def user(tok):
    if not tok:return None
    c=db()
    r=c.execute("""SELECT u.* FROM web_sessions s JOIN users u ON u.id=s.user_id
                   WHERE s.token=? AND s.expires_at>?""",(tok,now())).fetchone()
    c.close(); return dict(r) if r else None

def password_ok(p,h):
    if not h:return False
    if len(h)==64 and re.fullmatch(r"[0-9a-fA-F]{64}",h):
        return secrets.compare_digest(hashlib.sha256(p.encode()).hexdigest(),h)
    if h.startswith("pbkdf2$"):
        try:
            _,it,s,d=h.split("$",3)
            x=hashlib.pbkdf2_hmac("sha256",p.encode(),bytes.fromhex(s),int(it)).hex()
            return secrets.compare_digest(x,d)
        except: return False
    return False

class H(BaseHTTPRequestHandler):
    protocol_version="HTTP/1.1"
    def log_message(self,f,*a): print("[WEB]",f%a)
    def send(self,n,x):
        b=js(x); self.send_response(n)
        self.send_header("Content-Type","application/json; charset=utf-8")
        self.send_header("Content-Length",str(len(b)))
        self.send_header("Access-Control-Allow-Origin","*")
        self.send_header("Cache-Control","no-store"); self.end_headers(); self.wfile.write(b)
    def body(self):
        try:return json.loads(self.rfile.read(int(self.headers.get("Content-Length",0))) or b"{}")
        except:return {}
    def tok(self):
        x=self.headers.get("Authorization",""); return x[7:] if x.startswith("Bearer ") else ""
    def admin(self):
        u=user(self.tok()); return u if u and u.get("role") in ("admin","owner","superadmin") else None
    def do_OPTIONS(self):
        self.send_response(204); self.send_header("Access-Control-Allow-Origin","*")
        self.send_header("Access-Control-Allow-Headers","Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods","GET,POST,OPTIONS"); self.end_headers()

    def do_GET(self):
        p=urlparse(self.path); path=p.path; q=parse_qs(p.query)
        if path=="/health": return self.send(200,{"status":"ok","service":"BNB OTP Web","version":"3.0.0"})
        c=db()
        if path=="/api/countries":
            r=c.execute("SELECT id,code,name,flag,dial_code,enabled FROM countries WHERE enabled=1 ORDER BY name").fetchall()
            c.close(); return self.send(200,{"countries":[dict(x) for x in r]})
        if path=="/api/numbers":
            cid=q.get("country_id",[None])[0]
            r=c.execute("SELECT id,number,status,label,country_id FROM numbers"+(" WHERE country_id=?" if cid else "")+" ORDER BY id DESC",((cid,) if cid else ())).fetchall()
            c.close(); return self.send(200,{"numbers":[dict(x) for x in r]})
        m=re.fullmatch(r"/api/numbers/(\d+)",path)
        if m:
            r=c.execute("""SELECT n.*,c.name country_name,c.flag country_flag,c.code country_code
                           FROM numbers n LEFT JOIN countries c ON c.id=n.country_id WHERE n.id=?""",(int(m.group(1)),)).fetchone()
            c.close(); return self.send(200,{"number":dict(r)}) if r else self.send(404,{"error":"Number not found"})
        m=re.fullmatch(r"/api/numbers/(\d+)/otps",path)
        if m:
            r=c.execute("SELECT id,number_id,code,source,status,created_at,expires_at FROM otps WHERE number_id=? ORDER BY created_at DESC LIMIT 50",(int(m.group(1)),)).fetchall()
            c.close(); return self.send(200,{"otps":[dict(x) for x in r]})
        if path=="/api/admin/me":
            u=self.admin(); return self.send(200,{"user":u}) if u else self.send(401,{"error":"Authentication required"})
        if not self.admin() and path.startswith("/api/admin/"):
            return self.send(401,{"error":"Authentication required"})
        if path=="/api/admin/stats":
            out={}
            for k,t in [("countries","countries"),("numbers","numbers"),("otps","otps"),("users","users")]:
                try: out[k]=c.execute("SELECT COUNT(*) FROM "+t).fetchone()[0]
                except: out[k]=0
            c.close(); return self.send(200,out)
        if path=="/api/admin/countries":
            r=c.execute("SELECT * FROM countries ORDER BY name").fetchall(); c.close()
            return self.send(200,{"countries":[dict(x) for x in r]})
        if path=="/api/admin/numbers":
            r=c.execute("""SELECT n.*,c.name country_name,c.flag country_flag
                           FROM numbers n LEFT JOIN countries c ON c.id=n.country_id ORDER BY n.id DESC""").fetchall()
            c.close(); return self.send(200,{"numbers":[dict(x) for x in r]})
        if path=="/api/admin/otps":
            r=c.execute("""SELECT o.*,n.number,c.name country_name FROM otps o
                           LEFT JOIN numbers n ON n.id=o.number_id
                           LEFT JOIN countries c ON c.id=n.country_id
                           ORDER BY o.created_at DESC LIMIT 200""").fetchall()
            c.close(); return self.send(200,{"otps":[dict(x) for x in r]})
        c.close(); return self.send(404,{"error":"Not found"})

    def do_POST(self):
        path=urlparse(self.path).path; d=self.body()
        if path=="/api/admin/login":
            c=db(); r=c.execute("SELECT * FROM users WHERE username=? LIMIT 1",(str(d.get("username","")).strip(),)).fetchone()
            if not r or r["role"] not in ("admin","owner","superadmin") or not password_ok(str(d.get("password","")),r["password_hash"]):
                c.close(); return self.send(401,{"error":"Invalid admin credentials"})
            t=token(); c.execute("INSERT INTO web_sessions VALUES(?,?,?,?)",(t,r["id"],now(),now()+604800)); c.commit(); c.close()
            return self.send(200,{"token":t,"user":{"id":r["id"],"username":r["username"],"role":r["role"]}})
        if path=="/api/admin/logout":
            c=db(); c.execute("DELETE FROM web_sessions WHERE token=?",(self.tok(),)); c.commit(); c.close()
            return self.send(200,{"ok":True})
        if not self.admin(): return self.send(401,{"error":"Authentication required"})
        c=db()
        if path=="/api/admin/countries/save":
            t=now(); cid=d.get("id")
            try:
                if cid:c.execute("UPDATE countries SET code=?,name=?,flag=?,dial_code=?,enabled=?,updated_at=? WHERE id=?",(d["code"].upper(),d["name"],d.get("flag","🌍"),d["dial_code"],1 if d.get("enabled",1) else 0,t,int(cid)))
                else:c.execute("INSERT INTO countries(code,name,flag,dial_code,enabled,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",(d["code"].upper(),d["name"],d.get("flag","🌍"),d["dial_code"],1,t,t))
                c.commit(); c.close(); return self.send(200,{"ok":True})
            except Exception as e:c.close(); return self.send(409,{"error":str(e)})
        if path=="/api/admin/countries/toggle":
            c.execute("UPDATE countries SET enabled=CASE enabled WHEN 1 THEN 0 ELSE 1 END,updated_at=? WHERE id=?",(now(),int(d["id"])))
            c.commit(); c.close(); return self.send(200,{"ok":True})
        if path=="/api/admin/numbers/save":
            try:
                if d.get("id"):c.execute("UPDATE numbers SET number=?,label=?,status=?,country_id=?,updated_at=? WHERE id=?",(d["number"],d.get("label",""),d.get("status","waiting"),d.get("country_id"),now(),int(d["id"])))
                else:c.execute("INSERT INTO numbers(number,status,label,created_at,updated_at,country_id) VALUES(?,?,?,?,?,?)",(d["number"],d.get("status","waiting"),d.get("label",""),now(),now(),d.get("country_id")))
                c.commit(); c.close(); return self.send(200,{"ok":True})
            except Exception as e:c.close(); return self.send(409,{"error":str(e)})
        if path=="/api/admin/otp":
            code=str(d.get("code",""))
            if not re.fullmatch(r"\d{4,8}",code):c.close(); return self.send(400,{"error":"OTP must be 4-8 digits"})
            nid=int(d.get("number_id",0)); t=now()
            if not c.execute("SELECT id FROM numbers WHERE id=?",(nid,)).fetchone():c.close(); return self.send(404,{"error":"Number not found"})
            c.execute("INSERT INTO otps(number_id,code,source,status,created_at,expires_at) VALUES(?,?,?,?,?,?)",(nid,code,"CONTROLLED_TEST:"+str(d.get("message","Test SMS")),"received",t,t+600))
            c.execute("UPDATE numbers SET status='received',updated_at=? WHERE id=?",(t,nid)); c.commit(); c.close()
            return self.send(200,{"ok":True})
        c.close(); return self.send(404,{"error":"Not found"})

init(); print("BNB OTP WEB v3.0 | DB PRESERVED | WEB ONLY")
ThreadingHTTPServer(("127.0.0.1",PORT),H).serve_forever()
