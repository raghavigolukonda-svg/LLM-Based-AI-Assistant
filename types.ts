export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  files?: AttachedFile[];
}

export interface AttachedFile {
  name: string;
  type: string;
  content: string; // Base64 or extracted text
  size: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}
