import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { parseFileTs } from './parse_fun_refs';


const execAsync = promisify(exec);

let currentPanel: vscode.WebviewPanel | undefined = undefined;

export async function updateGraphVisualization() {
    if (!currentPanel) return;

    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    try {
        const fileName = editor.document.fileName;
        const dotContent = await parseFileTs(fileName);

        // Convert dot to SVG using Graphviz
        const { stdout: svgContent } = await execAsync(`echo "${dotContent}" | dot -Tsvg`);

        // Update webview content
        currentPanel.webview.html = getWebviewContent(svgContent);
    } catch (error) {
        vscode.window.showErrorMessage(`Error generating graph: ${error}`);
    }
}

function getWebviewContent(svgContent: string) {
    return `<!DOCTYPE html>
    <html>
        <head>
            <style>
                body {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    padding: 20px;
                    box-sizing: border-box;
                }
                #graph-container {
                    max-width: 100%;
                    max-height: 100%;
                    overflow: auto;
                }
            </style>
        </head>
        <body>
            <div id="graph-container">
                ${svgContent}
            </div>
            <script>
                const vscode = acquireVsCodeApi();

                // Add refresh button functionality
                document.addEventListener('keydown', (e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
                        vscode.postMessage({ command: 'refresh' });
                    }
                });
            </script>
        </body>
    </html>`;
}

