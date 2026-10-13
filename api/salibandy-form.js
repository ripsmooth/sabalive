export default async function handler(req, res) {
  const matchId = typeof req.query.match_id === "string"
    ? req.query.match_id
    : typeof req.query.ottelu === "string"
      ? req.query.ottelu
      : "953141";

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Käytä GET-pyyntöä." });
  }
  if (!/^\d{1,12}$/.test(matchId)) {
    return res.status(400).json({ error: "Virheellinen ottelun tunniste." });
  }

  const headers = {
    "Accept": "json/zsn3anknxzcfzc23k53jqdcd4pymutsf",
    "Accept-Language": "fi-FI,fi;q=0.9,en-US;q=0.8,en;q=0.7",
    "Origin": "https://tulospalvelu.salibandy.fi",
    "Referer": "https://tulospalvelu.salibandy.fi/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155.0.0.0 Safari/537.36"
  };

  async function call(endpoint, params) {
    const url = new URL("https://salibandy-api.torneopal.net/taso/rest/" + endpoint);
    for (const [key, value] of Object.entries(params || {})) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
    url.searchParams.set("timeStamp", String(Date.now()));
    const response = await fetch(url, { headers, cache: "no-store" });
    const body = await response.text();
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!response.ok || contentType.includes("text/html") || body.trimStart().startsWith("<")) {
      throw new Error("TorneoPal-pyyntö epäonnistui (" + response.status + ").");
    }
    let data;
    try { data = JSON.parse(body); }
    catch { throw new Error("TorneoPal ei palauttanut kelvollista JSON-dataa."); }
    if (data.call?.status && !["ok", "OK"].includes(data.call.status)) {
      throw new Error("TorneoPal: " + data.call.status);
    }
    return data;
  }

  const num = (value) => {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  };
  const first = (object, keys) => {
    for (const key of keys) {
      if (object?.[key] !== undefined && object[key] !== null && object[key] !== "") return object[key];
    }
    return "";
  };
  const isCompleted = (match) => {
    const status = String(match.status || "").trim().toLowerCase();
    const completedStatuses = new Set(["played", "finished", "over", "complete", "completed", "closed", "loppunut", "pelattu"]);
    if (completedStatuses.has(status)) return true;
    const pendingStatuses = new Set(["fixture", "scheduled", "planned", "live", "break", "cancelled", "canceled", "postponed", "ongoing", "keskeytetty"]);
    const a = num(first(match, ["fs_A", "final_A", "score_A"]));
    const b = num(first(match, ["fs_B", "final_B", "score_B"]));
    return !pendingStatuses.has(status) && a !== null && b !== null;
  };
  const matchDateKey = (match) => String(match.date || "") + " " + String(match.time || "");

  try {
    const matchData = await call("getMatch", { match_id: matchId });
    const match = matchData.match;
    if (!match) return res.status(502).json({ error: "Ottelutietoja ei löytynyt." });

    const competitionId = match.competition_id;
    const categoryId = match.category_id;
    const groupId = match.group_id;
    const teams = [
      { side: "a", id: String(match.team_A_id || ""), name: match.team_A_name || match.club_A_name || "KOTI", logo: match.club_A_crest || match.team_A_crest || "" },
      { side: "b", id: String(match.team_B_id || ""), name: match.team_B_name || match.club_B_name || "VIERAS", logo: match.club_B_crest || match.team_B_crest || "" }
    ];
    if (!competitionId || !categoryId || !teams[0].id || !teams[1].id) {
      return res.status(502).json({ error: "Ottelun sarja- tai joukkuetietoja ei löytynyt." });
    }

    async function getRecentMatches(team) {
      const data = await call("getMatches", {
        competition_id: competitionId,
        category_id: categoryId,
        team_id: team.id
      });
      const list = Array.isArray(data.matches) ? data.matches : [];
      const unique = new Map();
      for (const item of list) {
        const id = String(item.match_id || "");
        if (!id || id === matchId && !isCompleted(item) || !isCompleted(item)) continue;
        const teamA = String(item.team_A_id || "");
        const teamB = String(item.team_B_id || "");
        if (teamA !== team.id && teamB !== team.id) continue;
        const scoreA = num(first(item, ["fs_A", "final_A", "score_A"]));
        const scoreB = num(first(item, ["fs_B", "final_B", "score_B"]));
        if (scoreA === null || scoreB === null) continue;
        const isA = teamA === team.id;
        const goalsFor = isA ? scoreA : scoreB;
        const goalsAgainst = isA ? scoreB : scoreA;
        const outcome = goalsFor > goalsAgainst ? "V" : goalsFor < goalsAgainst ? "H" : "T";
        unique.set(id, {
          match_id: id,
          date: item.date || "",
          time: item.time || "",
          opponent: isA ? (item.team_B_name || item.club_B_name || "Vastustaja") : (item.team_A_name || item.club_A_name || "Vastustaja"),
          goals_for: goalsFor,
          goals_against: goalsAgainst,
          outcome
        });
      }
      return [...unique.values()].sort((a, b) => (String(b.date) + " " + String(b.time)).localeCompare(String(a.date) + " " + String(a.time))).slice(0, 5);
    }

    async function getSeasonScorers(team) {
      const data = await call("getCategory", {
        competition_id: competitionId,
        category_id: categoryId,
        player_statistics_team_id: team.id,
        lang: "fi"
      });
      const category = data.category || {};
      const list = Array.isArray(data.player_statistics) ? data.player_statistics
        : Array.isArray(category.player_statistics) ? category.player_statistics
          : Array.isArray(data.statistics) ? data.statistics : [];
      const players = list.filter(player => {
        const playerTeamId = String(player.team_id || player.player_team_id || "");
        return !playerTeamId || playerTeamId === team.id;
      }).map(player => {
        const goals = num(first(player, ["goals", "player_goals", "total_goals"])) ?? 0;
        const assists = num(first(player, ["assists", "player_assists", "total_assists"])) ?? 0;
        const rawPoints = num(first(player, ["points", "total_points", "player_points", "pts"]));
        return {
          player_id: String(player.player_id || ""),
          player_name: first(player, ["player_name", "name"]) || [player.first_name, player.last_name].filter(Boolean).join(" ") || "Tuntematon pelaaja",
          goals,
          assists,
          points: rawPoints !== null ? rawPoints : goals + assists
        };
      }).filter(player => player.points > 0 || player.goals > 0 || player.assists > 0);
      const unique = new Map();
      for (const player of players) {
        const key = player.player_id || player.player_name;
        if (!unique.has(key) || unique.get(key).points < player.points) unique.set(key, player);
      }
      return [...unique.values()].sort((a, b) => b.points - a.points || b.goals - a.goals || b.assists - a.assists || a.player_name.localeCompare(b.player_name, "fi")).slice(0, 5);
    }

    const results = await Promise.all(teams.map(async team => {
      const [recentResult, scorersResult] = await Promise.allSettled([
        getRecentMatches(team),
        getSeasonScorers(team)
      ]);
      return {
        ...team,
        recent_matches: recentResult.status === "fulfilled" ? recentResult.value : [],
        top_scorers: scorersResult.status === "fulfilled" ? scorersResult.value : [],
        matches_error: recentResult.status === "rejected" ? recentResult.reason?.message || "Viime otteluiden haku epäonnistui." : "",
        scorers_error: scorersResult.status === "rejected" ? scorersResult.reason?.message || "Pistetietojen haku epäonnistui." : ""
      };
    }));

    return res.status(200).json({
      call: { status: "ok" },
      selected_match_id: matchId,
      competition_name: match.category_name || match.competition_name || "Salibandy",
      category_name: match.category_name || "",
      group_name: match.group_name || "",
      teams: { a: results[0], b: results[1] },
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    return res.status(502).json({ error: error?.message || "Kuntopuntarin tietojen haku epäonnistui." });
  }
}
