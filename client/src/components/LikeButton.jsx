import { useState, useEffect } from 'react';
import { useAuth, authFetch } from '../context/AuthContext';

const API = import.meta.env.VITE_API_URL || '';

const HeartFilled = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);

const HeartOutline = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z" />
  </svg>
);

const LikeButton = ({ videoKey, onLikeChange, onOpenAuth }) => {
  const { user } = useAuth();
  const [liked, setLiked]       = useState(false);
  const [count, setCount]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [toggling, setToggling] = useState(false);

  // Fetch status whenever videoKey or user changes
  useEffect(() => {
    setLoading(true);
    authFetch(`${API}/api/likes/video?videoKey=${encodeURIComponent(videoKey)}`)
      .then(r => r.json())
      .then(d => { setLiked(d.liked); setCount(d.count); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [videoKey, user?.id]);

  const toggle = async () => {
    if (!user) { onOpenAuth?.(); return; }
    if (toggling) return;
    setToggling(true);

    // Optimistic update
    const wasLiked = liked;
    setLiked(!wasLiked);
    setCount(c => wasLiked ? Math.max(0, c - 1) : c + 1);

    try {
      const res = await authFetch(
        wasLiked
          ? `${API}/api/likes?videoKey=${encodeURIComponent(videoKey)}`
          : `${API}/api/likes`,
        {
          method: wasLiked ? 'DELETE' : 'POST',
          headers: wasLiked ? undefined : { 'Content-Type': 'application/json' },
          body: wasLiked ? undefined : JSON.stringify({ videoKey }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setLiked(data.liked);
        setCount(data.count);
        onLikeChange?.(videoKey, data.liked);
      } else {
        // Revert on failure
        setLiked(wasLiked);
        setCount(c => wasLiked ? c + 1 : Math.max(0, c - 1));
      }
    } catch {
      setLiked(wasLiked);
      setCount(c => wasLiked ? c + 1 : Math.max(0, c - 1));
    } finally {
      setToggling(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={!user ? 'Sign in to like' : liked ? 'Unlike' : 'Like'}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
        transition-all duration-150 disabled:opacity-50
        ${liked
          ? 'bg-red-600 text-white hover:bg-red-700'
          : 'bg-[#272727] text-white hover:bg-[#3f3f3f]'
        }
        ${toggling ? 'scale-95' : 'scale-100'}
      `}
    >
      <span className={`transition-transform duration-150 ${toggling ? 'scale-110' : ''}`}>
        {liked ? <HeartFilled /> : <HeartOutline />}
      </span>
      <span>{count > 0 ? count.toLocaleString() : ''} {count === 1 ? 'Like' : 'Likes'}</span>
    </button>
  );
};

export default LikeButton;
