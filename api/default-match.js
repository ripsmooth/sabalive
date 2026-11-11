export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-control-password");
  if (req.method === "OPTIONS") return res.status(204).end();

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const password = process.env.GRAPHICS_CONTROL_PASSWORD;
  if (!redisUrl || !redisToken || !password) {
    return res.status(503).json({ error: "Oletusottelun tallennus ei ole määritetty. Lisää Verceliin UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN ja GRAPHICS_CONTROL_PASSWORD." });
  }
  async function redis(command) {
    const response = await fetch(redisUrl.replace(/\/$/, "") + "/" + command.map(v => encodeURIComponent(String(v))).join("/"), {
      headers: { Authorization: "Bearer " + redisToken }, cache: "no-store"
    });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error("Tallennuspalvelun virhe");
    return data.result;
  }
  try {
    if (req.method === "GET") {
      const raw = await redis(["GET", "torneopal:graphics:default-match"]);
      if (!raw) return res.status(200).json({ ottelu: "", pvm: "", turnaus: "sjpl_2627", updatedAt: null });
      try { return res.status(200).json(JSON.parse(raw)); }
      catch { return res.status(200).json({ ottelu: "", pvm: "", turnaus: "sjpl_2627", updatedAt: null }); }
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Käytä GET- tai POST-pyyntöä." });
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const supplied = req.headers["x-control-password"] || body.password;
    if (typeof supplied !== "string" || supplied !== password) return res.status(401).json({ error: "Väärä ohjaussalasana." });
    const ottelu = String(body.ottelu || "").trim();
    const pvm = String(body.pvm || "").trim();
    const turnaus = String(body.turnaus || "sjpl_2627").trim();
    if (!/^\d{1,12}$/.test(ottelu)) return res.status(400).json({ error: "Anna kelvollinen ottelun ID (numerot)." });
    if (pvm && !/^\d{4}-\d{2}-\d{2}$/.test(pvm)) return res.status(400).json({ error: "Päivämäärän muodon pitää olla VVVV-KK-PP." });
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(turnaus)) return res.status(400).json({ error: "Turnauksen tunnus sisältää kiellettyjä merkkejä." });
    const state = { ottelu, pvm, turnaus, updatedAt: new Date().toISOString() };
    await redis(["SET", "torneopal:graphics:default-match", JSON.stringify(state)]);
    return res.status(200).json(state);
  } catch (error) {
    return res.status(502).json({ error: error?.message || "Oletusottelun tallennus epäonnistui." });
  }
}
