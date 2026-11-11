// Shared graphics visibility state for the TorneoPal overlays.
// Configure Vercel environment variables:
// UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, GRAPHICS_CONTROL_PASSWORD
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const password = process.env.GRAPHICS_CONTROL_PASSWORD;
  if (!redisUrl || !redisToken || !password) {
    return res.status(503).json({
      error: "Ohjaus ei ole vielä määritetty. Lisää Verceliin UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN ja GRAPHICS_CONTROL_PASSWORD."
    });
  }

  async function redis(command) {
    const response = await fetch(redisUrl.replace(/\/$/, "") + "/" + command.map(v => encodeURIComponent(String(v))).join("/"), {
      headers: { Authorization: "Bearer " + redisToken },
      cache: "no-store"
    });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error("Tallennuspalvelun virhe");
    return data.result;
  }

  try {
    if (req.method === "GET") {
      const raw = await redis(["GET", "torneopal:graphics:visibility"]);
      let state = { scorebug: true, lowerthird: false, stats: false, lineups: false, updatedAt: null };
      if (raw) {
        try { state = { ...state, ...JSON.parse(raw) }; } catch {}
      }
      return res.status(200).json(state);
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Käytä GET- tai POST-pyyntöä." });

    const supplied = req.headers["x-control-password"] || (req.body && req.body.password);
    if (typeof supplied !== "string" || supplied !== password) {
      return res.status(401).json({ error: "Väärä ohjaussalasana." });
    }
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const currentRaw = await redis(["GET", "torneopal:graphics:visibility"]);
    let current = { scorebug: true, lowerthird: false, stats: false, lineups: false };
    if (currentRaw) { try { current = { ...current, ...JSON.parse(currentRaw) }; } catch {} }
    const next = {
      scorebug: typeof body.scorebug === "boolean" ? body.scorebug : !!current.scorebug,
      lowerthird: typeof body.lowerthird === "boolean" ? body.lowerthird : !!current.lowerthird,
      stats: typeof body.stats === "boolean" ? body.stats : !!current.stats,
      lineups: typeof body.lineups === "boolean" ? body.lineups : !!current.lineups,
      updatedAt: new Date().toISOString()
    };
    await redis(["SET", "torneopal:graphics:visibility", JSON.stringify(next)]);
    return res.status(200).json(next);
  } catch (error) {
    return res.status(502).json({ error: "Yhteys ohjaustilan tallennukseen epäonnistui." });
  }
}
