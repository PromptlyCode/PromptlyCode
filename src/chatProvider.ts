import axios from 'axios';
import { API_ENDPOINT, API_KEY, ChatMessage } from './constants';
import * as vscode from 'vscode';

export class ChatProvider {
    private messages: ChatMessage[] = [];

    constructor() {
        // Optional: Load previous conversation from storage
        this.loadConversationHistory();
    }

    async sendMessage(userMessage: string): Promise<string> {
        try {
            // Add user message to conversation history
            this.messages.push({ role: 'user', content: userMessage });

            const response = await axios.post(API_ENDPOINT, {
                model: 'claude-3-haiku-20240307',
                messages: this.messages,
                max_tokens: 1024
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                }
            });

            const assistantReply = response.data.content[0].text;
            
            // Add assistant reply to conversation history
            this.messages.push({ role: 'assistant', content: assistantReply });

            // Save conversation history
            this.saveConversationHistory();

            return assistantReply;
        } catch (error) {
            console.error('Error in chat:', error);
            throw error;
        }
    }

    private loadConversationHistory() {
        const context = vscode.workspace.getConfiguration('aiChatExtension');
        const savedMessages = context.get<ChatMessage[]>('conversationHistory', []);
        this.messages = savedMessages;
    }

    private saveConversationHistory() {
        const context = vscode.workspace.getConfiguration('aiChatExtension');
        context.update('conversationHistory', this.messages, true);
    }

    resetConversation() {
        this.messages = [];
        this.saveConversationHistory();
    }
}