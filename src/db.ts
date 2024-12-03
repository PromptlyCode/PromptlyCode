import * as vscode from 'vscode';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';

// Types
interface ChatEntry {
    id: number;
    timestamp: string;
    content: string;
    filePath: string;
}

class ChatHistoryDB {
    private db: sqlite3.Database;
    
    constructor(dbPath: string) {
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err);
                return;
            }
        });
        this.initTable();
    }

    private initTable(): void {
        const sql = `
            CREATE TABLE IF NOT EXISTS chat_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                content TEXT NOT NULL,
                file_path TEXT NOT NULL
            )`;
        
        this.db.run(sql, (err) => {
            if (err) {
                console.error('Error creating table:', err);
            }
        });
    }

    public async saveChat(content: string, filePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const sql = 'INSERT INTO chat_history (content, file_path) VALUES (?, ?)';
            this.db.run(sql, [content, filePath], (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    public async getChatHistory(): Promise<ChatEntry[]> {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM chat_history ORDER BY timestamp DESC';
            this.db.all(sql, [], (err, rows: ChatEntry[]) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows);
            });
        });
    }

    public close(): void {
        this.db.close();
    }
}

export class ChatHistoryExtension {
    private chatDB: ChatHistoryDB;

    constructor(context: vscode.ExtensionContext) {
        const dbPath = path.join(context.extensionPath, 'chat-history.db');
        this.chatDB = new ChatHistoryDB(dbPath);
        
        // Register commands
        context.subscriptions.push(
            vscode.commands.registerCommand('extension.saveChat', this.saveChat.bind(this)),
            vscode.commands.registerCommand('extension.viewChatHistory', this.viewChatHistory.bind(this))
        );
    }

    private async saveChat(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        try {
            const content = editor.document.getText();
            const filePath = editor.document.uri.fsPath;
            await this.chatDB.saveChat(content, filePath);
            vscode.window.showInformationMessage('Chat history saved successfully');
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to save chat history: ${err}`);
        }
    }

    private async viewChatHistory(): Promise<void> {
        try {
            const history = await this.chatDB.getChatHistory();
            const panel = vscode.window.createWebviewPanel(
                'chatHistory',
                'Chat History',
                vscode.ViewColumn.One,
                {}
            );

            panel.webview.html = this.getWebviewContent(history);
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to load chat history: ${err}`);
        }
    }

    private getWebviewContent(history: ChatEntry[]): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Chat History</title>
                <style>
                    body { padding: 20px; }
                    .chat-entry {
                        margin-bottom: 20px;
                        padding: 10px;
                        border: 1px solid #ccc;
                        border-radius: 4px;
                    }
                    .timestamp {
                        color: #666;
                        font-size: 0.9em;
                    }
                    .file-path {
                        color: #0066cc;
                        font-size: 0.9em;
                    }
                </style>
            </head>
            <body>
                <h1>Chat History</h1>
                ${history.map(entry => `
                    <div class="chat-entry">
                        <div class="timestamp">${entry.timestamp}</div>
                        <div class="file-path">${entry.filePath}</div>
                        <pre>${entry.content}</pre>
                    </div>
                `).join('')}
            </body>
            </html>
        `;
    }

    public dispose(): void {
        this.chatDB.close();
    }
}

// Extension activation and deactivation
export function activate(context: vscode.ExtensionContext): void {
    new ChatHistoryExtension(context);
}

export function deactivate(): void {
    // Cleanup will be handled by dispose()
}