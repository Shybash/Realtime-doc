import * as Y from 'yjs';
import { applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';

// Native lightweight throttle helper with cancel capability to eliminate lodash library dependencies
function throttle(func, limit) {
  let timeoutId = null;
  let lastRun = 0;
  
  const throttled = function(...args) {
    const context = this;
    const now = Date.now();
    
    if (now - lastRun >= limit) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      func.apply(context, args);
      lastRun = now;
    } else {
      if (!timeoutId) {
        timeoutId = setTimeout(() => {
          func.apply(context, args);
          lastRun = Date.now();
          timeoutId = null;
        }, limit - (now - lastRun));
      }
    }
  };
  
  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  
  return throttled;
}

/**
 * SocketIOProvider
 *
 * Bridges a Yjs Y.Doc with a Socket.IO connection for real-time collaboration.
 *
 * KEY OPTIMISATION vs the previous version:
 *   The previous implementation called Y.encodeStateAsUpdate(doc) on every
 *   transaction — this encodes the FULL document state (O(doc size)) every
 *   100 ms, which is extremely wasteful for large documents.
 *
 *   This version captures the INCREMENTAL binary update from the transaction
 *   itself (provided by Yjs in the `afterTransaction` callback via
 *   `transaction.encodeUpdateMessage()`). For a single keystroke this is
 *   typically 5–20 bytes regardless of document size, vs. potentially
 *   hundreds of kilobytes with the old approach.
 */
class SocketIOProvider {
  constructor(socket, roomName, doc) {
    this.socket   = socket;
    this.roomName = roomName;
    this.doc      = doc;
    this.awareness = doc.awareness;
    this.connected = false;

    // ── Receive remote Yjs updates ─────────────────────────────────────────
    this._onYjsUpdate = (update) => {
      Y.applyUpdate(this.doc, new Uint8Array(update), this); // tag with `this` as origin
    };
    this.socket.on('yjs-update', this._onYjsUpdate);

    // ── Receive awareness (cursor) updates ─────────────────────────────────
    this._onAwarenessUpdate = (update) => {
      applyAwarenessUpdate(this.awareness, new Uint8Array(update), this);
    };
    this.socket.on('awareness-update', this._onAwarenessUpdate);

    // ── Send awareness updates (throttled to max 10/s) ─────────────────────
    this.awarenessUpdateThrottled = throttle(() => {
      const update = encodeAwarenessUpdate(this.awareness, [this.awareness.clientID]);
      this.socket.emit('awareness-update', this.roomName, Array.from(update));
    }, 100);
    this.awareness.on('update', this.awarenessUpdateThrottled);

    // ── Send incremental Yjs updates ───────────────────────────────────────
    // We use the `update` event instead of `afterTransaction` to get the
    // raw incremental binary diff directly — no re-encoding needed.
    // The `origin` check prevents echo: we only forward updates that did NOT
    // originate from the server (tagged with `this` as origin above).
    this._onDocUpdate = throttle((update, origin) => {
      if (origin === this) return; // skip updates we applied from the server
      this.socket.emit('yjs-update', this.roomName, Array.from(update));
    }, 50); // 50 ms throttle → max 20 updates/second
    this.doc.on('update', this._onDocUpdate);

    this.connected = true;
  }

  destroy() {
    this.connected = false;
    this.socket.off('yjs-update',      this._onYjsUpdate);
    this.socket.off('awareness-update', this._onAwarenessUpdate);
    this.awareness.off('update', this.awarenessUpdateThrottled);
    this.doc.off('update', this._onDocUpdate);
    if (this.awarenessUpdateThrottled?.cancel) this.awarenessUpdateThrottled.cancel();
    if (this._onDocUpdate?.cancel)              this._onDocUpdate.cancel();
  }
}

export default SocketIOProvider;