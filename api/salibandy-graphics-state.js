// Separate remote visibility state for Salibandy overlays.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Control-Password");
  if (req.method === "OPTIONS") return res.status(204).end();
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const password = process.env.GRAPHICS_CONTROL_PASSWORD;
  if (!redisUrl || !redisToken || !password) return res.status(503).json({error:"Etäohjaus ei ole määritetty. Tarkista Upstash- ja GRAPHICS_CONTROL_PASSWORD-ympäristömuuttujat."});
  async function redis(command) {
    const response = await fetch(redisUrl.replace(/\/$/,"")+"/"+command.map(v=>encodeURIComponent(String(v))).join("/"),{headers:{Authorization:"Bearer "+redisToken},cache:"no-store"});
    const data=await response.json();
    if(!response.ok||data.error)throw new Error("Redis-virhe");
    return data.result;
  }
  const key="salibandy:graphics:visibility";
  const defaults={scorebug:true,lowerthird:false,stats:false,lineups:false,events:false,scorers:false,updatedAt:null};
  try {
    if(req.method==="GET"){
      const raw=await redis(["GET",key]);let state={...defaults};
      if(raw){try{state={...state,...JSON.parse(raw)}}catch{}}
      return res.status(200).json(state);
    }
    if(req.method!=="POST")return res.status(405).json({error:"Käytä GET- tai POST-pyyntöä."});
    let body=typeof req.body==="string"?JSON.parse(req.body):(req.body||{});
    const supplied=req.headers["x-control-password"]||(body&&body.password);
    if(typeof supplied!=="string"||supplied!==password)return res.status(401).json({error:"Väärä ohjaussalasana."});
    const raw=await redis(["GET",key]);let current={...defaults};
    if(raw){try{current={...current,...JSON.parse(raw)}}catch{}}
    const next={scorebug:typeof body.scorebug==="boolean"?body.scorebug:!!current.scorebug,lowerthird:typeof body.lowerthird==="boolean"?body.lowerthird:!!current.lowerthird,stats:typeof body.stats==="boolean"?body.stats:!!current.stats,lineups:typeof body.lineups==="boolean"?body.lineups:!!current.lineups,events:typeof body.events==="boolean"?body.events:!!current.events,scorers:typeof body.scorers==="boolean"?body.scorers:!!current.scorers,updatedAt:new Date().toISOString()};
    await redis(["SET",key,JSON.stringify(next)]);
    return res.status(200).json(next);
  } catch { return res.status(502).json({error:"Yhteys salibandyn ohjaustilan tallennukseen epäonnistui."}); }
}
