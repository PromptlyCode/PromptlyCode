export const API_ENDPOINT = 'https://api.anthropic.com/v1/messages';
export const API_KEY = process.env.ANTHROPIC_API_KEY || '';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}