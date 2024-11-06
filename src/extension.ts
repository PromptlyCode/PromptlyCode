// src/extension.ts
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
        let apiKey = config.get<string>('apiKey');

        // If API key is not set, prompt for it
        if (!apiKey) {
            apiKey = await promptForApiKey();
            if (!apiKey) {
                return; // User cancelled the input
            }
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
                const response = await askOpenAI(apiKey!, question, selectedCode);
                
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
                    // If API key is invalid, prompt for a new one
                    if (error.message.includes('API key')) {
                        vscode.window.showErrorMessage('Invalid API key. Please enter a new one.');
                        await promptForApiKey();
                    } else {
                        vscode.window.showErrorMessage(`Error: ${error.message}`);
                    }
                } else {
                    vscode.window.showErrorMessage('An unknown error occurred');
                }
            }
        });
    });

    context.subscriptions.push(disposable);
}

async function promptForApiKey(): Promise<string | undefined> {
    const result = await vscode.window.showInputBox({
        prompt: 'Please enter your OpenAI API key',
        placeHolder: 'sk-...',
        password: true, // Masks the input
        ignoreFocusOut: true, // Keeps input box open when focus is lost
        validateInput: (value: string) => {
            if (!value.startsWith('sk-')) {
                return 'API key should start with "sk-"';
            }
            if (value.length < 20) {
                return 'API key seems too short';
            }
            return null;
        }
    });

    if (result) {
        // Save the API key to settings
        const config = vscode.workspace.getConfiguration('openaiHelper');
        await config.update('apiKey', result, true);
        vscode.window.showInformationMessage('API key saved successfully!');
        return result;
    }
    return undefined;
}

async function validateApiKey(apiKey: string): Promise<boolean> {
    try {
        await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4',
                messages: [
                    {
                        role: 'user',
                        content: 'Hello'
                    }
                ],
                max_tokens: 1 // Minimize tokens for validation
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return true;
    } catch (error) {
        return false;
    }
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
            if (error.response.status === 401) {
                throw new Error('Invalid API key');
            }
            throw new Error(`OpenAI API error: ${error.response.data.error.message}`);
        }
        throw error;
    }
}

export function deactivate() {}