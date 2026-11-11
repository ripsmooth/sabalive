export default async function handler(req, res) {
  const pvm = typeof req.query.pvm === "string" ? req.query.pvm : "";
  const turnaus = typeof req.query.turnaus === "string" ? req.query.turnaus : "sjpl_2627";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pvm) || !/^[a-zA-Z0-9_-]{1,80}$/.test(turnaus)) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(400).send("Virheelliset pvm- tai turnaus-parametrit.");
  }
  const target = new URL("https://sjpl.api.torneopal.com/taso/ajax.php");
  target.searchParams.set("db", "sjpl");
  target.searchParams.set("action", "liveupdate");
  target.searchParams.set("pvm", pvm);
  target.searchParams.set("turnaus", turnaus);
  try {
    const upstream = await fetch(target, {headers: {"User-Agent":"TorneoPal-TV-Overlay/3.0","Accept":"application/xml,text/xml,*/*"}, cache:"no-store"});
    const body = await upstream.text();
    res.setHeader("Access-Control-Allow-Origin","*");
    res.setHeader("Cache-Control","no-store, max-age=0");
    res.setHeader("Content-Type",upstream.headers.get("content-type")||"application/xml; charset=utf-8");
    return res.status(upstream.status).send(body);
  } catch {
    res.setHeader("Content-Type","text/plain; charset=utf-8");
    return res.status(502).send("TorneoPal-yhteys epäonnistui.");
  }
}
