import * as vscode from 'vscode';
import axios from 'axios';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('vscode-openai-helper.askOpenAI', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        // Get the selected text
        const selection = editor.selection;
        const selectedCode = editor.document.getText(selection);

        if (!selectedCode) {
            vscode.window.showErrorMessage('Please select some code first');
            return;
        }

        // Get the API key from settings
        const config = vscode.workspace.getConfiguration('openaiHelper');
        const apiKey = config.get<string>('apiKey');

        if (!apiKey) {
            vscode.window.showErrorMessage('Please set your OpenAI API key in settings');
            return;
        }

        // Show input box for the question
        const question = await vscode.window.showInputBox({
            placeHolder: 'What would you like to ask about this code?',
            prompt: 'Enter your question',
        });

        if (!question) {
            return;
        }

        // Show progress indicator
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Asking OpenAI...",
            cancellable: false
        }, async (progress) => {
            try {
                const response = await askOpenAI(apiKey, question, selectedCode);
                
                // Show response in a new editor
                const document = await vscode.workspace.openTextDocument({
                    content: response,
                    language: 'markdown'
                });
                
                await vscode.window.showTextDocument(document, {
                    viewColumn: vscode.ViewColumn.Beside
                });
            } catch (error) {
                if (error instanceof Error) {
                    vscode.window.showErrorMessage(`Error: ${error.message}`);
                } else {
                    vscode.window.showErrorMessage('An unknown error occurred');
                }
            }
        });
    });

    context.subscriptions.push(disposable);
}

async function askOpenAI(apiKey: string, question: string, code: string): Promise<string> {
    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant that answers questions about code.'
                    },
                    {
                        role: 'user',
                        content: `Question: ${question}\n\nCode:\n${code}`
                    }
                ],
                temperature: 0.7
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(`OpenAI API error: ${error.response.data.error.message}`);
        }
        throw error;
    }
}

export function deactivate() {}