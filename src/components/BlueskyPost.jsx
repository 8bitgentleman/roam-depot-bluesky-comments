import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BskyAgent } from '@atproto/api';
import { Button, Spinner, TextArea, Intent, Tooltip } from '@blueprintjs/core';
import { ReplyIcon, RepostIcon, LikeIcon, MoreIcon, BlueskyLogo } from './bluesky-components';

const AUTO_REFRESH_INTERVAL = 120000; // 2 minutes
const REFRESH_ON_FOCUS_DELAY = 30000; // 30 seconds

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
  return (
    <div className={`grid grid-cols-${Math.min(imageCount, 2)} gap-2 my-2`}>
      {embed.images.map((image, idx) => (
        <div key={image.fullsize} className="relative">
          <img
            src={image.thumb}
            alt={image.alt}
            className="w-full h-32 object-cover rounded cursor-pointer"
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
    <div className="mt-2 pl-3 border-l-2 border-gray-200">
      <div className="text-sm">
        <span className="font-bold">{record.author.displayName}</span>
        <span className="text-gray-500 ml-2">@{record.author.handle}</span>
      </div>
      <div className="text-sm">{record.value.text}</div>
      <MediaGallery embed={record.embeds?.[0]} />
    </div>
  );
};

const ReplyBox = ({ agent, postUri, onReplyPosted, authorHandle }) => {
  const [replyText, setReplyText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const handlePost = async () => {
    if (!replyText.trim()) return;

    setIsPosting(true);
    setError('');

    try {
      const post = {
        text: replyText,
        reply: {
          root: postUri,
          parent: postUri
        }
      };

      await agent.post(post);
      setReplyText('');
      setIsExpanded(false);
      onReplyPosted();
    } catch (e) {
      setError(e.message);
    } finally {
      setIsPosting(false);
    }
  };

  if (!isExpanded) {
    return (
      <div className="mt-2 flex items-center space-x-4 text-gray-500">
        <button
          className="text-gray-500 hover:text-blue-500 bp3-button bp3-minimal"
          onClick={() => setIsExpanded(true)}
        >
          <ReplyIcon />
        </button>
        <button className="text-gray-500 hover:text-green-500 bp3-button bp3-minimal">
          <RepostIcon />
        </button>
        <button className="text-gray-500 hover:text-red-500 bp3-button bp3-minimal">
          <LikeIcon />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <TextArea
        className="w-full min-h-12 mb-2 text-sm pointer-events-auto"
        style={{ pointerEvents: 'auto' }}
        placeholder={`Reply to @${authorHandle}...`}
        value={replyText}
        onChange={e => setReplyText(e.target.value)}
        disabled={isPosting}
      />
      {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
      <div className="flex justify-end space-x-2">
        <Button
          minimal
          small
          onClick={() => setIsExpanded(false)}
          disabled={isPosting}
        >
          Cancel
        </Button>
        <Button
          small
          intent={Intent.PRIMARY}
          onClick={handlePost}
          loading={isPosting}
          disabled={!replyText.trim()}
        >
          Reply
        </Button>
      </div>
    </div>
  );
};

const BlueskyPost = ({ url, extensionAPI }) => {
  const [thread, setThread] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [displayedReplies, setDisplayedReplies] = useState(3);
  const [expandedReplies, setExpandedReplies] = useState(new Set());
  const [notifications, setNotifications] = useState([]);
  const [agent, setAgent] = useState(null);

  const lastFetchRef = useRef(0);
  const lastReplyCountRef = useRef(0);

  const fetchThread = useCallback(async (isPolling = false) => {
    // Skip if recent fetch during polling
    if (isPolling && Date.now() - lastFetchRef.current < REFRESH_ON_FOCUS_DELAY) {
      return;
    }

    if (!url) {
      setError("No URL provided");
      setIsLoading(false);
      return;
    }

    try {
      const loginInfo = await extensionAPI.settings.get("loginInfo");
      const service = loginInfo ? 'https://bsky.social' : 'https://public.api.bsky.app';

      const bskyAgent = agent || new BskyAgent({ service });

      if (loginInfo?.username && loginInfo?.password && !agent) {
        try {
          await bskyAgent.login({
            identifier: loginInfo.username,
            password: loginInfo.password,
          });
          setIsAuthenticated(true);
          setAgent(bskyAgent);
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
      const response = await bskyAgent.getPostThread({ uri: postUri });

      const currentReplyCount = response.data.thread.replies?.length || 0;

      // Check for new replies
      if (lastReplyCountRef.current && currentReplyCount > lastReplyCountRef.current) {
        const newReplies = currentReplyCount - lastReplyCountRef.current;
        setNotifications(prev => [...prev, `${newReplies} new ${newReplies === 1 ? 'reply' : 'replies'}`]);
      }

      lastReplyCountRef.current = currentReplyCount;
      setThread(response.data.thread);
      setError(null);
      lastFetchRef.current = Date.now();
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [url, extensionAPI, agent]);

  // Initial fetch
  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  // Setup polling and focus handlers
  useEffect(() => {
    const pollInterval = setInterval(() => fetchThread(true), AUTO_REFRESH_INTERVAL);

    const handleFocus = () => {
      if (Date.now() - lastFetchRef.current >= REFRESH_ON_FOCUS_DELAY) {
        fetchThread(true);
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchThread]);

  const clearNotifications = () => setNotifications([]);

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Spinner size={24} />
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
    <div className="bluesky-thread rounded-md border border-gray-200 p-4 relative">
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="absolute top-2 right-2">
          <Tooltip content={notifications.join('\n')}>
            <Button
              intent={Intent.PRIMARY}
              small
              onClick={clearNotifications}
            >
              {notifications.length} new
            </Button>
          </Tooltip>
        </div>
      )}

      {/* Author Info */}
      <div className="flex items-center mb-3">
        {thread.post.author.avatar && (
          <img
            src={thread.post.author.avatar}
            alt={thread.post.author.displayName}
            className="w-10 h-10 rounded-full mr-3"
          />
        )}
        <div className="flex-1">
          <div className="font-bold">{thread.post.author.displayName}</div>
          <div className="text-sm text-gray-500">@{thread.post.author.handle}</div>
        </div>
        <a href={`https://bsky.app/profile/${thread.post.author.did}/post/${thread.post.uri.split('/').pop()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500">
          <BlueskyLogo />
        </a>
      </div>

      {/* Post Content */}
      <div className="text-base mb-4">
        {thread.post.record.text}
        <MediaGallery embed={thread.post.embed} />
        {thread.post.record.embed?.record && (
          <QuotedPost record={thread.post.record.embed.record} />
        )}
      </div>

      {/* Reply Interface for Authenticated Users */}
      {isAuthenticated && agent && (
        <ReplyBox
          agent={agent}
          postUri={thread.post.uri}
          onReplyPosted={() => fetchThread()}
          authorHandle={thread.post.author.handle}
        />
      )}

      {/* Replies Section */}
      <div className="border-t">
        <div className="text-sm text-gray-500 mb-3">
          {thread.replies?.length || 0} replies
          {!isAuthenticated && (
            <span className="ml-2 text-xs">(Viewing as guest)</span>
          )}
        </div>

        {thread.replies?.slice(0, displayedReplies).map((reply) => (
          <div key={reply.post.uri} className="ml-4 mt-3 pt-3 border-t">
            <div className="flex items-center mb-2">
              {reply.post.author.avatar && (
                <img
                  src={reply.post.author.avatar}
                  alt={reply.post.author.displayName}
                  className="w-6 h-6 rounded-full mr-2"
                />
              )}
              <div className="flex-1">
                <span className="font-bold text-sm">{reply.post.author.displayName}</span>
                <span className="text-xs text-gray-500 ml-2">
                  @{reply.post.author.handle} · {getRelativeTime(reply.post.indexedAt)}
                </span>
              </div>
            </div>

            <div className="text-sm">
              {reply.post.record.text}
              <MediaGallery embed={reply.post.embed} />
            </div>

            {reply.replies?.length > 0 && (
              <>
                <Button
                  minimal
                  small
                  className="mt-2"
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
                </Button>

                {expandedReplies.has(reply.post.uri) && (
                  <div className="ml-4 pl-4 border-l">
                    {reply.replies.map(nestedReply => (
                      <div key={nestedReply.post.uri} className="mt-3 pt-2">
                        <div className="flex items-center mb-1">
                          {nestedReply.post.author.avatar && (
                            <img
                              src={nestedReply.post.author.avatar}
                              alt={nestedReply.post.author.displayName}
                              className="w-5 h-5 rounded-full mr-2"
                            />
                          )}
                          <div className="flex-1">
                            <span className="font-bold text-sm">{nestedReply.post.author.displayName}</span>
                            <span className="text-xs text-gray-500 ml-2">
                              @{nestedReply.post.author.handle} · {getRelativeTime(nestedReply.post.indexedAt)}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm">
                          {nestedReply.post.record.text}
                          <MediaGallery embed={nestedReply.post.embed} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {isAuthenticated && agent && (
              <ReplyBox
                agent={agent}
                postUri={reply.post.uri}
                onReplyPosted={() => fetchThread()}
                authorHandle={reply.post.author.handle}
              />
            )}
          </div>
        ))}

        {thread.replies && displayedReplies < thread.replies.length && (
          <Button
            minimal
            small
            className="bp3-button bp3-minimal"
            onClick={() => setDisplayedReplies(prev => prev + 3)}
          >
            Show more replies ({thread.replies.length - displayedReplies} remaining)
          </Button>
        )}
      </div>
    </div>
  );
};

export default BlueskyPost;