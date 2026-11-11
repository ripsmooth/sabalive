export default async function handler(req, res) {
  const teamId = typeof req.query.joukkue === "string" ? req.query.joukkue : "";
  const tournament = typeof req.query.turnaus === "string" ? req.query.turnaus : "sjpl_2627";
  const series = typeof req.query.sarja === "string" ? req.query.sarja : "MBL";
  if (!/^\d{1,12}$/.test(teamId) || !/^[a-zA-Z0-9_-]{1,40}$/.test(tournament) || !/^[a-zA-Z0-9_-]{1,20}$/.test(series)) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(400).send("Virheelliset joukkueen tilastohakuehdot.");
  }
  const target = new URL("https://finbandy.torneopal.fi/taso/joukkue.php");
  target.searchParams.set("joukkue", teamId);
  target.searchParams.set("turnaus", tournament);
  target.searchParams.set("sarja", series);
  try {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "fi-FI,fi;q=0.9,en;q=0.8",
      "Referer": "https://finbandy.torneopal.fi/taso/"
    };
    // Open the TASO front page first to establish the same session as a browser.
    const warmup = await fetch("https://finbandy.torneopal.fi/taso/", { headers, cache: "no-store" });
    const cookies = warmup.headers.get("set-cookie");
    if (cookies) headers.Cookie = cookies.split(",").map(x => x.split(";")[0]).join("; ");
    const upstream = await fetch(target, { headers, cache: "no-store", redirect: "follow" });
    const body = await upstream.text();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-BandyLive-Team-Id", teamId);
    res.setHeader("X-BandyLive-Team-Stats", /class\s*=\s*["'][^"']*\bpelaajatilasto\b/i.test(body) ? "found" : "not-found");
    return res.status(upstream.status).send(body);

  } catch {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(502).send("TorneoPal-joukkueen kausitilastojen haku epäonnistui.");
  }
}
