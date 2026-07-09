import { useEffect, useRef, useState } from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import { lowlight } from 'lowlight';
import { io } from 'socket.io-client';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { Awareness } from 'y-protocols/awareness';
import SocketIOProvider from './SocketIOProvider';
import CommentMark from './extensions/CommentMark';
import SlashCommands from './extensions/SlashCommands';
import suggestion from './extensions/suggestion';

/**
 * useYjsProvider
 *
 * Sets up the complete real-time collaboration stack:
 *  1. Y.Doc — the Yjs CRDT document
 *  2. IndexeddbPersistence — saves the Y.Doc in the browser's IndexedDB
 *     so the document loads instantly and is editable even when OFFLINE
 *  3. Socket.IO — syncs the Y.Doc with the server and other clients
 *     when an internet connection is available
 *  4. Tiptap editor — bound to the Y.Doc via the Collaboration extension
 *
 * Offline behaviour:
 *  - If the user is offline (or the server is unreachable), Socket.IO
 *    will keep retrying in the background. All edits are saved locally
 *    to IndexedDB. When connectivity is restored, Socket.IO reconnects
 *    and the SocketIOProvider syncs the accumulated local changes.
 */
const useYjsProvider = (documentId, user, userId, canEdit, autoSave, docObj) => {
  const [isYjsReady, setIsYjsReady]   = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [saveStatus, setSaveStatus]   = useState('saved');
  const [idbSynced, setIdbSynced]     = useState(false); // true once IndexedDB is loaded

  const ydocRef      = useRef(null);
  const providerRef  = useRef(null);
  const idbRef       = useRef(null);
  const socketRef    = useRef(null);

  // ── 1. Tiptap editor ───────────────────────────────────────────────────────
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ history: false, codeBlock: false }),
        GlobalDragHandle.configure({ dragHandleWidth: 20, scrollTreshold: 100 }),
        TaskList,
        TaskItem.configure({ nested: true }),
        SlashCommands.configure({ suggestion }),

        // Collaboration extensions — only added once the Y.Doc is ready
        ...(isYjsReady && ydocRef.current && providerRef.current
          ? [
              Collaboration.configure({
                document: ydocRef.current,
                field: 'content',
              }),
              CollaborationCursor.configure({
                provider: providerRef.current,
                user: {
                  name:  user?.displayName || user?.email || 'Anonymous',
                  color: '#' + Math.floor(Math.random() * 16777215).toString(16),
                  id:    userId || Math.random().toString(36).substr(2, 9),
                },
              }),
            ]
          : []),

        Placeholder.configure({ placeholder: "Type '/' for commands" }),
        CodeBlockLowlight.configure({ lowlight }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        CommentMark,
      ],
      editorProps: {
        attributes: {
          class:
            'prose prose-sm sm:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[600px] w-full',
        },
      },
      editable: canEdit,
      onUpdate: ({ editor }) => {
        autoSave(editor);
      },
    },
    [isYjsReady, ydocRef.current, providerRef.current, canEdit]
  );

  // ── 2. Yjs + IndexedDB + Socket.IO setup ──────────────────────────────────
  useEffect(() => {
    if (!documentId) return;

    // Create a fresh Y.Doc for this document session
    const ydoc = new Y.Doc();
    ydoc.awareness = new Awareness(ydoc);
    ydoc.awareness.setLocalStateField('user', {
      name:  user?.displayName || user?.email || 'Anonymous',
      color: '#' + Math.floor(Math.random() * 16777215).toString(16),
      id:    userId || Math.random().toString(36).substr(2, 9),
    });
    ydocRef.current = ydoc;

    // ── 2a. IndexedDB persistence ──────────────────────────────────────────
    // Persists the Y.Doc in the browser's IndexedDB under the key
    // "collabdocs-<documentId>". On the NEXT open, the doc loads from
    // IndexedDB FIRST (offline-capable), then syncs with the server.
    const idbName = `collabdocs-${documentId}`;
    const idb = new IndexeddbPersistence(idbName, ydoc);
    idbRef.current = idb;

    idb.on('synced', () => {
      // IndexedDB is fully loaded — the editor already has the last local state
      console.log('[IDB] Local document loaded from IndexedDB:', idbName);
      setIdbSynced(true);
    });

    // ── 2b. Socket.IO — online sync ────────────────────────────────────────
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

    const socket = io(backendUrl, {
      withCredentials: true,
      transports: ['websocket'],
      // Retry forever so we sync as soon as connectivity is restored
      reconnection:        true,
      reconnectionAttempts: Infinity,
      reconnectionDelay:   1000,
      reconnectionDelayMax: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected — syncing with server');
      const provider = new SocketIOProvider(socket, `document-${documentId}`, ydoc);
      providerRef.current = provider;

      socket.emit('join-document', `document-${documentId}`, {
        name:  user?.name || user?.email || 'User',
        color: '#' + Math.floor(Math.random() * 16777215).toString(16),
        id:    userId || Math.random().toString(36).substr(2, 9),
      });

      setIsYjsReady(true);
    });

    // Server sends the current Yjs state when we join
    socket.on('document-state', (data) => {
      if (data.content) {
        const binary = atob(data.content);
        const update = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          update[i] = binary.charCodeAt(i);
        }
        // Merge server state into our local Y.Doc (CRDT merge — no conflicts)
        Y.applyUpdate(ydoc, update);
      }
    });

    // If offline: still show the editor using only IndexedDB state
    socket.on('connect_error', () => {
      if (!isYjsReady && idbSynced) {
        // No server but we have local state — allow read/edit offline
        setIsYjsReady(true);
      }
    });

    // Server-side version restore broadcast
    socket.on('document-restored', () => {
      window.location.reload();
    });

    // ── 2c. Awareness — live cursors ───────────────────────────────────────
    const updateOnlineUsers = () => {
      const states = Array.from(ydoc.awareness.getStates().values());
      setOnlineUsers(states.map((s) => s.user).filter(Boolean));
    };
    ydoc.awareness.on('change', updateOnlineUsers);
    updateOnlineUsers();

    socket.on('error', (err) => console.error('[Yjs Socket.IO error]', err));

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      ydoc.awareness.off('change', updateOnlineUsers);
      if (providerRef.current) providerRef.current.destroy();
      if (idbRef.current)      idbRef.current.destroy();
      if (ydocRef.current)     ydocRef.current.destroy();
      socket.disconnect();
      setIsYjsReady(false);
      setIdbSynced(false);
    };
  }, [documentId, userId, user?.name]);

  return {
    editor,
    isYjsReady,
    idbSynced,
    ydocRef,
    providerRef,
    onlineUsers,
    setOnlineUsers,
    saveStatus,
    setSaveStatus,
    socket: socketRef.current,
  };
};

export default useYjsProvider;