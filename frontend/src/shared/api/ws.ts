import { buildApiUrl } from './client';

export type ChatSocketMessage = {
  id: string;
  chat_id: string;
  author_id: string | null;
  role: 'developer' | 'client' | 'ai' | 'system';
  content: string;
  created_at?: string;
  timestamp?: string;
  attachments: Array<{ id: string; filename: string; content_type: string }>;
};

export function connectChatSocket(
  chatId: string,
  token: string,
  handlers: {
    onMessage: (message: ChatSocketMessage) => void;
    onError?: (event: Event) => void;
    onClose?: (event: CloseEvent) => void;
  }
): WebSocket {
  const socket = new WebSocket(
    buildApiUrl(`/ws/${encodeURIComponent(chatId)}`).replace(/^http/, 'ws') + `?token=${encodeURIComponent(token)}`
  );

  socket.addEventListener('message', (event) => {
    try {
      handlers.onMessage(JSON.parse(event.data) as ChatSocketMessage);
    } catch {
      // ignore malformed frames
    }
  });

  if (handlers.onError) socket.addEventListener('error', handlers.onError);
  if (handlers.onClose) socket.addEventListener('close', handlers.onClose);

  return socket;
}

export function closeChatSocket(socket: WebSocket): void {
  if (socket.readyState === WebSocket.CLOSING || socket.readyState === WebSocket.CLOSED) {
    return;
  }

  if (socket.readyState === WebSocket.CONNECTING) {
    const closeWhenReady = () => socket.close(1000, 'client cleanup');
    const cleanup = () => {
      socket.removeEventListener('open', closeWhenReady);
      socket.removeEventListener('error', cleanup);
    };

    socket.addEventListener('open', closeWhenReady, { once: true });
    socket.addEventListener('open', cleanup, { once: true });
    socket.addEventListener('error', cleanup, { once: true });
    return;
  }

  socket.close(1000, 'client cleanup');
}
