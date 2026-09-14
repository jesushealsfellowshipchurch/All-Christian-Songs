import React, { useState, useEffect, useRef } from 'react';
import './YouTubeSection.css';

const CHANNEL_ID = 'UCXHiWtcWRSCxqj9tw1JBrmg';
const CHANNEL_HANDLE = 'HepsiSherwin_CK';
const CHANNEL_NAME = 'Christ Kingdom';
const CHANNEL_DESC = 'Moments of faith, heartfelt worship & Telugu Christian songs by Sis. Hepsi Sherwin.';
const MAX_PER_ROW = 3;

const FALLBACK_VIDEOS = [
  { id: '6saSO_klV6U', title: 'ఏమని వివరింతు నీ ప్రేమ | Old Telugu Christian Song | Christ Kingdom', date: '2026-03-01' },
  { id: 'qT4lGz0kX0w', title: 'El Elyon Sarvonnathuda | New Telugu Christian Song 2026 | Sis. Hepsi Sherwin', date: '2026-02-15' },
  { id: 'G_WB8T4lD4c', title: 'Telugu Christian Worship Song | Christ Kingdom', date: '2026-01-20' }
];

const FALLBACK_SHORTS = [
  { id: 'XJMBB6KhkCI', title: 'ఆమెన్😇🙌 #telugu #jesus #christkingdom #dailyshorts', short: true, date: '2026-03-10' },
  { id: 'f3JXJVoYxyQ', title: 'ఆదికాండములో వెల్లడైన దేవుని నామము — ఏల్ ఎల్యోన్ సర్వోన్నతుడా #christkingdom', short: true, date: '2026-03-08' },
  { id: '5qGVOInEPfE', title: 'Those who led by spirit of God are the children of God 😇🙌 #christkingdom', short: true, date: '2026-03-05' }
];

const OLDER_VIDEO_IDS = [
  { id: '40ahsHVl-Zo', title: 'Telugu Christian Hymns & Worship | Christ Kingdom' },
  { id: 'jxJYNomKYLY', title: 'Heartfelt Worship Moments | Christ Kingdom' },
  { id: '0fLe4ynL2EE', title: 'Worship and Praise Songs | Christ Kingdom' }
];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (isNaN(s) || s < 0) return '';
  for (const [secs, name] of [
    [31536000, 'year'],
    [2592000, 'month'],
    [604800, 'week'],
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute']
  ]) {
    const v = Math.floor(s / secs);
    if (v >= 1) return v + ' ' + name + (v > 1 ? 's' : '') + ' ago';
  }
  return 'just now';
}

function parseJsonFeed(text) {
  const d = JSON.parse(text);
  if (d.status !== 'ok' || !Array.isArray(d.items)) throw new Error('bad json');
  return d.items
    .map((i) => ({
      id:
        (i.guid || '').split(':').pop() ||
        (i.link || '').match(/(?:v=|shorts\/|embed\/)([A-Za-z0-9_-]{11})/)?.[1],
      title: (i.title || '').trim(),
      date: i.pubDate || null,
      short: /shorts\//.test(i.link || '')
    }))
    .filter((v) => v.id && /^[A-Za-z0-9_-]{11}$/.test(v.id) && v.title);
}

function parseXmlFeed(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('bad xml');
  return Array.from(doc.getElementsByTagName('entry'))
    .map((e) => {
      const vid = e.getElementsByTagNameNS('*', 'videoId')[0];
      let short = false;
      Array.from(e.getElementsByTagName('link')).forEach((l) => {
        if (/shorts\//.test(l.getAttribute('href') || '')) short = true;
      });
      return {
        id: vid ? vid.textContent : '',
        title: ((e.getElementsByTagName('title')[0] || {}).textContent || '').trim(),
        date: (e.getElementsByTagName('published')[0] || {}).textContent || null,
        short
      };
    })
    .filter((v) => v.id && /^[A-Za-z0-9_-]{11}$/.test(v.id) && v.title);
}

async function fetchWithTimeout(url, ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal });
    if (!r.ok) throw new Error(String(r.status));
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

// Interactive Video Card with 3D pointer tilt
function VideoCard({ video, canTilt }) {
  const cardRef = useRef(null);
  const isShort = video.short === true;
  const title = video.title || 'Watch on YouTube';
  const url = isShort
    ? `https://www.youtube.com/shorts/${video.id}`
    : `https://www.youtube.com/watch?v=${video.id}`;

  const handlePointerMove = (e) => {
    if (!canTilt || !cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    cardRef.current.style.transform = `perspective(700px) rotateY(${(x * 7).toFixed(
      2
    )}deg) rotateX(${(-y * 7).toFixed(2)}deg) translateY(-4px)`;
  };

  const handlePointerLeave = () => {
    if (cardRef.current) {
      cardRef.current.style.transform = '';
    }
  };

  return (
    <a
      ref={cardRef}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="video-card"
      aria-label={(isShort ? 'Watch short: ' : 'Watch video: ') + title}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <span className="video-thumb" aria-hidden="true">
        <img
          loading="lazy"
          alt={title}
          src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
          onError={(e) => {
            // fallback if hqdefault is missing
            e.target.src = `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`;
          }}
        />
        <span className="youtube-play">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 7v10l8-5-8-5Z" />
          </svg>
        </span>
        {isShort && <span className="shorts-badge">▶ Shorts</span>}
      </span>
      <span className="video-info">
        <span className="video-title">{title}</span>
        <span className="video-meta-row">
          {video.date && <span className="video-date">{timeAgo(video.date)}</span>}
          <span className="watch-on-yt">Watch on YouTube ↗</span>
        </span>
      </span>
    </a>
  );
}

// Skeleton Card for loading state
function SkeletonCard() {
  return (
    <div className="video-card skeleton" aria-hidden="true">
      <div className="video-skeleton-thumb" />
      <div className="video-skeleton-lines">
        <div className="video-skeleton-line" />
        <div className="video-skeleton-line" />
      </div>
    </div>
  );
}

export default function YouTubeSection() {
  const [videos, setVideos] = useState([]);
  const [shorts, setShorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canTilt, setCanTilt] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    setCanTilt(!reducedMotion && hasFinePointer);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadLive() {
      setLoading(true);
      const FEED_URL = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + CHANNEL_ID;
      const SOURCES = [
        {
          url: 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(FEED_URL),
          parse: parseJsonFeed
        },
        {
          url: 'https://api.allorigins.win/raw?url=' + encodeURIComponent(FEED_URL),
          parse: parseXmlFeed
        },
        {
          url: 'https://api.allorigins.win/get?url=' + encodeURIComponent(FEED_URL),
          parse: (text) => parseXmlFeed(JSON.parse(text).contents)
        }
      ];

      for (const src of SOURCES) {
        try {
          const raw = await fetchWithTimeout(src.url, 8000);
          const vids = await src.parse(raw);
          if (vids && vids.length > 0 && active) {
            const reg = vids.filter((v) => !v.short).slice(0, MAX_PER_ROW);
            // Backfill with older videos if feed is short on long-form
            for (const o of OLDER_VIDEO_IDS) {
              if (reg.length >= MAX_PER_ROW) break;
              if (!reg.some((v) => v.id === o.id) && !vids.some((v) => v.id === o.id && v.short)) {
                reg.push(o);
              }
            }
            const sh = vids.filter((v) => v.short).slice(0, MAX_PER_ROW);
            setVideos(reg);
            setShorts(sh);
            setLoading(false);
            return;
          }
        } catch (_) {
          // try next proxy
        }
      }

      // If all relays fail, use static fallbacks
      if (active) {
        setVideos(FALLBACK_VIDEOS);
        setShorts(FALLBACK_SHORTS);
        setLoading(false);
      }
    }

    loadLive();

    return () => {
      active = false;
    };
  }, []);

  const channelUrl = `https://www.youtube.com/@${CHANNEL_HANDLE}`;

  return (
    <section id="youtube" className="youtube-section">
      <div className="wrap">
        {/* Section header */}
        <div className="sec-head">
          <p className="kicker">Watch With Us</p>
          <h2>Moments of faith, worship & inspiration.</h2>
          <p>Explore the latest videos from the channel.</p>
        </div>

        {/* Feature banner */}
        <div className="youtube-feature">
          <div className="youtube-copy">
            <div className="youtube-brand" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </div>
            <div>
              <p className="youtube-eyebrow">YouTube Channel</p>
              <h3>{CHANNEL_NAME}</h3>
              <p className="youtube-text">{CHANNEL_DESC}</p>
            </div>
          </div>
          <div className="youtube-actions">
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn youtube-channel-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
              <span>Visit YouTube Channel</span>
            </a>
          </div>
        </div>

        {/* Video grid card */}
        <div className="youtube-embed">
          <div className="youtube-embed-head">
            <div>
              <p className="location-label">Featured Channel</p>
              <h3>{CHANNEL_NAME} on YouTube</h3>
            </div>
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="maps-open"
            >
              Open Channel →
            </a>
          </div>

          {/* Videos Row Label */}
          <div className="yt-row-label" id="videosRowLabel">
            Latest Videos
          </div>

          {/* Videos Grid */}
          <div className="youtube-video-grid" id="videoGrid">
            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              videos.map((vid) => (
                <VideoCard key={vid.id} video={vid} canTilt={canTilt} />
              ))
            )}
          </div>

          {/* Shorts Row Label & Grid (hidden if none) */}
          {(loading || shorts.length > 0) && (
            <>
              <div className="yt-row-label shown" id="shortsRowLabel">
                Latest Shorts
              </div>
              <div className="youtube-video-grid shorts-grid shown" id="shortsGrid">
                {loading ? (
                  <>
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                  </>
                ) : (
                  shorts.map((sh) => (
                    <VideoCard key={sh.id} video={sh} canTilt={canTilt} />
                  ))
                )}
              </div>
            </>
          )}

          {/* Footer note */}
          <div className="youtube-note">
            <span>More videos are available on the channel.</span>
            <a href={channelUrl} target="_blank" rel="noopener noreferrer">
              See all videos →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
