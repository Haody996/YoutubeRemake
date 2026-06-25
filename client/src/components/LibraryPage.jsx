import { useState, useEffect, useRef } from 'react';
import { authFetch, getToken, useAuth } from '../context/AuthContext';

const formatSize = bytes => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const timeAgo = dateStr => {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

// ── Per-video card with thumbnail + delete ────────────────────────────────────

const LibraryCard = ({ video, onSelect, onDelete }) => {
  const [thumb, setThumb] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/videos/thumbnail?key=${encodeURIComponent(video.name)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled && data?.url) setThumb(data.url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [video.name]);

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await authFetch(`/api/videos/my?key=${encodeURIComponent(video.name)}`, { method: 'DELETE' });
      onDelete(video.name);
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const title = video.title || video.name.split('/').pop().replace(/\.[^.]+$/, '');

  return (
    <div className="group relative bg-[#1a1a1a] rounded-xl overflow-hidden">
      {/* Thumbnail */}
      <div className="aspect-video bg-[#272727] relative cursor-pointer" onClick={() => onSelect(video)}>
        {thumb
          ? <img src={thumb} className="w-full h-full object-cover" alt="" />
          : <div className="w-full h-full flex items-center justify-center text-gray-600">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 animate-pulse">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
        }
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-white">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-white text-sm font-medium line-clamp-1">{title}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-gray-500 text-xs">{timeAgo(video.lastModified)}</span>
          <span className="text-gray-500 text-xs">{formatSize(video.size)}</span>
        </div>
      </div>

      {/* Delete button */}
      <div className="absolute top-2 right-2">
        {confirmDelete ? (
          <div className="flex gap-1">
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs bg-[#272727] text-gray-300 px-2 py-1 rounded"
            >No</button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded"
            >{deleting ? '…' : 'Yes'}</button>
          </div>
        ) : (
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 bg-black/70 hover:bg-red-600 text-white p-1.5 rounded-lg transition-all"
            title="Delete video"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

// ── Upload panel ──────────────────────────────────────────────────────────────

const UploadPanel = ({ onDone, isAdmin }) => {
  const [file, setFile] = useState(null);
  const [thumbFile, setThumbFile] = useState(null);
  const [thumbPreview, setThumbPreview] = useState(null);
  const [progress, setProgress] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const thumbInputRef = useRef(null);
  const xhrRef = useRef(null);

  const maxBytes = isAdmin ? 5 * 1024 * 1024 * 1024 : 300 * 1024 * 1024;
  const maxLabel = isAdmin ? '5 GB' : '300 MB';

  const pick = f => {
    if (!f?.type?.startsWith('video/')) { setError('Please select a video file'); return; }
    if (f.size > maxBytes) { setError(`File too large. Maximum size is ${maxLabel}.`); return; }
    setFile(f); setError('');
  };

  const pickThumb = f => {
    if (!f?.type?.startsWith('image/')) return;
    setThumbFile(f);
    const url = URL.createObjectURL(f);
    setThumbPreview(url);
  };

  const clearThumb = () => {
    if (thumbPreview) URL.revokeObjectURL(thumbPreview);
    setThumbFile(null);
    setThumbPreview(null);
  };

  const upload = () => {
    if (!file) return;
    setProgress(0);
    setStatus('Uploading video…');
    setError('');
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 100));
    });
    xhr.addEventListener('load', async () => {
      if (xhr.status === 200) {
        const { key } = JSON.parse(xhr.responseText);
        if (thumbFile && key) {
          setStatus('Uploading thumbnail…');
          try {
            await fetch('/api/videos/thumbnail/upload', {
              method: 'POST',
              headers: {
                'Content-Type': thumbFile.type,
                'X-Video-Key': encodeURIComponent(key),
                'Authorization': `Bearer ${getToken()}`,
              },
              body: thumbFile,
            });
          } catch { /* thumbnail upload failure is non-fatal */ }
        }
        setStatus('Done!');
        setProgress(100);
        setTimeout(onDone, 800);
      } else {
        try { setError(JSON.parse(xhr.responseText).error || 'Upload failed.'); }
        catch { setError('Upload failed. Please try again.'); }
        setProgress(null);
        setStatus('');
      }
    });
    xhr.addEventListener('error', () => { setError('Upload failed.'); setProgress(null); setStatus(''); });
    xhr.addEventListener('abort', () => { setProgress(null); setFile(null); setStatus(''); });
    xhr.open('POST', '/api/videos/upload');
    xhr.setRequestHeader('X-Filename', encodeURIComponent(file.name));
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);
    xhr.send(file);
  };

  return (
    <div className="bg-[#1a1a1a] rounded-2xl p-6 mb-6 border border-[#3f3f3f]">
      {/* Drop zone */}
      {!file && progress === null && (
        <div
          className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 transition-colors cursor-pointer
            ${dragging ? 'border-red-500 bg-red-500/5' : 'border-[#3f3f3f] hover:border-[#606060]'}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current?.click()}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-gray-500">
            <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
          </svg>
          <p className="text-white font-medium">Drop video here or click to browse</p>
          <p className="text-gray-500 text-sm">MP4, MOV, AVI, MKV and more · max {maxLabel}</p>
          <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={e => pick(e.target.files[0])} />
        </div>
      )}

      {/* File selected, ready to upload */}
      {file && progress === null && (
        <div className="flex flex-col gap-4">
          {/* Video row */}
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-red-500 shrink-0">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{file.name}</p>
              <p className="text-gray-500 text-sm">{formatSize(file.size)}</p>
            </div>
            <button onClick={() => { setFile(null); clearThumb(); }} className="text-gray-500 hover:text-white p-2 transition-colors">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>

          {/* Thumbnail picker */}
          <div className="border-t border-[#2f2f2f] pt-4">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">Thumbnail (optional)</p>
            {thumbPreview ? (
              <div className="flex items-center gap-3">
                <img src={thumbPreview} className="w-24 aspect-video object-cover rounded-lg border border-[#3f3f3f]" alt="" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{thumbFile.name}</p>
                  <p className="text-gray-500 text-xs">{formatSize(thumbFile.size)}</p>
                </div>
                <button onClick={clearThumb} className="text-gray-500 hover:text-white p-2 transition-colors shrink-0">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => thumbInputRef.current?.click()}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-dashed border-[#3f3f3f] hover:border-[#606060] px-4 py-2.5 rounded-lg transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                </svg>
                Add thumbnail image
              </button>
            )}
            <input ref={thumbInputRef} type="file" accept="image/*" className="hidden" onChange={e => pickThumb(e.target.files[0])} />
          </div>

          <button onClick={upload} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg font-medium transition-colors self-end">
            Upload
          </button>
        </div>
      )}

      {/* Progress */}
      {progress !== null && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white text-sm font-medium">
              {progress < 100 ? `${status} ${progress}%` : status}
            </span>
            {progress < 100 && (
              <button onClick={() => xhrRef.current?.abort()} className="text-gray-500 hover:text-white text-sm transition-colors">
                Cancel
              </button>
            )}
          </div>
          <div className="h-2 bg-[#3f3f3f] rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all duration-200 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

const LibraryPage = ({ allVideos, onSelectVideo, onRefreshVideos }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [myVideos, setMyVideos] = useState(null);
  const [showUpload, setShowUpload] = useState(false);

  const load = () => {
    authFetch('/api/videos/my')
      .then(r => r.json())
      .then(setMyVideos)
      .catch(() => setMyVideos([]));
  };

  useEffect(() => { load(); }, []);

  const handleUploadDone = () => {
    load();
    onRefreshVideos();
    setShowUpload(false);
  };

  const handleDelete = key => {
    setMyVideos(prev => prev.filter(v => v.name !== key));
    onRefreshVideos();
  };

  // Merge with allVideos so WatchPage gets full metadata
  const findVideo = v => allVideos.find(a => a.name === v.name) || v;

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-red-500">
            <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z" />
          </svg>
          <h2 className="text-white text-xl font-bold">My Library</h2>
          {myVideos && (
            <span className="text-gray-500 text-sm">
              {isAdmin
                ? `(${myVideos.length} · unlimited)`
                : `(${myVideos.length} / 1)`}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowUpload(v => !v)}
          disabled={!isAdmin && myVideos?.length >= 1 && !showUpload}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          title={!isAdmin && myVideos?.length >= 1 ? 'Delete your existing video to upload a new one' : ''}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" />
          </svg>
          {showUpload ? 'Close' : 'Upload'}
        </button>
      </div>

      {/* Upload panel */}
      {showUpload && <UploadPanel onDone={handleUploadDone} isAdmin={isAdmin} />}

      {/* Grid */}
      {myVideos === null ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[#1a1a1a] rounded-xl overflow-hidden animate-pulse">
              <div className="aspect-video bg-[#272727]" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-[#272727] rounded w-3/4" />
                <div className="h-3 bg-[#272727] rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : myVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-600">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16 mb-4 opacity-20">
            <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
          </svg>
          <p className="text-lg">No videos uploaded yet</p>
          <p className="text-sm mt-1">Click Upload to add your first video</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {myVideos.map(video => (
            <LibraryCard
              key={video.name}
              video={video}
              onSelect={v => onSelectVideo(findVideo(v))}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default LibraryPage;
