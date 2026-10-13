export default async function handler(req, res) {
  const matchId =
    typeof req.query.match_id === "string"
      ? req.query.match_id
      : typeof req.query.ottelu === "string"
        ? req.query.ottelu
        : "953141";

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (!/^\d{1,12}$/.test(matchId)) {
    return res.status(400).json({ error: "Virheellinen ottelun tunniste." });
  }

  const target = new URL("https://salibandy-api.torneopal.net/taso/rest/getScore");
  target.searchParams.set("match_id", matchId);

  const startedAt = Date.now();
  try {
    const upstream = await fetch(target, {
      headers: {
        "Accept": "json/zsn3anknxzcfzc23k53jqdcd4pymutsf",
        "Origin": "https://tulospalvelu.salibandy.fi",
        "Referer": "https://tulospalvelu.salibandy.fi/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155.0.0.0 Safari/537.36"
      },
      cache: "no-store"
    });

    const body = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "";
    const elapsedMs = Date.now() - startedAt;

    if (!upstream.ok) {
      return res.status(502).json({
        error: "TorneoPalin getScore-pyyntö epäonnistui.",
        upstreamStatus: upstream.status,
        elapsedMs
      });
    }
    if (contentType.includes("text/html") || body.trimStart().startsWith("<!")) {
      return res.status(502).json({
        error: "TorneoPal palautti HTML-sivun JSON-datan sijaan. Palvelinpyyntö on mahdollisesti estetty.",
        elapsedMs
      });
    }

    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return res.status(502).json({ error: "TorneoPal ei palauttanut kelvollista getScore-JSON-dataa.", elapsedMs });
    }

    if (!data.score || data.call?.status !== "ok") {
      return res.status(502).json({
        error: "TorneoPalin getScore-vastauksesta puuttuu tulostieto.",
        detail: data.call?.status || "tuntematon vastaus",
        elapsedMs
      });
    }

    return res.status(200).json({ ...data, _sabalive: { elapsedMs, fetchedAt: new Date().toISOString() } });
  } catch {
    return res.status(502).json({ error: "Salibandyn TorneoPal getScore-yhteys epäonnistui." });
  }
}
