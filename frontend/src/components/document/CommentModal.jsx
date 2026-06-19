import React, { useEffect, useRef, useState } from 'react';

const CommentModal = ({ anchor, onSubmit, onClose }) => {
  const [comment, setComment] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    textareaRef.current?.focus();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (comment.trim()) onSubmit(comment.trim());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [comment, onClose, onSubmit]);

  return (
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 relative text-slate-800 dark:text-slate-100 transition-colors">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 text-xl font-bold p-1"
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="text-lg font-bold mb-2">Add Comment</h2>
        <div className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          <span className="font-semibold">Selected text:</span> <span className="italic">"{anchor?.text}"</span>
        </div>
        <textarea
          ref={textareaRef}
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Type your comment..."
          rows={3}
          className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-3 mb-4 bg-white/50 dark:bg-slate-950/50 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
        />
        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => comment.trim() && onSubmit(comment.trim())}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50"
            disabled={!comment.trim()}
          >
            Add Comment
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommentModal; 