/* Liga a página ao Supabase (login com e-mail e senha + banco de dados).
   Expõe window.claude.use("user") e window.claude.use("db") com a interface que o app usa. */
(function(){
  const url = window.SUPABASE_URL, key = window.SUPABASE_KEY;
  const ready = url && key && !String(url).includes('COLE_AQUI') && window.supabase;
  const sb = ready ? window.supabase.createClient(url, key) : null;
  const admins = (window.ADMIN_EMAILS || []).map(e => String(e).toLowerCase());

  /* ---------- Tela de login ---------- */
  function gate(msg){
    let el = document.getElementById('fbGate');
    if(!el){
      el = document.createElement('div'); el.id = 'fbGate';
      el.innerHTML = '<form class="fbbox" id="sbForm"><h2 class="brand">Redondo <b>dos Taz</b></h2>'+
        '<p class="note" id="sbMsg"></p>'+
        '<div id="sbFields"><input id="sbEmail" type="email" placeholder="E-mail" autocomplete="email" required>'+
        '<input id="sbPass" type="password" placeholder="Senha (mín. 6 caracteres)" autocomplete="current-password" minlength="6" required>'+
        '<button class="btn pri" type="submit" id="sbIn">Entrar</button>'+
        '<button class="btn" type="button" id="sbUp">Criar conta</button></div></form>';
      document.body.appendChild(el);
      const say = t => { document.getElementById('sbMsg').textContent = t; };
      const tr = e => { const m = String(e && e.message || e);
        if(/Invalid login/i.test(m)) return 'E-mail ou senha incorretos.';
        if(/already registered/i.test(m)) return 'Esse e-mail já tem conta. Use Entrar.';
        if(/Email not confirmed/i.test(m)) return 'Confirmação de e-mail ligada no Supabase. Peça ao organizador para desligar.';
        if(/at least 6/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
        return 'Erro: ' + m; };
      const creds = () => ({email: document.getElementById('sbEmail').value.trim(), password: document.getElementById('sbPass').value});
      document.getElementById('sbForm').addEventListener('submit', async e => { e.preventDefault(); say('Entrando…');
        const {error} = await sb.auth.signInWithPassword(creds()); if(error) say(tr(error)); });
      document.getElementById('sbUp').addEventListener('click', async () => { const c = creds();
        if(!c.email || c.password.length < 6){ say('Preencha e-mail e uma senha de pelo menos 6 caracteres.'); return; }
        say('Criando conta…'); const {data, error} = await sb.auth.signUp(c);
        if(error) say(tr(error)); else if(!data.session) say('Conta criada, mas o Supabase pediu confirmação por e-mail. Peça ao organizador para desligar "Confirm email".'); });
    }
    document.getElementById('sbMsg').textContent = msg;
    document.getElementById('sbFields').hidden = !ready;
  }
  const ungate = () => { const el = document.getElementById('fbGate'); if(el) el.remove(); };

  let user = null;
  const signedIn = new Promise(resolve => {
    if(!ready){ document.addEventListener('DOMContentLoaded', () => gate('Falta configurar o Supabase em js/supabase-config.js.')); return; }
    const done = s => { if(s && s.user){ user = s.user; ungate(); addLogout(); resolve(s.user); } else gate('Entre com seu e-mail e senha. Primeira vez? Preencha e toque em Criar conta.'); };
    sb.auth.getSession().then(({data}) => done(data.session));
    sb.auth.onAuthStateChange((ev, s) => { if(ev === 'SIGNED_OUT') location.reload(); else if(s && !user) done(s); });
  });
  function addLogout(){
    if(document.getElementById('sbOut')) return;
    const add = () => { const nav = document.getElementById('tabs'); if(!nav) return;
      const b = document.createElement('button'); b.className = 'tab'; b.id = 'sbOut'; b.textContent = 'Sair';
      b.addEventListener('click', e => { e.stopPropagation(); sb.auth.signOut(); }); nav.appendChild(b); };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', add) : add();
  }

  /* ---------- Banco de dados (tabela docs: col, id, data) ---------- */
  const errOf = e => ({ code: (e && (e.code === '42501' || e.code === 'P0001' || /row-level security/i.test(e.message||''))) ? 'invalid_argument' : 'unavailable', message: String(e && e.message || e) });
  const listeners = {};           // col -> Set(callback)
  const cache = {};               // col -> rows
  async function refresh(col){
    const {data, error} = await sb.from('docs').select('id,data').eq('col', col);
    if(error){ (listeners[col]||[]).forEach(l => l.err && l.err(errOf(error))); return; }
    cache[col] = data;
    (listeners[col]||[]).forEach(l => l.cb(data));
  }
  const channels = {};
  function listen(col, cb, err){
    (listeners[col] = listeners[col] || new Set());
    const l = {cb, err}; listeners[col].add(l);
    if(!channels[col]){
      channels[col] = sb.channel('docs-' + col)
        .on('postgres_changes', {event:'*', schema:'public', table:'docs', filter:'col=eq.' + col}, () => refresh(col))
        .subscribe();
      setInterval(() => refresh(col), 30000);   // garantia caso o tempo real caia
    }
    if(cache[col]) cb(cache[col]); refresh(col);
    return () => listeners[col].delete(l);
  }
  const meta = {fromCache:false, hasPendingWrites:false};
  const snapOf = (id, row) => ({ id, exists: !!row, data: () => row ? row.data : undefined, metadata: meta });
  const split = path => { const i = path.indexOf('/'); return [path.slice(0, i), path.slice(i + 1)]; };
  async function write(col, id, data){
    const {error} = await sb.from('docs').upsert({col, id, data, updated_at: new Date().toISOString()});
    if(error) throw errOf(error);
    await refresh(col);
  }

  const dbApi = {
    doc: path => { const [col, id] = split(path); return {
      id, path,
      get: async () => { const {data} = await sb.from('docs').select('id,data').eq('col', col).eq('id', id).maybeSingle(); return snapOf(id, data); },
      set: d => write(col, id, d),
      update: async d => { const {data, error} = await sb.from('docs').select('data').eq('col', col).eq('id', id).maybeSingle();
        if(error) throw errOf(error); if(!data) throw {code:'invalid_argument', message:'documento não existe'};
        return write(col, id, {...data.data, ...d}); },
      delete: async () => { const {error} = await sb.from('docs').delete().eq('col', col).eq('id', id); if(error) throw errOf(error); await refresh(col); },
      onSnapshot: (next, err) => listen(col, rows => next(snapOf(id, rows.find(r => r.id === id))), err)
    }; },
    collection: col => ({
      path: col,
      get: async () => { await refresh(col); const rows = cache[col] || []; return {docs: rows.map(r => snapOf(r.id, r)), size: rows.length, empty: !rows.length}; },
      onSnapshot: (next, err) => listen(col, rows => next({docs: rows.map(r => snapOf(r.id, r)), size: rows.length, empty: !rows.length, metadata: meta}), err)
    })
  };

  /* Logos (Supabase Storage, bucket "logos") e lista de admins */
  window.redondoLogoUrl = (slug, ver) => url + '/storage/v1/object/public/logos/' + encodeURIComponent(slug) + '.png?v=' + encodeURIComponent(ver);
  window.redondoUpload = async (slug, blob) => { const {error} = await sb.storage.from('logos').upload(slug + '.png', blob, {upsert:true, contentType:'image/png', cacheControl:'60'}); if(error) throw error; };
  window.redondoRemoveLogo = async slug => { const {error} = await sb.storage.from('logos').remove([slug + '.png']); if(error) throw error; };
  window.redondoAdmins = {
    list: async () => { const {data, error} = await sb.from('admins').select('email').order('email'); if(error) throw error; return data.map(r => r.email); },
    add: async email => { const {error} = await sb.from('admins').insert({email: String(email).toLowerCase()}); if(error) throw error; },
    remove: async email => { const {error} = await sb.from('admins').delete().eq('email', email); if(error) throw error; }
  };

  window.claude = {
    use: async name => {
      if(!ready) return null;
      const u = await signedIn;
      if(name === 'db') return dbApi;
      if(name === 'user') return {
        id: async () => u.id,
        isOwner: async () => { const {data, error} = await sb.rpc('is_admin'); return error ? admins.includes(String(u.email || '').toLowerCase()) : !!data; },
        can: async () => true,
        profiles: async ids => Object.fromEntries(ids.map(id => [id, {name: ''}]))
      };
      return null;
    }
  };
})();
