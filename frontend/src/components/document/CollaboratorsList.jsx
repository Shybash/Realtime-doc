import React from 'react';

const CollaboratorsList = ({
  isAdmin,
  docObj,
  permissionsError,
  userInfoMap,
  user,
  handleChangeRole,
  handleRemoveUser,
  newUserEmail,
  setNewUserEmail,
  newUserRole,
  setNewUserRole,
  handleAddUserByEmail,
  lookupLoading,
  lookupError
}) => {
  if (!isAdmin) return null;
  return (
    <div className="mt-8 p-5 md:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm transition-colors duration-300 text-sm">
      <h3 className="text-base font-bold text-slate-850 dark:text-slate-100 mb-4 flex items-center gap-2">
        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
        Manage Permissions
      </h3>
      
      {permissionsError && <div className="text-red-500 mb-3 bg-red-50 dark:bg-red-950/20 px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/40 text-xs font-semibold">{permissionsError}</div>}
      
      <ul className="divide-y divide-slate-100 dark:divide-slate-800/60 mb-6">
        {docObj?.permissions?.map((perm) => {
          const userInfo = userInfoMap[perm.userId];
          return (
            <li key={perm.userId} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-3">
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {userInfo?.name || perm.userId}
                </span>
                {userInfo?.email && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{userInfo.email}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={perm.role}
                  onChange={e => handleChangeRole(perm.userId, e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                >
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                {perm.userId !== user.uid && (
                  <button 
                    onClick={() => handleRemoveUser(perm.userId)} 
                    className="text-red-500 hover:text-red-700 dark:hover:text-red-400 text-xs font-semibold px-2 py-1 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      
      <form onSubmit={handleAddUserByEmail} className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100 dark:border-slate-800/60">
        <input
          type="email"
          placeholder="Invite by email address..."
          value={newUserEmail}
          onChange={e => setNewUserEmail(e.target.value)}
          className="flex-1 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-xs"
          required
        />
        <div className="flex gap-2">
          <select 
            value={newUserRole} 
            onChange={e => setNewUserRole(e.target.value)} 
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
          >
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          <button 
            type="submit" 
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-xs px-4 py-2 shadow-sm transition-all disabled:opacity-50 flex items-center justify-center min-w-[70px]" 
            disabled={lookupLoading}
          >
            {lookupLoading ? 'Adding...' : 'Add'}
          </button>
        </div>
      </form>
      {lookupError && <div className="text-red-500 mt-2 text-xs font-semibold bg-red-50 dark:bg-red-950/20 px-3 py-1.5 rounded-lg border border-red-150 dark:border-red-950">{lookupError}</div>}
    </div>
  );
};

export default React.memo(CollaboratorsList);
