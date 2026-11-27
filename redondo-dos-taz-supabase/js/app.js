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
const initials=n=>String(n||'?').trim().split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?';
const avatar=(b,size)=>{const u=b&&!b.manual&&b.avatar&&window.redondoAvatarUrl?window.redondoAvatarUrl(b.id,b.avatar):'';
  return '<span class="av" style="width:'+size+'px;height:'+size+'px;font-size:'+Math.round(size*.4)+'px">'+(u?'<img src="'+esc(u)+'" alt="">':esc(initials(nameOf(b))))+'</span>'};

/* tabs */
const views=['palpites','aovivo','ranking','resultados','regras','admin','perfil'];
let betsLoaded=false;const needLogin=()=>loaded&&(!db||!me||(betsLoaded&&!bets.some(b=>b.id===me)&&editId===me));
function show(){let v=location.hash.slice(1);if(!views.includes(v)||(v==='admin'&&!isOwner))v='palpites';
  const gate=needLogin();if(gate&&(v==='palpites'||!isOwner))v='login';
  $('#tabs').hidden=gate&&!isOwner;
  if(gate){$('#loginForm').hidden=!db||!me;if(!db||!me)$('#loginMsg').textContent='Entre com seu e-mail e senha para continuar.'}
  for(const b of document.querySelectorAll('.tab'))b.setAttribute('aria-current',b.dataset.v===v);
  for(const s of views.concat('login'))$('#v-'+s).classList.toggle('on',s===v);if(typeof renderLive==='function')renderLive(v==='aovivo')}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('.tab');if(b)location.hash=b.dataset.v});
addEventListener('hashchange',show);show();

function ranked(){return bets.map(b=>({b,...totals(b)})).sort((x,y)=>y.pts-x.pts||y.ex-x.ex||y.hit-x.hit)}
/* ---- Letreiro, destaque, pódio e "Seu Major" ---- */
const LIVE='<span class="live">AO VIVO</span>';
const scoreAB=m=>{if(m.winner&&m.score){const[w,l]=m.score.split('-');return m.winner==='a'?w+'–'+l:l+'–'+w}return(m.liveScore||'0-0').replace('-','–')};
const mapTxt=m=>m.liveMap?'Mapa '+m.liveMap+' de '+(m.bo||1)+(m.liveMapName?' · '+m.liveMapName:''):'';
const fmtCd=ms=>{if(ms<=0)return'agora';const s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),mi=Math.floor(s%3600/60);return d?d+'d '+h+'h':h?h+'h '+mi+'min':mi+'min'};
function renderStatus(){
  if(!loaded)return;
  const live=matches.filter(m=>m.live&&!m.winner),fin=matches.filter(m=>m.winner).sort((x,y)=>Date.parse(y.start||0)-Date.parse(x.start||0)).slice(0,8),
    nxt=matches.filter(m=>!m.winner&&!m.live&&Date.parse(m.start)>Date.now()).sort((x,y)=>Date.parse(x.start)-Date.parse(y.start)).slice(0,3);
  const items=[...live.map(m=>'<span class="tk-item">'+LIVE+' '+esc(m.a)+' <b>'+esc(scoreAB(m))+'</b> '+esc(m.b)+(mapTxt(m)?' <i>· '+esc(mapTxt(m))+'</i>':'')+'</span>'),
    ...nxt.map(m=>'<span class="tk-item"><i>PRÓXIMO</i> '+esc(m.a)+' x '+esc(m.b)+' · '+esc(hm(m.start))+'</span>'),
    ...fin.map(m=>'<span class="tk-item"><i>FINAL</i> '+esc(m.a)+' <b>'+esc(scoreAB(m))+'</b> '+esc(m.b)+'</span>')];
  if(cfg?.updatedAt)items.push('<span class="tk-item"><i>ATUALIZADO</i> '+esc(when(cfg.updatedAt))+'</span>');
  const html=items.join('')||'<span class="tk-item">Sem jogos no momento</span>';
  $('#tkTrack').innerHTML=html+'<span aria-hidden="true" class="tk-dup">'+html+'</span>';
  renderHero();renderAside()}
function heroMatch(){const open=matches.filter(m=>!m.winner);
  return open.find(m=>m.live)||open.filter(m=>!locked(m)).sort((x,y)=>Date.parse(x.start)-Date.parse(y.start))[0]||open.sort((x,y)=>Date.parse(x.start)-Date.parse(y.start))[0]}
function bigTeam(n){return '<div class="ht">'+tag(n)+'<span>'+esc(n)+'</span></div>'}
function renderHero(){const m=heroMatch(),el=$('#hero');if(!m){el.innerHTML='';return}
  const b=mine(),p=b?.picks?.[m.id],lk=locked(m);
  let right;
  if(m.live)right='<div class="hr-r"><button class="hr-btn watch" data-stream="'+esc((chOf(m)[0]||curStream()||{}).n||'')+'">▶ Assistir'+(chOf(m)[0]?' no '+esc(chOf(m)[0].n):' ao vivo')+'</button><span class="hr-l">Placar agora (mapas)</span><div class="hr-score">'+esc(scoreAB(m))+'</div>'+(mapTxt(m)?'<span class="hr-map">'+esc(mapTxt(m))+'</span>':'')+(p?'<span class="hr-mine">Seu palpite: '+esc(m[p.w])+(p.s?' '+esc(p.s):'')+'</span>':'')+'</div>';
  else if(!lk)right='<div class="hr-r"><span class="hr-l">Palpites fecham em</span><div class="cd" data-cd="'+lockAt(m)+'"></div>'+(p?'<span class="hr-mine">Seu palpite: '+esc(m[p.w])+(p.s?' '+esc(p.s):'')+'</span>':'<a class="hr-btn" href="#m-'+esc(m.id)+'">Dar meu palpite →</a>')+'</div>';
  else right='<div class="hr-r"><span class="hr-l">Começa em</span><div class="cd" data-cd="'+Date.parse(m.start)+'"></div><span class="hr-mine">Palpites fechados</span></div>';
  el.innerHTML='<div class="hero2"><div class="hr-l-col"><span class="hr-tag">'+(m.live?LIVE+' ':'PRÓXIMO JOGO · ')+esc(m.stage||'')+' · MD'+esc(m.bo||1)+' · '+esc(m.pts||1)+' PTS</span>'+
    '<div class="hr-teams">'+bigTeam(m.a)+'<span class="hr-vs">VS</span>'+bigTeam(m.b)+'</div></div>'+right+'</div>';tick()}
function tick(){for(const el of document.querySelectorAll('[data-cd]')){const ms=Math.max(0,+el.dataset.cd-Date.now()),s=Math.floor(ms/1000);
  if(el.classList.contains('cd')){const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),mi=Math.floor(s%3600/60),se=s%60,P=n=>String(n).padStart(2,'0');
    const u=d?[[d,'DIAS'],[h,'HORAS'],[mi,'MIN']]:[[h,'HORAS'],[mi,'MIN'],[se,'SEG']];el.innerHTML=u.map(([v,l])=>'<div><b>'+P(v)+'</b><small>'+l+'</small></div>').join('')}
  else el.textContent=ms?'fecha em '+fmtCd(ms):'fechado'}}
setInterval(tick,1000);
function renderAside(){const r=ranked(),b=bets.find(x=>x.id===me);
  const top=[r[1],r[0],r[2]],hs=[70,100,52],cls=['p2','p1','p3'],lb=['2º','1º','3º'];
  $('#podium').innerHTML='<h3>PÓDIO</h3>'+(r.length?'<div class="pod">'+top.map((x,i)=>x?'<div class="pd '+cls[i]+'">'+avatar(x.b,i===1?56:46)+'<span class="pd-n">'+esc(nameOf(x.b))+'</span><div class="pd-s" style="height:'+hs[i]+'px">'+lb[i]+' · '+x.pts+'</div></div>':'<div></div>').join('')+'</div>'+
    r.slice(3,6).map((x,i)=>'<div class="pd-row"><span>'+(i+4)+'º '+esc(nameOf(x.b))+'</span><b>'+x.pts+'</b></div>').join('')+'<a class="pd-link" href="#ranking">Ver ranking completo →</a>':'<p class="note">O pódio aparece quando a galera começar a pontuar.</p>');
  const s=b?myStats(b):null,pot=bets.length*(+cfg?.entry||10),pos=b?r.findIndex(x=>x.b.id===me)+1:0;
  const tile=(v,l,c)=>'<div class="tile"><b'+(c?' class="'+c+'"':'')+'>'+esc(v)+'</b><small>'+esc(l)+'</small></div>';
  $('#myMajor').innerHTML='<h3>SEU MAJOR</h3><div class="tiles">'+(s?tile(s.acc+'%','de acerto')+tile(s.cur,'acertos seguidos','hot')+tile(s.ex,'placares exatos'):'')+tile('R$ '+pot,'em jogo na skin')+'</div>';
  $('#mini').innerHTML=s?tile(pos?pos+'º':'—',s.pts+' pontos','red')+tile(s.acc+'%','de acerto')+tile(s.cur,'em sequência','hot'):''}

function teamBtn(m,k,sel,p,can){const n=m[k];const on=sel?.w===k,win=m.winner===k;
  const sub=win?'venceu':on?(p?'seu palpite'+(p.s?' · '+p.s:''):'escolhido'+(sel.s?' · '+sel.s:'')):'';
  return '<button class="team'+(on?' on':'')+(win?' win':'')+'" data-m="'+esc(m.id)+'" data-w="'+k+'"'+(can?'':' disabled')+' aria-pressed="'+on+'">'+tag(n)+'<span class="tn"><b>'+esc(n)+'</b>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</span></button>'}
function crowd(m){const ps=bets.map(x=>x.picks?.[m.id]).filter(Boolean);if(!ps.length)return '';const a=ps.filter(q=>q.w==='a').length,pa=Math.round(a/ps.length*100);
  return '<div class="crowd"><div class="cr-l"><span>Galera: '+pa+'% '+esc(m.a)+'</span><span>'+(100-pa)+'% '+esc(m.b)+'</span></div><div class="cr-bar"><i style="width:'+pa+'%"></i></div></div>'}
function card(m,b,showOthers){
  if(m.winner)return doneCard(m,b);
  const p=b?.picks?.[m.id],lk=locked(m),can=!lk&&canWrite&&!!editId&&!p,sel=p||(can?drafts[m.id]:null);
  let h='<article class="mc'+(m.live?' is-live':'')+'" id="m-'+esc(m.id)+'"><div class="mc-top"><span>'+(m.start?esc(hm(m.start))+' · ':'')+esc(m.stage||'')+' · MD'+esc(m.bo||1)+'</span>'+(m.live?LIVE:'')+'<span class="mc-pts">+'+esc(m.pts||1)+' pt'+((m.pts||1)>1?'s':'')+'</span></div>'+
    '<div class="mc-teams">'+teamBtn(m,'a',sel,p,can)+teamBtn(m,'b',sel,p,can)+'</div>';
  if(m.live)h+='<div class="mc-live"><span>Placar agora</span><b>'+esc(scoreAB(m))+'</b><span>'+(mapTxt(m)?esc(mapTxt(m)):'em mapas')+'</span></div>';
  const opts=scoreOpts(m.bo);
  if(can){h+='<div class="mc-row">'+(opts.length?'<span class="note">Cravar placar:</span>'+opts.map(s=>'<button class="chip'+(sel?.s===s?' on':'')+'" data-m="'+esc(m.id)+'" data-s="'+s+'"'+(sel?.w?'':' disabled')+'>'+s+'</button>').join(''):'')+'<span class="mc-cd" data-cd="'+lockAt(m)+'"></span></div>';
    h+='<button class="btn pri wide" data-confirm="'+esc(m.id)+'"'+(sel?.w?'':' disabled')+'>'+(sel?.w?'Confirmar: '+esc(m[sel.w])+(sel.s?' '+esc(sel.s):''):'Escolha um time')+'</button>'}
  else if(!lk&&p)h+='<div class="mc-row"><span class="confirmed">Palpite confirmado</span><span class="mc-cd" data-cd="'+lockAt(m)+'"></span></div>';
  else if(lk&&!m.live)h+='<div class="mc-row"><span class="note">Palpites fechados · começa às '+esc(hm(m.start))+'</span></div>';
  if(lk)h+=crowd(m);
  if(showOthers&&lk){const list=bets.filter(x=>x.picks?.[m.id]).map(x=>{const q=x.picks[m.id];return esc(nameOf(x))+': '+esc(m[q.w]||'?')+(q.s?' '+esc(q.s):'')});if(list.length)h+='<div class="who">'+list.join(' · ')+'</div>'}
  return h+'</article>'}
function doneCard(m,b){const p=b?.picks?.[m.id],r=betPts(m,p);
  const st=!p?'<span class="mc-flag">SEM PALPITE</span>':r.hit?'<span class="mc-flag ok">ACERTOU · +'+r.pts+' pt'+(r.pts>1?'s':'')+'</span>':'<span class="mc-flag no">ERROU</span>';
  const side=k=>'<span class="rs-t'+(m.winner===k?' w':'')+'">'+tag(m[k])+'<b>'+esc(m[k])+'</b></span>';
  const ex=bets.filter(x=>x.id!==b?.id&&x.picks?.[m.id]&&betPts(m,x.picks[m.id]).exact).length;
  let h='<article class="mc done"><div class="mc-top"><span>'+(m.start?esc(dayLabel(dayKey(m.start)).split(',')[0])+' · ':'')+esc(m.stage||'')+' · MD'+esc(m.bo||1)+'</span>'+st+'</div>'+
    '<div class="rs">'+side('a')+'<span class="rs-sc">'+esc(scoreAB(m))+'</span>'+side('b')+'</div>';
  if(r.exact)h+='<div class="good">Placar exato!'+(ex?' Você e mais '+ex+' cravaram '+esc(m.score)+'.':'')+'</div>';
  else if(p&&!r.hit)h+='<div class="note">Seu palpite: '+esc(m[p.w])+(p.s?' '+esc(p.s):'')+'</div>';
  const list=bets.filter(x=>x.picks?.[m.id]).map(x=>{const q=x.picks[m.id];return esc(nameOf(x))+': '+esc(m[q.w]||'?')+(q.s?' '+esc(q.s):'')});if(list.length)h+='<div class="who">'+list.join(' · ')+'</div>';
  return h+'</article>'}

function groupByDay(list){const g={};for(const m of list){const k=m.start?dayKey(m.start):'sem data';(g[k]=g[k]||[]).push(m)}return g}
function renderUpcoming(){
  const b=local||mine();
  const t=mine();$('#editingFor').textContent=editId&&editId!==me?'Palpitando por: '+nameOf(t||{id:editId,manual:true}):'';
  const list=matches.filter(m=>!m.winner).sort((x,y)=>Date.parse(x.start||0)-Date.parse(y.start||0));
  if(!loaded){$('#upcoming').innerHTML='<div class="empty">Carregando partidas…</div>';return}
  let note='';if(!me)note='<p class="note">Entre com seu e-mail e senha para palpitar.</p>';else if(!canWrite)note='<p class="note">Você está só visualizando.</p>';
  if(!list.length)$('#upcoming').innerHTML=note+'<div class="empty">Nenhuma partida aberta agora. Os próximos jogos entram assim que os confrontos forem definidos.</div>';
  else{const g=groupByDay(list);
    $('#upcoming').innerHTML=note+Object.keys(g).sort().map(k=>{const ms=g[k],op=ms.filter(m=>!locked(m)).length,mn=ms.filter(m=>b?.picks?.[m.id]).length;
      return '<div class="day-h"><h2>JOGOS DE '+esc(k==='sem data'?'—':dayLabel(k).toUpperCase())+'</h2><span class="note">'+(op?op+' abertos · ':'')+'você palpitou em '+mn+'</span></div><div class="mlist">'+ms.map(m=>card(m,b,true)).join('')+'</div>'}).join('')}
  const rec=matches.filter(m=>m.winner).sort((x,y)=>Date.parse(y.start||0)-Date.parse(x.start||0)).slice(0,3);
  $('#recent').innerHTML=rec.length?'<div class="day-h"><h2>ÚLTIMOS RESULTADOS</h2><a href="#resultados" class="note">ver todos →</a></div><div class="mlist">'+rec.map(m=>doneCard(m,mine())).join('')+'</div>':''}

function renderRank(){
  const r=ranked();let pos=0,last=null;
  $('#rank').innerHTML=r.map((x,i)=>{const key=x.pts+'|'+x.ex+'|'+x.hit;if(key!==last){pos=i+1;last=key}
    return '<tr class="'+(x.b.id===editId?'me ':'')+(pos===1&&x.pts>0?'lead':'')+'"><td class="num">'+pos+'º</td><td><span class="who-cell">'+avatar(x.b,30)+'<b>'+esc(nameOf(x.b))+'</b><span class="mis">'+medalIcons(x.b,22)+'</span></span>'+(x.b.manual?' <span class="note">(manual)</span>':'')+'</td><td class="r num">'+x.hit+'</td><td class="r num">'+x.ex+'</td><td class="r num">'+x.pts+'</td></tr>'}).join('')||'<tr><td colspan="5" class="note">Ninguém palpitou ainda.</td></tr>'}

function renderPast(){
  const list=matches.filter(m=>m.winner).sort((x,y)=>Date.parse(y.start||0)-Date.parse(x.start||0));
  if(!list.length){$('#past').innerHTML='<div class="empty">Os resultados aparecem aqui conforme as partidas terminam.</div>';return}
  const g=groupByDay(list),b=mine();
  $('#past').innerHTML=Object.keys(g).sort().reverse().map(k=>'<div class="day-h"><h2>'+esc(k==='sem data'?'—':dayLabel(k).toUpperCase())+'</h2></div><div class="mlist two">'+g[k].map(m=>doneCard(m,b)).join('')+'</div>').join('')}

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
/* ---- Perfil ---- */
const phase=s=>/^Stage 1/.test(s||'')?'Stage 1':/^Stage 2/.test(s||'')?'Stage 2':/^Stage 3/.test(s||'')?'Stage 3':'Playoffs';
function myStats(b){const picks=b?.picks||{};let hits=0,ex=0,pts=0,dec=0,pend=0,cur=0,best=0;const byPhase={},hist=[];
  const list=matches.filter(m=>picks[m.id]).sort((x,y)=>Date.parse(x.start||0)-Date.parse(y.start||0));
  for(const m of list){const p=picks[m.id];if(!m.winner){pend++;continue}dec++;const r=betPts(m,p);
    if(r.hit){hits++;cur++;best=Math.max(best,cur)}else cur=0;if(r.exact)ex++;pts+=r.pts;
    const f=phase(m.stage);byPhase[f]=(byPhase[f]||0)+r.pts;hist.push({m,p,r})}
  return{hits,ex,pts,dec,pend,cur,best,byPhase,hist:hist.reverse(),total:Object.keys(picks).length,acc:dec?Math.round(hits/dec*100):0}}
function renderMe(){const b=bets.find(x=>x.id===me);const btn=$('#meBtn');if(!btn)return;
  btn.hidden=!me||!b;if(b)btn.innerHTML=avatar(b,40)}
function renderProfile(){const el=$('#v-perfil');if(!el)return;const b=bets.find(x=>x.id===me);
  $('#pfEmpty').hidden=!!b;$('#pfBody').hidden=!b;document.querySelector('.pf-head').hidden=!b;if(!b)return;
  const s=myStats(b),r=ranked(),pos=r.findIndex(x=>x.b.id===me)+1;
  $('#pfAvatar').innerHTML=avatar(b,112);
  if(document.activeElement!==$('#pfName'))$('#pfName').value=b.name||'';
  const stat=(v,l)=>'<div class="stat"><span class="num">'+esc(v)+'</span><small>'+esc(l)+'</small></div>';
  $('#pfStats').innerHTML=stat(s.pts,'pontos')+stat(pos?pos+'º':'—','no ranking')+stat(s.acc+'%','de acerto')+stat(s.hits,'acertos')+stat(s.ex,'placares exatos')+stat(s.best,'melhor sequência')+stat(s.cur,'sequência atual')+stat(s.pend,'aguardando resultado');
  const ph=['Stage 1','Stage 2','Stage 3','Playoffs'],mx=Math.max(1,...ph.map(f=>s.byPhase[f]||0));
  $('#pfPhase').innerHTML=ph.map(f=>'<div class="bar"><span>'+f+'</span><div class="track"><i style="width:'+((s.byPhase[f]||0)/mx*100)+'%"></i></div><b class="num">'+(s.byPhase[f]||0)+'</b></div>').join('');
  $('#pfHist').innerHTML=s.hist.slice(0,12).map(({m,p,r})=>'<tr><td>'+esc(m.a)+' x '+esc(m.b)+'<br><span class="note">'+esc(m.stage||'')+'</span></td><td>'+esc(m[p.w]||'?')+(p.s?' '+esc(p.s):'')+'</td><td>'+esc(m[m.winner])+' '+esc(m.score||'')+'</td><td class="r num '+(r.hit?'good':'bad')+'">'+(r.hit?'+'+r.pts:'0')+'</td></tr>').join('')||'<tr><td colspan="4" class="note">Seus palpites aparecem aqui quando os jogos terminarem.</td></tr>';
  $('#pfEmail').textContent=window.redondoEmail?window.redondoEmail():''}
async function squarePng(file){const img=await createImageBitmap(file);const s=Math.min(img.width,img.height),c=document.createElement('canvas');c.width=c.height=256;
  c.getContext('2d').drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,256,256);return new Promise(ok=>c.toBlob(ok,'image/png'))}
$('#pfFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;if(f.size>8e6){toast('Imagem muito grande (máx. 8 MB).');return}
  toast('Enviando foto…');try{await window.redondoUploadAvatar(await squarePng(f));await db.doc('picks/'+me).update({avatar:Date.now()});toast('Foto atualizada!')}
  catch(err){toast('Não deu para enviar a foto: '+(err&&err.message||err))}e.target.value=''});
$('#pfSave').addEventListener('click',async()=>{const n=$('#pfName').value.trim();if(!n)return;
  if(bets.some(b=>b.id!==me&&nameOf(b).toLowerCase()===n.toLowerCase())){toast('Esse apelido já está em uso.');return}
  try{await db.doc('picks/'+me).update({name:n});toast('Apelido salvo.')}catch(e){toast('Não deu para salvar.')}});
$('#pfOut').addEventListener('click',()=>window.redondoSignOut&&window.redondoSignOut());
$('#meBtn').addEventListener('click',()=>{location.hash='perfil'});

/* ---- Ao vivo (transmissão) ---- */
var DEF_STREAMS=[{n:'Gaules',t:'kick',c:'gaules'},{n:'Polex',t:'kick',c:'polex'},{n:'PGL',t:'kick',c:'pgl'}];
function streams(){return Array.isArray(cfg?.streams)&&cfg.streams.length?cfg.streams:DEF_STREAMS}
var lvSel=null,lvPick=null,lvShown='',miniShown='',miniOff='';
try{lvSel=localStorage.getItem('redondo-stream')}catch(e){}
var srcOf=s=>s.t==='twitch'?'https://player.twitch.tv/?channel='+encodeURIComponent(s.c)+'&parent='+encodeURIComponent(location.hostname||'localhost')+'&autoplay=true&muted=true'
  :'https://player.kick.com/'+encodeURIComponent(s.c)+'?autoplay=true&muted=true';
function chOf(m){const ss=streams(),ch=(m.ch||[]).map(x=>String(x).toLowerCase());return ss.filter(s=>ch.includes(String(s.c).toLowerCase()))}
function liveSorted(){const b=mine();return matches.filter(m=>m.live&&!m.winner).sort((x,y)=>(b?.picks?.[y.id]?1:0)-(b?.picks?.[x.id]?1:0))}
function matchOfStream(s,live){return live.find(m=>chOf(m).includes(s))||null}
/* canal: escolha feita agora > canal do jogo em que você palpitou > canal salvo > primeiro da lista */
function curStream(){const ss=streams(),live=liveSorted();
  if(lvPick){const p=ss.find(s=>s.n===lvPick);if(p)return p}
  for(const m of live){const c=chOf(m);if(c.length)return c.find(s=>s.n===lvSel)||c[0]}
  return ss.find(s=>s.n===lvSel)||ss[0]}
function watchBtns(m){const c=chOf(m);return c.length?'<div class="lv-w">'+c.map(s=>'<button class="hr-btn watch sm" data-stream="'+esc(s.n)+'">▶ Assistir no '+esc(s.n)+'</button>').join('')+'</div>':'<div class="note">Canal ainda não identificado: escolha acima.</div>'}
function renderLive(visible){
  const live=liveSorted();$('#tabLive').classList.toggle('has-live',live.length>0);
  renderMini(live,visible);
  if(!visible){if(lvShown){$('#lvFrame').innerHTML='';lvShown=''}return}
  const ss=streams(),cur=curStream();
  $('#lvBadge').innerHTML=live.length?LIVE:'';$('#lvName').innerHTML=cur?esc(cur.n)+' <a class="lv-ext" href="'+(cur.t==='twitch'?'https://www.twitch.tv/':'https://kick.com/')+encodeURIComponent(cur.c)+'" target="_blank" rel="noopener">Abrir na '+(cur.t==='twitch'?'Twitch':'Kick')+' ↗</a>':'';
  $('#lvChannels').innerHTML=ss.map(s=>{const mm=matchOfStream(s,live);return '<button class="chip'+(s===cur?' on':'')+'" data-stream="'+esc(s.n)+'">'+esc(s.n)+(mm?' <small>· '+esc(mm.a)+' x '+esc(mm.b)+'</small>':'')+'</button>'}).join('');
  const src=cur?srcOf(cur):'';
  if(src!==lvShown){lvShown=src;$('#lvFrame').innerHTML=src?'<iframe src="'+esc(src)+'" allowfullscreen allow="autoplay; fullscreen" title="Transmissão ao vivo"></iframe>':''}
  const b=mine(),nx=matches.filter(m=>!m.winner&&!m.live&&Date.parse(m.start)>Date.now()).sort((x,y)=>Date.parse(x.start)-Date.parse(y.start));
  $('#lvNote').textContent=live.length?'O player começa sem som: toque nele para ativar o áudio.':(nx[0]?'Nenhum jogo ao vivo agora. Próximo: '+nx[0].a+' x '+nx[0].b+' · '+when(nx[0].start)+'.':'Nenhum jogo ao vivo agora.');
  $('#lvNow').innerHTML=live.length?live.map(m=>{const p=b?.picks?.[m.id];return '<div class="lv-m"><div class="lv-mt">'+LIVE+'<span class="note">'+esc(m.stage||'')+' · MD'+esc(m.bo||1)+'</span></div><div class="rs">'+'<span class="rs-t">'+tag(m.a)+'<b>'+esc(m.a)+'</b></span><span class="rs-sc">'+esc(scoreAB(m))+'</span><span class="rs-t">'+tag(m.b)+'<b>'+esc(m.b)+'</b></span></div>'+(mapTxt(m)?'<div class="note">'+esc(mapTxt(m))+'</div>':'')+'<div class="note">'+(p?'Seu palpite: <b>'+esc(m[p.w])+(p.s?' '+esc(p.s):'')+'</b>':'Você não palpitou neste jogo')+'</div>'+watchBtns(m)+crowd(m)+'</div>'}).join(''):'<p class="note">Sem jogos rolando agora.</p>';
  $('#lvNext').innerHTML=nx.slice(0,4).map(m=>'<div class="pd-row"><span>'+esc(m.a)+' x '+esc(m.b)+'</span><b>'+esc(when(m.start))+'</b></div>').join('')||'<p class="note">Os próximos jogos aparecem quando os confrontos forem definidos.</p>'}
document.addEventListener('click',e=>{const s=e.target.closest('[data-stream]');if(!s)return;lvSel=lvPick=s.dataset.stream;if(!$('#v-aovivo').classList.contains('on')){location.hash='aovivo';return}try{localStorage.setItem('redondo-stream',lvSel)}catch(x){}renderLive(true)});
function renderMini(live,onTab){const box=$('#miniLive');if(!box)return;
  const key=live.map(m=>m.id).join(',');let off='';try{off=sessionStorage.getItem('redondo-mini-off')||''}catch(e){}
  const show=live.length&&!onTab&&off!==key&&!needLogin();
  box.hidden=!show;
  if(!show){if(miniShown){$('#miniFrame').innerHTML='';miniShown=''}return}
  const s=curStream(),m=(s&&matchOfStream(s,live))||live[0];
  $('#miniInfo').innerHTML=LIVE+'<span class="mini-sc"><b>'+esc(m.a)+'</b> '+esc(scoreAB(m))+' <b>'+esc(m.b)+'</b></span>'+(live.length>1?'<span class="note">+'+(live.length-1)+'</span>':'');
  $('#miniCh').textContent=s?s.n:'';
  const src=s?srcOf(s):'';if(src!==miniShown){miniShown=src;$('#miniFrame').innerHTML=src?'<iframe src="'+esc(src)+'" allowfullscreen allow="autoplay; fullscreen" title="Transmissão ao vivo"></iframe>':''}}
$('#miniClose').addEventListener('click',()=>{const key=matches.filter(m=>m.live&&!m.winner).map(m=>m.id).join(',');try{sessionStorage.setItem('redondo-mini-off',key)}catch(e){}renderLive(false)});
$('#miniOpen').addEventListener('click',()=>{location.hash='aovivo'});
$('#lvSave').addEventListener('click',async()=>{const list=$('#lvCfg').value.split('\n').map(l=>l.split('|').map(x=>x.trim())).filter(x=>x.length>=3&&x[0]&&x[2]).map(([n,t,c])=>({n,t:/twitch/i.test(t)?'twitch':'kick',c:c.replace(/^https?:\/\/(www\.)?(kick\.com|twitch\.tv)\//i,'').replace(/\/.*$/,'')}));
  if(!list.length){toast('Nenhum canal válido.');return}
  try{await db.doc('league/config').update({streams:list});toast('Canais salvos.')}catch(e){toast('Não deu para salvar.')}});
function renderLvMap(){const el=$('#lvMap');if(!el||!isOwner)return;
  const now=Date.now(),list=matches.filter(m=>!m.winner&&m.start&&(m.live||Math.abs(Date.parse(m.start)-now)<12*3600e3)).sort((x,y)=>Date.parse(x.start)-Date.parse(y.start));
  const ss=streams();
  el.innerHTML=list.map(m=>{const c=chOf(m),v=m.chManual?(c[0]?.c||''):'';
    return '<div class="rrow"><div><b>'+esc(m.a)+' x '+esc(m.b)+'</b><div class="when">'+(m.live?'AO VIVO':esc(hm(m.start)))+' · agora: '+(c.length?esc(c.map(s=>s.n).join(', ')):'—')+(m.chManual?' (manual)':'')+'</div></div>'+
    '<select data-chid="'+esc(m.id)+'" aria-label="Canal"><option value="">Automático</option>'+ss.map(s=>'<option value="'+esc(s.c)+'"'+(v===s.c?' selected':'')+'>'+esc(s.n)+'</option>').join('')+'</select></div>'}).join('')||'<p class="note">Nenhum jogo nas próximas horas.</p>'}
$('#lvMap').addEventListener('change',async e=>{const s=e.target.closest('[data-chid]');if(!s)return;
  const v=s.value;try{await db.doc('matches/'+s.dataset.chid).update(v?{ch:[v],chManual:true}:{chManual:false});toast(v?'Canal definido.':'Voltou para o automático.')}catch(x){toast('Não deu para salvar.')}});
function fillLiveCfg(){renderLvMap();const t=$('#lvCfg');if(t&&document.activeElement!==t)t.value=streams().map(s=>s.n+' | '+s.t+' | '+s.c).join('\n')}

/* ---- Medalhas (conquistas) ---- */
const DECISIVE=m=>/vale vaga|elimina|Quartas|Semifinal|3º lugar|Final/i.test(m.stage||'')||(m.pts||1)>=2;
function medalsOf(b){const got=new Set();if(!b||!b.picks)return got;const picks=b.picks;
  const done=matches.filter(m=>m.winner&&m.start),hitsByDay={},daysAll={};let ex=0,clutch=0,cur=0,best=0;
  for(const m of [...done].sort((x,y)=>Date.parse(x.start)-Date.parse(y.start))){const k=dayKey(m.start);(daysAll[k]=daysAll[k]||[]).push(m);
    const p=picks[m.id];if(!p)continue;const r=betPts(m,p);
    if(r.hit){hitsByDay[k]=(hitsByDay[k]||0)+1;cur++;best=Math.max(best,cur);if(DECISIVE(m))clutch++;
      const ps=bets.map(x=>x.picks?.[m.id]).filter(Boolean);if(ps.length>=3&&ps.filter(q=>q.w===m.winner).length/ps.length<0.3)got.add('zebra')}else cur=0;
    if(r.exact)ex++}
  if(Object.values(hitsByDay).some(n=>n>=5))got.add('ace');
  if(best>=5)got.add('fogo');if(ex>=3)got.add('crava');if(clutch>=3)got.add('clutch');
  if(Object.keys(picks).length>=20)got.add('veterano');
  for(const k in daysAll){const ms=daysAll[k];
    if(ms.length>=4&&ms.every(m=>picks[m.id]&&picks[m.id].w===m.winner))got.add('profeta');
    const sc=bets.map(x=>({id:x.id,p:ms.reduce((a,m)=>a+betPts(m,x.picks?.[m.id]).pts,0)})),mx=Math.max(...sc.map(s=>s.p));
    if(mx>0&&sc.filter(s=>s.p===mx).length===1&&sc.find(s=>s.id===b.id)?.p===mx)got.add('rei')}
  return got}
let medalCache=new Map();
function medalsCached(b){const key=b.id+'|'+matches.length+'|'+matches.filter(m=>m.winner).length+'|'+JSON.stringify(b.picks||{}).length+'|'+bets.length;
  const c=medalCache.get(b.id);if(c&&c.key===key)return c.v;const v=medalsOf(b);medalCache.set(b.id,{key,v});return v}
const medalIcons=(b,size)=>{const g=medalsCached(b);return window.MEDALS?MEDALS.filter(M=>g.has(M.k)).map(M=>'<span class="mi" title="'+esc(M.n)+'">'+medalSVG(M.k,'r'+slugOf(b.id)+M.k,size,false,M.n)+'</span>').join(''):''};
function renderMedals(){const el=$('#pfMedals');if(!el||!window.MEDALS)return;const b=bets.find(x=>x.id===me);if(!b)return;const g=medalsCached(b);
  $('#pfMedCount').textContent=g.size+' de '+MEDALS.length;
  el.innerHTML=MEDALS.map(M=>'<div class="md'+(g.has(M.k)?' got':'')+'">'+medalSVG(M.k,'p'+M.k,96,!g.has(M.k),M.n)+'<b>'+esc(M.n)+'</b><small>'+esc(M.d)+'</small></div>').join('');
  try{const key='redondo-medals-'+me,seen=JSON.parse(localStorage.getItem(key)||'null');const now=[...g];
    if(seen){const nw=now.filter(k=>!seen.includes(k));if(nw.length){const M=MEDALS.find(x=>x.k===nw[0]);showMedalToast(M)}}
    if(loaded&&betsLoaded)localStorage.setItem(key,JSON.stringify(now))}catch(e){}}
function showMedalToast(M){const t=$('#medalToast');if(!t)return;t.innerHTML=medalSVG(M.k,'tt'+M.k,72,false,M.n)+'<div><small>NOVA MEDALHA</small><b>'+esc(M.n)+'</b><span>'+esc(M.d)+'</span></div>';t.classList.add('on');clearTimeout(t.h);t.h=setTimeout(()=>t.classList.remove('on'),6000)}

/* ---- Card de compartilhar (canvas 1080x1350) ---- */
const loadImg=(src,cors)=>new Promise(ok=>{if(!src)return ok(null);const i=new Image();if(cors)i.crossOrigin='anonymous';i.onload=()=>ok(i);i.onerror=()=>ok(null);i.src=src});
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
async function makeCard(){const b=bets.find(x=>x.id===me);if(!b)return null;
  try{await Promise.all(['400 88px Anton','700 24px Inter','400 20px Inter'].map(f=>document.fonts.load(f)))}catch(e){}
  const s=myStats(b),r=ranked(),pos=r.findIndex(x=>x.b.id===me)+1,g=medalsCached(b),pot=bets.length*(+cfg?.entry||10);
  const W=1080,H=1350,cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');
  let bg=c.createRadialGradient(540,240,40,540,240,1000);bg.addColorStop(0,'#5A0E13');bg.addColorStop(.5,'#1A0809');bg.addColorStop(1,'#0A0A0C');c.fillStyle=bg;c.fillRect(0,0,W,H);
  c.save();c.globalAlpha=.07;c.strokeStyle='#E3242B';c.lineWidth=4;for(let x=-H;x<W+H;x+=100){c.beginPath();c.moveTo(x,H);c.lineTo(x+H*0.62,0);c.stroke()}c.restore();
  // topo
  const logo=await loadImg('img/logo.png');c.save();c.translate(102,102);c.rotate(-6*Math.PI/180);c.shadowColor='rgba(227,36,43,.5)';c.shadowBlur=30;c.fillStyle='#E3242B';rr(c,-38,-38,76,76,20);c.fill();c.shadowBlur=0;
  if(logo){rr(c,-38,-38,76,76,20);c.clip();c.drawImage(logo,-38,-38,76,76)}else{c.fillStyle='#fff';c.font='36px Anton';c.textAlign='center';c.textBaseline='middle';c.fillText('RT',0,2)}c.restore();
  c.textBaseline='alphabetic';c.textAlign='left';c.font='44px Anton';c.fillStyle='#fff';c.fillText('REDONDO ',158,104);c.fillStyle='#E3242B';c.fillText('DOS TAZ',158+c.measureText('REDONDO ').width,104);
  c.font='20px Inter';c.fillStyle='#C9B9BA';c.fillText('Bolão do Major de Singapura 2026',158,134);
  const hm2=heroMatch(),stg=(hm2?.stage||'Major').split('·')[0].trim().toUpperCase();c.font='800 18px Inter';const sw=c.measureText(stg).width+32;c.fillStyle='#E3242B';rr(c,W-64-sw,82,sw,40,10);c.fill();c.fillStyle='#fff';c.fillText(stg,W-64-sw+16,108);
  // foto
  const cx=540,cy=342,R=150;let ring;try{ring=c.createConicGradient(3.5,cx,cy);ring.addColorStop(0,'#E3242B');ring.addColorStop(.3,'#FFB547');ring.addColorStop(.6,'#E3242B');ring.addColorStop(.8,'#6E0A10');ring.addColorStop(1,'#E3242B')}catch(e){ring='#E3242B'}
  c.fillStyle=ring;c.beginPath();c.arc(cx,cy,R+14,0,7);c.fill();c.fillStyle='#0A0A0C';c.beginPath();c.arc(cx,cy,R+6,0,7);c.fill();
  const av=b.avatar&&window.redondoAvatarUrl?await loadImg(window.redondoAvatarUrl(b.id,b.avatar),true):null;
  c.save();c.beginPath();c.arc(cx,cy,R,0,7);c.clip();if(av)c.drawImage(av,cx-R,cy-R,2*R,2*R);else{const ag=c.createLinearGradient(cx-R,cy-R,cx+R,cy+R);ag.addColorStop(0,'#7A1015');ag.addColorStop(1,'#2A0B0D');c.fillStyle=ag;c.fillRect(cx-R,cy-R,2*R,2*R);c.fillStyle='#fff';c.font='130px Anton';c.textAlign='center';c.textBaseline='middle';c.fillText(initials(nameOf(b)),cx,cy+6)}c.restore();
  c.fillStyle='#E3242B';c.strokeStyle='#0A0A0C';c.lineWidth=6;c.beginPath();c.arc(cx+122,cy+98,52,0,7);c.fill();c.stroke();c.fillStyle='#fff';c.font='44px Anton';c.textAlign='center';c.textBaseline='middle';c.fillText((pos||'—')+'º',cx+122,cy+100);
  // nome
  c.textBaseline='alphabetic';c.font='88px Anton';let nm=nameOf(b).toUpperCase();while(c.measureText(nm).width>940&&nm.length>3)nm=nm.slice(0,-1);c.fillStyle='#F5F2F2';c.fillText(nm,cx,cy+R+30+80);
  c.font='700 24px Inter';c.fillStyle='#FFB547';try{c.letterSpacing='3px'}catch(e){}c.fillText(pos===1&&s.pts>0?'LÍDER DO REDONDO':(pos?pos+'º LUGAR NO REDONDO':'NO REDONDO'),cx,cy+R+30+80+42);try{c.letterSpacing='0px'}catch(e){}
  // números
  const sy=696,bw=(W-128-42)/4,st=[[s.pts,'pontos','#E3242B'],[s.acc+'%','de acerto','#fff'],[s.best,'melhor sequência','#FFB547'],[s.ex,'placares exatos','#fff']];
  st.forEach(([v,l,col],i)=>{const x=64+i*(bw+14);c.fillStyle='rgba(0,0,0,.45)';rr(c,x,sy,bw,130,22);c.fill();c.strokeStyle='#3A2224';c.lineWidth=2;c.stroke();c.fillStyle=col;c.font='64px Anton';c.fillText(String(v),x+bw/2,sy+76);c.fillStyle='#C9B9BA';c.font='18px Inter';c.fillText(l,x+bw/2,sy+108)});
  // medalhas
  c.textAlign='left';c.font='30px Anton';c.fillStyle='#fff';c.fillText('MEDALHAS',64,900);const mw=c.measureText('MEDALHAS').width;c.font='20px Inter';c.fillStyle='#A39A9B';const ct=g.size+' de '+MEDALS.length;c.fillText(ct,64+mw+14,900);
  const lx=64+mw+28+c.measureText(ct).width,lg=c.createLinearGradient(lx,0,W-64,0);lg.addColorStop(0,'#E3242B');lg.addColorStop(1,'rgba(227,36,43,0)');c.fillStyle=lg;c.fillRect(lx,892,W-64-lx,2);
  const ord=[...MEDALS.filter(M=>g.has(M.k)),...MEDALS.filter(M=>!g.has(M.k))],cols=4,cw=(W-128)/cols;
  for(let i=0;i<ord.length;i++){const M=ord[i],col=i%cols,row=Math.floor(i/cols),x=64+col*cw+cw/2,y=930+row*160;
    const im=await loadImg('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(medalSVG(M.k,'k'+M.k,208,!g.has(M.k),M.n).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ')));if(im)c.drawImage(im,x-52,y,104,104);
    c.textAlign='center';c.font='18px Anton';c.fillStyle=g.has(M.k)?'#F5F2F2':'#5E5557';c.fillText(M.n,x,y+128)}
  // rodapé
  c.fillStyle='#3A2224';c.fillRect(64,1262,W-128,1);c.textAlign='left';c.font='20px Inter';c.fillStyle='#A39A9B';c.fillText('Em jogo: ',64,1304);c.font='700 20px Inter';c.fillStyle='#fff';c.fillText('R$ '+pot+' na skin',64+c.measureText('Em jogo: ').width+2,1304);
  c.textAlign='right';c.font='20px Inter';c.fillStyle='#A39A9B';c.fillText('Faça seu palpite no Redondo',W-64,1304);
  return new Promise(ok=>cv.toBlob(ok,'image/png'))}
let cardBlob=null;
$('#pfCard').addEventListener('click',async()=>{const btn=$('#pfCard');btn.disabled=true;btn.textContent='Gerando…';
  try{cardBlob=await makeCard();if(!cardBlob)throw new Error('sem dados');const u=URL.createObjectURL(cardBlob);$('#cardImg').src=u;$('#cardDl').href=u;
    const f=new File([cardBlob],'redondo-dos-taz.png',{type:'image/png'});$('#cardShare').hidden=!(navigator.canShare&&navigator.canShare({files:[f]}));$('#cardModal').hidden=false}
  catch(e){toast('Não deu para gerar o card.')}btn.disabled=false;btn.textContent='Gerar meu card'});
$('#cardShare').addEventListener('click',async()=>{try{await navigator.share({files:[new File([cardBlob],'redondo-dos-taz.png',{type:'image/png'})],text:'Meu Redondo dos Taz 🔥'})}catch(e){}});
$('#cardClose').addEventListener('click',()=>{$('#cardModal').hidden=true});
$('#cardModal').addEventListener('click',e=>{if(e.target.id==='cardModal')$('#cardModal').hidden=true});

function renderAll(){fillLiveCfg();show();renderStatus();renderUpcoming();renderRank();renderPast();renderAdmin();renderMe();renderProfile();renderMedals()}

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
  if(!db){$('#tkTrack').textContent='Falta configurar o Supabase (js/supabase-config.js).';loaded=true;renderAll();return}
  const t=setTimeout(()=>{if(!loaded)$('#tkTrack').textContent='Não consegui carregar o bolão ainda. Verifique a conexão.'},10000);
  db.doc('league/config').onSnapshot(s=>{cfg=s.exists?s.data():null;renderStatus()},()=>{});
  db.doc('league/logos').onSnapshot(s=>{LOGOS=s.exists?{...s.data()}:{};renderAll()},()=>{});
  db.collection('matches').onSnapshot(s=>{matches=s.docs.map(d=>({id:d.id,...d.data()}));if(!s.metadata.fromCache){loaded=true;clearTimeout(t)}renderAll()},()=>{loaded=true;clearTimeout(t);renderAll()});
  db.collection('picks').onSnapshot(s=>{bets=s.docs.map(d=>({id:d.id,...d.data()}));betsLoaded=true;if(!saving&&!timer)local=null;renderAll();loadProfiles()},()=>{});
})();
}
