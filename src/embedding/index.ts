import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as lancedb from "@lancedb/lancedb";
import "@lancedb/lancedb/embedding/openai";
import { LanceSchema, getRegistry } from "@lancedb/lancedb/embedding";
import { EmbeddingFunction } from "@lancedb/lancedb/embedding";
import { Utf8 } from "apache-arrow";

// Configuration interface
export interface CodeScannerConfig {
    openaiApiKey: string;
    excludePatterns: string[];
    maxFileSizeBytes: number;
}

export async function xxactivate(context: vscode.ExtensionContext) {
    // Create database directory in extension's storage path
    const dbPath = path.join(context.globalStoragePath, 'codedb');
    await fs.mkdir(dbPath, { recursive: true });

    let disposable = vscode.commands.registerCommand('codescanner.scanProject', async () => {
        try {
            const config = vscode.workspace.getConfiguration('codescanner');
            const settings: CodeScannerConfig = {
                openaiApiKey: config.get('openaiApiKey', ''),
                excludePatterns: config.get('excludePatterns', ['node_modules', '.git']),
                maxFileSizeBytes: config.get('maxFileSizeBytes', 1000000)
            };

            if (!settings.openaiApiKey) {
                throw new Error('OpenAI API key not configured');
            }

            // Initialize LanceDB
            const db = await lancedb.connect(dbPath);
            const func = getRegistry()
                .get("openai")
                ?.create({ 
                    model: "text-embedding-ada-002",
                    apiKey: settings.openaiApiKey 
                }) as EmbeddingFunction;

            // Define schema
            const codeSchema = LanceSchema({
                filePath: new Utf8(),
                content: func.sourceField(new Utf8()),
                language: new Utf8(),
                vector: func.vectorField(),
            });

            // Create or get table
            const table = await db.createEmptyTable("code_vectors", codeSchema, {
                mode: "overwrite"
            });

            // Get workspace folders
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                throw new Error('No workspace folder open');
            }
            
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Scanning project files",
                cancellable: true
            }, async (progress, token) => {
                // Scan files recursively
                for (const folder of workspaceFolders) {
                    await scanDirectory(folder.uri.fsPath, table, settings, progress, token);
                }
            });

            vscode.window.showInformationMessage('Project scan completed successfully!');

        } catch (error) {
            vscode.window.showErrorMessage(`Error scanning project: {error.message}`);
        }
    });

    context.subscriptions.push(disposable);

    // Register search command
    let searchDisposable = vscode.commands.registerCommand('codescanner.searchCode', async () => {
        try {
            const query = await vscode.window.showInputBox({
                prompt: "Enter search query",
                placeHolder: "Search code..."
            });

            if (!query) return;

            const db = await lancedb.connect(dbPath);
            const table = await db.openTable("code_vectors");
            
            // Show progress during search
            const results = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Searching code...",
                cancellable: false
            }, async () => {
                return await table.search(query).limit(5).toArray();
            });
            
            // Create and show results in a new webview
            const panel = vscode.window.createWebviewPanel(
                'searchResults',
                'Code Search Results',
                vscode.ViewColumn.One,
                {}
            );

            panel.webview.html = getResultsHtml(results);

        } catch (error) {
            vscode.window.showErrorMessage(`Error searching: {error.message}`);
        }
    });

    context.subscriptions.push(searchDisposable);
}

export async function scanDirectory(
    dirPath: string,
    table: any,
    config: CodeScannerConfig,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    token: vscode.CancellationToken
): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
        if (token.isCancellationRequested) {
            return;
        }

        const fullPath = path.join(dirPath, entry.name);
        
        // Skip excluded patterns
        if (config.excludePatterns.some(pattern => fullPath.includes(pattern))) {
            continue;
        }

        if (entry.isDirectory()) {
            await scanDirectory(fullPath, table, config, progress, token);
        } else {
            try {
                const stats = await fs.stat(fullPath);
                
                // Skip files that are too large
                if (stats.size > config.maxFileSizeBytes) {
                    continue;
                }

                const content = await fs.readFile(fullPath, 'utf-8');
                const language = getFileLanguage(fullPath);

                progress.report({ message: `Processing ${fullPath}` });

                await table.add([{
                    filePath: fullPath,
                    content: content,
                    language: language
                }]);

            } catch (error) {
                console.error(`Error processing file ${fullPath}:`, error);
            }
        }
    }
}

export function getFileLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: { [key: string]: string } = {
        '.js': 'javascript',
        '.ts': 'typescript',
        '.py': 'python',
        '.java': 'java',
        '.cpp': 'cpp',
        '.cs': 'csharp',
        '.go': 'go',
        '.rs': 'rust',
        '.rb': 'ruby',
        '.php': 'php',
        '.html': 'html',
        '.css': 'css',
        '.json': 'json',
        '.md': 'markdown'
    };
    return languageMap[ext] || 'unknown';
}

export function getResultsHtml(results: any[]): string {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { padding: 20px; }
                .result { margin-bottom: 20px; padding: 10px; border: 1px solid #ccc; }
                .filepath { font-weight: bold; }
                .content { white-space: pre-wrap; }
            </style>
        </head>
        <body>
            <h2>Search Results</h2>
            ${results.map(result => `
                <div class="result">
                    <div class="filepath">${result.filePath}</div>
                    <div class="language">Language: ${result.language}</div>
                    <pre class="content">${result.content}</pre>
                </div>
            `).join('')}
        </body>
        </html>
    `;
}
