export default async function handler(req, res) {
  const matchId = typeof req.query.match_id === "string" ? req.query.match_id :
    typeof req.query.ottelu === "string" ? req.query.ottelu : "953141";
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (!/^\d{1,12}$/.test(matchId)) return res.status(400).json({ error: "Virheellinen ottelun tunniste." });
  const headers = {
    "Accept": "json/zsn3anknxzcfzc23k53jqdcd4pymutsf",
    "Origin": "https://tulospalvelu.salibandy.fi",
    "Referer": "https://tulospalvelu.salibandy.fi/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155.0.0.0 Safari/537.36"
  };
  async function call(endpoint, params) {
    const u = new URL("https://salibandy-api.torneopal.net/taso/rest/" + endpoint);
    for (const [k,v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
    u.searchParams.set("timeStamp", String(Date.now()));
    const r = await fetch(u, { headers, cache: "no-store" });
    const body = await r.text();
    if (!r.ok || body.trimStart().startsWith("<")) throw new Error("TorneoPal-pyyntö epäonnistui (" + r.status + ").");
    const d = JSON.parse(body);
    if (d.call?.status && !["ok","OK"].includes(d.call.status)) throw new Error("TorneoPal: " + d.call.status);
    return d;
  }
  try {
    const md = await call("getMatch", { match_id: matchId });
    const m = md.match;
    if (!m) return res.status(502).json({ error: "Ottelutietoja ei löytynyt." });
    const competitionId = m.competition_id;
    const categoryId = m.category_id;
    const groupId = m.group_id;
    if (!competitionId || !categoryId) return res.status(502).json({ error: "Ottelun sarjatietoja ei löytynyt." });
    let gd = await call("getGroups", { competition_id: competitionId, category_id: categoryId, group_id: groupId });
    let groups = Array.isArray(gd.groups) ? gd.groups : [];
    let group = groups.find(g => String(g.group_id ?? "") === String(groupId ?? "")) || groups[0] || null;
    let teams = Array.isArray(group?.teams) ? group.teams : [];
    // Some TorneoPal configurations return groups without team standings; try category as a fallback.
    if (!teams.length) {
      const cd = await call("getCategory", { competition_id: competitionId, category_id: categoryId });
      const catGroups = Array.isArray(cd.category?.groups) ? cd.category.groups : [];
      const cg = catGroups.find(g => String(g.group_id ?? "") === String(groupId ?? "")) || catGroups[0];
      teams = Array.isArray(cg?.teams) ? cg.teams : [];
      if (!group && cg) group = cg;
    }
    return res.status(200).json({
      match: { match_id: matchId, competition_id: competitionId, competition_name: m.competition_name || "", category_id: categoryId, category_name: m.category_name || "", group_id: groupId || "", group_name: m.group_name || group?.group_name || "", team_A_id: m.team_A_id, team_B_id: m.team_B_id },
      teams,
      source: "TorneoPal"
    });
  } catch (e) {
    return res.status(502).json({ error: e?.message || "Sarjataulukon haku epäonnistui." });
  }
}
