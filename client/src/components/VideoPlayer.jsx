import { useState, useEffect, useRef } from 'react';

const API = import.meta.env.VITE_API_URL || '';

const formatTitle = name =>
  name
    .replace(/\.[^.]+$/, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();

const formatSize = bytes => {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1e3).toFixed(0)} KB`;
};

const VideoPlayer = ({ video, onClose }) => {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/api/videos/url?key=${encodeURIComponent(video.name)}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        setUrl(data.url);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [video.name]);

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleOverlayClick = e => {
    if (e.target === overlayRef.current) onClose();
  };

  const title = formatTitle(video.name);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="relative w-full max-w-5xl mx-4 flex flex-col bg-[#0f0f0f] rounded-2xl overflow-hidden shadow-2xl border border-[#3f3f3f]/50">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#272727]">
          <div className="flex items-center gap-3 min-w-0">
            <svg className="w-5 h-5 text-red-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10 16.5l6-4.5-6-4.5v9zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
            </svg>
            <h2 className="text-white text-sm font-medium truncate">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-[#272727] shrink-0 ml-3"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* Video Area */}
        <div className="relative w-full aspect-video bg-black">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-4 border-[#272727] border-t-red-600 rounded-full animate-spin" />
              <p className="text-gray-500 text-sm">Loading video...</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <svg className="w-12 h-12 text-red-700 opacity-60" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              <p className="text-red-400 text-sm">Failed to load video</p>
              <p className="text-gray-600 text-xs">{error}</p>
            </div>
          )}
          {url && (
            <video
              src={url}
              controls
              autoPlay
              className="w-full h-full"
              controlsList="nodownload"
            >
              Your browser does not support the video tag.
            </video>
          )}
        </div>

        {/* Footer metadata */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#272727] text-xs text-gray-500">
          <span>
            {new Date(video.lastModified).toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric'
            })}
          </span>
          <span>{formatSize(video.size)}</span>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
