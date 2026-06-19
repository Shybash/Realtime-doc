import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, FileText, Calendar, User, Trash2, ChevronRight, ChevronDown, Sun, Moon } from "lucide-react";
import api from "../api/docs";
import sanitizeHtml from "sanitize-html";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "./ThemeContext";
import { formatDate } from "../utils/dateUtils";
import toast from "react-hot-toast";

// ── DocumentTreeItem ──────────────────────────────────────────────────────────
// Memoised so sidebar tree items don't re-render when the main list filters change.
const DocumentTreeItem = React.memo(({ doc, allDocs, selectedParentId, setSelectedParentId, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const children = useMemo(() => allDocs.filter(d => d.parentId === doc.id), [allDocs, doc.id]);
  const hasChildren = children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${selectedParentId === doc.id ? 'bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-200 font-medium border-r-2 border-blue-600' : 'text-slate-600 dark:text-slate-300'}`}
        style={{ paddingLeft: `${16 + level * 16}px` }}
        onClick={() => setSelectedParentId(doc.id)}
      >
        <div className="w-5 h-5 flex items-center justify-center mr-1" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>
          {hasChildren && (isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />)}
        </div>
        <span className="truncate flex-1">{doc.title || 'Untitled'}</span>
      </div>
      {isExpanded && hasChildren && (
        <div>
          {children.map(child => (
            <DocumentTreeItem key={child.id} doc={child} allDocs={allDocs} selectedParentId={selectedParentId} setSelectedParentId={setSelectedParentId} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
});
DocumentTreeItem.displayName = 'DocumentTreeItem';

// ── DocumentCard ──────────────────────────────────────────────────────────────
// Extracted + memoised so that search input changes do NOT re-render all cards.
const DocumentCard = React.memo(({ document, onSelect, onDelete }) => (
  <motion.div
    layout
    key={document.id}
    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl dark:hover:shadow-black/30 transition-all cursor-pointer group flex flex-col h-[220px] overflow-hidden"
    onClick={() => onSelect(document)}
  >
    {document.coverImage && (
      <div className="h-20 w-full overflow-hidden shrink-0">
        <img src={document.coverImage} className="w-full h-full object-cover" alt="" loading="lazy" />
      </div>
    )}
    <div className="p-5 flex flex-col flex-1 relative">
      <div className="flex justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${document.coverImage && document.icon ? '-mt-10 bg-white dark:bg-slate-800 shadow-md text-2xl z-10' : 'bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-300'}`}>
          {document.icon || <FileText className="w-5 h-5" />}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(document.id, document.title); }}
          className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-500 rounded-md bg-white dark:bg-slate-800"
          aria-label={`Delete ${document.title}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 line-clamp-2">{document.title}</h3>
      <div className="mt-auto pt-4 flex justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDate(document.updatedAt)}</span>
        <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded"><User className="w-3.5 h-3.5" /> {document.collaborators?.length || 1}</span>
      </div>
    </div>
  </motion.div>
));
DocumentCard.displayName = 'DocumentCard';

// ── DocumentList ──────────────────────────────────────────────────────────────
const DocumentList = ({ onDocumentSelect, onCreateDocument }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [selectedParentId, setSelectedParentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDocumentTitle, setNewDocumentTitle] = useState("");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await api.get("/docs?all=true");
      setDocuments(response.data);
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const createDocument = async () => {
    const cleanTitle = sanitizeHtml(newDocumentTitle.trim());
    if (!cleanTitle) return;
    try {
      const response = await api.post("/docs", { title: cleanTitle, content: "", parentId: selectedParentId });
      setDocuments((prev) => [response.data, ...prev]);
      setNewDocumentTitle("");
      setShowCreateModal(false);
      if (onCreateDocument) onCreateDocument(response.data);
    } catch (error) {
      console.error("Error creating document:", error);
      toast.error("Failed to create document");
    }
  };

  // Toast-based confirmation instead of blocking window.confirm
  const deleteDocument = useCallback((documentId, title) => {
    toast((t) => (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-slate-800">Delete <strong>{title || 'this document'}</strong>?</p>
        <p className="text-xs text-slate-500">This cannot be undone.</p>
        <div className="flex gap-2 mt-1">
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await api.delete(`/docs/${documentId}`);
                setDocuments((prev) => prev.filter((d) => d.id !== documentId && d.parentId !== documentId));
                toast.success("Document deleted");
              } catch {
                toast.error("Failed to delete document");
              }
            }}
            className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700"
          >
            Delete
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200"
          >
            Cancel
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  }, []);

  // Memoised derivations — only recompute when documents or filters change,
  // NOT on every render triggered by search input state changes.
  const rootDocs = useMemo(() => documents.filter(doc => !doc.parentId), [documents]);

  const currentViewDocs = useMemo(() =>
    documents.filter(doc =>
      doc.parentId === selectedParentId &&
      (doc.title?.toLowerCase() ?? '').includes(search.toLowerCase())
    ),
    [documents, selectedParentId, search]
  );

  const pageTitle = useMemo(() =>
    selectedParentId ? (documents.find(d => d.id === selectedParentId)?.title || 'Document') : 'Documents',
    [selectedParentId, documents]
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col md:flex-row font-sans selection:bg-blue-100 selection:text-blue-900 transition-colors duration-300">
      <button
        className="md:hidden p-3 fixed top-4 left-4 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={sidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg>
      </button>

      <aside className={`fixed md:sticky top-0 left-0 h-[100dvh] w-72 bg-white dark:bg-slate-900 z-40 transition-transform duration-300 border-r border-slate-200 dark:border-slate-800 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="p-6 pt-20 md:pt-6 flex-shrink-0 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-3 mb-6 px-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md shadow-blue-600/20">C</div>
            <span className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">CollabDocs</span>
          </div>
          <button
            className={`w-full text-left px-4 py-2.5 rounded-xl transition-all flex items-center ${selectedParentId === null ? "bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-200 font-medium" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100"}`}
            onClick={() => { setSelectedParentId(null); setSidebarOpen(false); }}
          >
            All Documents
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
          {rootDocs.map(doc => (
            <DocumentTreeItem key={doc.id} doc={doc} allDocs={documents} selectedParentId={selectedParentId} setSelectedParentId={setSelectedParentId} />
          ))}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex-shrink-0">
          <div className="flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl shadow-sm">
            <div className="flex items-center truncate mr-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-200 flex items-center justify-center font-bold text-sm mr-3 flex-shrink-0">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{user?.email}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button onClick={toggleTheme} className="p-1.5 text-slate-400 dark:text-slate-400 hover:text-yellow-500 dark:hover:text-yellow-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}>
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button onClick={async () => { await logout(); navigate("/login"); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors" title="Logout">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-slate-900/20 dark:bg-black/40 backdrop-blur-sm z-30 md:hidden" onClick={() => setSidebarOpen(false)} />}

      <main className="flex-1 p-6 md:p-10 md:pl-12 pt-20 md:pt-10 min-h-screen flex flex-col relative">
        <header className="flex flex-col md:flex-row items-start md:items-end justify-between mb-10 gap-6 z-10 relative">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">{pageTitle}</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm md:text-base font-medium">Nested document workspace</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <input
                type="text"
                placeholder="Search view..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-sm"
              />
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all shadow-md active:scale-95 flex-shrink-0"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">New inside</span>
            </button>
          </div>
        </header>

        <div className="z-10 relative flex-1">
          {loading ? (
            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-t-blue-600"></div></div>
          ) : currentViewDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl">
              <FileText className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-4" />
              <p className="text-slate-500 dark:text-slate-400 mb-6">No documents here.</p>
              <button onClick={() => setShowCreateModal(true)} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium">Create Document</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
              <AnimatePresence>
                {currentViewDocs.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    onSelect={onDocumentSelect}
                    onDelete={deleteDocument}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl text-slate-800 dark:text-slate-100">
              <h2 className="text-2xl font-bold mb-2">New Document</h2>
              <input
                type="text"
                autoFocus
                placeholder="Title"
                value={newDocumentTitle}
                onChange={e => setNewDocumentTitle(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl mt-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => e.key === 'Enter' && createDocument()}
              />
              <div className="flex gap-3 mt-8">
                <button onClick={() => setShowCreateModal(false)} className="flex-1 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl font-medium">Cancel</button>
                <button onClick={createDocument} disabled={!newDocumentTitle.trim()} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-all">Create</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DocumentList;
