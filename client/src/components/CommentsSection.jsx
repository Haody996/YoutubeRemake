import { useState, useEffect, useRef } from 'react';
import { useAuth, authFetch } from '../context/AuthContext';

const API = import.meta.env.VITE_API_URL || '';

const relativeTime = iso => {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const avatarColor = name => {
  const cols = ['#e53e3e','#dd6b20','#d69e2e','#38a169','#3182ce','#805ad5','#d53f8c'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % cols.length;
  return cols[h];
};

const Avatar = ({ username, size = 8 }) => (
  <div
    className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0`}
    style={{ backgroundColor: avatarColor(username) }}
  >
    {username[0].toUpperCase()}
  </div>
);

const CommentsSection = ({ videoKey, onOpenAuth }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/comments?videoKey=${encodeURIComponent(videoKey)}`)
      .then(r => r.json())
      .then(data => { setComments(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [videoKey]);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await authFetch(`${API}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoKey, content: text.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments(prev => [data, ...prev]);
        setText('');
        setFocused(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async id => {
    setDeletingId(id);
    try {
      const res = await authFetch(`${API}/api/comments/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) setComments(prev => prev.filter(c => c.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancel = () => {
    setText('');
    setFocused(false);
    textareaRef.current?.blur();
  };

  return (
    <div className="mt-6 border-t border-[#272727] pt-6">
      <h3 className="text-white font-semibold mb-5">
        {loading ? 'Comments' : `${comments.length} Comment${comments.length !== 1 ? 's' : ''}`}
      </h3>

      {/* Comment input */}
      <div className="flex gap-3 mb-6">
        {user
          ? <Avatar username={user.username} />
          : <div className="w-8 h-8 rounded-full bg-[#272727] shrink-0" />
        }

        <div className="flex-1">
          {user ? (
            <form onSubmit={handleSubmit}>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onFocus={() => setFocused(true)}
                placeholder="Add a comment…"
                rows={focused ? 3 : 1}
                maxLength={1000}
                className="w-full bg-transparent border-b border-[#3f3f3f] focus:border-white text-white text-sm placeholder-gray-600 focus:outline-none resize-none transition-all duration-150 pb-1"
              />
              {focused && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-600">{text.length}/1000</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-4 py-1.5 text-sm text-gray-400 hover:text-white rounded-full hover:bg-[#272727] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!text.trim() || submitting}
                      className="px-4 py-1.5 text-sm font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full transition-colors"
                    >
                      {submitting ? 'Posting…' : 'Comment'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          ) : (
            <button
              onClick={onOpenAuth}
              className="w-full text-left border-b border-[#3f3f3f] text-gray-600 text-sm pb-1 hover:border-white hover:text-gray-400 transition-colors"
            >
              Sign in to comment…
            </button>
          )}
        </div>
      </div>

      {/* Comment list */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-[#272727] shrink-0" />
              <div className="flex-1 flex flex-col gap-2 pt-1">
                <div className="h-3 bg-[#272727] rounded w-1/4" />
                <div className="h-3 bg-[#272727] rounded w-3/4" />
                <div className="h-3 bg-[#272727] rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-8">No comments yet. Be the first!</p>
      ) : (
        <div className="flex flex-col gap-5">
          {comments.map(c => (
            <div key={c.id} className="flex gap-3 group">
              <Avatar username={c.username} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white text-xs font-semibold">@{c.username}</span>
                  <span className="text-gray-600 text-xs">{relativeTime(c.created_at)}</span>
                </div>
                <p className="text-[#d1d1d1] text-sm mt-1 leading-relaxed whitespace-pre-wrap break-words">
                  {c.content}
                </p>
              </div>
              {/* Delete button (own comments only) */}
              {user?.id === c.user_id && (
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-500 transition-all shrink-0 mt-0.5"
                  title="Delete comment"
                >
                  {deletingId === c.id
                    ? <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    : <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                      </svg>
                  }
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentsSection;
