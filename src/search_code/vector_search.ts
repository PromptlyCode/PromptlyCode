// src/extension.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as lancedb from "@lancedb/lancedb";
import { Schema, DataType, Field } from "apache-arrow";
import axios from 'axios';

let db: lancedb.Connection;
const TABLE_NAME = 'code_snippets';

async function embedCode(codeSnippet: string): Promise<number[]> {
    try {
        const response = await axios.post('http://localhost:11434/api/embeddings', {
            model: "nomic-embed-text",
            prompt: codeSnippet
        });

        if (response.status === 200) {
            return response.data.embedding;
        }
    } catch (error) {
        console.error('Error generating embedding:', error);
    }
    return new Array(768).fill(0); // Default to zero vector on error
}

type CodeData = {
    [key: string]: unknown;
    file: string;
    code: string;
    vector: number[];
}

async function indexProjectCode() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const progress = vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Indexing project code",
        cancellable: false
    }, async (progress) => {
        try {
            // Create schema
            const schema = new Schema([
                new Field('file', new DataType('utf8')),
                new Field('code', new DataType('utf8')),
                new Field('vector', new DataType('fixed_size_list', 768, new DataType('float32')))
            ]);

            // Create or get table
            let table = await db.createTable(TABLE_NAME, schema);

            // Clear existing data
            await table.delete().execute();

            const files = await vscode.workspace.findFiles('**/*.{js,ts,py,java,cpp,c,cs,go,rb,php}', '**/node_modules/**');
            const totalFiles = files.length;
            let processedFiles = 0;
            const batchSize = 10;
            let batch: CodeData[] = [];

            for (const file of files) {
                try {
                    const content = await vscode.workspace.fs.readFile(file);
                    const codeSnippet = content.toString();
                    
                    // Generate embedding
                    const embedding = await embedCode(codeSnippet);

                    batch.push({
                        file: file.fsPath,
                        code: codeSnippet,
                        vector: embedding
                    });

                    // Process batch
                    if (batch.length >= batchSize) {
                        await table.add(batch as Record<string, unknown>[]);
                        batch = [];
                    }

                    processedFiles++;
                    progress.report({ 
                        increment: (processedFiles / totalFiles) * 100,
                        message: `Processed ${processedFiles} of ${totalFiles} files`
                    });
                } catch (error) {
                    console.error(`Error processing file ${file.fsPath}:`, error);
                    continue;
                }
            }

            // Process remaining items in batch
            if (batch.length > 0) {
                await table.add(batch as Record<string, unknown>[]);
            }

            vscode.window.showInformationMessage(`Indexed ${processedFiles} files successfully`);
        } catch (error) {
            console.error('Error indexing code:', error);
            vscode.window.showErrorMessage('Error indexing code');
        }
    });
}

async function searchCode() {
    try {
        const searchQuery = await vscode.window.showInputBox({
            prompt: 'Enter search keywords',
            placeHolder: 'e.g., file handling, database connection'
        });

        if (!searchQuery) return;

        const embedding = await embedCode(searchQuery);
        const table = await db.openTable(TABLE_NAME);
        
        const results = await table.search("vector", embedding)
            .metric("cosine")
            .limit(5)
            .execute();

        // Create and show results
        const panel = vscode.window.createWebviewPanel(
            'searchResults',
            'Code Search Results',
            vscode.ViewColumn.One,
            {}
        );

        let resultsHtml = '<h2>Search Results</h2>';
        for (const result of results) {
            const filePath = result.file;
            const relativePath = vscode.workspace.workspaceFolders?.[0] ? 
                path.relative(vscode.workspace.workspaceFolders[0].uri.fsPath, filePath) : 
                filePath;

            resultsHtml += `
                <div style="margin-bottom: 20px; border-bottom: 1px solid #ccc;">
                    <h3>File: ${relativePath}</h3>
                    <pre style="background-color: #f5f5f5; padding: 10px; overflow-x: auto;">
                        <code>${escapeHtml(result.code)}</code>
                    </pre>
                    <p>Similarity Score: ${(1 - result.distance).toFixed(4)}</p>
                </div>
            `;
        }

        panel.webview.html = `
            <!DOCTYPE html>
            <html>
                <head>
                    <style>
                        body { 
                            font-family: var(--vscode-font-family);
                            color: var(--vscode-editor-foreground);
                            background-color: var(--vscode-editor-background);
                            padding: 20px;
                        }
                        pre { 
                            max-height: 300px;
                            background-color: var(--vscode-editor-background);
                            border: 1px solid var(--vscode-panel-border);
                        }
                        code {
                            font-family: var(--vscode-editor-font-family);
                            font-size: var(--vscode-editor-font-size);
                        }
                        h2, h3 {
                            color: var(--vscode-editor-foreground);
                        }
                    </style>
                </head>
                <body>
                    ${resultsHtml}
                </body>
            </html>
        `;

    } catch (error) {
        console.error('Error searching code:', error);
        vscode.window.showErrorMessage('Error searching code');
    }
}

function escapeHtml(unsafe: string): string {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
