export default async function handler(req, res) {
  const matchId = typeof req.query.ottelu === "string" ? req.query.ottelu : "";
  if (!/^\d{1,12}$/.test(matchId)) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(400).send("Virheellinen ottelun tunniste.");
  }

  const origin = "https://finbandy.torneopal.fi";
  const target = new URL("/taso/ottelu.php", origin);
  target.searchParams.set("ottelu", matchId);
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fi-FI,fi;q=0.9,en;q=0.8",
    "Referer": origin + "/taso/"
  };

  // Keep the cookies that TorneoPal sets while opening its main TASO page,
  // then reuse them for the requested match page.
  const cookies = new Map();
  function saveCookies(response) {
    let setCookies = [];
    try {
      if (typeof response.headers.getSetCookie === "function") {
        setCookies = response.headers.getSetCookie();
      } else {
        const one = response.headers.get("set-cookie");
        if (one) setCookies = one.split(/,(?=\s*[^;,\s]+=)/g);
      }
    } catch {}
    for (const item of setCookies) {
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
      if (current.hostname !== "finbandy.torneopal.fi") {
        throw new Error("TorneoPal ohjasi odottamattomaan osoitteeseen.");
      }
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

  function extractJavascriptRedirect(body, baseUrl) {
    // TorneoPal has used both atob('...') and a variable passed to atob().
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

  try {
    // Warm up the site's session before requesting the match. Some TorneoPal
    // responses differ when this page has not been visited first.
    await get(new URL("/taso/", origin));
    let result = await get(target);
    let body = result.body;
    let upstream = result.response;

    // Follow a same-host JavaScript redirect if TorneoPal returns one.
    // If it points back to the same URL, retry once with the established session.
    for (let attempt = 0; attempt < 2 && !/class\s*=\s*["'][^"']*\bpelaajalista\b/i.test(body); attempt++) {
      const next = extractJavascriptRedirect(body, result.url || target);
      if (next) {
        result = await get(next);
      } else if (attempt === 0) {
        result = await get(target);
      } else {
        break;
      }
      upstream = result.response;
      body = result.body;
    }

    // Optional lightweight response for the actual match clock times.
    // The regular endpoint remains HTML for roster/detail consumers.
    if (req.query.ajat === "1") {
      const visibleText = body
        .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;|&#160;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/\s+/g, " ");
      const readClock = label => {
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const match = visibleText.match(new RegExp("\\b" + escaped + "\\s*:?\\s*([01]?\\d|2[0-3]):([0-5]\\d)\\b", "i"));
        return match ? String(match[1]).padStart(2, "0") + ":" + match[2] : "";
      };
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("X-BandyLive-TorneoPal-Status", String(upstream.status));
      return res.status(upstream.status).json({
        ottelu: matchId,
        alkoi: readClock("Alkoi"),
        loppui: readClock("Loppui"),
        source: "ottelu.php"
      });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-BandyLive-TorneoPal-Status", String(upstream.status));
    res.setHeader("X-BandyLive-Player-Tables", /class\s*=\s*["'][^"']*\bpelaajalista\b/i.test(body) ? "found" : "not-found");
    return res.status(upstream.status).send(body);
  } catch (error) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(502).send("TorneoPal-ottelusivun haku epäonnistui: " + (error?.message || "tuntematon virhe"));
  }
}
