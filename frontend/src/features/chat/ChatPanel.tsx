import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Zap, MessageSquare } from 'lucide-react';
import { useAppStore } from '../../app/store';
import './chat.css';

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

export const ChatPanel: React.FC = () => {
  const chatMessages = useAppStore(s => s.chatMessages);
  const isStreaming = useAppStore(s => s.isStreaming);
  const selectedIssue = useAppStore(s => s.selectedIssue);
  const sendMessage = useAppStore(s => s.sendMessage);
  const generateRoadmap = useAppStore(s => s.generateRoadmap);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    sendMessage(text);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-panel animate-slide-right">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-avatar chat-avatar--ai">
            <Bot size={16} />
          </div>
          <div>
            <div className="chat-header-name">ReqLens AI</div>
            <div className="chat-header-status">
              <span className="chat-status-dot" />
              Онлайн · GPT-4o + анализатор ТЗ
            </div>
          </div>
        </div>
        <div className="chat-header-badge">
          <MessageSquare size={12} />
          {chatMessages.length}
        </div>
      </div>

      {/* Active issue pill */}
      {selectedIssue && (
        <div className="chat-issue-pill">
          <span className={`issue-pill-dot ${selectedIssue.level}`} />
          <span className="issue-pill-text">
            Анализ: <strong>«{selectedIssue.text.slice(0, 40)}{selectedIssue.text.length > 40 ? '…' : ''}»</strong>
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {chatMessages.map((msg) => (
          <div key={msg.id} className={`chat-message chat-message--${msg.role}`}>
            <div className={`chat-avatar ${msg.role === 'assistant' ? 'chat-avatar--ai' : 'chat-avatar--user'}`}>
              {msg.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
            </div>
            <div className="chat-bubble">
              <div
                className="chat-bubble-content"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
              />
              <div className="chat-bubble-time">
                {msg.timestamp.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="chat-message chat-message--assistant">
            <div className="chat-avatar chat-avatar--ai">
              <Bot size={14} />
            </div>
            <div className="chat-bubble">
              <div className="chat-typing">
                <span className="chat-typing-dot" />
                <span className="chat-typing-dot" />
                <span className="chat-typing-dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      <div className="chat-suggestions">
        {['Какие риски у этого ТЗ?', 'Как улучшить требование №3?', 'Дай общую оценку'].map(s => (
          <button key={s} className="chat-suggestion" onClick={() => sendMessage(s)}>
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <div className="chat-input-wrap">
          <textarea
            className="chat-input"
            placeholder="Задайте вопрос по ТЗ..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
          />
          <button
            className={`chat-send-btn ${isStreaming || !input.trim() ? 'disabled' : ''}`}
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
          >
            {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>

        {/* Roadmap button */}
        <button className="btn btn-primary chat-roadmap-btn" onClick={generateRoadmap}>
          <Zap size={16} />
          Сгенерировать Roadmap
        </button>
      </div>
    </div>
  );
};
