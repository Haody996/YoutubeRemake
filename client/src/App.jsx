import { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth, authFetch } from './context/AuthContext';
import VideoGallery from './components/VideoGallery';
import WatchPage from './components/WatchPage';
import HistoryPage from './components/HistoryPage';
import LibraryPage from './components/LibraryPage';
import AuthModal from './components/AuthModal';
import AgeGate from './components/AgeGate';

const API = import.meta.env.VITE_API_URL || '';

// ── Logo ──────────────────────────────────────────────────────────────────────

const Logo = ({ onClick }) => (
  <div className="select-none cursor-pointer" onClick={onClick}>
    <span className="text-[17px] font-black tracking-tight leading-none">
      <span className="text-white">LUST</span>
      <span className="text-red-500">BUSTER</span>
    </span>
  </div>
);

// ── User menu (avatar dropdown) ───────────────────────────────────────────────

const UserMenu = ({ onSignIn }) => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = e => { if (!menuRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!user) {
    return (
      <button
        onClick={onSignIn}
        className="flex items-center gap-2 border border-[#3f3f3f] hover:border-[#606060] text-white text-sm px-3 py-1.5 rounded-full transition-colors shrink-0"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-blue-400">
          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
        </svg>
        Sign in
      </button>
    );
  }

  const color = (() => {
    const cols = ['#e53e3e','#dd6b20','#d69e2e','#38a169','#3182ce','#805ad5','#d53f8c'];
    let h = 0;
    for (let i = 0; i < user.username.length; i++) h = (h * 31 + user.username.charCodeAt(i)) % cols.length;
    return cols[h];
  })();

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
        style={{ backgroundColor: color }}
        title={user.username}
      >
        {user.username[0].toUpperCase()}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-52 bg-[#212121] border border-[#3f3f3f] rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-[#3f3f3f]">
            <p className="text-white text-sm font-semibold">@{user.username}</p>
            <p className="text-gray-500 text-xs mt-0.5">Signed in</p>
          </div>
          <button
            onClick={() => { logout(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-[#272727] hover:text-white transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};

// ── Nav items ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  {
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg>,
    label: 'Home',
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z" /></svg>,
    label: 'Library',
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" /></svg>,
    label: 'History',
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>,
    label: 'Liked',
  },
];

// ── Inner app (needs AuthContext) ─────────────────────────────────────────────

const AppInner = () => {
  const { user } = useAuth();
  const [ageVerified, setAgeVerified]     = useState(() => localStorage.getItem('lb_age_ok') === '1');
  const [search, setSearch]               = useState('');
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [watchingVideo, setWatchingVideo] = useState(null);
  const [allVideos, setAllVideos]         = useState([]);
  const [activeNav, setActiveNav]         = useState('Home');
  const [showAuth, setShowAuth]           = useState(false);
  const [likedKeys, setLikedKeys]         = useState(new Set());
  const [viewCounts, setViewCounts]       = useState({});
  const mainRef                           = useRef(null);

  // Fetch video list
  const refreshVideos = () => {
    fetch(`${API}/api/videos`)
      .then(r => r.json())
      .then(setAllVideos)
      .catch(() => {});
  };

  useEffect(() => { refreshVideos(); }, []);

  // Fetch all view counts whenever video list loads
  useEffect(() => {
    if (allVideos.length === 0) return;
    fetch(`${API}/api/views/all`)
      .then(r => r.json())
      .then(setViewCounts)
      .catch(() => {});
  }, [allVideos.length]);

  // Sync liked keys whenever user logs in / out
  useEffect(() => {
    if (!user) { setLikedKeys(new Set()); return; }
    authFetch(`${API}/api/likes/my`)
      .then(r => r.json())
      .then(keys => setLikedKeys(new Set(keys)))
      .catch(() => {});
  }, [user?.id]);

  // Scroll to top when a video is opened
  useEffect(() => {
    if (watchingVideo) mainRef.current?.scrollTo(0, 0);
  }, [watchingVideo?.name]);

  // Record watch history whenever a video is opened
  useEffect(() => {
    if (!watchingVideo || !user) return;
    authFetch(`${API}/api/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoKey: watchingVideo.name }),
    }).catch(() => {});
  }, [watchingVideo?.name, user?.id]);

  // Record view and update local count whenever a video is opened
  useEffect(() => {
    if (!watchingVideo) return;
    fetch(`${API}/api/views`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoKey: watchingVideo.name }),
    })
      .then(r => r.json())
      .then(({ count }) => setViewCounts(prev => ({ ...prev, [watchingVideo.name]: count })))
      .catch(() => {});
  }, [watchingVideo?.name]);

  const handleLikeChange = (videoKey, isLiked) => {
    setLikedKeys(prev => {
      const next = new Set(prev);
      if (isLiked) next.add(videoKey); else next.delete(videoKey);
      return next;
    });
  };

  const handleNavClick = label => {
    if ((label === 'Liked' || label === 'History' || label === 'Library') && !user) { setShowAuth(true); return; }
    setActiveNav(label);
    if (label === 'Home') { setWatchingVideo(null); setSearch(''); }
    else setWatchingVideo(null);
    setSidebarOpen(false);
  };

  const goHome = () => { setWatchingVideo(null); setSearch(''); setActiveNav('Home'); };

  if (!ageVerified) return (
    <AgeGate onEnter={() => { localStorage.setItem('lb_age_ok', '1'); setAgeVerified(true); }} />
  );

  return (
    <div className="flex flex-col h-screen bg-[#0f0f0f] text-white overflow-hidden">

      {/* ── Navbar ── */}
      <nav className="h-14 px-4 flex items-center justify-between fixed top-0 w-full bg-[#0f0f0f] z-40 border-b border-[#272727] gap-4">
        {/* Left */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-2 rounded-full hover:bg-[#272727] transition md:hidden"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
            </svg>
          </button>
          <Logo onClick={goHome} />
        </div>

        {/* Center: search */}
        {!watchingVideo && (
          <div className="flex-1 max-w-xl">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search"
                className="w-full bg-[#121212] border border-[#3f3f3f] rounded-full pl-5 pr-12 py-2 text-sm focus:outline-none focus:border-[#1c62b9] transition-colors"
              />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Right: user */}
        <UserMenu onSignIn={() => setShowAuth(true)} />
      </nav>

      <div className="flex pt-14 h-full overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className={`
          fixed md:relative top-14 md:top-0 left-0 z-30 h-[calc(100vh-3.5rem)] md:h-full
          w-60 bg-[#0f0f0f] border-r border-[#272727] flex-col p-3 overflow-y-auto shrink-0
          transition-transform duration-200
          ${sidebarOpen ? 'flex translate-x-0' : 'hidden md:flex'}
        `}>
          <ul className="space-y-0.5">
            {NAV_ITEMS.map(item => (
              <li
                key={item.label}
                onClick={() => handleNavClick(item.label)}
                className={`flex items-center gap-5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors text-sm font-medium
                  ${activeNav === item.label && !watchingVideo
                    ? 'bg-[#272727] text-white'
                    : 'text-[#aaa] hover:bg-[#272727]/60 hover:text-white'}`}
              >
                {item.icon}
                {item.label}
              </li>
            ))}
          </ul>
          <div className="mt-6 px-3">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-3">About</p>
            <div className="flex flex-col gap-1 text-xs text-gray-600">
              <span>© 2026 Lustbuster</span>
              <span>Private streaming service</span>
            </div>
          </div>
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ── Main content ── */}
        <main ref={mainRef} className="flex-1 overflow-y-auto">
          {watchingVideo ? (
            <WatchPage
              video={watchingVideo}
              allVideos={allVideos}
              viewCounts={viewCounts}
              onBack={() => setWatchingVideo(null)}
              onSelectVideo={setWatchingVideo}
              onOpenAuth={() => setShowAuth(true)}
              onLikeChange={handleLikeChange}
            />
          ) : activeNav === 'Library' ? (
            <LibraryPage
              allVideos={allVideos}
              onSelectVideo={setWatchingVideo}
              onRefreshVideos={refreshVideos}
            />
          ) : activeNav === 'History' ? (
            <HistoryPage
              allVideos={allVideos}
              onSelectVideo={setWatchingVideo}
            />
          ) : activeNav === 'Liked' ? (
            <div className="p-4 md:p-6">
              <div className="flex items-center gap-3 mb-6">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-red-500">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                <h2 className="text-white text-xl font-bold">Liked Videos</h2>
                <span className="text-gray-500 text-sm">({likedKeys.size})</span>
              </div>
              {likedKeys.size === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-gray-600">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16 mb-4 opacity-20">
                    <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z" />
                  </svg>
                  <p className="text-lg">No liked videos yet</p>
                  <p className="text-sm mt-1">Videos you like will appear here</p>
                </div>
              ) : (
                <VideoGallery
                  allVideos={allVideos.filter(v => likedKeys.has(v.name))}
                  viewCounts={viewCounts}
                  onSelectVideo={setWatchingVideo}
                />
              )}
            </div>
          ) : (
            <div className="p-4 md:p-6">
              {search && (
                <p className="text-sm text-gray-400 mb-5">
                  Search results for <span className="text-white font-medium">"{search}"</span>
                </p>
              )}
              <VideoGallery
                searchQuery={search}
                allVideos={allVideos}
                viewCounts={viewCounts}
                onSelectVideo={setWatchingVideo}
              />
            </div>
          )}
        </main>
      </div>

      {/* ── Auth modal ── */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
};

// ── Root App (provides context) ───────────────────────────────────────────────

const App = () => (
  <AuthProvider>
    <AppInner />
  </AuthProvider>
);

export default App;
