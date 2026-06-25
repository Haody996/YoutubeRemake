import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || '';

const formatSize = bytes => {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1e3).toFixed(0)} KB`;
};

const formatDate = iso => {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} days ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)} months ago`;
  return `${Math.floor(diff / 31536000)} years ago`;
};

const formatTitle = name => {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
};

const getExtension = name => (name.match(/\.([^.]+)$/) || [])[1]?.toUpperCase() || 'VID';

const formatViews = n => {
  if (!n) return null;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B views`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M views`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K views`;
  return `${n} view${n === 1 ? '' : 's'}`;
};

// Random seeded avatar color per name
const avatarColor = name => {
  const colors = ['#e53e3e', '#dd6b20', '#d69e2e', '#38a169', '#3182ce', '#805ad5', '#d53f8c'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length;
  return colors[h];
};

const Thumbnail = ({ videoKey }) => {
  const [thumbUrl, setThumbUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/videos/thumbnail?key=${encodeURIComponent(videoKey)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled && data?.url) setThumbUrl(data.url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [videoKey]);

  if (!thumbUrl) return null;
  return (
    <img
      src={thumbUrl}
      className="absolute inset-0 w-full h-full object-cover"
      alt=""
      loading="lazy"
    />
  );
};

const VideoCard = ({ video, viewCount = 0, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const title = formatTitle(video.name);
  const ext = getExtension(video.name);
  const initials = title.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const color = avatarColor(video.name);

  return (
    <div
      className="flex flex-col gap-2 cursor-pointer group"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail */}
      <div className="relative w-full aspect-video bg-[#1a1a1a] rounded-xl overflow-hidden">
        <Thumbnail videoKey={video.name} />

        {/* Gradient fallback overlay (visible until canvas captures) */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1f1f1f] to-[#0a0a0a] flex items-center justify-center"
          style={{ opacity: 0 }}>
        </div>

        {/* Play icon overlay on hover */}
        <div className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-200 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
          <div className="w-14 h-14 rounded-full bg-black/70 flex items-center justify-center border-2 border-white/20 backdrop-blur-sm">
            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Format badge */}
        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-bold px-1.5 py-0.5 rounded">
          {ext}
        </div>

      </div>

      {/* Video Info */}
      <div className="flex gap-3 px-1">
        {/* Avatar */}
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
          <span className="text-[#aaa] text-xs mt-1 hover:text-white transition-colors cursor-pointer">
            {video.uploaderUsername ? `@${video.uploaderUsername}` : 'Lustbuster'}
          </span>
          <span className="text-[#aaa] text-xs">
            {formatViews(viewCount)
              ? <>{formatViews(viewCount)} · </>
              : null
            }
            {formatDate(video.lastModified)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default VideoCard;
