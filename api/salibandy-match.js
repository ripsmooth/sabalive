export default async function handler(req, res) {
  const matchId = typeof req.query.match_id === "string"
    ? req.query.match_id
    : (typeof req.query.ottelu === "string" ? req.query.ottelu : "953141");
  if (!/^\d{1,12}$/.test(matchId)) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(400).json({ error: "Virheellinen ottelun tunniste." });
  }
  const target = new URL("https://salibandy-api.torneopal.net/taso/rest/getMatch");
  target.searchParams.set("match_id", matchId);
  target.searchParams.set("timeStamp", String(Date.now()));
  try {
    const upstream = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SalibandyTVOverlay/1.0)",
        "Accept": "application/json,text/plain,*/*",
        "Referer": "https://tulospalvelu.salibandy.fi/"
      },
      cache: "no-store"
    });
    const body = await upstream.text();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    if (!upstream.ok) return res.status(upstream.status).send(body);
    try {
      const data = JSON.parse(body);
      if (!data.match || data.call?.status !== "ok") {
        return res.status(502).json({ error: "TorneoPalin vastauksesta puuttuu ottelutieto.", detail: data.call?.status || "tuntematon vastaus" });
      }
      return res.status(200).json(data);
    } catch {
      return res.status(502).json({ error: "TorneoPal ei palauttanut kelvollista JSON-dataa." });
    }
  } catch {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(502).json({ error: "Salibandyn TorneoPal-yhteys epäonnistui." });
  }
}
