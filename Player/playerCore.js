// Player/playerCore.js
// LibreUltra Core v2
// Minimal, async, GitHub Pages-safe

(() => {
  /* =========================
     CONFIG
  ========================== */

  let CFG = null;
  const RATE_LIMIT = 25;
  const INTERVAL = 60000;
  const TTL = 1000 * 60 * 5;
  const MAX_CACHE = 80;
  const PER_VIDEO_COOLDOWN = 4000;

  const memory = new Map();
  const inflight = new Map();
  const lastHit = new Map();

  let tokens = RATE_LIMIT;
  const bc = "BroadcastChannel" in window ? new BroadcastChannel("libre_ultra") : null;
  if (bc) bc.onmessage = e => { if (e.data === "t" && tokens > 0) tokens--; };
  setInterval(() => tokens = RATE_LIMIT, INTERVAL);

  const allow = () => { if(tokens <= 0) return false; tokens--; bc?.postMessage("t"); return true; };
  const now = () => performance.now();

  const trim = () => { if(memory.size <= MAX_CACHE) return; memory.delete(memory.keys().next().value); };
  setInterval(() => { const t = now(); for (const [k,v] of memory) if(t - v.t > TTL) memory.delete(k); }, 60000);

  /* =========================
     CORE REQUESTS
  ========================== */

  const core = async (key, url) => {
    const cached = memory.get(key);
    if (cached && now() - cached.t < TTL) return cached.v;
    if (lastHit.has(key) && now() - lastHit.get(key) < PER_VIDEO_COOLDOWN) return null;
    if (!allow()) return null;
    if (inflight.has(key)) return inflight.get(key);

    lastHit.set(key, now());
    const req = fetch(url, { referrerPolicy:"no-referrer", keepalive:true })
      .then(r => r.ok ? r.json() : null)
      .then(v => { inflight.delete(key); if(v){ memory.set(key, {v, t: now()}); trim(); } return v; })
      .catch(() => { inflight.delete(key); return null; });
    inflight.set(key, req);
    return req;
  };

  /* =========================
     PUBLIC INTERFACE
  ========================== */

  window.LibreUltra = {
    initConfig: (config) => { CFG = config; },
    sponsor: (id) => core("sb_"+id, CFG?.sponsorBlock?.API + "api/skipSegments?videoID=" + id),
    dearrow: (id) => core("da_"+id, CFG?.dearrow?.API + "api/branding?videoID=" + id + "&license=" + CFG?.dearrow?.KEY),
    prefetch: (id) => requestIdleCallback?.(() => window.LibreUltra.dearrow(id))
  };
})();
