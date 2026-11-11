export default async function handler(req, res) {
  const turnaus = typeof req.query.turnaus === "string" ? req.query.turnaus : "sjpl_2627";
  const sarja = typeof req.query.sarja === "string" ? req.query.sarja : "MBL";
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(turnaus) || !/^[a-zA-Z0-9_-]{1,40}$/.test(sarja)) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(400).send("Virheellinen turnaus- tai sarjatunnus.");
  }
  const origin = "https://finbandy.torneopal.fi";
  const target = new URL("/taso/sarja.php", origin);
  target.searchParams.set("turnaus", turnaus);
  target.searchParams.set("sarja", sarja);
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fi-FI,fi;q=0.9,en;q=0.8",
    "Referer": origin + "/taso/"
  };
  const cookies = new Map();
  function saveCookies(response) {
    let setCookies = [];
    try {
      if (typeof response.headers.getSetCookie === "function") setCookies = response.headers.getSetCookie();
      else { const one = response.headers.get("set-cookie"); if (one) setCookies = one.split(/,(?=\s*[^;,\s]+=)/g); }
    } catch {}
    for (const item of setCookies) { const pair = String(item).split(";", 1)[0]; const eq = pair.indexOf("="); if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim()); }
  }
  const cookieHeader = () => [...cookies.entries()].map(([k,v]) => `${k}=${v}`).join("; ");
  async function get(url) {
    let current = new URL(url);
    for (let i=0; i<6; i++) {
      if (current.hostname !== "finbandy.torneopal.fi") throw new Error("TorneoPal ohjasi odottamattomaan osoitteeseen.");
      const h = {...headers}; const cookie = cookieHeader(); if (cookie) h.Cookie = cookie;
      const response = await fetch(current, {headers:h, cache:"no-store", redirect:"manual"}); saveCookies(response);
      if ([301,302,303,307,308].includes(response.status)) { const loc=response.headers.get("location"); if (!loc) return {response,body:await response.text(),url:current}; current=new URL(loc,current); continue; }
      return {response,body:await response.text(),url:current};
    }
    throw new Error("TorneoPalin uudelleenohjauksia oli liikaa.");
  }
  function jsRedirect(body, baseUrl) {
    let encoded=""; const direct=body.match(/(?:window\.)?location\.replace\s*\(\s*atob\s*\(\s*["']([^"']+)["']\s*\)\s*\)/i); if(direct) encoded=direct[1];
    if(!encoded){const call=body.match(/(?:window\.)?location\.replace\s*\(\s*atob\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\)/i);if(call){const name=call[1].replace(/[.*+?^${}()|[\]\\]/g,"\\$&");const a=body.match(new RegExp("(?:^|[;\\s])(?:var\\s+|let\\s+|const\\s+)?"+name+"\\s*=\\s*['\\\"]([^'\\\"]+)['\\\"]","m"));if(a)encoded=a[1];}}
    if(!encoded)return null; try {const decoded=Buffer.from(encoded,"base64").toString("utf8");const next=new URL(decoded,baseUrl);return next.hostname==="finbandy.torneopal.fi"&&next.pathname.startsWith("/taso/")?next:null;}catch{return null;}
  }
  try {
    await get(new URL("/taso/",origin)); let result=await get(target); let body=result.body; let upstream=result.response;
    for(let attempt=0;attempt<2 && !/<table\b/i.test(body);attempt++){const next=jsRedirect(body,result.url||target);if(next)result=await get(next);else if(attempt===0)result=await get(target);else break;body=result.body;upstream=result.response;}
    res.setHeader("Access-Control-Allow-Origin","*"); res.setHeader("Cache-Control","no-store, max-age=0"); res.setHeader("Content-Type","text/html; charset=utf-8");
    res.setHeader("X-BandyLive-TorneoPal-Status",String(upstream.status)); res.setHeader("X-BandyLive-Standings-Table",/<table\b/i.test(body)?"found":"not-found");
    return res.status(upstream.status).send(body);
  } catch(error) { res.setHeader("Content-Type","text/plain; charset=utf-8"); return res.status(502).send("TorneoPal-sarjataulukon haku epäonnistui: "+(error?.message||"tuntematon virhe")); }
}
