import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft, Zap, Send, Paperclip, Bot, X,
  Loader2,
  UserPlus, Copy, Check, Moon, Sun, Wifi, WifiOff
} from 'lucide-react';
import { useAppStore } from '../app/store';
import { closeChatSocket, connectChatSocket, pingApiServer } from '../shared/api';
import { getErrorMessage } from '../shared/api';
import type { Message, Attachment } from '../shared/types';
import { AiAnalysisDrawer } from '../shared/components/AiAnalysisDrawer';
import { AiAnalysisSidebar } from '../shared/components/AiAnalysisSidebar';
import './chat.css';

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function formatTime(d: Date) {
  return new Date(d).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
}



function getInitials(role: Message['role'], authorId: string) {
  if (role === 'ai')     return '🤖';
  if (role === 'system') return '⚙';
  return authorId.charAt(0).toUpperCase();
}

// function shortId(value: string): string {
//   return value.length > 8 ? value.slice(0, 8) : value;
// }

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'closed';


/* ── Main chat page ──────────────────────────────────────────────────────────── */
export const ChatPage: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();

  const currentUser  = useAppStore(s => s.currentUser);
  const chatRooms    = useAppStore(s => s.chatRooms);
  const isAuthenticated = useAppStore(s => s.isAuthenticated);
  const accessToken  = useAppStore(s => s.accessToken);
  const theme = useAppStore(s => s.theme);
  const toggleTheme = useAppStore(s => s.toggleTheme);
  const isAiStreaming = useAppStore(s => s.isAiStreaming);
  const streamingChatId = useAppStore(s => s.streamingChatId);
  const leaveChat = useAppStore(s => s.leaveChat);
  const loadMessages = useAppStore(s => s.loadMessages);
  const receiveMessage = useAppStore(s => s.receiveMessage);
  const sendMessage  = useAppStore(s => s.sendMessage);
  const runCommand   = useAppStore(s => s.runCommand);
  const toggleSidebar = useAppStore(s => s.toggleSidebar);
  const loadChats    = useAppStore(s => s.loadChats);


  const room = chatRooms.find(r => r.id === chatId);

  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isCommand = useMemo(() => input.startsWith('/'), [input]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendError, setSendError] = useState('');
  const [connection, setConnection] = useState<{ status: ConnectionStatus; rttMs?: number }>({ status: 'idle' });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room?.messages]);

  useEffect(() => {
    if (isAuthenticated && chatId) {
      void loadMessages(chatId);
      if (chatRooms.length === 0) {
        void loadChats();
      }
    }

    return () => {
      if (chatId) leaveChat(chatId);
    };
  }, [isAuthenticated, chatId, leaveChat, loadMessages, loadChats, chatRooms.length]);

  useEffect(() => {
    if (!accessToken || !chatId) {
      queueMicrotask(() => setConnection({ status: 'idle' }));
      return;
    }

    if (socketRef.current) {
      closeChatSocket(socketRef.current);
    }
    const startedAt = performance.now();
    queueMicrotask(() => setConnection({ status: 'connecting' }));

    const socket = connectChatSocket(chatId, accessToken, {
      onOpen: () => {
        if (socketRef.current !== socket) return;
        setConnection({ status: 'connected', rttMs: Math.round(performance.now() - startedAt) });
      },
      onMessage: (incoming) => {
        if (socketRef.current !== socket) return;
        receiveMessage(chatId, {
          id: incoming.id,
          chatId: incoming.chat_id,
          authorId: incoming.author_id ?? incoming.role,
          role: incoming.role,
          content: incoming.content,
          timestamp: new Date(incoming.timestamp ?? incoming.created_at ?? Date.now()),
          attachments: incoming.attachments.map(a => ({
            id: a.id,
            name: a.filename,
            size: 0,
            type: a.content_type,
          })),
        });
      },
      onError: () => {
        if (socketRef.current === socket) {
          setConnection({ status: 'error' });
        }
        if (import.meta.env.DEV && socketRef.current === socket) {
          console.warn('[chat-ws] connection error', { chatId, url: socket.url });
        }
      },
      onClose: (event) => {
        if (socketRef.current === socket) {
          setConnection({ status: event.code === 1000 ? 'closed' : 'error' });
        }
        if (import.meta.env.DEV && socketRef.current === socket && event.code !== 1000) {
          console.warn('[chat-ws] connection closed', {
            chatId,
            code: event.code,
            reason: event.reason || '(empty)',
            wasClean: event.wasClean,
          });
        }
      },
    });
    socketRef.current = socket;

    return () => {
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
      closeChatSocket(socket);
    };
  }, [accessToken, chatId, receiveMessage]);

  useEffect(() => {
    if (!accessToken || !chatId) return;

    const controller = new AbortController();

    const measurePing = async () => {
      try {
        const rttMs = await pingApiServer(controller.signal);
        setConnection(current => (
          current.status === 'connected' || current.status === 'connecting'
            ? { ...current, rttMs }
            : current
        ));
      } catch (error) {
        if (!controller.signal.aborted) {
          setConnection(current => (
            current.status === 'connected' || current.status === 'connecting'
              ? { ...current, status: 'error' }
              : current
          ));
          if (import.meta.env.DEV) {
            console.warn('[api-ping] failed', error);
          }
        }
      }
    };

    const intervalId = window.setInterval(() => {
      void measurePing();
    }, 10_000);

    return () => {
      controller.abort();
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [accessToken, chatId]);


  // Redirect if not found
  if (!room) {
    if (isAuthenticated && chatRooms.length === 0) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 16 }}>
          <Loader2 size={24} className="animate-spin text-muted" />
          <p className="text-muted">Loading chat…</p>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 16 }}>
        <p className="text-muted">Chat not found</p>
        <Link to="/" className="btn btn-primary">← Back to chats</Link>
      </div>
    );
  }

  const isCurrentChatStreaming = isAiStreaming && streamingChatId === chatId;
  const hasStreamingMessage = room.messages.some(message => message.isStreaming);
  const isConnectionLive = connection.status === 'connected';
  const connectionLabel = connection.status === 'connected'
    ? `${connection.rttMs ?? 0}ms`
    : connection.status === 'connecting'
    ? 'Connecting'
    : connection.status === 'idle'
    ? 'Offline'
    : 'Disconnected';

  const handleSend = async () => {
    const text = input.trim();
    if (!text && attachments.length === 0) return;
    const messageText = text || 'Please analyze the attached file.';

    setInput('');
    setSendError('');

    try {
      if (messageText.startsWith('/')) {
        await runCommand(chatId!, messageText);
      } else {
        await sendMessage(chatId!, messageText, attachments.length > 0 ? attachments : undefined);
      }

      attachments.forEach(a => {
        if (a.url?.startsWith('blob:')) {
          URL.revokeObjectURL(a.url);
        }
      });
      setAttachments([]);
    } catch (error) {
      setInput(text);
      setSendError(getErrorMessage(error));
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    attachments.forEach(a => {
      if (a.url?.startsWith('blob:')) {
        URL.revokeObjectURL(a.url);
      }
    });

    const newAttachment: Attachment = {
      id: `att-${Date.now()}-${file.name}`,
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file),
      file,
    };
    setAttachments([newAttachment]);
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    const removed = attachments.find(a => a.id === id);
    if (removed?.url?.startsWith('blob:')) {
      URL.revokeObjectURL(removed.url);
    }
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const getMsgClass = (msg: Message) => {
    const isMe = msg.authorId === currentUser?.id;
    if (msg.role === 'ai' || msg.role === 'system') return 'msg--ai';
    return isMe ? 'msg--me' : 'msg--other';
  };

  const getMessageAuthorName = (msg: Message) => {
    if (msg.authorId === currentUser?.id) return 'You';
    if (msg.role === 'ai') return 'AgreeMi AI';
    const roleLabel = msg.role ? msg.role.charAt(0).toUpperCase() + msg.role.slice(1) : 'User';
    return `${roleLabel} (${msg.authorId.slice(0, 4)})`;
  };

  // Command suggestions
  const COMMANDS = ['/analyze', '/diff', '/summary', '/help'];
  const suggestions = isCommand
    ? COMMANDS.filter(c => c.startsWith(input.toLowerCase()))
    : [];

  // Invite modal state
  const inviteCode = room.inviteCode ?? chatId;
  const inviteJoinLink = `${window.location.origin}/join/${inviteCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteJoinLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="chat-layout">
      {/* Top nav */}
      <div className="chat-nav glass">
        <div className="chat-nav-left">
          <Link to="/" className="btn btn-ghost chat-back">
            <ArrowLeft size={15} />
          </Link>
          <div className="chat-nav-room">
            <div className="chat-nav-title">{room.title}</div>
            <div className="text-xs text-muted">{room.messages.length} messages</div>
          </div>
        </div>
        <div className="chat-nav-right">
          <span
            className={`connection-badge connection-badge--${connection.status}`}
            title={`Realtime server: ${connectionLabel}`}
          >
            {isConnectionLive ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connectionLabel}
          </span>
          {room.aiAnalysis && (
            <span className="badge badge-lime">
              <Zap size={10} />
              Analyzed
            </span>
          )}
          <button className="btn btn-ghost theme-toggle" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            className="btn btn-ghost ai-analysis-btn"
            onClick={() => {
              if (window.innerWidth > 1024) {
                toggleSidebar();
              } else {
                setIsDrawerOpen(true);
              }
            }}
            title="AI Analysis"
          >
            <Bot size={15} />
            {room.aiAnalysis ? 'Analysis' : 'AI'}
          </button>
          <button
            className="btn btn-ghost invite-btn"
            onClick={() => setShowInvite(v => !v)}
            title="Invite collaborator"
          >
            <UserPlus size={15} />
            Invite
          </button>
        </div>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="invite-modal-overlay" onClick={() => setShowInvite(false)}>
          <div
            className="invite-modal glass animate-fade-up"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-modal-title"
          >
            <div className="invite-modal-header">
              <div className="invite-modal-title" id="invite-modal-title">
                <UserPlus size={16} />
                Invite to "{room.title}"
              </div>
              <button className="invite-modal-close" onClick={() => setShowInvite(false)} aria-label="Close invite dialog">
                <X size={14} />
              </button>
            </div>
            <p className="text-sm text-muted invite-modal-desc">
              Share this link — anyone who opens it will be added to this workspace.
            </p>
            <div className="invite-link-row">
              <input
                className="invite-link-input"
                aria-label="Invite link"
                value={inviteJoinLink}
                readOnly
                onFocus={e => e.target.select()}
              />
              <button
                className={`invite-copy-btn ${copied ? 'copied' : ''}`}
                onClick={handleCopy}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-muted invite-link-format">
              Link format: <code>/join/{inviteCode}</code>
            </p>
          </div>
        </div>
      )}

      {/* Body: messages + sidebar */}
      <div className="chat-body">
        {/* Messages area */}
        <div className="chat-messages-area">
          <div className="chat-messages">
            {room.messages.map((msg, i) => (
              <div
                key={msg.id}
                className={`msg ${getMsgClass(msg)} animate-fade-up`}
                style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
              >
                {/* Avatar (left) */}
                {(msg.role === 'ai' || getMsgClass(msg) === 'msg--other') && (
                  <div className={`avatar avatar-${msg.role === 'ai' ? 'ai' : 'client'} msg-avatar`}>
                    {getInitials(msg.role, getMessageAuthorName(msg))}
                  </div>
                )}

                <div className="msg-bubble">
                  {/* Role label for others */}
                  {msg.role !== 'ai' && getMsgClass(msg) !== 'msg--me' && (
                    <div className="msg-author text-xs text-muted">
                      {getMessageAuthorName(msg)}
                    </div>
                  )}
                  {msg.role === 'ai' && (
                    <div className="msg-author text-xs" style={{ color: '#a78bfa' }}>
                      🤖 AgreeMi AI
                    </div>
                  )}

                  <div className="msg-content">
                    {msg.isStreaming ? (
                      <div className="msg-streaming-content">
                        <span>{msg.content}</span>
                        <span className="msg-streaming-dots"><i /><i /><i /></span>
                      </div>
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    )}
                  </div>

                  {/* Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="msg-attachments">
                      {msg.attachments.map(a => (
                        a.url ? (
                          <a key={a.id} href={a.url} className="msg-attachment" target="_blank" rel="noreferrer">
                            <Paperclip size={12} />
                            <span>{a.name}</span>
                          </a>
                        ) : (
                          <div key={a.id} className="msg-attachment">
                            <Paperclip size={12} />
                            <span>{a.name}</span>
                          </div>
                        )
                      ))}
                    </div>
                  )}

                  <div className={`msg-time text-xs text-muted msg-time--${msg.status ?? 'sent'}`}>
                    {msg.status === 'sending'
                      ? 'Sending…'
                      : msg.status === 'failed'
                      ? 'Failed'
                      : formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))}

            {isCurrentChatStreaming && !hasStreamingMessage && (
              <div className="msg msg--ai">
                <div className="avatar avatar-ai msg-avatar">🤖</div>
                <div className="msg-bubble">
                  <div className="msg-author text-xs" style={{ color: '#a78bfa' }}>🤖 AgreeMi AI</div>
                  <div className="msg-typing">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="chat-input-area">
            {/* Command suggestions */}
            {suggestions.length > 0 && (
              <div className="cmd-suggestions">
                {suggestions.map(cmd => (
                  <button
                    key={cmd}
                    className="cmd-suggestion"
                    onClick={() => setInput(cmd + ' ')}
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            )}

            {/* Attachments preview */}
            {attachments.length > 0 && (
              <div className="attach-preview">
                {attachments.map(a => (
                  <div key={a.id} className="attach-chip">
                    <Paperclip size={11} />
                    <span>{a.name}</span>
                    <button onClick={() => removeAttachment(a.id)}>
                      <span className="sr-only">Remove attachment</span>
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {sendError && (
              <div className="chat-send-error">{sendError}</div>
            )}

            <div className="chat-input-row">
              <button
                className="chat-attach-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Attach file"
                aria-label="Attach file"
              >
                <Paperclip size={18} />
              </button>

              <div className="chat-input-wrap">
                <textarea
                  className="chat-input"
                  aria-label="Message"
                  placeholder={isCommand ? 'Type a command…' : 'Message… or type / for commands'}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  rows={1}
                />
              </div>

              <button
                className={`chat-send ${(!input.trim() && attachments.length === 0) || isCurrentChatStreaming ? 'disabled' : ''}`}
                onClick={handleSend}
                disabled={(!input.trim() && attachments.length === 0) || isCurrentChatStreaming}
                aria-label={isCommand ? 'Run command' : 'Send message'}
              >
                {isCurrentChatStreaming
                  ? <Loader2 size={17} className="animate-spin" />
                  : isCommand
                  ? <Zap size={17} />
                  : <Send size={17} />
                }
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              aria-label="Upload attachment"
              accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
              style={{ display: 'none' }}
              onChange={handleFile}
            />
          </div>
        </div>

        {/* AI Sidebar (Desktop) */}
        <AiAnalysisSidebar chatId={chatId!} />
      </div>

      {/* AI Analysis drawer (Mobile) */}
      <AiAnalysisDrawer
        chatId={chatId!}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
};
