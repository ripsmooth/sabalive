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

    // getScore's documented response example contains a top-level `score`
    // object without necessarily including a `call.status` wrapper. Only reject
    // an explicit upstream error; absence of `call` is not itself an error.
    if (data.call?.status && data.call.status !== "ok") {
      return res.status(502).json({
        error: "TorneoPal ilmoitti getScore-kutsun epäonnistuneen.",
        detail: data.call.status,
        rootKeys: Object.keys(data).slice(0, 30),
        responsePreview: JSON.stringify(data).slice(0, 1200),
        elapsedMs
      });
    }

    // The documented response is { score: { ... } }. Some deployments or
    // proxy layers may return the score fields directly, so accept that form
    // only when recognizable score fields are actually present.
    const score = data.score && typeof data.score === "object"
      ? data.score
      : (Object.prototype.hasOwnProperty.call(data, "live_A") ||
         Object.prototype.hasOwnProperty.call(data, "live_B") ||
         Object.prototype.hasOwnProperty.call(data, "fs_A") ||
         Object.prototype.hasOwnProperty.call(data, "fs_B"))
        ? data
        : null;

    if (!score) {
      return res.status(502).json({
        error: "TorneoPalin getScore-vastauksesta ei löytynyt score-oliota eikä tunnistettavia tuloskenttiä.",
        detail: data.call?.status || "vastausrakenne poikkeaa odotetusta",
        rootKeys: Object.keys(data).slice(0, 30),
        responsePreview: JSON.stringify(data).slice(0, 1200),
        elapsedMs
      });
    }

    const normalized = data.score && typeof data.score === "object"
      ? data
      : { score, call: data.call || { method: "getScore", status: "ok" } };

    return res.status(200).json({ ...normalized, _sabalive: { elapsedMs, fetchedAt: new Date().toISOString() } });
  } catch {
    return res.status(502).json({ error: "Salibandyn TorneoPal getScore-yhteys epäonnistui." });
  }
}
