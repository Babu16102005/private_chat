import NetInfo from '@react-native-community/netinfo';
import * as SQLite from 'expo-sqlite';

type PendingMessage = {
  id: number;
  pairId: string;
  content: string;
  mediaUrl?: string | null;
  messageType: string;
  replyToMessageId?: string | null;
  optionsJson?: string | null;
};

const db = SQLite.openDatabaseSync('kiba-offline.db');

let initialized = false;

const ensureInitialized = async () => {
  if (initialized) return;
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pair_id TEXT NOT NULL,
      content TEXT NOT NULL,
      media_url TEXT,
      message_type TEXT NOT NULL,
      reply_to_message_id TEXT,
      options_json TEXT,
      created_at TEXT NOT NULL
    );
  `);
  initialized = true;
};

export const offlineMessageService = {
  async enqueue(message: Omit<PendingMessage, 'id' | 'optionsJson'> & { options?: Record<string, any> }) {
    await ensureInitialized();
    await db.runAsync(
      `INSERT INTO pending_messages (pair_id, content, media_url, message_type, reply_to_message_id, options_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      message.pairId,
      message.content,
      message.mediaUrl || null,
      message.messageType,
      message.replyToMessageId || null,
      message.options ? JSON.stringify(message.options) : null,
      new Date().toISOString()
    );
  },

  async getPending(): Promise<PendingMessage[]> {
    await ensureInitialized();
    return db.getAllAsync(
      `SELECT id, pair_id as pairId, content, media_url as mediaUrl, message_type as messageType,
        reply_to_message_id as replyToMessageId, options_json as optionsJson
       FROM pending_messages ORDER BY id ASC`
    );
  },

  async remove(id: number) {
    await ensureInitialized();
    await db.runAsync('DELETE FROM pending_messages WHERE id = ?', id);
  },

  async isOnline() {
    const state = await NetInfo.fetch();
    return state.isConnected !== false && state.isInternetReachable !== false;
  },
};
