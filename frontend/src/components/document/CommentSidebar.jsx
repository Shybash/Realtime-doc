import React, { useEffect, useState, useCallback } from 'react';
import api, { authApi } from '../../api/docs';
import { formatDate } from '../../utils/dateUtils';

const CommentSidebar = ({ docId, focusedCommentId, onClose, socket }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userMap, setUserMap] = useState({});

  // ── Fetch comments via backend ──
  const fetchComments = useCallback(async () => {
    if (!docId) return;
    try {
      const res = await api.get(`/docs/${docId}/comments`);
      setComments(res.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load comments:', err);
      setError(err?.response?.data?.error || err.message || 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [docId]);

  // Fetch once on mount
  useEffect(() => {
    setLoading(true);
    setComments([]);
    fetchComments();
  }, [fetchComments]);

  // Sync comments in real-time via WebSockets
  useEffect(() => {
    if (!socket) return;

    const handleCommentAdded = (newComment) => {
      setComments((prev) => {
        if (prev.some((c) => c.id === newComment.id)) return prev;
        return [...prev, newComment];
      });
    };

    const handleCommentDeleted = (deletedId) => {
      setComments((prev) => prev.filter((c) => c.id !== deletedId));
    };

    socket.on("comment-added", handleCommentAdded);
    socket.on("comment-deleted", handleCommentDeleted);

    return () => {
      socket.off("comment-added", handleCommentAdded);
      socket.off("comment-deleted", handleCommentDeleted);
    };
  }, [socket]);

  // Fetch display names / emails for comment authors
  useEffect(() => {
    const userIds = Array.from(new Set(comments.map(c => c.userId).filter(Boolean)));
    if (userIds.length === 0) return;

    authApi.post('/auth/user-info', { uids: userIds })
      .then(res => {
        const map = {};
        res.data.users.forEach(u => { map[u.uid] = u.email || u.uid; });
        setUserMap(map);
      })
      .catch(err => console.error('Failed to fetch user info for comments:', err));
  }, [comments]);


  const sidebarContent = (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-lg font-bold text-slate-850 dark:text-slate-100">Comments</h3>
        {onClose && (
          <button
            className="md:hidden text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-2xl font-bold px-2"
            onClick={onClose}
            aria-label="Close comments"
          >
            ×
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="text-slate-400 dark:text-slate-500 text-sm py-4">Loading comments...</div>
        ) : error ? (
          <div className="text-red-500 text-sm py-4">Error: {error}</div>
        ) : comments.length === 0 ? (
          <div className="text-slate-400 dark:text-slate-500 text-sm py-8 text-center font-medium">
            No comments yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {comments.map(comment => {
              const isFocused = focusedCommentId === comment.id;
              return (
                <li
                  key={comment.id}
                  className={`p-3 rounded-xl border transition-all ${
                    isFocused
                      ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/60 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-900/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                      {userMap[comment.userId] || comment.userId}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {formatDate(comment.createdAt)}
                    </span>
                  </div>
                  <div className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed break-words">
                    {comment.content}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  // Mobile: modal overlay; Desktop: sidebar panel
  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block h-full">
        {sidebarContent}
      </div>
      {/* Mobile modal */}
      {onClose && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="flex-1 bg-black bg-opacity-40" onClick={onClose}></div>
          <div className="w-4/5 max-w-xs bg-white dark:bg-slate-900 h-full shadow-lg p-0">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

export default CommentSidebar;