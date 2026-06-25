import { useState, useEffect } from 'react';
import { authFetch } from '../context/AuthContext';

const API = import.meta.env.VITE_API_URL || '';

const relativeTime = iso => {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const fmtTitle = name =>
  name.replace(/\.[^.]+$/, '').replace(/[_\-.]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();

const fmtSize = b => {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  return `${Math.round(b / 1e3)} KB`;
};

const avatarColor = name => {
  const cols = ['#e53e3e','#dd6b20','#d69e2e','#38a169','#3182ce','#805ad5','#d53f8c'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % cols.length;
  return cols[h];
};

// ── Thumbnail ─────────────────────────────────────────────────────────────────

const Thumb = ({ videoKey }) => {
  const [thumbUrl, setThumbUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/videos/thumbnail?key=${encodeURIComponent(videoKey)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled && data?.url) setThumbUrl(data.url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [videoKey]);

  return (
    <div className="relative w-full aspect-video bg-[#1a1a1a] rounded-xl overflow-hidden">
      {thumbUrl && (
        <img src={thumbUrl} className="absolute inset-0 w-full h-full object-cover" alt="" loading="lazy" />
      )}
      {!thumbUrl && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-gray-700">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="white" className="w-8 h-8"><path d="M8 5v14l11-7z" /></svg>
      </div>
    </div>
  );
};

// ── Main HistoryPage ──────────────────────────────────────────────────────────

const HistoryPage = ({ allVideos, onSelectVideo }) => {
  const [items, setItems]           = useState(null); // null = loading
  const [clearing, setClearing]     = useState(false);
  const [removingKey, setRemovingKey] = useState(null);

  useEffect(() => {
    authFetch(`${API}/api/history`)
      .then(r => r.json())
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  // Join history items with allVideos metadata
  const videoMap = Object.fromEntries(allVideos.map(v => [v.name, v]));
  const historyWithMeta = (items ?? [])
    .map(item => ({ ...item, video: videoMap[item.video_key] }))
    .filter(item => item.video); // skip videos no longer in R2

  const handleClearAll = async () => {
    setClearing(true);
    await authFetch(`${API}/api/history`, { method: 'DELETE' }).catch(() => {});
    setItems([]);
    setClearing(false);
  };

  const handleRemove = async (e, videoKey) => {
    e.stopPropagation();
    setRemovingKey(videoKey);
    await authFetch(`${API}/api/history/item?videoKey=${encodeURIComponent(videoKey)}`, {
      method: 'DELETE',
    }).catch(() => {});
    setItems(prev => prev.filter(i => i.video_key !== videoKey));
    setRemovingKey(null);
  };

  const loading = items === null;

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-gray-400">
            <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
          </svg>
          <h2 className="text-white text-xl font-bold">Watch History</h2>
          {!loading && (
            <span className="text-gray-500 text-sm">({historyWithMeta.length})</span>
          )}
        </div>

        {!loading && historyWithMeta.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={clearing}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
            {clearing ? 'Clearing…' : 'Clear all'}
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 animate-pulse">
              <div className="w-full aspect-video bg-[#272727] rounded-xl" />
              <div className="h-4 bg-[#272727] rounded w-3/4" />
              <div className="h-3 bg-[#272727] rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : historyWithMeta.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-600">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16 mb-4 opacity-20">
            <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
          </svg>
          <p className="text-lg">No watch history yet</p>
          <p className="text-sm mt-1">Videos you watch will appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
          {historyWithMeta.map(({ video_key, watched_at, video }) => {
            const title    = fmtTitle(video.name);
            const color    = avatarColor(video.name);
            const initials = title.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

            return (
              <div
                key={video_key}
                className="flex flex-col gap-2 cursor-pointer group relative"
                onClick={() => onSelectVideo(video)}
              >
                <Thumb videoKey={video_key} />

                {/* Remove button */}
                <button
                  onClick={e => handleRemove(e, video_key)}
                  disabled={removingKey === video_key}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black text-gray-400 hover:text-white"
                  title="Remove from history"
                >
                  {removingKey === video_key
                    ? <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    : <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                      </svg>
                  }
                </button>

                {/* Info */}
                <div className="flex gap-3 px-1">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5"
                    style={{ backgroundColor: color }}
                  >
                    {initials}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <h3 className="text-[#f1f1f1] text-sm font-medium leading-snug line-clamp-2 group-hover:text-white transition-colors">
                      {title}
                    </h3>
                    <span className="text-[#aaa] text-xs mt-0.5">Lustbuster</span>
                    <span className="text-[#aaa] text-xs flex items-center gap-1 mt-0.5">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 shrink-0">
                        <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
                      </svg>
                      Watched {relativeTime(watched_at)}
                    </span>
                    <span className="text-[#666] text-xs">{fmtSize(video.size)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
