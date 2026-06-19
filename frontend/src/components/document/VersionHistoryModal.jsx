import React, { useState, useEffect } from "react";
import { X, Clock, Plus, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import api from "../../api/docs";
import { formatDate } from "../../utils/dateUtils";

const VersionHistoryModal = ({ docId, onClose, onRestored, canEdit }) => {
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [newVersionName, setNewVersionName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchVersions();
  }, [docId]);

  const fetchVersions = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(`/docs/${docId}/versions`);
      setVersions(res.data);
      if (res.data.length > 0) {
        setSelectedVersion(res.data[0]);
      }
    } catch (err) {
      setError("Failed to fetch version history");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = async (e) => {
    e.preventDefault();
    if (!newVersionName.trim()) return;
    try {
      setCreating(true);
      setError("");
      const res = await api.post(`/docs/${docId}/versions`, {
        name: newVersionName.trim()
      });
      setNewVersionName("");
      setShowCreateForm(false);
      // Refresh list
      const updatedVersions = [res.data, ...versions];
      setVersions(updatedVersions);
      setSelectedVersion(res.data);
      // No redundant fetchVersions() — we already have the new version in res.data
    } catch (err) {
      setError("Failed to save snapshot");
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleRestoreVersion = async (versionId) => {
    if (!window.confirm("Are you sure you want to restore the document to this version? All active collaborators will be reloaded.")) return;
    try {
      setRestoring(true);
      setError("");
      await api.post(`/docs/${docId}/versions/${versionId}/restore`);
      if (onRestored) {
        onRestored();
      }
      onClose();
    } catch (err) {
      setError("Failed to restore version");
      console.error(err);
    } finally {
      setRestoring(false);
    }
  };


  return (
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-800 dark:text-slate-100 transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-indigo-500" />
            <h2 className="text-xl font-bold">Document Version History</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 px-6 py-3 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel - Version list */}
          <div className="w-80 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/50 dark:bg-slate-900/20">
            {canEdit && (
              <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                {!showCreateForm ? (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 rounded-xl font-medium flex items-center justify-center gap-2 text-sm shadow-sm active:scale-95 transition-all"
                  >
                    <Plus className="w-4 h-4" /> Create Snapshot
                  </button>
                ) : (
                  <form onSubmit={handleCreateVersion} className="space-y-3">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Snapshot Name (e.g. Draft 1)"
                      value={newVersionName}
                      onChange={(e) => setNewVersionName(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setShowCreateForm(false); setNewVersionName(""); }}
                        className="flex-1 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-md"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={creating || !newVersionName.trim()}
                        className="flex-1 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium disabled:opacity-50"
                      >
                        {creating ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <span className="text-sm">Loading history...</span>
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm px-4">
                  No snapshots created yet. Snapshots will appear here when you or others manually save a version.
                </div>
              ) : (
                versions.map((ver) => (
                  <div
                    key={ver.id}
                    onClick={() => setSelectedVersion(ver)}
                    className={`p-3 rounded-xl cursor-pointer text-left transition-all ${
                      selectedVersion?.id === ver.id
                        ? "bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 shadow-sm"
                        : "border border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="font-semibold text-sm truncate text-slate-800 dark:text-slate-100">{ver.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                      <span>{formatDate(ver.createdAt)}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                      By: {ver.createdBy}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right panel - Preview & Actions */}
          <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
            {selectedVersion ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Version Toolbar */}
                <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">Viewing Snapshot</span>
                    <span className="text-base font-bold text-slate-800 dark:text-slate-100">{selectedVersion.name}</span>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => handleRestoreVersion(selectedVersion.id)}
                      disabled={restoring}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 shadow-md hover:shadow-indigo-600/10 active:scale-95 disabled:opacity-50 transition-all"
                    >
                      {restoring ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Restore this version
                    </button>
                  )}
                </div>

                {/* HTML content preview */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/20 dark:bg-slate-950/20">
                  <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 min-h-[500px] shadow-sm rounded-xl">
                    {selectedVersion.content ? (
                      <article 
                        className="prose prose-slate dark:prose-invert max-w-none focus:outline-none"
                        dangerouslySetInnerHTML={{ __html: selectedVersion.content }}
                      />
                    ) : (
                      <div className="text-center py-24 text-slate-400 dark:text-slate-500 italic">
                        Empty document content at this snapshot.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Clock className="w-12 h-12 stroke-[1.5] mb-3 text-slate-300 dark:text-slate-700" />
                <span className="text-sm">Select a version from the left panel to preview it.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VersionHistoryModal;
