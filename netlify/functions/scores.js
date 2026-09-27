// Fonction Netlify : gère le classement TOP 10 partagé de Madeleine.
// Stockage via Netlify Blobs : aucune inscription à un service tiers,
// aucune clé à configurer, ça fonctionne automatiquement sur un site
// déployé sur Netlify.
//
// GET  /api/scores               -> renvoie le TOP 10 actuel (tableau JSON)
// POST /api/scores {name, score} -> ajoute un score, renvoie le TOP 10 mis à jour
//
// Place ce fichier exactement à ce chemin dans ton projet :
//   netlify/functions/scores.js

import { getStore } from "@netlify/blobs";

const STORE_NAME = "madeleine-scores";
const KEY = "top10";
const MAX_ENTRIES = 10;
const MAX_SCORE = 100000; // garde-fou anti-triche grossier

function corsHeaders() {
  return {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const store = getStore(STORE_NAME);

  if (req.method === "GET") {
    const list = (await store.get(KEY, { type: "json" })) || [];
    return new Response(JSON.stringify(list), { headers: corsHeaders() });
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "invalid json" }), {
        status: 400,
        headers: corsHeaders()
      });
    }

    let name = String(body && body.name != null ? body.name : "Anonyme").trim();
    if (!name) name = "Anonyme";
    name = name.slice(0, 14);

    const score = Math.floor(Number(body && body.score));
    if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) {
      return new Response(JSON.stringify({ error: "invalid score" }), {
        status: 400,
        headers: corsHeaders()
      });
    }

    let list = (await store.get(KEY, { type: "json" })) || [];
    list.push({ name, score, date: Date.now() });
    list.sort((a, b) => b.score - a.score);
    list = list.slice(0, MAX_ENTRIES);

    await store.setJSON(KEY, list);
    return new Response(JSON.stringify(list), { headers: corsHeaders() });
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
};

// Rend la fonction accessible sur /api/scores (au lieu de
// /.netlify/functions/scores) sans avoir besoin de netlify.toml
export const config = { path: "/api/scores" };
