export default async function handler(req, res) {
  const date = typeof req.query.pvm === "string" ? req.query.pvm : "";
  const home = typeof req.query.koti === "string" ? req.query.koti : "";
  const away = typeof req.query.vieras === "string" ? req.query.vieras : "";
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !home || !away) {
    return res.status(400).json({ error: "Anna pvm, koti ja vieras." });
  }

  const origin = "https://finbandy.torneopal.fi";
  const target = new URL("/taso/sarja.php?turnaus=sjpl_2627&sarja=MBL&ottelut=1", origin);
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fi-FI,fi;q=0.9,en;q=0.8",
    "Referer": origin + "/taso/"
  };
  const cookies = new Map();
  function saveCookies(response) {
    let values = [];
    try {
      if (typeof response.headers.getSetCookie === "function") values = response.headers.getSetCookie();
      else {
        const one = response.headers.get("set-cookie");
        if (one) values = one.split(/,(?=\s*[^;,\s]+=)/g);
      }
    } catch {}
    for (const item of values) {
      const pair = String(item).split(";", 1)[0];
      const eq = pair.indexOf("=");
      if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  function cookieHeader() {
    return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  async function get(url) {
    let current = new URL(url);
    for (let i = 0; i < 6; i++) {
      if (current.hostname !== "finbandy.torneopal.fi") throw new Error("TorneoPal ohjasi odottamattomaan osoitteeseen.");
      const h = { ...headers };
      const cookie = cookieHeader();
      if (cookie) h.Cookie = cookie;
      const response = await fetch(current, { headers: h, cache: "no-store", redirect: "manual" });
      saveCookies(response);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) return { response, body: await response.text(), url: current };
        current = new URL(location, current);
        continue;
      }
      return { response, body: await response.text(), url: current };
    }
    throw new Error("TorneoPalin uudelleenohjauksia oli liikaa.");
  }
  function jsRedirect(body, baseUrl) {
    let encoded = "";
    const direct = body.match(/(?:window\.)?location\.replace\s*\(\s*atob\s*\(\s*["']([^"']+)["']\s*\)\s*\)/i);
    if (direct) encoded = direct[1];
    if (!encoded) {
      const call = body.match(/(?:window\.)?location\.replace\s*\(\s*atob\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\)/i);
      if (call) {
        const name = call[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const assignment = body.match(new RegExp("(?:^|[;\\s])(?:var\\s+|let\\s+|const\\s+)?" + name + "\\s*=\\s*['\\\"]([^'\\\"]+)['\\\"]", "m"));
        if (assignment) encoded = assignment[1];
      }
    }
    if (!encoded) return null;
    try {
      const decoded = Buffer.from(encoded, "base64").toString("utf8");
      const next = new URL(decoded, baseUrl);
      if (next.hostname !== "finbandy.torneopal.fi" || !next.pathname.startsWith("/taso/")) return null;
      return next;
    } catch { return null; }
  }
  const decode = value => String(value || "")
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
  const norm = value => decode(String(value || "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ").trim().toLocaleLowerCase("fi-FI");

  try {
    // Establish a TorneoPal session first; its schedule endpoint may return a
    // JavaScript atob(location.replace(...)) redirect when fetched cold.
    await get(new URL("/taso/", origin));
    let result = await get(target);
    for (let attempt = 0; attempt < 3 && !/ml_tulosklo/i.test(result.body); attempt++) {
      const next = jsRedirect(result.body, result.url || target);
      if (next) result = await get(next);
      else if (attempt === 0) result = await get(target);
      else break;
    }

    const html = result.body;
    const [year, month, day] = date.split("-");
    const wantedDate = `${Number(day)}.${Number(month)}.`;
    const wantedHome = norm(home), wantedAway = norm(away);
    const anchors = html.match(/<a\b[^>]*href=['"][^'"]*ottelu=\d+[^'"]*['"][^>]*>[\s\S]*?<\/a>/gi) || [];
    for (const block of anchors) {
      const idMatch = block.match(/ottelu=(\d+)/i);
      const getClass = cls => {
        const re = new RegExp(`<div\\b[^>]*class=['"][^"']*\\b${cls}\\b[^"']*['"][^>]*>([\\s\\S]*?)<\\/div>`, "i");
        const m = block.match(re);
        return m ? norm(m[1]) : "";
      };
      const listedDate = getClass("ml_pvmsiisti");
      const listedHome = getClass("ml_kotisiisti");
      const listedAway = getClass("ml_vierassiisti");
      const timeRaw = getClass("ml_tulosklo");
      if ((listedDate === wantedDate || listedDate.startsWith(wantedDate)) && listedHome === wantedHome && listedAway === wantedAway) {
        const time = timeRaw.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
        return res.status(200).json({
          klo: time ? `${time[1].padStart(2, "0")}:${time[2]}` : "",
          debug: { date: listedDate, koti: listedHome, vieras: listedAway, scheduleMatchId: idMatch?.[1] || "", scheduleRows: anchors.length, source: result.url.href }
        });
      }
    }
    return res.status(200).json({
      klo: "",
      debug: {
        date: wantedDate, koti: wantedHome, vieras: wantedAway,
        scheduleRows: anchors.length, httpStatus: result.response.status,
        finalUrl: result.url.href, htmlLength: html.length,
        preview: html.slice(0, 500), hasKickoffClass: /ml_tulosklo/i.test(html),
        source: target.href
      }
    });
  } catch (error) {
    return res.status(502).json({ error: "Otteluohjelman kellonaikaa ei saatu haettua.", detail: String(error?.message || error) });
  }
}
