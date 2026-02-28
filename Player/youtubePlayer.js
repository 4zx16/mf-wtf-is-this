// youtubePlayer.js
import { config } from './config.js';

let currentPlayer = null;
let currentSegments = [];

export async function createYouTubePlayer(containerId, videoId, options = {}) {
  if (!videoId) return console.error('Invalid video ID');
  const container = document.getElementById(containerId);
  if (!container) return console.error('Container not found');

  container.innerHTML = ''; // clear old player

  // Use only youtube-nocookie.com for reliable embedding
  const iframe = document.createElement('iframe');
  iframe.src = `${config.Player.UI.default}${videoId}?autoplay=${options.autoplay ? 1 : 0}&rel=0&modestbranding=1`;
  iframe.width = options.width || '560';
  iframe.height = options.height || '315';
  iframe.frameBorder = '0';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = 'no-referrer';
  iframe.style.borderRadius = '12px';
  iframe.style.border = 'none';
  iframe.style.overflow = 'hidden';
  iframe.title = 'YouTube (Privacy-first) Player';

  container.appendChild(iframe);
  currentPlayer = iframe;

  // Fetch SponsorBlock segments for optional skipping (no proxy)
  try {
    const res = await fetch(`${config.Player.Misc.sponsorBlock}api/skipSegments?videoID=${videoId}`);
    currentSegments = res.ok ? (await res.json()).sort((a,b)=>a.segment[0]-b.segment[0]) : [];
  } catch (e) {
    console.warn('SponsorBlock fetch failed:', e);
    currentSegments = [];
  }

  return iframe;
}

export function getSponsorSegments() {
  return currentSegments;
}
