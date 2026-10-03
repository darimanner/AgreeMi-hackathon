import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Zap, Plus, MessageSquare, Clock, ArrowRight,
  LogOut, ChevronRight, User, Settings, Link2, UserPlus,
  Bot, Terminal, Paperclip, Moon, Sun
} from 'lucide-react';
import { useAppStore } from '../app/store';
import './home.css';

function formatRelative(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getAuthorLabel(
  authorId: string,
  currentUser: { id: string; name: string } | null,
  participants: Array<{ id: string; name: string }>
): string {
  if (authorId === 'ai') return 'ReqLens AI';
  if (authorId === 'system') return 'System';
  if (currentUser && authorId === currentUser.id) return currentUser.name;
  return participants.find(user => user.id === authorId)?.name ?? (authorId.length > 8 ? authorId.slice(0, 8) : authorId);
}

export const HomePage: React.FC = () => {
  const currentUser    = useAppStore(s => s.currentUser);
  const isAuthenticated = useAppStore(s => s.isAuthenticated);
  const chatRooms      = useAppStore(s => s.chatRooms);
  const createChat     = useAppStore(s => s.createChat);
  const setActiveChat  = useAppStore(s => s.setActiveChat);
  const logout         = useAppStore(s => s.logout);
  const theme          = useAppStore(s => s.theme);
  const toggleTheme    = useAppStore(s => s.toggleTheme);

  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [joinLink, setJoinLink] = useState('');
  const [joinError, setJoinError] = useState('');
  const [showJoin, setShowJoin] = useState(false);

  const joinChat = useAppStore(s => s.joinChat);

  const handleOpenChat = (chatId: string) => {
    setActiveChat(chatId);
    navigate(`/chat/${chatId}`);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    const chat = await createChat(newTitle.trim());
    setCreating(false);
    setShowNew(false);
    setNewTitle('');
    navigate(`/chat/${chat.id}`);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    // Accept full URL or just the path or just chatId
    const raw = joinLink.trim();
    // Extract chatId from patterns like /join/chat-1 or https://…/join/chat-1 or just chat-1
    const match = raw.match(/(?:join\/)?([\w-]+)\s*$/);
    const chatId = match?.[1] ?? raw;
    if (!chatId) { setJoinError('Paste a valid invite link'); return; }
    const res = await joinChat(chatId);
    if (res.success) {
      navigate(`/chat/${res.chatId ?? chatId}`);
    } else {
      setJoinError(res.error ?? 'Could not join chat');
    }
  };

  // ── Unauthenticated landing ────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="landing">
        <div className="landing-glow landing-glow--1" />
        <div className="landing-glow landing-glow--2" />

        {/* Nav */}
        <nav className="landing-nav glass">
          <div className="logo">
            <div className="logo-icon"><Zap size={14} /></div>
            <span className="logo-text">ReqLens</span>
          </div>
          <div className="landing-nav-actions">
            <button className="btn btn-ghost theme-toggle" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <Link to="/login" className="btn btn-ghost">Sign in</Link>
            <Link to="/register" className="btn btn-primary">Get started</Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="landing-hero">
          <div className="landing-badge badge badge-lime animate-fade-in">
            <Zap size={10} />
            AI-powered project communication
          </div>
          <h1 className="landing-title animate-fade-up">
            Where clients &amp; devs<br />
            <span className="landing-title-accent">build together</span>
          </h1>
          <p className="landing-desc animate-fade-up" style={{ animationDelay: '80ms' }}>
            A smart workspace where clients and developers communicate, share specs,
            and let AI catch the ambiguities before they become problems.
          </p>
          <div className="landing-cta animate-fade-up" style={{ animationDelay: '160ms' }}>
            <Link to="/register" className="btn btn-primary landing-cta-primary">
              Start for free
              <ArrowRight size={16} />
            </Link>
            <Link to="/login" className="btn btn-ghost landing-cta-secondary">
              Sign in
            </Link>
          </div>

          {/* Join existing */}
          <div className="landing-join animate-fade-up" style={{ animationDelay: '240ms' }}>
            <p className="text-sm text-muted">Got an invite link?</p>
            <Link to="/login" className="landing-join-link">
              <Link2 size={13} />
              Join existing workspace
            </Link>
          </div>
        </section>

        {/* Feature cards */}
        <section className="landing-features">
          {[
            { icon: MessageSquare, title: 'Real-time chat', desc: 'Dedicated workspace per project. Client and dev in one thread.' },
            { icon: Bot, title: 'AI sidebar', desc: 'Attach a spec, AI instantly flags ambiguous requirements with suggestions.' },
            { icon: Terminal, title: 'Slash commands', desc: 'Type /update to get a live project status summary, generated by AI.' },
            { icon: Paperclip, title: 'File analysis', desc: 'Drop any PDF or doc — AI reads it and posts insights directly in chat.' },
          ].map(f => (
            <div key={f.title} className="feature-card glass animate-fade-up">
              <div className="feature-icon"><f.icon size={20} /></div>
              <h3>{f.title}</h3>
              <p className="text-muted text-sm">{f.desc}</p>
            </div>
          ))}
        </section>
      </div>
    );
  }

  // ── Authenticated dashboard ────────────────────────────────────────────────
  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="dash-sidebar glass">
        <div className="dash-logo">
          <div className="logo">
            <div className="logo-icon"><Zap size={14} /></div>
            <span className="logo-text">ReqLens</span>
          </div>
        </div>

        {/* User card */}
        <div className="dash-user">
          <div className={`avatar avatar-${currentUser!.role}`}>
            {currentUser!.name.charAt(0).toUpperCase()}
          </div>
          <div className="dash-user-info">
            <div className="dash-user-name">{currentUser!.name}</div>
            <div className={`badge ${currentUser!.role === 'client' ? 'badge-blue' : 'badge-lime'}`}>
              {currentUser!.role}
            </div>
          </div>
        </div>

        <nav className="dash-nav">
          <button className="dash-nav-item active">
            <MessageSquare size={16} />
            Chats
          </button>
          <button className="dash-nav-item">
            <User size={16} />
            Profile
          </button>
          <button className="dash-nav-item">
            <Settings size={16} />
            Settings
          </button>
        </nav>

        <button className="dash-theme btn btn-ghost" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          {theme === 'dark' ? 'Light theme' : 'Dark theme'}
        </button>

        <button className="dash-logout btn btn-danger" onClick={logout}>
          <LogOut size={15} />
          Sign out
        </button>
      </aside>

      {/* Main content */}
      <main className="dash-main">
        <div className="dash-header">
          <div>
            <h2>Your Chats</h2>
            <p className="text-muted text-sm">
              {chatRooms.length} active workspace{chatRooms.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowNew(v => !v)}>
            <Plus size={16} />
            New chat
          </button>
        </div>

        {/* New chat form */}
        {showNew && (
          <form className="new-chat-form glass animate-fade-up" onSubmit={handleCreate}>
            <input
              className="input"
              placeholder="Project name (e.g. E-Commerce MVP)"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn btn-primary" disabled={creating || !newTitle.trim()}>
              <Plus size={14} />
              Create
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowNew(false)}>
              Cancel
            </button>
          </form>
        )}

        {/* Chat list */}
        <div className="chat-list">
          {chatRooms.length === 0 && (
            <div className="chat-list-empty">
              <MessageSquare size={40} />
              <p>No chats yet</p>
              <p className="text-muted text-sm">Create one to get started</p>
            </div>
          )}
          {chatRooms.map(room => {
            const last = room.messages[room.messages.length - 1];
            const lastAuthor = last ? getAuthorLabel(last.authorId, currentUser, room.participants) : '';
            return (
              <button
                key={room.id}
                className="chat-item glass animate-fade-up"
                onClick={() => handleOpenChat(room.id)}
              >
                <div className="chat-item-icon">
                  <MessageSquare size={18} />
                </div>
                <div className="chat-item-body">
                  <div className="chat-item-top">
                    <span className="chat-item-title">{room.title}</span>
                    <span className="chat-item-time text-xs text-muted">
                      <Clock size={11} />
                      {formatRelative(room.lastMessageAt)}
                    </span>
                  </div>
                  <div className="chat-item-preview text-sm text-muted">
                    {last
                      ? `${lastAuthor}: ${last.content.slice(0, 70)}${last.content.length > 70 ? '…' : ''}`
                      : 'No messages yet'}
                  </div>
                  <div className="chat-item-meta">
                    <span className="badge badge-purple text-xs">
                      {room.messages.length} messages
                    </span>
                    {room.aiAnalysis && (
                      <span className="badge badge-lime text-xs">
                        <Zap size={9} />
                        AI analyzed
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="chat-item-arrow text-muted" />
              </button>
            );
          })}
        </div>
        {/* Join existing chat */}
        <div className="join-section glass">
          <div className="join-section-header">
            <UserPlus size={16} style={{ color: 'var(--lime-400)' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Join existing workspace</div>
              <div className="text-xs text-muted">Paste an invite link from a colleague</div>
            </div>
            <button className="btn btn-ghost join-toggle" onClick={() => setShowJoin(v => !v)}>
              {showJoin ? 'Cancel' : 'Paste link'}
            </button>
          </div>

          {showJoin && (
            <form className="join-form" onSubmit={handleJoin}>
              <input
                className="input"
                placeholder="https://reqlens.app/join/chat-1 or just the code"
                value={joinLink}
                onChange={e => { setJoinLink(e.target.value); setJoinError(''); }}
                autoFocus
              />
              <button type="submit" className="btn btn-primary" disabled={!joinLink.trim()}>
                <Link2 size={14} />
                Join
              </button>
              {joinError && (
                <div className="join-error">{joinError}</div>
              )}
            </form>
          )}
        </div>
      </main>
    </div>
  );
};
