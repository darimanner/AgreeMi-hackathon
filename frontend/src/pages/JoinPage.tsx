import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Zap, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useAppStore } from '../app/store';
import './auth.css';

export const JoinPage: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAppStore(s => s.isAuthenticated);
  const joinChat = useAppStore(s => s.joinChat);
  const chatRooms = useAppStore(s => s.chatRooms);

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const room = chatRooms.find(r => r.id === chatId);

  useEffect(() => {
    if (!isAuthenticated) {
      // Redirect to login, come back after
      navigate(`/login?redirect=/join/${chatId}`, { replace: true });
      return;
    }

    if (!chatId) return;

    queueMicrotask(() => {
      const res = joinChat(chatId);
      if (res.success) {
        setStatus('success');
        // Auto-redirect after short delay so user sees confirmation
        setTimeout(() => navigate(`/chat/${chatId}`, { replace: true }), 1500);
      } else {
        setStatus('error');
        setErrorMsg(res.error ?? 'Could not join chat.');
      }
    });
  }, [chatId, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!chatId) {
    return (
      <div className="auth-page">
        <div className="auth-glow auth-glow--1" />
        <div className="auth-glow auth-glow--2" />
        <div className="auth-card auth-card--center animate-fade-up">
          <div className="auth-logo auth-logo--center">
            <div className="logo-icon"><Zap size={16} /></div>
            <span className="logo-text">ReqLens</span>
          </div>
          <XCircle size={40} className="auth-status-icon auth-status-icon--error" />
          <h2>Couldn't join</h2>
          <p className="text-muted auth-status-copy">Invalid invite link.</p>
          <Link to="/" className="btn btn-primary auth-status-action">
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-glow auth-glow--1" />
      <div className="auth-glow auth-glow--2" />

      <div className="auth-card auth-card--center animate-fade-up">
        <div className="auth-logo auth-logo--center">
          <div className="logo-icon"><Zap size={16} /></div>
          <span className="logo-text">ReqLens</span>
        </div>

        {status === 'loading' && (
          <>
            <Loader2 size={40} className="animate-spin auth-status-icon auth-status-icon--success" />
            <h2>Joining workspace…</h2>
            <p className="text-muted auth-status-copy">Just a moment</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle size={40} className="auth-status-icon auth-status-icon--success" />
            <h2>You're in! 🎉</h2>
            <p className="text-muted auth-status-copy">
              Joined <strong style={{ color: 'var(--text-100)' }}>{room?.title}</strong>
              <br />Redirecting you to the chat…
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={40} className="auth-status-icon auth-status-icon--error" />
            <h2>Couldn't join</h2>
            <p className="text-muted auth-status-copy auth-status-copy--spaced">{errorMsg}</p>
            <Link to="/" className="btn btn-primary auth-status-action">
              Go to dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
};
