import React, { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import sanitizeHtml from "sanitize-html";
import api, { authApi } from "../api/docs";
import toast from "react-hot-toast";
import DocumentHeader from "./document/DocumentHeader";
import DocumentToolbar from "./document/DocumentToolbar";
import DocumentEditor from "./document/DocumentEditor";
import CollaboratorsList from "./document/CollaboratorsList";
import useDocumentLoader from "./document/useDocumentLoader";
import useYjsProvider from "./document/useYjsProvider";
import useOnlineStatus from "../hooks/useOnlineStatus";
import { Mark } from '@tiptap/core';
import CommentSidebar from "./document/CommentSidebar";
import CommentModal from "./document/CommentModal";
import ShareModal from "./document/ShareModal";
import DocumentCover from "./document/DocumentCover";
import VersionHistoryModal from "./document/VersionHistoryModal";

const Document = ({ onSave }) => {
  const { id: paramId } = useParams();
  const location = useLocation();
  const { user, loading } = useAuth();
  const doc = location.state?.doc;
  const documentId = doc?.id || paramId;
  const documentTitle = doc?.title || "";

  const { docObj, isLoading, setDocObj, setIsLoading, loadDocument } =
    useDocumentLoader(documentId, doc);

  // Track browser online/offline status
  const isOnline = useOnlineStatus();

  const userId = user?.uid;
  const myRole =
    docObj?.permissions?.find((p) => p.userId === userId)?.role || "viewer";
  const canEdit = ["admin", "editor"].includes(myRole);
  const isAdmin = myRole === "admin";

  const [saveStatus, setSaveStatus] = useState("saved");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("editor");
  const [permissionsError, setPermissionsError] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [userInfoMap, setUserInfoMap] = useState({});
  const autoSaveTimeoutRef = useRef(null);
  const [focusedCommentId, setFocusedCommentId] = useState(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentSelection, setCommentSelection] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareInfo, setShareInfo] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const { editor, isYjsReady, idbSynced, onlineUsers, setOnlineUsers, socket } = useYjsProvider(
    documentId,
    user,
    userId,
    canEdit,
    autoSave,
    docObj
  );

  function autoSave(editorInstance) {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    setSaveStatus("saving");
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveDocument(editorInstance);
    }, 3000);
  }
  const saveDocument = async (editorInstance = editor) => {
    if (!editorInstance || !documentId) return;
    try {
      const content = editorInstance.getHTML();
      const cleanContent = sanitizeHtml(content);
      const response = await api.put(`/docs/${documentId}`, {
        content: cleanContent,
      });
      setSaveStatus("saved");
      setDocObj(response.data);
    } catch (error) {
      setSaveStatus("error");
      alert(
        "Failed to save document: " +
          (error?.response?.data?.error || error.message)
      );
    }
  };
  const handleChangeRole = async (userId, newRole) => {
    if (!docObj) return;
    const updatedPermissions = docObj.permissions.map((perm) =>
      perm.userId === userId ? { ...perm, role: newRole } : perm
    );
    await updatePermissions(updatedPermissions);
  };
  const handleRemoveUser = async (userId) => {
    if (!docObj) return;
    const updatedPermissions = docObj.permissions.filter(
      (perm) => perm.userId !== userId
    );
    await updatePermissions(updatedPermissions);
  };
  const handleAddUserByEmail = async (e) => {
    e.preventDefault();
    setLookupError("");
    setLookupLoading(true);
    try {
      const res = await authApi.post("/auth/lookup-uid", { email: newUserEmail });
      const uid = res.data.uid;
      if (docObj.permissions.some((perm) => perm.userId === uid)) {
        setLookupError("User already has a role");
        setLookupLoading(false);
        return;
      }
      const updatedPermissions = [
        ...docObj.permissions,
        { userId: uid, role: newUserRole },
      ];
      await updatePermissions(updatedPermissions);
      setNewUserEmail("");
      setNewUserRole("editor");
    } catch (err) {
      setLookupError(err?.response?.data?.error || "User not found");
    }
    setLookupLoading(false);
  };
  const updatePermissions = async (updatedPermissions) => {
    try {
      const response = await api.put(`/docs/${docObj.id}/permissions`, {
        permissions: updatedPermissions,
      });
      setDocObj(response.data);
    } catch (error) {
      setPermissionsError("Failed to update permissions");
    }
  };

  // Add comment to selected text
  const handleAddComment = () => {
    if (!editor || editor.state.selection.empty) return;
    const { from, to } = editor.state.selection;
    const anchor = { from, to, text: editor.state.doc.textBetween(from, to) };
    setCommentSelection(anchor);
    setShowCommentModal(true);
  };

  const handleSubmitComment = async (commentText) => {
    if (!editor || !commentSelection || !commentText) return;
    try {
      const res = await api.post(`/docs/${documentId}/comments`, {
        anchor: commentSelection,
        content: commentText,
      });
      const commentId = res.data.id;
      editor.chain().focus().setMark('comment', { commentId }).run();
      setShowCommentModal(false);
      setCommentSelection(null);
      toast.success('Comment added!');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to add comment');
      console.error(err);
    }
  };

  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!docObj?.permissions?.length) return;
      const uids = docObj.permissions.map((p) => p.userId);
      try {
        const res = await authApi.post("/auth/user-info", { uids });
        const map = {};
        res.data.users.forEach((u) => {
          map[u.uid] = u;
        });
        setUserInfoMap(map);
      } catch (err) {}
    };
    fetchUserInfo();
  }, [docObj?.permissions]);

  useEffect(() => {
    if (!doc) loadDocument();
  }, [documentId]);

  useEffect(() => {
    if (
      editor &&
      isYjsReady &&
      docObj &&
      docObj.content &&
      editor.getHTML().trim() === ""
    ) {
      editor.commands.setContent(docObj.content);
    }
  }, [editor, isYjsReady, docObj]);

  useEffect(() => {
    if (!editor) return;
    const handleClick = (event) => {
      const target = event.target;
      if (target && target.nodeType === 1 && target.hasAttribute('data-comment-id')) {
        const commentId = target.getAttribute('data-comment-id');
        setFocusedCommentId(commentId);
        setShowSidebar(true); // Auto-open sidebar on highlight click
      }
    };
    const editorEl = document.querySelector('.ProseMirror');
    if (editorEl) {
      editorEl.addEventListener('click', handleClick);
    }
    return () => {
      if (editorEl) {
        editorEl.removeEventListener('click', handleClick);
      }
    };
  }, [editor]);

  // Check for share token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      // Fetch document by share token
      api.get(`/docs/shared/${token}`)
        .then(res => {
          setDocObj(res.data);
          // Optionally set permission in state for UI
        })
        .catch(() => {
          alert('Invalid or expired share link.');
        });
    }
  }, [documentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading user...</p>
        </div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-600">Please log in to view this document.</p>
        </div>
      </div>
    );
  }
  if (!editor || (!isYjsReady && !idbSynced)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isLoading
              ? "Loading document..."
              : !isOnline
              ? "Loading local copy..."
              : !isYjsReady
              ? "Initializing collaboration..."
              : "Initializing editor..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">

      {/* ── Offline Banner ─────────────────────────────────────────────────── */}
      {!isOnline && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium shadow-md">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          You are offline — changes are saved locally and will sync automatically when reconnected.
        </div>
      )}

      {/* Top Header Navigation */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <DocumentHeader
          title={docObj?.title || documentTitle || "Untitled Document"}
          myRole={myRole}
          isConnected={true}
          onlineUsers={onlineUsers}
          saveStatus={saveStatus}
          isAdmin={isAdmin}
          canEdit={canEdit}
          onDelete={undefined}
          onShowHistory={() => setShowHistoryModal(true)}
        />
        
        {/* Sticky Toolbar Area */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 max-w-5xl mx-auto w-full transition-colors">
          <div className="flex-1 overflow-x-auto custom-scrollbar pb-1">
            <DocumentToolbar editor={editor} onAddComment={handleAddComment} />
          </div>
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            <button
              className="px-4 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border border-blue-200 dark:border-blue-800 shadow-sm flex items-center text-sm"
              onClick={() => setShowShareModal(true)}
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              Share
            </button>
            <button
              className={`px-4 py-1.5 font-medium rounded-lg transition-colors border shadow-sm flex items-center text-sm ${
                showSidebar 
                  ? "bg-slate-800 text-white border-slate-800 hover:bg-slate-700" 
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
              onClick={() => setShowSidebar((v) => !v)}
              title={showSidebar ? "Hide Comments" : "Show Comments"}
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              {showSidebar ? "Close" : "Comments"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Editor Canvas */}
        <main className={`flex-1 overflow-y-auto custom-scrollbar transition-all duration-300 ${showSidebar ? 'mr-80' : ''}`}>
          <div className="max-w-4xl mx-auto py-12 px-8 md:px-16 min-h-[800px] bg-white dark:bg-slate-900 my-8 shadow-sm border border-slate-200/60 dark:border-slate-850 rounded-lg transition-colors">
            <DocumentCover 
              documentId={documentId} 
              docObj={docObj} 
              setDocObj={setDocObj} 
              canEdit={canEdit} 
            />
            <hr className="my-6 border-slate-200/60 dark:border-slate-800/60" />
            {/* The Editor Component handles the actual Prosemirror content */}
            <DocumentEditor editor={editor} />
          </div>
          
          <div className="max-w-4xl mx-auto pb-12 px-4">
             <CollaboratorsList
                isAdmin={isAdmin}
                docObj={docObj}
                permissionsError={permissionsError}
                userInfoMap={userInfoMap}
                user={user}
                handleChangeRole={handleChangeRole}
                handleRemoveUser={handleRemoveUser}
                newUserEmail={newUserEmail}
                setNewUserEmail={setNewUserEmail}
                newUserRole={newUserRole}
                setNewUserRole={setNewUserRole}
                handleAddUserByEmail={handleAddUserByEmail}
                lookupLoading={lookupLoading}
                lookupError={lookupError}
              />
          </div>
        </main>

        {/* Right Sidebar for Comments */}
        {showSidebar && (
          <div className="w-80 border-l border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm fixed right-0 top-[115px] bottom-0 overflow-y-auto custom-scrollbar shadow-xl z-30 transition-colors">
            <CommentSidebar
              docId={documentId}
              focusedCommentId={focusedCommentId}
              onClose={() => setShowSidebar(false)}
              socket={socket}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {showCommentModal && (
        <CommentModal
          anchor={commentSelection}
          onSubmit={handleSubmitComment}
          onClose={() => { setShowCommentModal(false); setCommentSelection(null); }}
        />
      )}
      {showShareModal && (
        <ShareModal
          docId={documentId}
          onClose={() => setShowShareModal(false)}
          shareInfo={shareInfo}
          setShareInfo={setShareInfo}
        />
      )}
      {showHistoryModal && (
        <VersionHistoryModal
          docId={documentId}
          onClose={() => setShowHistoryModal(false)}
          onRestored={() => window.location.reload()}
          canEdit={canEdit}
        />
      )}
    </div>
  );
};

export default Document;
