{
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dayKey=iso=>{const d=new Date(iso);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const dayLabel=k=>{const[y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit'})};
const hm=iso=>new Date(iso).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
const when=iso=>new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const TEAMS={'Ninjas in Pyjamas':['NIP','#c8a200'],'Liquid':['TL','#0b2a4a'],'HEROIC':['HRC','#e2631c'],'M80':['M80','#141414'],'Eternal Fire':['EF','#d01f2e'],'100 Thieves':['100T','#d11f2a'],'PARIVISION':['PARI','#6b2fd1'],'FaZe':['FaZe','#d6202b'],'Wildcard':['WC','#1f9a7a'],'Lynn Vision':['LVG','#2b5fb3'],'Imperial':['IMP','#a8862c'],'FlyQuest':['FLY','#1e7a3e'],'9z':['9z','#1b1b1b'],'DENDELE':['DEN','#2f8ac6'],'BC.Game':['GOSH','#2fa65a'],'Chinggis Warriors':['CW','#b51e2b'],'Spirit':['SPR','#3a3a3a'],'Vitality':['VIT','#e2b500'],'FURIA':['FUR','#1c1c1c'],'MOUZ':['MOUZ','#d9233b'],'Aurora':['AUR','#4a2a8c'],'Falcons':['FAL','#0e8a52'],'Legacy':['LGC','#2462c9'],'BetBoom':['BB','#c41e2a'],'FUT':['FUT','#e2312a'],'NAVI':['NAVI','#d6b300'],'1win':['1W','#2a5bd7'],'MIBR':['MIBR','#1d1d1d'],'Nemiga':['NEM','#2a2a2a'],'G2':['G2','#6b6b6b'],'Astralis':['AST','#d4272e'],'The MongolZ':['MGZ','#c8102e']};
/* ===== LOGOS DOS TIMES =====
   As logos são enviadas pela aba Admin e ficam no Supabase Storage (bucket "logos").
   O documento league/logos guarda quais times têm logo e a versão de cada uma. */
let LOGOS={};
const slugOf=n=>String(n||'').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g,'');
const logoUrl=s=>LOGOS[s]&&window.redondoLogoUrl?window.redondoLogoUrl(s,LOGOS[s]):'';
const tag=n=>{const t=TEAMS[n]||[String(n||'?').replace(/[^A-Za-z0-9]/g,'').slice(0,4).toUpperCase(),'#5a2a2c'];const u=logoUrl(slugOf(n));
  return '<span class="crest'+(u?' has-logo':'')+'">'+(u?'<img class="tlogo" src="'+esc(u)+'" alt="">':'')+'<span class="badge" style="background:'+t[1]+'">'+esc(t[0])+'</span></span>'};
document.addEventListener('error',e=>{if(e.target.classList?.contains('tlogo')){e.target.parentNode.classList.remove('has-logo');e.target.remove()}},true);
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),2600)};

let db=null,user=null,me=null,isOwner=false,canWrite=false;
let cfg=null,matches=[],bets=[],profiles={},loaded=false;
let editId=null,local=null,saving=false,again=false,timer=null;

const LOCK_MS=15*60*1000;const lockAt=m=>Date.parse(m.start)-LOCK_MS;const locked=m=>!m.start||Date.now()>=lockAt(m);let drafts={};
const scoreOpts=bo=>bo==3?['2-0','2-1']:bo==5?['3-0','3-1','3-2']:[];
function betPts(m,p){if(!m.winner||!p||p.w!==m.winner)return{pts:0,hit:false,exact:false};
  const exact=m.bo>1&&!!p.s&&p.s===m.score;return{pts:(+m.pts||1)+(exact?1:0),hit:true,exact}}
function totals(b){let pts=0,hit=0,ex=0;for(const m of matches){const r=betPts(m,b.picks?.[m.id]);pts+=r.pts;hit+=r.hit;ex+=r.exact}return{pts,hit,ex}}
const mine=()=>bets.find(b=>b.id===editId);
const nameOf=b=>b?.name||(b?.manual?b.id:(profiles[b?.id]?.name))||'Sem nome';

/* tabs */
const views=['palpites','ranking','resultados','regras','admin'];
let betsLoaded=false;const needLogin=()=>loaded&&(!db||!me||(betsLoaded&&!bets.some(b=>b.id===me)&&editId===me));
function show(){let v=location.hash.slice(1);if(!views.includes(v)||(v==='admin'&&!isOwner))v='palpites';
  const gate=needLogin();if(gate&&(v==='palpites'||!isOwner))v='login';
  $('#tabs').hidden=gate&&!isOwner;
  if(gate){$('#loginForm').hidden=!db||!me;if(!db||!me)$('#loginMsg').textContent='Entre com seu e-mail e senha para continuar.'}
  for(const b of document.querySelectorAll('.tab'))b.setAttribute('aria-current',b.dataset.v===v);
  for(const s of views.concat('login'))$('#v-'+s).classList.toggle('on',s===v)}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('.tab');if(b)location.hash=b.dataset.v});
addEventListener('hashchange',show);show();

function ranked(){return bets.map(b=>({b,...totals(b)})).sort((x,y)=>y.pts-x.pts||y.ex-x.ex||y.hit-x.hit)}
function renderStatus(){
  if(cfg?.prize)$('#prize').textContent=cfg.prize;
  if(!loaded){return}
  const r=ranked(),done=matches.filter(m=>m.winner).length,open=matches.filter(m=>!locked(m)).length;let h='';
  if(r.length&&r[0].pts>0)h+='<span class="pill gold">Líder: '+esc(nameOf(r[0].b))+' · <span class="num">'+r[0].pts+'</span> pts</span>';
  const mb=mine();if(mb){const t=totals(mb);const pos=r.findIndex(x=>x.b.id===mb.id)+1;h+='<span class="pill">'+esc(nameOf(mb))+': <span class="num">'+t.pts+'</span> pts · '+pos+'º</span>'}
  h+='<span class="pill">'+open+' partida(s) abertas para palpite</span><span class="pill">'+done+' com resultado</span>';
  if(cfg?.updatedAt)h+='<span class="pill">Atualizado '+esc(when(cfg.updatedAt))+'</span>';
  $('#status').innerHTML=h}

function card(m,b,showOthers){
  const p=b?.picks?.[m.id],lk=locked(m),can=!lk&&canWrite&&!!editId&&!p&&!m.winner,sel=p||(can?drafts[m.id]:null);
  const side=k=>{const name=m[k];const cls=['side'];if(sel?.w===k)cls.push('pick');if(m.winner===k)cls.push('win');
    const sub=m.winner===k?'venceu':(sel?.w===k?(p?'seu palpite':'escolhido'):'');
    return '<button class="'+cls.join(' ')+'" data-m="'+esc(m.id)+'" data-w="'+k+'"'+(can?'':' disabled')+' aria-pressed="'+(sel?.w===k)+'">'+tag(name)+'<b>'+esc(name)+'</b><small>'+esc(sub)+'</small></button>'};
  let h='<div class="m"><div class="meta"><span>'+esc(m.stage||'')+' · MD'+esc(m.bo||1)+(m.start?' · '+esc(hm(m.start)):'')+'</span><span class="num">'+esc(m.pts||1)+' pt'+((m.pts||1)>1?'s':'')+'</span></div>'+
    '<div class="vs">'+side('a')+'<span class="x">VS</span>'+side('b')+'</div>';
  const opts=scoreOpts(m.bo);
  if(opts.length&&can)h+='<div class="scores">Placar (opcional): '+opts.map(s=>'<button class="chip'+(sel?.s===s?' on':'')+'" data-m="'+esc(m.id)+'" data-s="'+s+'"'+(sel?.w?'':' disabled')+'>'+s+'</button>').join('')+'</div>';
  if(can)h+='<button class="btn pri" data-confirm="'+esc(m.id)+'"'+(sel?.w?'':' disabled')+'>'+(sel?.w?'Confirmar: '+esc(m[sel.w])+(sel.s?' '+esc(sel.s):''):'Escolha um time')+'</button>';
  if(p&&!m.winner)h+='<div class="confirmed">Palpite confirmado: '+esc(m[p.w])+(p.s?' '+esc(p.s):'')+'</div>';
  if(m.winner){const r=betPts(m,p);h+='<div class="res '+(r.hit?'good':'bad')+'">Placar final '+esc(m[m.winner])+' '+esc(m.score||'')+' · '+(p?(r.hit?'você fez '+r.pts+' pt'+(r.pts>1?'s':'')+(r.exact?' (placar exato!)':''):'você errou'):'sem palpite')+'</div>'}
  else if(lk)h+='<div class="lockinfo">Palpites travados.</div>';
  else if(!p)h+='<div class="lockinfo">Palpite até '+esc(when(new Date(lockAt(m)).toISOString()))+' (15 min antes).</div>';
  if(showOthers&&lk){const list=bets.filter(x=>x.picks?.[m.id]).map(x=>{const q=x.picks[m.id];return esc(nameOf(x))+': '+esc(m[q.w]||'?')+(q.s?' '+esc(q.s):'')});
    if(list.length)h+='<div class="who">'+list.join(' · ')+'</div>'}
  return h+'</div>'}

function groupByDay(list){const g={};for(const m of list){const k=m.start?dayKey(m.start):'sem data';(g[k]=g[k]||[]).push(m)}return g}
function renderUpcoming(){
  const b=local||mine();
  const t=mine();$('#editingFor').textContent=editId&&editId!==me?'Palpitando por: '+nameOf(t||{id:editId,manual:true}):'';
  const list=matches.filter(m=>!m.winner).sort((x,y)=>Date.parse(x.start||0)-Date.parse(y.start||0));
  if(!loaded){$('#upcoming').innerHTML='<div class="empty">Carregando partidas…</div>';return}
  if(!list.length){$('#upcoming').innerHTML='<div class="empty">Nenhuma partida aberta agora. As próximas entram todo dia por volta das 17h, depois do último jogo.</div>';return}
  let note='';if(!me)note='<p class="note">Entre com seu e-mail e senha para palpitar.</p>';else if(!canWrite)note='<p class="note">Você está só visualizando.</p>';
  const g=groupByDay(list);
  $('#upcoming').innerHTML=note+Object.keys(g).sort().map(k=>'<h3>'+esc(k==='sem data'?k:dayLabel(k))+'</h3><div class="matches">'+g[k].map(m=>card(m,b,true)).join('')+'</div>').join('')}

function renderRank(){
  const r=ranked();let pos=0,last=null;
  $('#rank').innerHTML=r.map((x,i)=>{const key=x.pts+'|'+x.ex+'|'+x.hit;if(key!==last){pos=i+1;last=key}
    return '<tr class="'+(x.b.id===editId?'me ':'')+(pos===1&&x.pts>0?'lead':'')+'"><td class="num">'+pos+'º</td><td><b>'+esc(nameOf(x.b))+'</b>'+(x.b.manual?' <span class="note">(manual)</span>':'')+'</td><td class="r num">'+x.hit+'</td><td class="r num">'+x.ex+'</td><td class="r num">'+x.pts+'</td></tr>'}).join('')||'<tr><td colspan="5" class="note">Ninguém palpitou ainda.</td></tr>'}

function renderPast(){
  const list=matches.filter(m=>m.winner).sort((x,y)=>Date.parse(y.start||0)-Date.parse(x.start||0));
  if(!list.length){$('#past').innerHTML='<div class="empty">Os resultados aparecem aqui conforme as partidas terminam.</div>';return}
  const g=groupByDay(list),b=mine();
  $('#past').innerHTML=Object.keys(g).sort().reverse().map(k=>'<h3>'+esc(k==='sem data'?k:dayLabel(k))+'</h3><div class="matches">'+g[k].map(m=>card(m,b,true)).join('')+'</div>').join('')}

function renderAdmin(){if(!isOwner)return;renderLogos();renderAdmins();
  const s=$('#aWho'),cur=s.value||editId;
  s.innerHTML='<option value="'+esc(me)+'">Eu</option>'+bets.filter(b=>b.id!==me).map(b=>'<option value="'+esc(b.id)+'">'+esc(nameOf(b))+'</option>').join('');
  s.value=cur;
  const days=[...new Set(matches.filter(m=>m.start).map(m=>dayKey(m.start)))].sort();
  const ds=$('#rDay');let cd=ds.value;
  if(!cd||!days.includes(cd)){const pend=days.filter(k=>matches.some(m=>m.start&&dayKey(m.start)===k&&locked(m)&&!m.winner));const past=days.filter(k=>k<=dayKey(new Date().toISOString()));cd=pend[0]||past[past.length-1]||days[0]||''}
  ds.innerHTML=days.map(k=>'<option value="'+k+'"'+(k===cd?' selected':'')+'>'+esc(dayLabel(k))+'</option>').join('')||'<option value="">Sem partidas</option>';
  const list=matches.filter(m=>m.start&&dayKey(m.start)===cd).sort((x,y)=>Date.parse(x.start)-Date.parse(y.start));
  $('#adminRes').innerHTML=list.map(m=>{const d=resDraft[m.id]||{w:m.winner||null,s:m.score||null},o=scoreOpts(m.bo);
    return '<div class="rrow"><div><b>'+esc(m.a)+' x '+esc(m.b)+'</b><div class="when">'+esc(hm(m.start))+' · MD'+esc(m.bo||1)+(m.winner?' · salvo':'')+'</div></div>'+
    '<button class="rb'+(d.w==='a'?' on':'')+'" data-rid="'+esc(m.id)+'" data-rwin="a">'+esc(m.a)+'</button>'+
    '<button class="rb'+(d.w==='b'?' on':'')+'" data-rid="'+esc(m.id)+'" data-rwin="b">'+esc(m.b)+'</button>'+
    (o.length?'<select data-rid="'+esc(m.id)+'" data-rsc aria-label="Placar"><option value="">placar</option>'+o.map(x=>'<option'+(d.s===x?' selected':'')+'>'+x+'</option>').join('')+'</select>':'<span class="when">MD1</span>')+'</div>'}).join('')||'<p class="note">Nenhuma partida neste dia.</p>'}
let resDraft={};
$('#rDay').addEventListener('change',()=>{resDraft={};renderAdmin()});
$('#adminRes').addEventListener('click',e=>{const b=e.target.closest('[data-rwin]');if(!b)return;const m=matches.find(x=>x.id===b.dataset.rid);if(!m)return;
  const d=resDraft[m.id]||{w:m.winner||null,s:m.score||null};d.w=d.w===b.dataset.rwin?null:b.dataset.rwin;if(!d.w)d.s=null;resDraft[m.id]=d;$('#rMsg').textContent='Alterações não salvas.';renderAdmin()});
$('#adminRes').addEventListener('change',e=>{const s=e.target.closest('[data-rsc]');if(!s)return;const m=matches.find(x=>x.id===s.dataset.rid);if(!m)return;
  const d=resDraft[m.id]||{w:m.winner||null,s:m.score||null};d.s=s.value||null;resDraft[m.id]=d;$('#rMsg').textContent='Alterações não salvas.'});
$('#rSaveAll').addEventListener('click',async()=>{const ids=Object.keys(resDraft);
  const miss=ids.filter(id=>{const m=matches.find(x=>x.id===id),d=resDraft[id];return m&&d.w&&m.bo>1&&!d.s});
  if(miss.length){$('#rMsg').textContent='Falta o placar em '+miss.length+' jogo(s) melhor de 3/5.';return}
  $('#rSaveAll').disabled=true;let n=0,err=0;
  for(const id of ids){const m=matches.find(x=>x.id===id),d=resDraft[id];if(!m)continue;
    const s=d.w?(m.bo>1?d.s:'1-0'):null;if(d.w===(m.winner||null)&&s===(m.score||null))continue;
    try{await db.doc('matches/'+id).update({winner:d.w||null,score:s});n++}catch(e){err++}}
  resDraft={};$('#rSaveAll').disabled=false;$('#rMsg').textContent=err?err+' jogo(s) não salvaram. Tente de novo.':(n?n+' resultado(s) salvos. Ranking atualizado.':'Nada para salvar.');renderAdmin()});

/* ---- Admin: logos ---- */
function teamList(){const s=new Set(Object.keys(TEAMS));for(const m of matches){if(m.a)s.add(m.a);if(m.b)s.add(m.b)}return [...s].sort((x,y)=>x.localeCompare(y))}
function renderLogos(){const el=$('#logoGrid');if(!el||el.contains(document.activeElement)&&document.activeElement.type==='file')return;
  el.innerHTML=teamList().map(n=>{const s=slugOf(n);return '<div class="lrow">'+tag(n)+'<b>'+esc(n)+'</b>'+
    '<label class="btn">'+(LOGOS[s]?'Trocar':'Enviar')+'<input type="file" accept="image/*" data-logo="'+esc(n)+'" hidden></label>'+
    (LOGOS[s]?'<button class="btn" data-logodel="'+esc(n)+'">Remover</button>':'')+'</div>'}).join('')}
async function toPng(file){const img=await createImageBitmap(file);const max=256,r=Math.min(1,max/Math.max(img.width,img.height));
  const c=document.createElement('canvas');c.width=Math.round(img.width*r);c.height=Math.round(img.height*r);c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  return new Promise(ok=>c.toBlob(ok,'image/png'))}
async function setLogos(next){const s=await db.doc('league/logos').get();if(s.exists)await db.doc('league/logos').set(next);else await db.doc('league/logos').set(next)}
document.addEventListener('change',async e=>{const i=e.target.closest('[data-logo]');if(!i||!i.files[0])return;const n=i.dataset.logo,s=slugOf(n);
  if(i.files[0].size>5e6){toast('Imagem muito grande (máx. 5 MB).');return}
  toast('Enviando logo de '+n+'…');
  try{const png=await toPng(i.files[0]);await window.redondoUpload(s,png);await setLogos({...LOGOS,[s]:Date.now()});toast('Logo de '+n+' salva!')}
  catch(err){toast('Não deu para enviar: '+(err&&err.message||err))}});
document.addEventListener('click',async e=>{const d=e.target.closest('[data-logodel]');if(!d)return;const n=d.dataset.logodel,s=slugOf(n);
  try{await window.redondoRemoveLogo(s);const next={...LOGOS};delete next[s];await setLogos(next);toast('Logo removida.')}catch(err){toast('Erro ao remover.')}});
/* ---- Admin: administradores ---- */
let adminList=[];
async function loadAdmins(){try{adminList=await window.redondoAdmins.list()}catch(e){adminList=[]}renderAdmins()}
function renderAdmins(){const el=$('#adminList');if(!el)return;
  el.innerHTML=adminList.map(x=>'<div class="lrow"><b>'+esc(x)+'</b>'+(adminList.length>1?'<button class="btn" data-admdel="'+esc(x)+'">Remover</button>':'<span class="note">único admin</span>')+'</div>').join('')||'<p class="note">Carregando…</p>'}
$('#admAdd').addEventListener('click',async()=>{const v=$('#admEmail').value.trim().toLowerCase();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)){toast('Digite um e-mail válido.');return}
  try{await window.redondoAdmins.add(v);$('#admEmail').value='';toast(v+' agora é admin.');loadAdmins()}catch(e){toast('Não deu para adicionar: '+(e&&e.message||e))}});
document.addEventListener('click',async e=>{const d=e.target.closest('[data-admdel]');if(!d)return;
  try{await window.redondoAdmins.remove(d.dataset.admdel);toast('Admin removido.');loadAdmins()}catch(err){toast('Erro ao remover.')}});
function renderAll(){show();renderStatus();renderUpcoming();renderRank();renderPast();renderAdmin()}

/* saving picks */
async function flush(){if(saving){again=true;return}saving=true;$('#saveState').textContent='Salvando…';
  try{await db.doc('picks/'+editId).set(JSON.parse(JSON.stringify(local)));$('#saveState').textContent='Palpites salvos.'}
  catch(e){if(e?.code==='invalid_argument'){if(/Prazo|confirmado/.test(e.message||''))toast(e.message.replace(/^.*?(Prazo|Palpite)/,'$1'));else{canWrite=false;toast('Sem permissão para salvar. Fale com o organizador.')}}else toast('Não deu para salvar. Tente de novo.');$('#saveState').textContent='';local=null;saving=false;again=false;renderAll();return}
  saving=false;if(again){again=false;flush()}}
function queue(){clearTimeout(timer);timer=setTimeout(()=>{timer=null;flush()},700)}
function ensureLocal(){if(!local){const t=mine();local={name:t?.name||'',picks:{...(t?.picks||{})}};if(t?.manual)local.manual=true}}
document.addEventListener('click',e=>{
  const w=e.target.closest('[data-w]'),s=e.target.closest('[data-s]');
  if(w||s){const id=(w||s).dataset.m;const m=matches.find(x=>x.id===id);if(!m||locked(m)||!canWrite){if(m&&locked(m))toast('Essa partida já começou.');return}
    ensureLocal();if(local.picks[id]){toast('Você já palpitou nessa partida.');return}
    const p={...(drafts[id]||{})};
    if(w){if(p.w!==w.dataset.w){p.w=w.dataset.w;delete p.s}}else p.s=p.s===s.dataset.s?undefined:s.dataset.s;
    if(p.s===undefined)delete p.s;drafts[id]=p;renderUpcoming();return}
  const cf=e.target.closest('[data-confirm]');
  if(cf){const id=cf.dataset.confirm,m=matches.find(x=>x.id===id),d=drafts[id];
    if(!m||!d?.w)return;if(locked(m)){toast('Os palpites dessa partida já fecharam.');renderUpcoming();return}
    ensureLocal();if(local.picks[id]){toast('Você já palpitou nessa partida.');return}
    local.picks[id]={w:d.w,...(d.s?{s:d.s}:{}),at:new Date().toISOString()};delete drafts[id];renderUpcoming();clearTimeout(timer);timer=null;flush();return}
  const rs=e.target.closest('[data-rsave]');if(rs)saveResult(rs.dataset.rsave)});
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();const n=$('#loginName').value.trim();if(!n||!db||!me)return;
  if(bets.some(b=>b.id!==me&&nameOf(b).toLowerCase()===n.toLowerCase())){$('#loginMsg').textContent='Esse apelido já está em uso. Escolha outro.';return}
  $('#loginBtn').disabled=true;
  try{await db.doc('picks/'+me).set({name:n,picks:{...(mine()?.picks||{})}});local=null;location.hash='palpites';toast('Bem-vindo ao Redondo, '+n+'!')}
  catch(err){$('#loginMsg').textContent=err?.code==='invalid_argument'?'Sua conta não tem permissão para entrar. Fale com o organizador.':'Não deu para entrar agora. Tente de novo.'}
  $('#loginBtn').disabled=false});

/* admin */
$('#aEdit').addEventListener('click',()=>{editId=$('#aWho').value||me;local=null;renderAll();location.hash='palpites'});
$('#aCreate').addEventListener('click',async()=>{const n=$('#aNew').value.trim();if(!n)return;
  const id='manual-'+n.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40);
  if(bets.some(b=>b.id===id)){toast('Esse participante já existe.');return}
  try{await db.doc('picks/'+id).set({name:n,manual:true,picks:{}});$('#aNew').value='';editId=id;local=null;location.hash='palpites';toast('Participante criado.')}catch(e){toast('Não deu para criar.')}});
$('#nStage').addEventListener('change',()=>{const v=$('#nStage').value;const map={'Quartas':[3,3],'Semifinal':[3,4],'3º lugar':[3,3],'Final':[5,5],'Stage 3':[3,2]};const x=map[v];if(x){$('#nBo').value=x[0];$('#nPts').value=x[1]}});
$('#nBo').addEventListener('change',()=>{const st=$('#nStage').value;if(st==='Stage 1'||st==='Stage 2')$('#nPts').value=$('#nBo').value==='1'?1:2});
$('#nAdd').addEventListener('click',async()=>{const a=$('#nA').value.trim(),b=$('#nB').value.trim(),st=$('#nStart').value;
  if(!a||!b||!st){toast('Preencha os dois times e o horário.');return}
  const start=new Date(st).toISOString();const id=start.slice(0,10)+'-'+(a+'-'+b).toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,60);
  try{await db.doc('matches/'+id).set({a,b,start,stage:$('#nStage').value,bo:+$('#nBo').value,pts:+$('#nPts').value||1,winner:null,score:null});$('#nA').value='';$('#nB').value='';toast('Partida adicionada.')}catch(e){toast('Erro ao adicionar.')}});
async function saveResult(id){const w=document.querySelector('[data-rw="'+CSS.escape(id)+'"]').value||null;const sEl=document.querySelector('[data-rs="'+CSS.escape(id)+'"]');const s=sEl?sEl.value||null:(w?'1-0':null);
  try{await db.doc('matches/'+id).update({winner:w,score:s});toast('Resultado salvo.')}catch(e){toast('Erro ao salvar.')}}

setInterval(()=>{renderStatus();renderUpcoming()},60000);

async function loadProfiles(){if(!user)return;const ids=bets.filter(b=>!b.manual).map(b=>b.id).filter(id=>!profiles[id]);if(!ids.length)return;
  try{Object.assign(profiles,await user.profiles(ids)||{})}catch(e){}renderAll()}

(async()=>{
  user=await claude.use('user');db=await claude.use('db');
  if(user){me=await user.id();isOwner=(await user.isOwner())??false;const cw=await user.can('data.write');canWrite=cw===null?true:!!cw}
  editId=me;$('#tabAdmin').hidden=!isOwner;show();if(isOwner)loadAdmins();
  if(!db){$('#status').innerHTML='<span class="pill">Falta configurar o Supabase (js/supabase-config.js).</span>';loaded=true;renderAll();return}
  const t=setTimeout(()=>{if(!loaded)$('#status').innerHTML='<span class="pill">Não consegui carregar o bolão ainda. Verifique a conexão.</span>'},10000);
  db.doc('league/config').onSnapshot(s=>{cfg=s.exists?s.data():null;renderStatus()},()=>{});
  db.doc('league/logos').onSnapshot(s=>{LOGOS=s.exists?{...s.data()}:{};renderAll()},()=>{});
  db.collection('matches').onSnapshot(s=>{matches=s.docs.map(d=>({id:d.id,...d.data()}));if(!s.metadata.fromCache){loaded=true;clearTimeout(t)}renderAll()},()=>{loaded=true;clearTimeout(t);renderAll()});
  db.collection('picks').onSnapshot(s=>{bets=s.docs.map(d=>({id:d.id,...d.data()}));betsLoaded=true;if(!saving&&!timer)local=null;renderAll();loadProfiles()},()=>{});
})();
}
