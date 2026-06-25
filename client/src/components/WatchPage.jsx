import { useState, useEffect, useRef, useCallback } from 'react';
import CommentsSection from './CommentsSection';
import LikeButton from './LikeButton';

const API = import.meta.env.VITE_API_URL || '';

// ── Utilities ────────────────────────────────────────────────────────────────

const fmt = secs => {
  if (!secs || isNaN(secs)) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const fmtTitle = name =>
  name.replace(/\.[^.]+$/, '').replace(/[_\-.]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();

const fmtSize = b => {
  if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  return `${Math.round(b / 1e3)} KB`;
};

const avatarColor = name => {
  const cols = ['#e53e3e','#dd6b20','#d69e2e','#38a169','#3182ce','#805ad5','#d53f8c'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % cols.length;
  return cols[h];
};

// ── Icons ────────────────────────────────────────────────────────────────────

const IcPlay = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M8 5v14l11-7z" />
  </svg>
);
const IcPause = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);
const IcVolHigh = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
  </svg>
);
const IcVolLow = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
  </svg>
);
const IcVolMute = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
  </svg>
);
const IcFullscreen = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
  </svg>
);
const IcExitFullscreen = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
  </svg>
);
const IcBack = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
  </svg>
);

// ── Volume Slider (styled range input) ───────────────────────────────────────

const VolumeSlider = ({ value, onChange }) => (
  <input
    type="range"
    min="0" max="1" step="0.02"
    value={value}
    onChange={onChange}
    className="w-20 h-1 cursor-pointer accent-red-600"
    style={{ accentColor: '#ef4444' }}
    onClick={e => e.stopPropagation()}
  />
);

// ── Related Video Card (horizontal compact) ──────────────────────────────────

const RelatedCard = ({ video, viewCount = 0, onClick }) => {
  const [thumbUrl, setThumbUrl] = useState(null);
  const title = fmtTitle(video.name);
  const color = avatarColor(video.name);
  const initials = title.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/videos/thumbnail?key=${encodeURIComponent(video.name)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled && data?.url) setThumbUrl(data.url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [video.name]);

  return (
    <div
      className="flex gap-2 cursor-pointer group rounded-xl overflow-hidden hover:bg-[#1a1a1a] p-1.5 transition-colors"
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="relative w-40 shrink-0 aspect-video bg-[#1a1a1a] rounded-lg overflow-hidden">
        {thumbUrl
          ? <img src={thumbUrl} className="absolute inset-0 w-full h-full object-cover" alt="" loading="lazy" />
          : (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-gray-600">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )
        }
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><path d="M8 5v14l11-7z" /></svg>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col min-w-0 justify-center">
        <p className="text-[#f1f1f1] text-xs font-medium line-clamp-2 leading-snug group-hover:text-white transition-colors">
          {title}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0" style={{ backgroundColor: color }}>
            {initials[0]}
          </div>
          <span className="text-[#aaa] text-xs truncate">Lustbuster</span>
        </div>
        <span className="text-[#aaa] text-xs mt-0.5">
          {viewCount > 0 ? `${fmtViews(viewCount)} · ` : ''}{fmtSize(video.size)}
        </span>
      </div>
    </div>
  );
};

// ── Main WatchPage ────────────────────────────────────────────────────────────

const fmtViews = n => {
  if (!n) return '0 views';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B views`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M views`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K views`;
  return `${n} view${n === 1 ? '' : 's'}`;
};

const WatchPage = ({ video, allVideos, viewCounts = {}, onBack, onSelectVideo, onOpenAuth, onLikeChange }) => {
  const [url, setUrl] = useState(null);
  const [loadingUrl, setLoadingUrl] = useState(true);
  const [urlError, setUrlError] = useState(null);

  // Player state
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const progressRef = useRef(null);
  const scrubbing = useRef(false);
  const hideTimer = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [flashIcon, setFlashIcon] = useState(null); // 'play' | 'pause'

  // Fetch presigned URL
  useEffect(() => {
    setLoadingUrl(true); setUrlError(null); setUrl(null);
    setPlaying(false); setCurrentTime(0); setDuration(0);
    fetch(`${API}/api/videos/url?key=${encodeURIComponent(video.name)}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setUrl(d.url); setLoadingUrl(false); })
      .catch(e => { setUrlError(e.message); setLoadingUrl(false); });
  }, [video.name]);

  // Scroll to top on mount
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [video.name]);

  // Auto-hide controls
  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  const revealControls = useCallback(() => {
    setShowControls(true);
    if (playing && !scrubbing.current) scheduleHide();
  }, [playing, scheduleHide]);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  // Fullscreen change listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = e => {
      if (e.target.tagName === 'INPUT') return;
      const vid = videoRef.current;
      if (!vid) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'ArrowRight') { e.preventDefault(); vid.currentTime = Math.min(vid.currentTime + 5, vid.duration); }
      if (e.code === 'ArrowLeft')  { e.preventDefault(); vid.currentTime = Math.max(vid.currentTime - 5, 0); }
      if (e.code === 'ArrowUp')   { e.preventDefault(); setVolume(v => Math.min(1, v + 0.1)); }
      if (e.code === 'ArrowDown') { e.preventDefault(); setVolume(v => Math.max(0, v - 0.1)); }
      if (e.code === 'KeyM') toggleMute();
      if (e.code === 'KeyF') toggleFullscreen();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // Sync volume state → video element
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.volume = volume;
    videoRef.current.muted = muted;
  }, [volume, muted]);

  // ── Video event handlers ──────────────────────────────────────────────────

  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid) return;
    setCurrentTime(vid.currentTime);
    if (vid.buffered.length > 0) setBuffered(vid.buffered.end(vid.buffered.length - 1));
  };
  const handleLoaded = () => { if (videoRef.current) setDuration(videoRef.current.duration); };
  const handlePlay  = () => { setPlaying(true); scheduleHide(); };
  const handlePause = () => { setPlaying(false); setShowControls(true); clearTimeout(hideTimer.current); };
  const handleEnded = () => { setPlaying(false); setShowControls(true); };

  // ── Controls ──────────────────────────────────────────────────────────────

  const showFlash = icon => {
    setFlashIcon(icon);
    setTimeout(() => setFlashIcon(null), 600);
  };

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) { vid.play(); showFlash('play'); }
    else            { vid.pause(); showFlash('pause'); }
  };

  const toggleMute = () => setMuted(m => !m);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) containerRef.current.requestFullscreen();
    else document.exitFullscreen();
  };

  // Progress bar seek
  const seekTo = e => {
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (videoRef.current) videoRef.current.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  };

  const onProgressMouseDown = e => {
    scrubbing.current = true;
    seekTo(e);
    const onMove = e2 => { seekTo(e2); };
    const onUp = e2 => {
      seekTo(e2);
      scrubbing.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const progress  = duration ? (currentTime / duration) * 100 : 0;
  const buffPct   = duration ? (buffered / duration) * 100 : 0;
  const volIcon   = muted || volume === 0 ? <IcVolMute /> : volume < 0.5 ? <IcVolLow /> : <IcVolHigh />;
  const related   = allVideos.filter(v => v.name !== video.name);
  const title     = fmtTitle(video.name);

  return (
    <div className="min-h-full bg-[#0f0f0f] pb-10">
      {/* Back */}
      <div className="px-4 md:px-6 py-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
        >
          <IcBack /> Back to Library
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 px-4 md:px-6">

        {/* ── Left column: Player + Details ── */}
        <div className="flex-1 min-w-0">

          {/* Player container */}
          <div
            ref={containerRef}
            className="relative w-full aspect-video bg-black rounded-xl overflow-hidden select-none"
            onMouseMove={revealControls}
            onMouseLeave={() => playing && scheduleHide()}
          >
            {/* Video */}
            {url && (
              <video
                ref={videoRef}
                src={url}
                className="w-full h-full"
                autoPlay
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoaded}
                onPlay={handlePlay}
                onPause={handlePause}
                onEnded={handleEnded}
                onClick={togglePlay}
                style={{ cursor: showControls ? 'default' : 'none' }}
              />
            )}

            {/* Loading spinner */}
            {loadingUrl && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black">
                <div className="w-12 h-12 border-4 border-[#272727] border-t-red-600 rounded-full animate-spin" />
                <p className="text-gray-500 text-sm">Loading…</p>
              </div>
            )}

            {/* Error */}
            {urlError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
                <IcVolMute />
                <p className="text-red-400">Failed to load video</p>
                <p className="text-gray-600 text-xs">{urlError}</p>
              </div>
            )}

            {/* Center flash icon (play/pause feedback) */}
            {flashIcon && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center animate-ping-once">
                  {flashIcon === 'play' ? <IcPlay /> : <IcPause />}
                </div>
              </div>
            )}

            {/* Controls overlay */}
            <div
              className={`absolute inset-x-0 bottom-0 transition-opacity duration-300 ${showControls || !playing ? 'opacity-100' : 'opacity-0'}`}
              onClick={e => e.stopPropagation()}
            >
              {/* Gradient scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

              {/* Progress bar */}
              <div className="relative px-4 pt-8">
                <div
                  ref={progressRef}
                  className="relative w-full h-1 rounded-full cursor-pointer group/bar hover:h-2.5 transition-all duration-100"
                  style={{ background: 'rgba(255,255,255,0.2)' }}
                  onMouseDown={onProgressMouseDown}
                >
                  {/* Buffered */}
                  <div
                    className="absolute top-0 left-0 h-full rounded-full bg-white/30"
                    style={{ width: `${buffPct}%` }}
                  />
                  {/* Played */}
                  <div
                    className="absolute top-0 left-0 h-full rounded-full bg-red-600"
                    style={{ width: `${progress}%` }}
                  >
                    {/* Thumb dot */}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full shadow opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>

              {/* Bottom controls bar */}
              <div className="relative flex items-center gap-3 px-4 py-2.5">

                {/* Play / Pause */}
                <button
                  onClick={togglePlay}
                  className="text-white hover:text-gray-200 transition-colors shrink-0"
                >
                  {playing ? <IcPause /> : <IcPlay />}
                </button>

                {/* Volume: mute button + slider */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={toggleMute}
                    className="text-white hover:text-gray-200 transition-colors"
                  >
                    {volIcon}
                  </button>
                  <VolumeSlider
                    value={muted ? 0 : volume}
                    onChange={e => {
                      const v = parseFloat(e.target.value);
                      setVolume(v);
                      if (v > 0) setMuted(false);
                    }}
                  />
                </div>

                {/* Time */}
                <span className="text-white text-xs font-mono shrink-0">
                  {fmt(currentTime)} / {fmt(duration)}
                </span>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Fullscreen */}
                <button
                  onClick={toggleFullscreen}
                  className="text-white hover:text-gray-200 transition-colors shrink-0"
                >
                  {isFullscreen ? <IcExitFullscreen /> : <IcFullscreen />}
                </button>
              </div>
            </div>
          </div>

          {/* Video metadata */}
          <div className="mt-4 border-b border-[#272727] pb-4">
            <h1 className="text-white text-lg md:text-xl font-semibold leading-snug">{title}</h1>
            <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
              {/* Left: channel + date + size */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: avatarColor(video.name) }}
                  >
                    LB
                  </div>
                  <span className="text-white font-medium">Lustbuster</span>
                </div>
                <span>·</span>
                <span>{new Date(video.lastModified).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                <span>·</span>
                <span>{fmtSize(video.size)}</span>
                <span>·</span>
                <span>{fmtViews(viewCounts[video.name])}</span>
              </div>
              {/* Right: like button */}
              <LikeButton
                videoKey={video.name}
                onLikeChange={onLikeChange}
                onOpenAuth={onOpenAuth}
              />
            </div>
          </div>

          {/* Keyboard hints */}
          <div className="mt-3 flex flex-wrap gap-3">
            {[['Space', 'Play/Pause'], ['← →', 'Seek 5s'], ['↑ ↓', 'Volume'], ['M', 'Mute'], ['F', 'Fullscreen']].map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5 text-xs text-gray-600">
                <kbd className="px-1.5 py-0.5 bg-[#272727] text-gray-400 rounded text-[10px] font-mono">{k}</kbd>
                <span>{v}</span>
              </div>
            ))}
          </div>

          {/* Comments */}
          <CommentsSection videoKey={video.name} onOpenAuth={onOpenAuth} />
        </div>

        {/* ── Right column: Related videos ── */}
        <div className="lg:w-80 xl:w-96 shrink-0">
          <h3 className="text-white text-sm font-semibold mb-3">Up Next</h3>
          {related.length === 0 ? (
            <p className="text-gray-600 text-sm">No other videos in library.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {related.map(v => (
                <RelatedCard key={v.name} video={v} viewCount={viewCounts[v.name] || 0} onClick={() => onSelectVideo(v)} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default WatchPage;
