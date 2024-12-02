import * as sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'path';
import * as vscode from "vscode";

// Initialize database connection
export async function initDatabase(context: vscode.ExtensionContext) {
  const dbPath = path.join(context.globalStorageUri.fsPath, 'chat_history.db');
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Create table if it doesn't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      role TEXT,
      content TEXT
    )
  `);

  return db;
}
