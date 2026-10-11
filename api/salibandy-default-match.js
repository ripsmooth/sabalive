// Shared default match ID stored as a JSON file in the GitHub repository.
// Required Vercel environment variables: GITHUB_TOKEN, GITHUB_REPOSITORY (owner/repo),
// DEFAULT_MATCH_CONTROL_PASSWORD.
export default async function handler(req,res){
 res.setHeader("Cache-Control","no-store, no-cache, must-revalidate");
 res.setHeader("Access-Control-Allow-Origin","*");
 res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
 res.setHeader("Access-Control-Allow-Headers","Content-Type, X-Control-Password");
 if(req.method==="OPTIONS") return res.status(204).end();
 if(!["GET","POST"].includes(req.method)) return res.status(405).json({error:"Käytä GET- tai POST-pyyntöä."});
 const token=process.env.GITHUB_TOKEN, repo=process.env.GITHUB_REPOSITORY, password=process.env.DEFAULT_MATCH_CONTROL_PASSWORD;
 if(!token||!repo||!password) return res.status(503).json({error:"Oletusottelun palvelintallennus ei ole määritetty. Lisää Vercelin ympäristömuuttujat GITHUB_TOKEN, GITHUB_REPOSITORY ja DEFAULT_MATCH_CONTROL_PASSWORD."});
 const path="config/salibandy-default-match.json", api=`https://api.github.com/repos/${repo}/contents/${path}`;
 const headers={Authorization:`Bearer ${token}`,"X-GitHub-Api-Version":"2022-11-28",Accept:"application/vnd.github+json","Content-Type":"application/json"};
 try{
  const read=async()=>{const r=await fetch(api,{headers,cache:"no-store"});if(r.status===404)return {match_id:"953141",sha:null};if(!r.ok)throw Error("GitHub-tallennuksen lukeminen epäonnistui.");const d=await r.json();let data={};try{data=JSON.parse(atob((d.content||"").replace(/\n/g,"")))}catch{}return {match_id:String(data.match_id||"953141"),sha:d.sha};};
  if(req.method==="GET"){const v=await read();return res.status(200).json({match_id:v.match_id});}
  let body=typeof req.body==="string"?JSON.parse(req.body):(req.body||{});
  const supplied=req.headers["x-control-password"]||body.password;
  if(typeof supplied!=="string"||supplied!==password)return res.status(401).json({error:"Väärä ohjaussalasana."});
  const match_id=String(body.match_id||"").trim();
  if(!/^[A-Za-z0-9_-]{1,80}$/.test(match_id))return res.status(400).json({error:"Anna kelvollinen ottelun ID."});
  const old=await read(), content=JSON.stringify({match_id,updated_at:new Date().toISOString()},null,2);
  const encoded=btoa(content);
  const payload={message:`Set Salibandy TV default match to ${match_id}`,content:encoded};
  if(old.sha)payload.sha=old.sha;
  const wr=await fetch(api,{method:"PUT",headers,body:JSON.stringify(payload)});
  if(!wr.ok){const e=await wr.json().catch(()=>({}));throw Error(e.message||"GitHub ei hyväksynyt tallennusta.");}
  return res.status(200).json({match_id});
 }catch(e){return res.status(502).json({error:e.message||"Oletusottelun tallennus epäonnistui."});}
}
