// src/extension.ts
import * as vscode from 'vscode';
import axios from 'axios';
import { ChatViewProvider } from './chatViewProvider';

let chatViewProvider: ChatViewProvider;

export function activate(context: vscode.ExtensionContext) {
    // Initialize chat view provider
    chatViewProvider = new ChatViewProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'aiChatView',
            chatViewProvider
        )
    );

    // Register the original command for code modification
    let disposable = vscode.commands.registerCommand('promptly-code.askOpenAI', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const selection = editor.selection;
        const selectedCode = editor.document.getText(selection);

        if (!selectedCode) {
            vscode.window.showErrorMessage('Please select some code first');
            return;
        }

        const config = vscode.workspace.getConfiguration('openaiHelper');
        let apiKey = config.get<string>('apiKey');

        if (!apiKey) {
            apiKey = await promptForApiKey();
            if (!apiKey) {
                return;
            }
        }

        const question = await vscode.window.showInputBox({
            placeHolder: 'What would you like to ask about this code?',
            prompt: 'Enter your question',
        });

        if (!question) {
            return;
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Processing with Claude...",
            cancellable: false
        }, async (progress) => {
            try {
                const newCode = await askAI(apiKey!, question, selectedCode);
                await editor.edit(editBuilder => {
                    editBuilder.replace(selection, newCode);
                });
                vscode.window.showInformationMessage('Code updated successfully!');
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

    // Register command to create new file from chat
    context.subscriptions.push(
        vscode.commands.registerCommand('promptly-code.createFile', async (content: string, language: string) => {
            const document = await vscode.workspace.openTextDocument({
                content: content,
                language: language
            });
            await vscode.window.showTextDocument(document);
        })
    );

    context.subscriptions.push(disposable);
}

async function promptForApiKey(): Promise<string | undefined> {
    const result = await vscode.window.showInputBox({
        prompt: 'Please enter your OpenRouter API key',
        placeHolder: 'sk-or-...',
        password: true,
        ignoreFocusOut: true,
        validateInput: (value: string) => {
            if (!value.startsWith('sk-or-')) {
                return 'OpenRouter API key should start with "sk-or-"';
            }
            if (value.length < 20) {
                return 'API key seems too short';
            }
            return null;
        }
    });

    if (result) {
        const config = vscode.workspace.getConfiguration('openaiHelper');
        await config.update('apiKey', result, true);
        vscode.window.showInformationMessage('API key saved successfully!');
        return result;
    }
    return undefined;
}

function extractCodeFromResponse(response: string): string {
    // Try to find code between markdown code blocks
    const markdownMatch = response.match(/```(?:\w+)?\n([\s\S]+?)\n```/);
    if (markdownMatch) {
        return markdownMatch[1].trim();
    }

    // If no markdown blocks found, attempt to extract just the code section
    const codeMatch = response.match(/(?:Here's the code:|Here is the code:)\n*([\s\S]+)$/i);
    if (codeMatch) {
        return codeMatch[1].trim();
    }

    // If no specific markers found, return the whole response
    return response.trim();
}

async function askAI(apiKey: string, question: string, code: string): Promise<string> {
    try {
        const fullPrompt = `I have this code:

${code}

${question}

Please provide only the modified code without any explanation or markdown tags. Do not include \`\`\` markers. Just return the code that should replace the current selection.`;

        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: 'anthropic/claude-3.5-sonnet',
                messages: [
                    {
                        role: 'user',
                        content: fullPrompt
                    }
                ],
                top_p: 1,
                temperature: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
                repetition_penalty: 1,
                top_k: 0,
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const responseContent = response.data.choices[0].message.content;
        return extractCodeFromResponse(responseContent);
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            if (error.response.status === 401) {
                throw new Error('Invalid API key');
            }
            throw new Error(`API error: ${error.response.data.error.message}`);
        }
        throw error;
    }
}

export function deactivate() {}
