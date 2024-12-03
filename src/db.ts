import * as vscode from 'vscode';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';

// Database helper class to manage chat history storage
export class ChatHistoryDatabase {
  private db: sqlite3.Database;

  constructor(context: vscode.ExtensionContext) {
    const dbPath = path.join(context.extensionPath, 'chat_history.sqlite');
    
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        vscode.window.showErrorMessage(`Error opening database: ${err.message}`);
      } else {
        this.initializeDatabase();
      }
    });
  }

  private initializeDatabase() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        session_id TEXT,
        role TEXT,
        message TEXT
      )
    `);
  }

  // Save a message to the database
  public saveMessage(sessionId: string, role: 'user' | 'assistant', message: string) {
    return new Promise<void>((resolve, reject) => {
      this.db.run(
        'INSERT INTO chat_history (session_id, role, message) VALUES (?, ?, ?)', 
        [sessionId, role, message], 
        (err) => {
          if (err) {
            vscode.window.showErrorMessage(`Error saving message: ${err.message}`);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  // Retrieve chat history for a specific session
  public getChatHistory(sessionId: string): Promise<Array<{role: string, message: string, timestamp: string}>> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT role, message, timestamp FROM chat_history WHERE session_id = ? ORDER BY timestamp', 
        [sessionId], 
        (err, rows) => {
          if (err) {
            vscode.window.showErrorMessage(`Error retrieving chat history: ${err.message}`);
            reject(err);
          } else {
            console.log("TODO----");
            //resolve(rows);
          }
        }
      );
    });
  }

  // Close the database connection
  public close() {
    this.db.close((err) => {
      if (err) {
        vscode.window.showErrorMessage(`Error closing database: ${err.message}`);
      }
    });
  }
}

