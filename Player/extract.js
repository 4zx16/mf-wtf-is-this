// extract.js
(function () {
  function isValidID(id) {
    return /^[a-zA-Z0-9_-]{11}$/.test(id);
  }

  function extractVideoID(input) {
    if (!input || typeof input !== "string") return null;

    input = input.trim();

    // Direct ID
    if (isValidID(input)) return input;

    try {
      const url = new URL(input);
      const host = url.hostname.replace(/^www\./, "");

      // youtu.be short link
      if (host === "youtu.be") {
        const id = url.pathname.slice(1);
        return isValidID(id) ? id : null;
      }

      // Any YouTube domain
      if (
        host.includes("youtube.com") ||
        host.includes("youtube-nocookie.com") ||
        host.includes("invidious") ||
        host.includes("piped")
      ) {
        // ?v=
        const vParam = url.searchParams.get("v");
        if (isValidID(vParam)) return vParam;

        // /embed/ID
        const embed = url.pathname.match(/\/embed\/([^/?]+)/);
        if (embed && isValidID(embed[1])) return embed[1];

        // /shorts/ID
        const shorts = url.pathname.match(/\/shorts\/([^/?]+)/);
        if (shorts && isValidID(shorts[1])) return shorts[1];

        // /watch/ID (Invidious style)
        const watchPath = url.pathname.match(/\/watch\/([^/?]+)/);
        if (watchPath && isValidID(watchPath[1])) return watchPath[1];

        // /v/ID (Piped style)
        const vPath = url.pathname.match(/\/v\/([^/?]+)/);
        if (vPath && isValidID(vPath[1])) return vPath[1];

        // Last segment fallback
        const parts = url.pathname.split("/").filter(Boolean);
        const last = parts[parts.length - 1];
        if (isValidID(last)) return last;
      }

    } catch (e) {
      // Not a URL — try regex fallback
      const match = input.match(/([a-zA-Z0-9_-]{11})/);
      if (match) return match[1];
    }

    return null;
  }

  // Make it global for browser use
  window.extractVideoID = extractVideoID;
})();
