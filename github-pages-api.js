/* GitHub Pages compatibility layer for Salibandy-TV.
   Uses browser-local settings and direct TorneoPal requests (requires TorneoPal CORS support). */
(() => {
  'use strict';
  const nativeFetch = window.fetch.bind(window);
  const API = 'https://salibandy-api.torneopal.net/taso/rest/';
  const ACCEPT = 'json/zsn3anknxzcfzc23k53jqdcd4pymutsf';
  const HASH_SEED = 'ysnyp4h6e9egetkc3s3v';
  async function sha256Hex(value) {
    if (!globalThis.crypto?.subtle) throw new Error('SHA-256 ei ole käytettävissä. Avaa sivu HTTPS-yhteydellä.');
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  }
  const DEFAULTS = {scorebug:true,lowerthird:false,breaktime:false,stats:false,lineups:false,lines:false,events:false,scorers:false,form:false,updatedAt:null};
  const getStore = (k, fallback) => { try { const v=localStorage.getItem(k); return v===null?fallback:JSON.parse(v); } catch { return fallback; } };
  const setStore = (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} };
  function response(data, status=200) { return new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}}); }
  async function call(endpoint, params={}) {
    const u=new URL(endpoint,API);
    const hashParams = [];
    Object.entries(params).forEach(([k,v])=>{
      if(v!==undefined&&v!==null&&v!==''){
        const value=String(v);
        u.searchParams.set(k,value);
        hashParams.push([k,value]);
      }
    });
    const timeStamp=String(Date.now());
    u.searchParams.set('timeStamp',timeStamp);
    hashParams.push(['timeStamp',timeStamp]);

    // TorneoPal SHA-256: method?seed&param=value... (parameter insertion order).
    // The hash is calculated before adding the hash parameter itself.
    let hashInput=endpoint+'?'+HASH_SEED;
    for(const [key,value] of hashParams) hashInput+='&'+key+'='+value;
    const hash=await sha256Hex(hashInput);
    u.searchParams.set('hash',hash);

    let r;
    try { r=await nativeFetch(u.toString(),{headers:{Accept:ACCEPT},cache:'no-store'}); }
    catch(e) { throw new Error('TorneoPal-haku estyi selaimen CORS-rajoitukseen tai verkkovirheeseen. GitHub Pages ei voi ohittaa tätä. '+(e?.message||'')); }
    const body=await r.text();
    if(!r.ok||body.trimStart().startsWith('<')) throw new Error('TorneoPal-pyyntö epäonnistui ('+r.status+').');
    let d; try{d=JSON.parse(body)}catch{throw new Error('TorneoPal ei palauttanut kelvollista JSON-dataa.');}
    if(d.call?.status&&!['ok','OK'].includes(d.call.status)) throw new Error('TorneoPal: '+d.call.status);
    return d;
  }
  const num=v=>{if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
  const first=(o,keys)=>{for(const k of keys)if(o?.[k]!==undefined&&o[k]!==null&&o[k]!=='')return o[k];return '';};
  const completed=m=>{const s=String(m.status||'').trim().toLowerCase();if(['played','finished','over','complete','completed','closed','loppunut','pelattu'].includes(s))return true;const pending=['fixture','scheduled','planned','live','break','cancelled','canceled','postponed','ongoing','keskeytetty'];return !pending.includes(s)&&num(first(m,['fs_A','final_A','score_A']))!==null&&num(first(m,['fs_B','final_B','score_B']))!==null;};
  async function standings(matchId){
    const d=await call('getMatch',{match_id:matchId}),m=d.match;if(!m)throw Error('Ottelutietoja ei löytynyt.');
    if(!m.competition_id||!m.category_id)throw Error('Ottelun sarjatietoja ei löytynyt.');
    let gd=await call('getGroups',{competition_id:m.competition_id,category_id:m.category_id,group_id:m.group_id});
    let groups=Array.isArray(gd.groups)?gd.groups:[];let g=groups.find(x=>String(x.group_id??'')===String(m.group_id??''))||groups[0]||null;let teams=Array.isArray(g?.teams)?g.teams:[];
    if(!teams.length){const cd=await call('getCategory',{competition_id:m.competition_id,category_id:m.category_id});const gs=Array.isArray(cd.category?.groups)?cd.category.groups:[];const cg=gs.find(x=>String(x.group_id??'')===String(m.group_id??''))||gs[0];teams=Array.isArray(cg?.teams)?cg.teams:[];if(!g&&cg)g=cg;}
    return {match:{match_id:matchId,competition_id:m.competition_id,competition_name:m.competition_name||'',category_id:m.category_id,category_name:m.category_name||'',group_id:m.group_id||'',group_name:m.group_name||g?.group_name||'',team_A_id:m.team_A_id,team_B_id:m.team_B_id},teams,source:'TorneoPal'};
  }
  async function form(matchId){
    const d=await call('getMatch',{match_id:matchId}),m=d.match;if(!m)throw Error('Ottelutietoja ei löytynyt.');
    const competitionId=m.competition_id,categoryId=m.category_id;
    const teams=[{side:'a',id:String(m.team_A_id||''),name:m.team_A_name||m.club_A_name||'KOTI',logo:m.club_A_crest||m.team_A_crest||''},{side:'b',id:String(m.team_B_id||''),name:m.team_B_name||m.club_B_name||'VIERAS',logo:m.club_B_crest||m.team_B_crest||''}];
    if(!competitionId||!categoryId||!teams[0].id||!teams[1].id)throw Error('Ottelun sarja- tai joukkuetietoja ei löytynyt.');
    async function recent(t){const x=await call('getMatches',{competition_id:competitionId,category_id:categoryId,team_id:t.id});const unique=new Map();for(const it of (Array.isArray(x.matches)?x.matches:[])){const id=String(it.match_id||'');if(!id||!completed(it))continue;const a=String(it.team_A_id||''),b=String(it.team_B_id||'');if(a!==t.id&&b!==t.id)continue;const sa=num(first(it,['fs_A','final_A','score_A'])),sb=num(first(it,['fs_B','final_B','score_B']));if(sa===null||sb===null)continue;const isA=a===t.id,gf=isA?sa:sb,ga=isA?sb:sa;unique.set(id,{match_id:id,date:it.date||'',time:it.time||'',opponent:isA?(it.team_B_name||it.club_B_name||'Vastustaja'):(it.team_A_name||it.club_A_name||'Vastustaja'),goals_for:gf,goals_against:ga,outcome:gf>ga?'V':gf<ga?'H':'T'});}return [...unique.values()].sort((a,b)=>(b.date+' '+b.time).localeCompare(a.date+' '+a.time)).slice(0,5);}
    async function scorers(t){const x=await call('getCategory',{competition_id:competitionId,category_id:categoryId,player_statistics_team_id:t.id,lang:'fi'});const c=x.category||{};const list=Array.isArray(x.player_statistics)?x.player_statistics:Array.isArray(c.player_statistics)?c.player_statistics:Array.isArray(x.statistics)?x.statistics:[];const players=list.filter(p=>{const id=String(p.team_id||p.player_team_id||'');return !id||id===t.id;}).map(p=>{const goals=num(first(p,['goals','player_goals','total_goals']))??0,assists=num(first(p,['assists','player_assists','total_assists']))??0,points=num(first(p,['points','total_points','player_points','pts']));return {player_id:String(p.player_id||''),player_name:first(p,['player_name','name'])||[p.first_name,p.last_name].filter(Boolean).join(' ')||'Tuntematon pelaaja',goals,assists,points:points!==null?points:goals+assists};}).filter(p=>p.points>0||p.goals>0||p.assists>0);const u=new Map();for(const p of players){const k=p.player_id||p.player_name;if(!u.has(k)||u.get(k).points<p.points)u.set(k,p);}return [...u.values()].sort((a,b)=>b.points-a.points||b.goals-a.goals||b.assists-a.assists||a.player_name.localeCompare(b.player_name,'fi')).slice(0,5);}
    const results=await Promise.all(teams.map(async t=>{const [r,s]=await Promise.allSettled([recent(t),scorers(t)]);return {...t,recent_matches:r.status==='fulfilled'?r.value:[],top_scorers:s.status==='fulfilled'?s.value:[],matches_error:r.status==='rejected'?(r.reason?.message||'Viime otteluiden haku epäonnistui.'):'',scorers_error:s.status==='rejected'?(s.reason?.message||'Pistetietojen haku epäonnistui.'):''};}));
    return {call:{status:'ok'},selected_match_id:matchId,competition_name:m.category_name||m.competition_name||'Salibandy',category_name:m.category_name||'',group_name:m.group_name||'',teams:{a:results[0],b:results[1]},updated_at:new Date().toISOString()};
  }
  window.fetch = async function(input, init={}) {
    const raw=typeof input==='string'?input:(input?.url||String(input));
    let u;try{u=new URL(raw,location.href)}catch{return nativeFetch(input,init)}
    const match= u.pathname.match(/\/api\/(salibandy-[a-z-]+)/);if(!match)return nativeFetch(input,init);
    const route=match[1], method=(init.method||input?.method||'GET').toUpperCase();
    const q=u.searchParams, matchId=q.get('match_id')||q.get('ottelu')||'953141';
    try {
      if(route==='salibandy-default-match'){
        if(method==='POST'){let b={};try{b=JSON.parse(init.body||'{}')}catch{};const id=String(b.match_id||'').trim();if(!/^\d{1,12}$/.test(id))return response({error:'Virheellinen ottelun tunniste.'},400);setStore('salibandy-gh-pages-default-match',{match_id:id});return response({match_id:id,local_only:true});}
        return response(getStore('salibandy-gh-pages-default-match',{match_id:'953141'}));
      }
      if(route==='salibandy-graphics-state'){
        if(method==='POST'){let b={};try{b=JSON.parse(init.body||'{}')}catch{};const old=getStore('salibandy-gh-pages-graphics-state',DEFAULTS);const next={...old,...b,updatedAt:new Date().toISOString()};setStore('salibandy-gh-pages-graphics-state',next);return response(next);}
        return response({...DEFAULTS,...getStore('salibandy-gh-pages-graphics-state',{})});
      }
      if(route==='salibandy-match')return response(await call('getMatch',{match_id:matchId}));
      if(route==='salibandy-score')return response(await call('getScore',{match_id:matchId}));
      if(route==='salibandy-standings')return response(await standings(matchId));
      if(route==='salibandy-form')return response(await form(matchId));
      return response({error:'Tätä API-reittiä ei tueta GitHub Pages -versiossa.'},501);
    } catch(e){return response({error:e?.message||'Tietojen haku epäonnistui.'},502);}
  };
})();
