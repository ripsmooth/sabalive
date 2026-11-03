import crypto from "node:crypto";

const TORNEOPAL_BASE = "https://salibandy-api.torneopal.net/taso/rest/";
const ALLOWED_METHODS = new Set([
  "getMatch",
  "getScore",
  "getGroups",
  "getCategory",
  "getMatches"
]);

function send(res, status, data) {
  return res.status(status).json(data);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return send(res, 405, { error: "Vain GET-pyynnöt ovat sallittuja." });

  const method = String(req.query.method || "");
  if (!ALLOWED_METHODS.has(method)) {
    return send(res, 400, { error: "Tuntematon TorneoPal-rajapintakutsu." });
  }

  // Hash seed and Accept value are stored only in Vercel environment variables,
  // not in the public GitHub Pages files.
  const hashSeed = process.env.TORNEOPAL_HASH_SEED;
  const accept = process.env.TORNEOPAL_ACCEPT;
  if (!hashSeed || !accept) {
    return send(res, 500, {
      error: "Vercelin ympäristömuuttujat TORNEOPAL_HASH_SEED ja TORNEOPAL_ACCEPT puuttuvat."
    });
  }

  const target = new URL(method, TORNEOPAL_BASE);
  const hashParams = [];
  for (const [key, rawValue] of Object.entries(req.query)) {
    if (key === "method" || key === "hash" || key === "timeStamp") continue;
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (value === undefined || value === null || value === "") continue;
    const stringValue = String(value);
    target.searchParams.set(key, stringValue);
    hashParams.push([key, stringValue]);
  }

  const timeStamp = String(Date.now());
  target.searchParams.set("timeStamp", timeStamp);
  hashParams.push(["timeStamp", timeStamp]);

  // Same TorneoPal SHA-256 input format used by the Salibandy-TV client helper.
  let hashInput = method + "?" + hashSeed;
  for (const [key, value] of hashParams) hashInput += "&" + key + "=" + value;
  const hash = crypto.createHash("sha256").update(hashInput, "utf8").digest("hex");
  target.searchParams.set("hash", hash);

  try {
    const upstream = await fetch(target.toString(), {
      method: "GET",
      headers: {
        Accept: accept,
        Origin: "https://tulospalvelu.salibandy.fi",
        Referer: "https://tulospalvelu.salibandy.fi/",
        "User-Agent": "Mozilla/5.0 (compatible; SalibandyTV/1.0)"
      },
      cache: "no-store"
    });

    const body = await upstream.text();
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return send(res, 502, {
        error: "TorneoPal ei palauttanut kelvollista JSON-dataa.",
        upstreamStatus: upstream.status
      });
    }

    if (!upstream.ok) {
      return send(res, 502, {
        error: "TorneoPal-pyyntö epäonnistui.",
        upstreamStatus: upstream.status,
        call: data.call || null
      });
    }

    if (data.call?.status && !["ok", "OK"].includes(data.call.status)) {
      return send(res, 502, {
        error: "TorneoPal hylkäsi pyynnön: " + data.call.status,
        call: data.call
      });
    }

    return send(res, 200, data);
  } catch (error) {
    return send(res, 502, {
      error: "Yhteys TorneoPal-palvelimeen epäonnistui.",
      detail: error?.message || String(error)
    });
  }
};
