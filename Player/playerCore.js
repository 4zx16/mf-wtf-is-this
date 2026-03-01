(() => {

  /* =========================
     SETTINGS
  ========================== */

  const OWNER = "JamesHickers";
  const REPO = "Krynetfeatures";
  const BRANCH = "main";
  const VERSION_KEY = "libre_ultra_version";

  /* =========================
     VERSION CHECK
  ========================== */

  const checkVersion = async () => {
    try {
      const url = `https://api.github.com/repos/${OWNER}/${REPO}/commits/${BRANCH}`;
      const data = await fetch(url, { cache: "no-store" }).then(r => r.json());
      const latest = data.sha;
      const stored = localStorage.getItem(VERSION_KEY);
      if (stored && stored !== latest) {
        console.log("Upstream updated. Clearing cache.");
        localStorage.clear();
      }
      localStorage.setItem(VERSION_KEY, latest);
    } catch {}
  };

  /* =========================
     CONFIG LOADER
  ========================== */

const loadConfig = async () => {
  try {
    const raw = await fetch("/LibreWatch/Player/config.js", { cache: "no-store" }).then(r => r.text());
    const sandbox = {};
    // Remove "let config;" to prevent redeclaration
    new Function("sandbox", `
      ${raw}
      if (typeof config !== "undefined")
        sandbox.config = config;
    `)(sandbox);
    return Object.freeze(sandbox.config.Player.Misc);
  } catch (e) {
    console.error("Failed to load config:", e);
    return null;
  }
};
  /* =========================
     NETWORK CORE
  ========================== */

  const initCore = (CFG) => {

    const SB_API = CFG.sponsorBlock.API;
    const DA_API = CFG.dearrow.API;
    const DA_KEY = CFG.dearrow.KEY;

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
    if (bc) bc.onmessage = e => { if(e.data==="t"&&tokens>0) tokens--; };
    setInterval(()=>tokens=RATE_LIMIT, INTERVAL);

    const allow = ()=>{ if(tokens<=0) return false; tokens--; bc?.postMessage("t"); return true; };
    const now = ()=>performance.now();
    const trim = ()=>{ if(memory.size<=MAX_CACHE) return; memory.delete(memory.keys().next().value); };
    setInterval(()=>{ const t=now(); for(const [k,v] of memory) if(t-v.t>TTL) memory.delete(k); },60000);

    const core = async (key,url)=>{
      const cached=memory.get(key);
      if(cached&&now()-cached.t<TTL) return cached.v;
      if(lastHit.has(key)&&now()-lastHit.get(key)<PER_VIDEO_COOLDOWN) return null;
      if(!allow()) return null;
      if(inflight.has(key)) return inflight.get(key);

      lastHit.set(key,now());
      const req=fetch(url,{referrerPolicy:"no-referrer",keepalive:true})
        .then(r=>r.ok?r.json():null)
        .then(v=>{ inflight.delete(key); if(v){memory.set(key,{v,t:now()}); trim();} return v; })
        .catch(()=>{ inflight.delete(key); return null; });
      inflight.set(key,req);
      return req;
    };

    window.LibreUltra = {
      sponsor: id=>core("sb_"+id, SB_API+"api/skipSegments?videoID="+id),
      dearrow: id=>core("da_"+id, DA_API+"api/branding?videoID="+id+"&license="+DA_KEY),
      prefetch: id=>requestIdleCallback?.(()=>window.LibreUltra.dearrow(id))
    };
  };

  /* =========================
     EMBEDDED YOUTUBE ADBLOCK
  ========================== */

  const embedAdblock = (() => {

    const sponsorCheckInterval = 300; // ms

    const processEmbed = async (embed, DA_KEY, DA_API) => {
      if(embed.__dearrow) return;

      const iframe = embed.querySelector("iframe");
      if(!iframe) return;
      const match = /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/.exec(iframe.src);
      if(!match) return;

      const id = match[1];

      // fetch branding data
      let data;
      try { data = await window.LibreUltra.dearrow(id); } catch{return;}

      const titleEl = embed.querySelector(".embed-title");
      const thumbEl = embed.querySelector(".embed-thumbnail");
      if(!titleEl&&!thumbEl) return;

      const orig={title:titleEl?.textContent,thumb:thumbEl?.src};
      const newTitle = data?.titles?.[0]?.votes>=0 ? data.titles[0].title.replace(/(^|\s)>(\S)/g,"$1$2"):null;
      const newThumb = data?.thumbnails?.[0]?.votes>=0&&!data.thumbnails[0].original ?
        `https://dearrow-thumb.ajay.app/api/v1/getThumbnail?videoID=${id}&time=${data.thumbnails[0].timestamp}&license=${DA_KEY}`
        : null;

      if(!newTitle&&!newThumb) return;

      const btn=document.createElement("button");
      btn.className="vc-dearrow-on";
      btn.innerHTML="...SVG HERE...";
      btn.onclick=()=>{
        if(btn.className==="vc-dearrow-on"){
          if(titleEl&&newTitle) titleEl.textContent=orig.title;
          if(thumbEl&&newThumb) thumbEl.src=orig.thumb;
          btn.className="vc-dearrow-off";
        }else{
          if(titleEl&&newTitle) titleEl.textContent=newTitle;
          if(thumbEl&&newThumb) thumbEl.src=newThumb;
          btn.className="vc-dearrow-on";
        }
      };
      embed.style.position=embed.style.position||"relative";
      embed.appendChild(btn);
      if(titleEl&&newTitle) titleEl.textContent=newTitle;
      if(thumbEl&&newThumb) thumbEl.src=newThumb;

      embed.__dearrow=true;
    };

    const run = (DA_KEY, DA_API) => {
      const embeds = document.querySelectorAll(".youtube-embed");
      for(let i=0;i<embeds.length;i++) processEmbed(embeds[i], DA_KEY, DA_API);
      setInterval(()=>{ const e=document.querySelectorAll(".youtube-embed"); for(let i=0;i<e.length;i++) processEmbed(e[i], DA_KEY, DA_API); }, sponsorCheckInterval);
    };

    return { run };
  })();

  /* =========================
     BOOT
  ========================== */

  (async ()=>{
    await checkVersion();
    const CFG = await loadConfig();
    initCore(CFG);
    embedAdblock.run(CFG.dearrow.KEY, CFG.dearrow.API);
  })();

})();
