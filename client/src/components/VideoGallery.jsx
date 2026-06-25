import VideoCard from './VideoCard';

const SkeletonCard = () => (
  <div className="flex flex-col gap-2 animate-pulse">
    <div className="w-full aspect-video bg-[#272727] rounded-xl" />
    <div className="flex gap-3 px-1">
      <div className="w-9 h-9 rounded-full bg-[#272727] shrink-0 mt-1" />
      <div className="flex flex-col gap-2 flex-1 pt-1">
        <div className="h-4 bg-[#272727] rounded w-3/4" />
        <div className="h-3 bg-[#272727] rounded w-1/2" />
        <div className="h-3 bg-[#272727] rounded w-1/3" />
      </div>
    </div>
  </div>
);

const EmptyState = ({ query }) => (
  <div className="flex flex-col items-center justify-center py-24 text-gray-500 col-span-full">
    <svg className="w-16 h-16 mb-4 opacity-30" fill="currentColor" viewBox="0 0 24 24">
      <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
    </svg>
    {query
      ? <p className="text-lg">No results for <span className="text-white">"{query}"</span></p>
      : <p className="text-lg">No videos found in library</p>}
  </div>
);

// allVideos comes from App (already fetched), loading = empty array before data arrives
const VideoGallery = ({ searchQuery, allVideos = [], viewCounts = {}, onSelectVideo }) => {
  const loading = allVideos.length === 0 && !searchQuery;

  const filtered = searchQuery
    ? allVideos.filter(v => v.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : allVideos;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
      {loading
        ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
        : filtered.length === 0
          ? <EmptyState query={searchQuery} />
          : filtered.map(video => (
              <VideoCard
                key={video.name}
                video={video}
                viewCount={viewCounts[video.name] || 0}
                onClick={() => onSelectVideo(video)}
              />
            ))
      }
    </div>
  );
};

export default VideoGallery;
