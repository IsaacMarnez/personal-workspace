interface Env {
  DB: D1Database;
  FILES: KVNamespace;
  APP_PASSWORD: string;
  SESSION_SECRET: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
}

type AnyRecord = Record<string, any>;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
}
function id() { return crypto.randomUUID(); }
function isoNow() { return new Date().toISOString(); }
function cookieValue(request: Request, name: string) { const raw=request.headers.get('Cookie')||''; for(const part of raw.split(';')){const [k,...rest]=part.trim().split('=');if(k===name)return rest.join('=')} return null; }
function toBase64Url(bytes: Uint8Array) { let s=''; for(const b of bytes)s+=String.fromCharCode(b); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function encodeText(s:string){return toBase64Url(new TextEncoder().encode(s));}
function decodeBase64Url(s:string){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const bin=atob(s);return new TextDecoder().decode(Uint8Array.from(bin,c=>c.charCodeAt(0)));}
async function hmac(secret:string,message:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message))));}
async function makeSession(secret:string){const payload=encodeText(JSON.stringify({exp:Date.now()+30*24*60*60*1000}));return `${payload}.${await hmac(secret,payload)}`;}
async function validSession(token:string|null,secret:string){if(!token)return false;const [payload,sig]=token.split('.');if(!payload||!sig)return false;const expected=await hmac(secret,payload);if(expected!==sig)return false;try{return JSON.parse(decodeBase64Url(payload)).exp>Date.now()}catch{return false}}
async function sha256(s:string){return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));}
async function sameSecret(a:string,b:string){const [aa,bb]=await Promise.all([sha256(a),sha256(b)]);if(aa.length!==bb.length)return false;let x=0;for(let i=0;i<aa.length;i++)x|=aa[i]^bb[i];return x===0;}
async function body<T=AnyRecord>(request:Request):Promise<T>{return request.json() as Promise<T>}
async function log(env:Env,type:string,message:string,entityType?:string,entityId?:string,metadata?:unknown){await env.DB.prepare('INSERT INTO activity_log (id,type,entity_type,entity_id,message,metadata,created_at) VALUES (?,?,?,?,?,?,?)').bind(id(),type,entityType||null,entityId||null,message,metadata?JSON.stringify(metadata):null,isoNow()).run();}

async function handleApi(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url), path=url.pathname;
  if(path==='/api/auth/login'&&request.method==='POST'){
    if(!env.APP_PASSWORD||!env.SESSION_SECRET)return json({error:'Faltan APP_PASSWORD o SESSION_SECRET en Cloudflare.'},500);
    const data=await body<{password?:string}>(request); if(!data.password||!(await sameSecret(data.password,env.APP_PASSWORD)))return json({error:'Contraseña incorrecta.'},401);
    const session=await makeSession(env.SESSION_SECRET); const secure=new URL(request.url).protocol==='https:'?'; Secure':''; return json({ok:true},200,{'Set-Cookie':`pw_session=${session}; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=2592000`});
  }
  if(path==='/api/auth/logout'&&request.method==='POST'){const secure=new URL(request.url).protocol==='https:'?'; Secure':'';return json({ok:true},200,{'Set-Cookie':`pw_session=; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=0`});}
  const authenticated=await validSession(cookieValue(request,'pw_session'),env.SESSION_SECRET||'');
  if(path==='/api/auth/me')return json({authenticated});
  if(!authenticated)return json({error:'401: sesión no válida.'},401);

  if(path==='/api/dashboard'&&request.method==='GET'){
    const today=new Date().toISOString().slice(0,10); const weekAgo=new Date(Date.now()-7*86400000).toISOString();
    const [todayR,pending,inProgress,overdue,completed,projects,focus]=await Promise.all([
      env.DB.prepare("SELECT COUNT(*) c FROM tasks WHERE due_date=? AND status!='done'").bind(today).first<{c:number}>(),
      env.DB.prepare("SELECT COUNT(*) c FROM tasks WHERE status!='done'").first<{c:number}>(),
      env.DB.prepare("SELECT COUNT(*) c FROM tasks WHERE status='in_progress'").first<{c:number}>(),
      env.DB.prepare("SELECT COUNT(*) c FROM tasks WHERE due_date<? AND status!='done'").bind(today).first<{c:number}>(),
      env.DB.prepare("SELECT COUNT(*) c FROM tasks WHERE status='done' AND completed_at>=?").bind(weekAgo).first<{c:number}>(),
      env.DB.prepare("SELECT COUNT(*) c FROM projects WHERE status='active'").first<{c:number}>(),
      env.DB.prepare("SELECT COALESCE(SUM(duration_seconds),0) c FROM focus_sessions WHERE started_at>=?").bind(`${today}T00:00:00.000Z`).first<{c:number}>()
    ]);
    return json({today:todayR?.c||0,pending:pending?.c||0,inProgress:inProgress?.c||0,overdue:overdue?.c||0,completedWeek:completed?.c||0,activeProjects:projects?.c||0,focusSecondsToday:focus?.c||0});
  }

  if(path==='/api/tasks'&&request.method==='GET'){
    const r=await env.DB.prepare('SELECT t.*, p.name project_name FROM tasks t LEFT JOIN projects p ON p.id=t.project_id ORDER BY CASE t.priority WHEN \'high\' THEN 0 WHEN \'medium\' THEN 1 ELSE 2 END, COALESCE(t.due_date,\'9999-12-31\'), t.created_at DESC').all(); return json(r.results);
  }
  if(path==='/api/tasks'&&request.method==='POST'){
    const d=await body<AnyRecord>(request), taskId=id(), now=isoNow(); if(!String(d.title||'').trim())return json({error:'El título es obligatorio.'},400);
    await env.DB.prepare('INSERT INTO tasks (id,title,description,status,priority,due_date,project_id,estimated_minutes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(taskId,String(d.title).trim(),d.description||null,d.status||'inbox',d.priority||'medium',d.due_date||null,d.project_id||null,d.estimated_minutes||null,now,now).run();
    await log(env,'task_created',`Creaste la tarea “${String(d.title).trim()}”.`,'task',taskId); const row=await env.DB.prepare('SELECT t.*,p.name project_name FROM tasks t LEFT JOIN projects p ON p.id=t.project_id WHERE t.id=?').bind(taskId).first(); return json(row,201);
  }
  const taskMatch=path.match(/^\/api\/tasks\/([^/]+)$/);
  if(taskMatch&&request.method==='PATCH'){
    const taskId=taskMatch[1], current=await env.DB.prepare('SELECT * FROM tasks WHERE id=?').bind(taskId).first<AnyRecord>(); if(!current)return json({error:'Tarea no encontrada.'},404); const d=await body<AnyRecord>(request), now=isoNow();
    const next={title:d.title??current.title,description:d.description!==undefined?d.description:current.description,status:d.status??current.status,priority:d.priority??current.priority,due_date:d.due_date!==undefined?d.due_date:current.due_date,project_id:d.project_id!==undefined?d.project_id:current.project_id,estimated_minutes:d.estimated_minutes!==undefined?d.estimated_minutes:current.estimated_minutes}; const completed=next.status==='done'?(current.completed_at||now):null;
    await env.DB.prepare('UPDATE tasks SET title=?,description=?,status=?,priority=?,due_date=?,project_id=?,estimated_minutes=?,completed_at=?,updated_at=? WHERE id=?').bind(next.title,next.description,next.status,next.priority,next.due_date,next.project_id,next.estimated_minutes,completed,now,taskId).run();
    if(current.status!==next.status)await log(env,'task_status',`Moviste “${String(next.title)}” a ${String(next.status)}.`,'task',taskId,{from:current.status,to:next.status}); else await log(env,'task_updated',`Actualizaste “${String(next.title)}”.`,'task',taskId);
    return json(await env.DB.prepare('SELECT t.*,p.name project_name FROM tasks t LEFT JOIN projects p ON p.id=t.project_id WHERE t.id=?').bind(taskId).first());
  }
  if(taskMatch&&request.method==='DELETE'){
    const row=await env.DB.prepare('SELECT title FROM tasks WHERE id=?').bind(taskMatch[1]).first<{title:string}>(); await env.DB.prepare('DELETE FROM tasks WHERE id=?').bind(taskMatch[1]).run(); if(row)await log(env,'task_deleted',`Eliminaste la tarea “${row.title}”.`,'task',taskMatch[1]); return json({ok:true});
  }

  if(path==='/api/projects'&&request.method==='GET'){const r=await env.DB.prepare('SELECT * FROM projects ORDER BY status, updated_at DESC').all();return json(r.results)}
  if(path==='/api/projects'&&request.method==='POST'){
    const d=await body<AnyRecord>(request), projectId=id(), now=isoNow(); if(!String(d.name||'').trim())return json({error:'El nombre es obligatorio.'},400); await env.DB.prepare('INSERT INTO projects (id,name,description,status,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(projectId,String(d.name).trim(),d.description||null,d.status||'active',now,now).run(); await log(env,'project_created',`Creaste el proyecto “${String(d.name).trim()}”.`,'project',projectId); return json(await env.DB.prepare('SELECT * FROM projects WHERE id=?').bind(projectId).first(),201);
  }

  if(path==='/api/activity'&&request.method==='GET'){const r=await env.DB.prepare('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 100').all();return json(r.results)}
  if(path==='/api/attachments'&&request.method==='GET'){const r=await env.DB.prepare('SELECT id,task_id,project_id,name,mime_type,size_bytes,created_at FROM attachments ORDER BY created_at DESC').all();return json(r.results)}
  if(path==='/api/attachments'&&request.method==='POST'){
    const form=await request.formData(), item=form.get('file'); if(!(item instanceof File))return json({error:'Selecciona un archivo.'},400); if(item.size>MAX_FILE_SIZE)return json({error:'El archivo supera el límite de 20 MB.'},413); const attachmentId=id(), key=`file:${attachmentId}`; const taskId=String(form.get('taskId')||'')||null,projectId=String(form.get('projectId')||'')||null;
    await env.FILES.put(key,await item.arrayBuffer(),{metadata:{name:item.name,type:item.type,size:item.size}}); await env.DB.prepare('INSERT INTO attachments (id,task_id,project_id,kv_key,name,mime_type,size_bytes,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(attachmentId,taskId,projectId,key,item.name,item.type||'application/octet-stream',item.size,isoNow()).run(); await log(env,'file_uploaded',`Subiste el archivo “${item.name}”.`,'attachment',attachmentId,{size:item.size}); return json(await env.DB.prepare('SELECT id,task_id,project_id,name,mime_type,size_bytes,created_at FROM attachments WHERE id=?').bind(attachmentId).first(),201);
  }
  const attachmentMatch=path.match(/^\/api\/attachments\/([^/]+)$/);
  if(attachmentMatch&&request.method==='DELETE'){
    const row=await env.DB.prepare('SELECT * FROM attachments WHERE id=?').bind(attachmentMatch[1]).first<{kv_key:string;name:string}>(); if(!row)return json({error:'Archivo no encontrado.'},404); await env.FILES.delete(row.kv_key); await env.DB.prepare('DELETE FROM attachments WHERE id=?').bind(attachmentMatch[1]).run(); await log(env,'file_deleted',`Eliminaste el archivo “${row.name}”.`,'attachment',attachmentMatch[1]); return json({ok:true});
  }
  const fileMatch=path.match(/^\/api\/files\/([^/]+)$/);
  if(fileMatch&&request.method==='GET'){
    const row=await env.DB.prepare('SELECT * FROM attachments WHERE id=?').bind(fileMatch[1]).first<{kv_key:string;name:string;mime_type:string}>(); if(!row)return json({error:'Archivo no encontrado.'},404); const value=await env.FILES.get(row.kv_key,'arrayBuffer'); if(!value)return json({error:'El archivo ya no existe en almacenamiento.'},404); return new Response(value,{headers:{'Content-Type':row.mime_type,'Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(row.name)}`,'Cache-Control':'private, max-age=300'}});
  }

  if(path==='/api/focus/start'&&request.method==='POST'){
    const d=await body<{taskId?:string}>(request), sessionId=id(), started=isoNow(); await env.DB.prepare('INSERT INTO focus_sessions (id,task_id,started_at) VALUES (?,?,?)').bind(sessionId,d.taskId||null,started).run(); await log(env,'focus_started','Iniciaste una sesión de enfoque.','focus',sessionId,{taskId:d.taskId||null}); return json({id:sessionId,started_at:started},201);
  }
  if(path==='/api/focus/stop'&&request.method==='POST'){
    const d=await body<{id?:string}>(request); if(!d.id)return json({error:'Falta la sesión.'},400); const row=await env.DB.prepare('SELECT * FROM focus_sessions WHERE id=?').bind(d.id).first<{started_at:string;ended_at:string|null}>(); if(!row)return json({error:'Sesión no encontrada.'},404); const ended=isoNow(),seconds=Math.max(1,Math.floor((new Date(ended).getTime()-new Date(row.started_at).getTime())/1000)); await env.DB.prepare('UPDATE focus_sessions SET ended_at=?,duration_seconds=? WHERE id=?').bind(ended,seconds,d.id).run(); await log(env,'focus_stopped',`Terminaste una sesión de enfoque de ${Math.round(seconds/60)} min.`,'focus',d.id,{duration_seconds:seconds}); return json({duration_seconds:seconds});
  }

  if(path==='/api/ai/ask'&&request.method==='POST'){
    if(!env.GEMINI_API_KEY)return json({error:'Gemini todavía no está configurado. Agrega el secreto GEMINI_API_KEY.'},503);
    const d=await body<{prompt?:string}>(request); if(!d.prompt?.trim())return json({error:'Escribe una instrucción.'},400);
    const model=env.GEMINI_MODEL||'gemini-3.8-flash';
    const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},
      body:JSON.stringify({
        model,
        system_instruction:'Eres un asistente de productividad dentro de una aplicación personal. Responde en español, de forma práctica, breve y accionable. No inventes datos del usuario.',
        input:d.prompt.trim()
      })
    });
    if(!response.ok){const err=await response.text();return json({error:`Gemini respondió ${response.status}: ${err.slice(0,220)}`},502)}
    const data=await response.json() as any;
    const text=(data?.steps||[]).filter((step:any)=>step?.type==='model_output').flatMap((step:any)=>step?.content||[]).filter((part:any)=>part?.type==='text').map((part:any)=>part?.text||'').join('\n').trim()||'Gemini no devolvió texto.';
    return json({text});
  }

  return json({error:'Ruta API no encontrada.'},404);
}

export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const url=new URL(request.url); if(url.pathname.startsWith('/api/')){try{return await handleApi(request,env)}catch(error){console.error(error);return json({error:error instanceof Error?error.message:'Error interno.'},500)}} return new Response('Not found',{status:404});
  }
} satisfies ExportedHandler<Env>;
