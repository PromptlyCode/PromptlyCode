import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  chatSessionId: string;
}

export class ChatHistoryManager {
  private storageDir: string;

  constructor(context: vscode.ExtensionContext) {
    // Create a directory for storing chat histories
    this.storageDir = path.join(context.extensionPath, 'chat-histories');
    
    // Ensure directory exists
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private getSessionFilePath(chatSessionId: string): string {
    return path.join(this.storageDir, `${chatSessionId}.json`);
  }

  public saveChatMessage(message: ChatMessage) {
    // Ensure message has a timestamp and chatSessionId
    message.timestamp = message.timestamp || Date.now();
    message.chatSessionId = message.chatSessionId || this.generateChatSessionId();

    const filePath = this.getSessionFilePath(message.chatSessionId);
    
    try {
      let messages: ChatMessage[] = [];
      
      // Read existing messages if file exists
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        messages = JSON.parse(fileContent);
      }

      // Add new message
      messages.push(message);

      // Write updated messages back to file
      fs.writeFileSync(filePath, JSON.stringify(messages, null, 2), 'utf8');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save chat message: ${error}`);
    }
  }

  public getChatHistory(chatSessionId?: string, limit = 100): ChatMessage[] {
    if (chatSessionId) {
      const filePath = this.getSessionFilePath(chatSessionId);
      
      try {
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const messages: ChatMessage[] = JSON.parse(fileContent);
          
          // Sort and limit messages
          return messages
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-limit);
        }
        return [];
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to retrieve chat history: ${error}`);
        return [];
      }
    }

    // If no specific session, return latest messages from all sessions
    try {
      const allFiles = fs.readdirSync(this.storageDir)
        .filter(file => file.endsWith('.json'));

      const allMessages: ChatMessage[] = allFiles.flatMap(file => {
        const filePath = path.join(this.storageDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(fileContent);
      });

      return allMessages
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-limit);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to retrieve chat histories: ${error}`);
      return [];
    }
  }

  public clearChatHistory(chatSessionId?: string) {
    try {
      if (chatSessionId) {
        const filePath = this.getSessionFilePath(chatSessionId);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } else {
        // Clear all chat history files
        const files = fs.readdirSync(this.storageDir);
        files.forEach(file => {
          if (file.endsWith('.json')) {
            fs.unlinkSync(path.join(this.storageDir, file));
          }
        });
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to clear chat history: ${error}`);
    }
  }

  private generateChatSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
