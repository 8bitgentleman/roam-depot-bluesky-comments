// src/components/BlueskyPost.jsx
import React, { useState, useEffect } from 'react';
import { BskyAgent } from '@atproto/api';

const BlueskyPost = ({ url, extensionAPI }) => {
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [displayedReplies, setDisplayedReplies] = useState(3);
  const [expandedReplies, setExpandedReplies] = useState(new Set());

  // Utility function to format timestamps
  const getRelativeTime = (indexedAt) => {
    const now = new Date();
    const postDate = new Date(indexedAt);
    const diffInSeconds = Math.floor((now - postDate) / 1000);

    if (diffInSeconds < 60) {
      return 'just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    } else {
      return postDate.toLocaleDateString();
    }
  }
  useEffect(() => {
    const fetchThread = async () => {
      try {
        const loginInfo = await extensionAPI.settings.get("loginInfo");
        const service = loginInfo ? 'https://bsky.social' : 'https://public.api.bsky.app';
        const agent = new BskyAgent({ service });

        // Try to login if we have credentials
        if (loginInfo?.username && loginInfo?.password) {
          try {
            await agent.login({
              identifier: loginInfo.username,
              password: loginInfo.password,
            });
            setIsAuthenticated(true);
          } catch (loginError) {
            console.warn('Login failed:', loginError);
            // Continue without authentication using public API
            setIsAuthenticated(false);
          }
        }

        // Extract post identifier from URL
        // Convert from https://bsky.app/profile/username.bsky.social/post/postid
        // to at://username.bsky.social/app.bsky.feed.post/postid
        const parts = url.split('/');
        const postId = parts.pop(); // Get the post ID
        const username = parts[parts.indexOf('profile') + 1]; // Get username
        const postUri = `at://${username}/app.bsky.feed.post/${postId}`;

        console.log('Fetching thread for:', postUri);

        // Get the thread
        const response = await agent.getPostThread({ uri: postUri });
        console.log('Thread response:', response);

        // For now, just set the raw thread data
        setThread(response.data.thread);
      } catch (e) {
        console.error('Error fetching thread:', e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchThread();
  }, [url, extensionAPI]);

  if (loading) {
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
            Note: Viewing as guest. To interact with posts, please log in via the extension settings.
          </div>
        )}
      </div>
    );
  }

  if (!thread) return null;

  return (
    <div className="bluesky-thread p-4 border rounded-md">
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
        {thread.post.record.text}
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
              {reply.post.record.text}
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