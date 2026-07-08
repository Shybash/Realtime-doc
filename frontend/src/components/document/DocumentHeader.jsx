import React from "react";
import { ArrowLeft, Users, Wifi, WifiOff, Cloud, CloudOff, Loader2, History, Sun, Moon } from "lucide-react";
import { useTheme } from "../ThemeContext";
import { Link } from "react-router-dom";

function getUniqueUsers(users) {
  const map = {};
  users.forEach((u) => {
    const key = u.email || u.id;
    if (key && !map[key]) map[key] = u;
  });
  return Object.values(map);
}

const DocumentHeader = ({
  title,
  myRole,
  isConnected,
  onlineUsers,
  saveStatus,
  isAdmin,
  canEdit,
  onDelete,
  onShowHistory,
}) => {
  const uniqueOnlineUsers = getUniqueUsers(onlineUsers);
  const { theme, toggleTheme } = useTheme();
  
  return (
    <div className="px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="flex items-center gap-4">
        <Link
          to="/documents"
          className="p-2 text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm"
          title="Back to Workspace"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </Link>
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{title}</h1>
            {!canEdit && (
               <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700">Read-only</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-300">Role: {myRole}</span>
            
            <div className="flex items-center gap-1.5">
              {saveStatus === "saving" ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" /> <span className="text-blue-500">Saving...</span></>
              ) : saveStatus === "saved" ? (
                <><Cloud className="w-3.5 h-3.5 text-green-500 dark:text-green-400" /> <span className="text-green-600 dark:text-green-400">Saved to cloud</span></>
              ) : (
                <><CloudOff className="w-3.5 h-3.5 text-red-500" /> <span className="text-red-500 font-semibold">Save failed</span></>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3 flex-wrap">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 text-slate-400 dark:text-slate-400 hover:text-yellow-500 dark:hover:text-yellow-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm"
          title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Version History Button */}
        {onShowHistory && (
          <button
            onClick={onShowHistory}
            className="p-2 text-slate-400 dark:text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm flex items-center gap-1.5"
            title="Version History"
          >
            <History className="w-4 h-4" />
            <span className="text-sm font-medium hidden md:inline">History</span>
          </button>
        )}

        {/* Connection Status */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700" title={isConnected ? "Connected to server" : "Disconnected from server"}>
           {isConnected ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
           <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:inline">{isConnected ? "Online" : "Offline"}</span>
        </div>

        {/* Online Users */}
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          {uniqueOnlineUsers.length === 0 ? (
            <span className="text-sm text-slate-500 dark:text-slate-400">Just you</span>
          ) : (
            <div className="flex -space-x-2">
              {uniqueOnlineUsers.map((u, idx) => (
                <div
                  key={u.email || u.id || idx}
                  className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs font-bold text-white shadow-sm ring-2 ring-transparent hover:ring-blue-400 transition-all cursor-default z-10 hover:z-20"
                  style={{ backgroundColor: u.color || "#6366f1" }}
                  title={u.name || u.email || "User"}
                >
                  {(u.name || u.email || "U").charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
          )}
        </div>

        {onDelete && isAdmin && (
          <button
            className="ml-2 px-3 py-1.5 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/40 font-medium rounded-lg transition-colors text-sm border border-red-200 dark:border-red-800 shadow-sm"
            onClick={onDelete}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
};

export default React.memo(DocumentHeader);
