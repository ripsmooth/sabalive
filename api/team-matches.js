export default async function handler(req, res) {
  const date = typeof req.query.pvm === "string" ? req.query.pvm : "";
  const tournament = typeof req.query.turnaus === "string" ? req.query.turnaus : "sjpl_2627";
  const requestedSeries = typeof req.query.sarja === "string" ? req.query.sarja : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^[a-zA-Z0-9_-]{1,80}$/.test(tournament)) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(400).json({ error: "Virheelliset pvm- tai turnaus-parametrit." });
  }

  const origin = "https://finbandy.torneopal.fi";
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
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
  const cookieHeader = () => [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; ");

  async function get(url) {
    let current = new URL(url);
    for (let i = 0; i < 6; i++) {
      if (current.hostname !== "finbandy.torneopal.fi") throw new Error("TorneoPal ohjasi odottamattomaan osoitteeseen.");
      const requestHeaders = { ...headers };
      const cookie = cookieHeader();
      if (cookie) requestHeaders.Cookie = cookie;
      const response = await fetch(current, {
        headers: requestHeaders,
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(7000)
      });
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
      return next.hostname === "finbandy.torneopal.fi" && next.pathname.startsWith("/taso/") ? next : null;
    } catch { return null; }
  }

  const decode = value => String(value || "")
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
  const plain = value => decode(String(value || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ").trim();
  const norm = value => plain(value).toLocaleLowerCase("fi-FI").normalize("NFKC");
  function classValue(block, classNames) {
    for (const name of classNames) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`<(?:div|span)\\b[^>]*class=['"][^'"]*\\b${escaped}\\b[^'"]*['"][^>]*>([\\s\\S]*?)<\\/(?:div|span)>`, "i");
      const match = block.match(re);
      if (match) return plain(match[1]);
    }
    return "";
  }
  function dateFromListing(raw) {
    const match = String(raw || "").match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/);
    if (!match) return "";
    const [, dayRaw, monthRaw, yearRaw] = match;
    const day = Number(dayRaw), month = Number(monthRaw);
    if (day < 1 || day > 31 || month < 1 || month > 12) return "";
    const [wantedYear, wantedMonth] = date.split("-").map(Number);
    let year = yearRaw ? Number(yearRaw.length === 2 ? "20" + yearRaw : yearRaw) : wantedYear;
    // Listings sometimes omit the year. Infer the closest calendar year around
    // the selected date so December/January navigation remains correct.
    if (!yearRaw) {
      const targetMonthIndex = wantedYear * 12 + wantedMonth - 1;
      const candidateMonthIndex = year * 12 + month - 1;
      const delta = candidateMonthIndex - targetMonthIndex;
      if (delta > 6) year--;
      else if (delta < -6) year++;
    }
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return "";
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  function extractMatches(html, series, seriesName) {
    const rows = [];
    // Current TorneoPal list: match anchors contain date and team names.
    // Keep regex escapes single-escaped in JS regex literals (\b, \d, \s).
    const anchors = html.match(/<a\b[^>]*href=['"][^'"]*ottelu=\d+[^'"]*['"][^>]*>[\s\S]*?<\/a>/gi) || [];
    for (const anchor of anchors) {
      const id = (anchor.match(/ottelu=(\d+)/i) || [])[1] || "";
      if (!id) continue;
      const listedDate = classValue(anchor, ["ml_pvmsiisti", "ml_pvm"]);
      const matchDate = dateFromListing(listedDate);
      if (!matchDate) continue;
      const timeRaw = classValue(anchor, ["ml_tulosklo"]);
      const timeMatch = timeRaw.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
      const home = classValue(anchor, ["ml_kotisiisti"]);
      const away = classValue(anchor, ["ml_vierassiisti"]);
      let score = classValue(anchor, ["ml_tulossiisti", "ml_tuloslinkki", "ml_tulos"]);
      rows.push({
        id, sarja: series, sarjanimi: seriesName || series, pvm: matchDate,
        paivays: listedDate, koti: home, vieras: away, tulos: score,
        klo: timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : ""
      });
    }
    if (rows.length) return rows;

    // Older TorneoPal tables.
    const tableRows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
    for (const block of tableRows) {
      const id = (block.match(/\bname=['"](\d+)['"]/i) || block.match(/\bid=['"][^'"]*?[_-](\d+)['"]/i) || block.match(/otteluid=(\d+)/i) || [])[1] || "";
      if (!id) continue;
      const cell = names => {
        for (const name of names) {
          const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const re = new RegExp(`<td\\b[^>]*class=['"][^'"]*\\b${escaped}\\b[^'"]*['"][^>]*>([\\s\\S]*?)<\\/td>`, "i");
          const m = block.match(re);
          if (m) return m[1];
        }
        return "";
      };
      const dateCell = cell(["col_pvmsiisti", "col_pvm"]);
      const dateTag = dateCell.match(/data-sort=['"](\d{4}-\d{2}-\d{2})['"]/i);
      const listedDate = plain(dateCell);
      const matchDate = dateTag ? dateTag[1] : dateFromListing(listedDate);
      if (!matchDate) continue;
      const timeRaw = plain(cell(["col_klosiisti", "col_klo"]));
      const timeMatch = timeRaw.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
      const home = plain(cell(["col_kotisiisti"]));
      const away = plain(cell(["col_vierassiisti"]));
      const score = plain(cell(["col_tulossiisti", "col_tuloslinkki", "col_tulos"]));
      if (!home || !away) continue;
      rows.push({
        id, sarja: series, sarjanimi: seriesName || series, pvm: matchDate,
        paivays: listedDate, koti: home, vieras: away, tulos: score,
        klo: timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : ""
      });
    }
    return rows;
  }
  async function followPage(url) {
    let result = await get(url);
    for (let attempt = 0; attempt < 2 && !(/<li\b[^>]*class=['"][^'"]*\bmatch\b/i.test(result.body) || /ml_tulosklo/i.test(result.body)); attempt++) {
      const next = jsRedirect(result.body, result.url || url);
      if (next) result = await get(next);
      else if (attempt === 0) result = await get(url);
      else break;
    }
    return result;
  }

  try {
    // Read the public navigation to discover every published series in this season.
    const home = await followPage(new URL("/taso/", origin));
    const series = new Set();
    const seriesNames = new Map();
    // Read complete navigation anchors, not only href attributes, so the UI can
    // use TorneoPal's published series names (e.g. Miesten Bandyliiga).
    const links = home.body.match(/<a\b[^>]*href\s*=\s*['"][^'"]*\/taso\/sarja\.php\?[^'"]*['"][^>]*>[\s\S]*?<\/a>/gi) || [];
    for (const item of links) {
      const href = decode((item.match(/href\s*=\s*['"]([^'"]+)['"]/i) || [])[1] || "");
      const label = plain(item.replace(/^.*?>/s, "").replace(/<\/a>\s*$/i, ""));
      try {
        const url = new URL(href, origin);
        if (url.hostname !== "finbandy.torneopal.fi") continue;
        const params = url.searchParams;
        if (params.get("turnaus") === tournament) {
          const code = params.get("sarja");
          if (code && /^[a-zA-Z0-9_-]{1,40}$/.test(code)) {
            series.add(code);
            if (label && label.length <= 100 && !seriesNames.has(code)) seriesNames.set(code, label);
          }
        }
      } catch {}
    }
    const historicalSeriesByTournament = {
      sjpl_2425: ["MBL","NBL","MSC","NSC","DIV","PIC","NUBL","TURNAUKSET","U18","U16","U14","U14LOPPU","U12","U12YL","U12AL","U10","PP12","PP10","Piiri","Internationals"],
      sjpl_2324: ["MBL","NBL","MSC","NSC","DIV","PIC","NUBL","TURNAUKSET","U18","U16","U14","U14LOPPU","U12","U12YL","U12AL","U10","PP12","PP10","Piiri","Internationals"],
      sjpl_2122: ["BL","N","TUR","NSC","SS","PIC","HAR","NUBL","TURNAUKSET","U18","U16","U14","U12","U12YL","U12AL","U10","PP12","PP10","Piiri","Internationals"],
      sjpl_2223: ["BL","N","TUR","NSC","SS","PIC","HAR","NUBL","TURNAUKSET","U18","U16","U14","U12","U12YL","U12AL","U10","PP12","PP10","Piiri","Internationals"],
      sjpl_2021: ["BL","N","TUR","NSC","SS","PIC","HAR","NUBL","TURNAUKSET","P11","P13","P15","P17","P21","PP11","Internationals"],
      sjpl_1920: ["BL","N","TUR","NSC","SS","PIC","HAR","NUBL","TURNAUKSET","P11","P13","P15alempi","P15ylempi","P15Karsinta","P17","P21","PP11","PP13","Internationals","IK60","IK65","PN","KOULUT","LT15Y"],
      sjpl_1819: ["BL","N","TUR","NSC","SS","PIC","HAR","NUBL","TURNAUKSET","P11","P13","P15","P17","P21","PP11","PP13","KV","LPR","MO","IK40","IK55","IK60","IK65","PN","KOULUT","Jturnauksia"],
      sjpl_1718: ["BL","N","TUR","NSC","SS","PIC","HAR","NUBL","TURNAUKSET","P11","P13","P15","P17","P21","PP11","PP13","KV","LPR","MO","IK40","IK55","IK60","IK65","PN","KOULUT","Jturnauksia","JPTURN"],
      sjpl_1617: ["BL","N","TUR","SS","PIC","HAR","NUBL","TURNAUKSET","P11","P13","P15","P17","P21","PP11","PP13","KV","LPR","MO","IK40","IK55","IK60","IK65","PN","KOULUT","Jturnauksia","JPTURN"],
      sjpl_1516: ["BL","N","TUR","SS","PIC","HAR","NUBL","TURNAUKSET","P11","P13","P15","P17","P21","PP11","PP13","T11","T17","KV","LPR","MO","IK40","K55","K60","K65","PN","KOULUT","Jturn","JPK"]
    };

    const historicalCodes = historicalSeriesByTournament[tournament];
    if (historicalCodes) {
      for (const code of historicalCodes) series.add(code);
      for (const code of historicalCodes) if (!seriesNames.has(code)) seriesNames.set(code, code);
    }

    // Tulevien kausien varasarjat: ensisijaisesti käytetään aina TorneoPalin
    // kyseisen turnauksen navigaatiosta löytyviä sarjoja. Jos navigaatio ei
    // vielä palauta kaikkia linkkejä, kokeillaan myös nykyisin käytössä olevia
    // yleisiä sarjatunnisteita. Näin uusi sjpl_YYZZ-kausi ei vaadi koodipäivitystä.
    const futureSeason = tournament.match(/^sjpl_(\d{2})(\d{2})$/);
    if (futureSeason && Number(futureSeason[1]) >= 27) {
      const futureFallback = {
        MBL: "Miesten Bandyliiga", NBL: "Naisten Bandyliiga",
        MSC: "Miesten Suomen Cup", NSC: "Naisten Suomen Cup",
        DIV: "Divari", PIC: "Piirisarja", NUBL: "Nuorten Bandyliiga",
        TURNAUKSET: "Turnaukset", U18: "U18", U16: "U16", U14: "U14",
        U12: "U12", U10: "U10", PP12: "Pikkupojat 12", PP10: "Pikkupojat 10",
        Piiri: "Piirisarjat", Internationals: "Internationals"
      };
      for (const [code, name] of Object.entries(futureFallback)) {
        series.add(code);
        if (!seriesNames.has(code)) seriesNames.set(code, name);
      }
    }

    // Always union the published navigation with the known 2026–27 series.
    // A partially rendered TorneoPal menu must not silently hide a series.
    const knownSeriesNames = {
      MBL: "Miesten Bandyliiga",
      NBL: "Naisten Bandyliiga",
      MSC: "Miesten Suomen Cup",
      NSC: "Naisten Suomen Cup",
      DIV: "Divari",
      PIC: "Piirisarja",
      NUBL: "Nuorten Bandyliiga",
      U16: "U16",
      U14: "U14",
      U12: "U12",
      U10: "U10",
      PP12: "Pikkupojat 12",
      PP10: "Pikkupojat 10",
      Piiri: "Piirisarjat"
    };
    if (tournament === "sjpl_2627") {
      // Keep the current 2026–27 series list unchanged.
      for (const code of Object.keys(knownSeriesNames)) series.add(code);
    }

    // The 2025–26 series are no longer reliably present in TorneoPal's
    // current public navigation. Use the verified historical series list
    // as a fallback, while still retaining any series discovered above.
    const knownSeriesNames2526 = {
      MBL: "Miesten Bandyliiga",
      NBL: "Naisten Bandyliiga",
      MSC: "Miesten Suomen Cup",
      NSC: "Naisten Suomen Cup",
      DIV: "Divari",
      PIC: "Piirisarja",
      NUBL: "Nuorten Bandyliiga",
      U16: "U16",
      U14: "U14",
      U14LOPPU: "U14-lopputurnaus",
      U12YL: "U12-kilpasarja",
      U10: "U10",
      PP12: "Pikkupojat 12",
      PP10: "Pikkupojat 10",
      Piiri: "Piirisarjat",
      Internationals: "Internationals"
    };
    if (tournament === "sjpl_2526") {
      for (const code of Object.keys(knownSeriesNames2526)) series.add(code);
      for (const [code, name] of Object.entries(knownSeriesNames2526)) {
        if (!seriesNames.has(code)) seriesNames.set(code, name);
      }
    }
    for (const code of series) {
      if (!seriesNames.has(code) && knownSeriesNames[code]) seriesNames.set(code, knownSeriesNames[code]);
    }

    const seriesList = requestedSeries && /^[a-zA-Z0-9_-]{1,40}$/.test(requestedSeries) ? [requestedSeries] : [...series];
    // Request all category schedules in parallel. The pages are only fetched once
    // by the browser per selected date, not on every live-score refresh.
    const results = new Array(seriesList.length);
    let nextSeriesIndex = 0;
    async function seriesWorker() {
      while (true) {
        const index = nextSeriesIndex++;
        if (index >= seriesList.length) return;
        const code = seriesList[index];
        const target = new URL("/taso/sarja.php", origin);
        target.searchParams.set("turnaus", tournament);
        target.searchParams.set("sarja", code);
        target.searchParams.set("ottelut", "1");
        try {
          const result = await followPage(target);
          if (!result.response.ok) throw new Error(`HTTP ${result.response.status}`);
          results[index] = { code, ok: true, matches: extractMatches(result.body, code, seriesNames.get(code) || code) };
        } catch (error) {
          results[index] = { code, ok: false, error: String(error?.message || error), matches: [] };
        }
      }
    }
    // Limit concurrency to avoid overwhelming TorneoPal when the full known list is requested.
    await Promise.all(Array.from({ length: Math.min(4, seriesList.length) }, () => seriesWorker()));
    const allMatches = results.flatMap(result => result.matches);
    const failedSeries = results.filter(result => !result.ok).map(result => result.code);
    const successfulSeries = results.filter(result => result.ok).map(result => result.code);

    // Otteluohjelma kertoo ottelut ja niiden tunnisteet. Varsinaiset pelatut
    // tulokset luetaan liveupdate-XML:stä, jossa kmaali/vmaali ovat luotettavat.
    // Liveupdate on päiväkohtainen, joten haetaan jokainen otteluohjelmasta
    // löytyvä pelipäivä ja yhdistetään tulos ottelutunnisteella.
    const dates = [...new Set(allMatches.map(match => match.pvm).filter(Boolean))];
    const scoresById = new Map();
    let liveUpdateFailedDates = [];
    let nextDateIndex = 0;
    async function liveUpdateWorker() {
      while (true) {
        const index = nextDateIndex++;
        if (index >= dates.length) return;
        const matchDate = dates[index];
        const target = new URL("https://sjpl.api.torneopal.com/taso/ajax.php");
        target.searchParams.set("db", "sjpl");
        target.searchParams.set("action", "liveupdate");
        target.searchParams.set("pvm", matchDate);
        target.searchParams.set("turnaus", tournament);
        try {
          const response = await fetch(target, {
            headers: { "User-Agent": "TorneoPal-TV-Overlay/3.0", "Accept": "application/xml,text/xml,*/*" },
            cache: "no-store",
            signal: AbortSignal.timeout(7000)
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const xml = await response.text();
          const nodes = xml.match(/<ottelu\b[^>]*>[\s\S]*?<\/ottelu>/gi) || [];
          for (const node of nodes) {
            const field = name => {
              const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              const found = node.match(new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"));
              return found ? decode(found[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")).trim() : "";
            };
            const id = field("otteluid");
            const homeGoals = field("kmaali");
            const awayGoals = field("vmaali");
            if (!id || !/^\d+$/.test(homeGoals) || !/^\d+$/.test(awayGoals)) continue;
            scoresById.set(id, {
              tulos: `${homeGoals}–${awayGoals}`,
              kmaali: Number(homeGoals), vmaali: Number(awayGoals),
              status: field("status"), livestatus: field("livestatus")
            });
          }
        } catch {
          liveUpdateFailedDates.push(matchDate);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(5, dates.length) }, () => liveUpdateWorker()));
    for (const match of allMatches) {
      const score = scoresById.get(String(match.id));
      if (score) Object.assign(match, score);
    }
    const matches = allMatches.filter(match => match.pvm === date);
    const gameDates = [...new Set(allMatches.map(match => match.pvm).filter(Boolean))].sort();
    const previousDate = gameDates.filter(day => day < date).at(-1) || "";
    const nextDate = gameDates.find(day => day > date) || "";
    res.setHeader("Access-Control-Allow-Origin", "*");
    // Do not let a partial series response be cached as a complete schedule.
    res.setHeader("Cache-Control", failedSeries.length ? "no-store" : "public, s-maxage=15, stale-while-revalidate=5");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("X-BandyLive-Schedule-Series", String(seriesList.length));
    return res.status(200).json({ pvm: date, turnaus: tournament, liveUpdateDates: dates.length, liveUpdateFailedDates, scoredMatches: scoresById.size, series: seriesList, seriesDetails: seriesList.map(code => ({ code, name: seriesNames.get(code) || code })), successfulSeries, failedSeries, complete: failedSeries.length === 0, count: allMatches.length, previousDate, nextDate, matches: allMatches });
  } catch (error) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(502).json({ error: "TorneoPalin otteluohjelman haku epäonnistui.", detail: String(error?.message || error) });
  }
}
