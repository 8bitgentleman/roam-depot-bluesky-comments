import React, { useState, useEffect, useCallback } from 'react';
import { BskyAgent } from '@atproto/api';

const getRelativeTime = (indexedAt) => {
  const now = new Date();
  const postDate = new Date(indexedAt);
  const diffInSeconds = Math.floor((now - postDate) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return postDate.toLocaleDateString();
};

const MediaGallery = ({ embed }) => {
  if (!embed?.images?.length) return null;

  const imageCount = embed.images.length;
  const gridClass = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-2",
    4: "grid-cols-2"
  }[imageCount] || "grid-cols-2";

  return (
    <div className={`grid ${gridClass} gap-2 my-2`}>
      {embed.images.map((image, idx) => (
        <div
          key={image.fullsize}
          className={`${imageCount === 3 && idx === 2 ? 'col-span-2' : ''} relative aspect-square`}
        >
          <img
            src={image.thumb}
            alt={image.alt}
            className="object-cover w-full h-full rounded-md cursor-pointer"
            onClick={() => window.open(image.fullsize, '_blank')}
          />
        </div>
      ))}
    </div>
  );
};

const QuotedPost = ({ record }) => {
  if (!record) return null;

  return (
    <div className="mt-2 border-l-4 border-gray-200 pl-3">
      <div className="text-sm">
        <span className="font-bold">{record.author.displayName}</span>
        <span className="text-gray-500 ml-2">@{record.author.handle}</span>
      </div>
      <div className="text-sm">{record.value.text}</div>
      <MediaGallery embed={record.embeds?.[0]} />
    </div>
  );
};

const renderTextWithEntities = (text, facets) => {
  if (!facets?.length) return text;

  if (!facets || !Array.isArray(facets)) {
    return text;
  }

  let segments = [];
  let lastIndex = 0;

  const sortedFacets = [...facets].sort((a, b) => a.index.start - b.index.start);

  sortedFacets.forEach((facet, idx) => {
    // Add plain text before the entity
    if (facet.index.start > lastIndex) {
      segments.push(<span key={`text-${idx}`}>{text.slice(lastIndex, facet.index.start)}</span>);
    }
    
    const entityText = text.slice(facet.index.start, facet.index.end);

    // Create appropriate link based on facet type
    if (facet.features?.[0]?.uri) {
      segments.push(
        <a
          key={`link-${idx}`}
          href={facet.features[0].uri}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          {entityText}
        </a>
      );
    } else if (facet.features?.[0]?.did) {
      segments.push(
        <a
          key={`mention-${idx}`}
          href={`https://bsky.app/profile/${facet.features[0].did}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          {entityText}
        </a>
      );
    } else {
      segments.push(entityText);
    }

    lastIndex = facet.index.end;
  });

  // Add any remaining text
  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex));
  }

  return segments;
};

const BlueskyPost = ({ url, extensionAPI }) => {
  const [thread, setThread] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [pollingLoading, setPollingLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [displayedReplies, setDisplayedReplies] = useState(3);
  const [expandedReplies, setExpandedReplies] = useState(new Set());

  const fetchThread = useCallback(async (isPolling = false) => {
    const timestamp = new Date().toLocaleTimeString();
    console.group(`[${timestamp}] ${isPolling ? 'Polling: ' : ''}Thread Fetch`);

    if (!url) {
      console.error('No URL provided');
      console.groupEnd();
      setError("No URL provided");
      setInitialLoading(false);
      return;
    }

    if (isPolling) {
      setPollingLoading(true);
    }

    try {
      console.log('Fetching with URL:', url);
      const loginInfo = await extensionAPI.settings.get("loginInfo");
      const service = loginInfo ? 'https://bsky.social' : 'https://public.api.bsky.app';
      console.log('Using service:', service);

      const agent = new BskyAgent({ service });

      if (loginInfo?.username && loginInfo?.password) {
        try {
          await agent.login({
            identifier: loginInfo.username,
            password: loginInfo.password,
          });
          setIsAuthenticated(true);
        } catch (loginError) {
          console.warn('Login failed:', loginError);
          setIsAuthenticated(false);
        }
      }

      const parts = url.split('/');
      const postId = parts.pop();
      const username = parts[parts.indexOf('profile') + 1];

      if (!postId || !username) {
        throw new Error('Invalid Bluesky URL format');
      }

      const postUri = `at://${username}/app.bsky.feed.post/${postId}`;
      const response = await agent.getPostThread({ uri: postUri });

      console.log('Thread fetched:', {
        replyCount: response.data.thread.replies?.length || 0,
        lastReply: response.data.thread.replies?.[0]?.post?.record?.text
      });
      console.groupEnd();

      setThread(response.data.thread);
      setError(null);
    } catch (e) {
      console.error('Error fetching thread:', e);
      setError(e.message);
    } finally {
      setInitialLoading(false);
      setPollingLoading(false);
    }
  }, [url, extensionAPI]);

  // Initial fetch
  useEffect(() => {
    fetchThread(false);
  }, [fetchThread]);

  // Setup polling
  useEffect(() => {
    const pollInterval = setInterval(() => fetchThread(true), 30000);
    return () => clearInterval(pollInterval);
  }, [fetchThread]);

  // Setup polling
  useEffect(() => {
    const pollInterval = setInterval(fetchThread, 30000); // Poll every 30 seconds
    return () => clearInterval(pollInterval); // Cleanup on unmount
  }, [fetchThread]);

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="bp3-spinner">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Error loading thread: {error}
        {!isAuthenticated && (
          <div className="mt-2 text-sm">
            Note: Viewing as guest. Please log in via extension settings.
          </div>
        )}
      </div>
    );
  }

  if (!thread) return null;

  return (
    <div className="bluesky-thread p-4 border rounded-md">
      {pollingLoading && (
        <div className="absolute top-2 right-2">
          <div className="bp3-spinner bp3-small" />
        </div>
      )}
      <div className="author-info">
        <a href={`https://bsky.app/profile/${thread.post.author.did}`} target="_blank" rel="noopener noreferrer nofollow">
          <div className="avatar">
            {thread.post.author.avatar && (
              <img
                src={thread.post.author.avatar}
                alt={thread.post.author.displayName}
              />
            )}
          </div>
        </a>
        <div>
          <a href={`https://bsky.app/profile/${thread.post.author.did}`} target="_blank" rel="noopener noreferrer nofollow" className="author-name">
            <p>{thread.post.author.displayName}</p>
          </a>
          <a href={`https://bsky.app/profile/${thread.post.author.did}`} target="_blank" rel="noopener noreferrer nofollow" className="author-handle">
            <p>@{thread.post.author.handle}</p>
          </a>
        </div>
        <a href={`https://bsky.app/profile/${thread.post.author.did}/post/${thread.post.uri.split('/').pop()}`} target="_blank" rel="noopener noreferrer nofollow" className="bluesky-logo-link">
          <img
            src="data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20fill='none'%20viewBox='0%200%20320%20286'%3e%3cpath%20fill='rgb(10,122,255)'%20d='M69.364%2019.146c36.687%2027.806%2076.147%2084.186%2090.636%20114.439%2014.489-30.253%2053.948-86.633%2090.636-114.439C277.107-.917%20320-16.44%20320%2032.957c0%209.865-5.603%2082.875-8.889%2094.729-11.423%2041.208-53.045%2051.719-90.071%2045.357%2064.719%2011.12%2081.182%2047.953%2045.627%2084.785-80%2082.874-106.667-44.333-106.667-44.333s-26.667%20127.207-106.667%2044.333c-35.555-36.832-19.092-73.665%2045.627-84.785-37.026%206.362-78.648-4.149-90.071-45.357C5.603%20115.832%200%2042.822%200%2032.957%200-16.44%2042.893-.917%2069.364%2019.147Z'/%3e%3c/svg%3e"
            className="bluesky-logo"
            alt="Bluesky logo"
          />
        </a>
      </div>
      <div className="post-content">
        {renderTextWithEntities(thread.post.record.text, thread.post.record.facets)}
        <MediaGallery embed={thread.post.embed} />
        {thread.post.record.embed?.record && (
          <QuotedPost record={thread.post.record.embed.record} />
        )}
      </div>
      <div className="mt-4">
        <div className="text-sm text-gray-500 mb-3">
          {thread.replies?.length || 0} replies
          {!isAuthenticated && (
            <span className="ml-2 text-xs text-gray-400">(Viewing as guest)</span>
          )}
        </div>

        {/* Render limited number of immediate replies */}
        {thread.replies?.slice(0, displayedReplies).map((reply) => (
          <div key={reply.post.uri} className="ml-4 mt-3 pt-3 border-t">
            <div className="post-header flex items-center mb-2">
              {reply.post.author.avatar && (
                <img
                  src={reply.post.author.avatar}
                  alt={reply.post.author.displayName}
                  className="w-6 h-6 rounded-full mr-2"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center">
                  <span className="font-bold text-sm">{reply.post.author.displayName}</span>
                  <span className="text-xs text-gray-500 ml-2">@{reply.post.author.handle}</span>
                  <span className="text-xs text-gray-500 ml-2">·</span>
                  <span className="text-xs text-gray-500 ml-2" title={new Date(reply.post.indexedAt).toLocaleString()}>
                    {getRelativeTime(reply.post.indexedAt)}
                  </span>
                </div>
              </div>
            </div>
            <div className="post-content text-sm">
              {renderTextWithEntities(reply.post.record.text, reply.post.record.facets)}
              <MediaGallery embed={reply.post.embed} />
              {reply.post.record.embed?.record && (
                <QuotedPost record={reply.post.record.embed.record} />
              )}
            </div>

            {/* Show nested replies button if reply has replies */}
            {reply.replies?.length > 0 && (
              <div className="mt-2">
                <button
                  className="bp3-button bp3-minimal bp3-small"
                  onClick={() => {
                    setExpandedReplies(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(reply.post.uri)) {
                        newSet.delete(reply.post.uri);
                      } else {
                        newSet.add(reply.post.uri);
                      }
                      return newSet;
                    });
                  }}
                >
                  {expandedReplies.has(reply.post.uri) ? 'Hide' : 'Show'} {reply.replies.length} {reply.replies.length === 1 ? 'reply' : 'replies'}
                </button>
              </div>
            )}

            {/* Render nested replies if expanded */}
            {expandedReplies.has(reply.post.uri) && reply.replies?.map(nestedReply => (
              <div key={nestedReply.post.uri} className="ml-4 mt-2 pt-2 border-l border-gray-200">
                <div className="post-header flex items-center mb-1">
                  {nestedReply.post.author.avatar && (
                    <img
                      src={nestedReply.post.author.avatar}
                      alt={nestedReply.post.author.displayName}
                      className="w-5 h-5 rounded-full mr-2"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center">
                      <span className="font-bold text-sm">{nestedReply.post.author.displayName}</span>
                      <span className="text-xs text-gray-500 ml-2">@{nestedReply.post.author.handle}</span>
                      <span className="text-xs text-gray-500 ml-2">·</span>
                      <span className="text-xs text-gray-500 ml-2" title={new Date(nestedReply.post.indexedAt).toLocaleString()}>
                        {getRelativeTime(nestedReply.post.indexedAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="post-content text-sm">
                  {nestedReply.post.record.text}
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Show more button if there are more replies */}
        {thread.replies && displayedReplies < thread.replies.length && (
          <div className="mt-3 ml-4">
            <button
              className="bp3-button bp3-minimal bp3-small"
              onClick={() => setDisplayedReplies(prev => prev + 3)}
            >
              Show more replies ({thread.replies.length - displayedReplies} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlueskyPost;