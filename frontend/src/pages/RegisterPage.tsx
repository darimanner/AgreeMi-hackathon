import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, Mail, Lock, User, Loader2 } from 'lucide-react';
import { useAppStore } from '../app/store';
import type { User as UserType } from '../shared/types';
import './auth.css';

export const RegisterPage: React.FC = () => {
  const register = useAppStore(s => s.register);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserType['role']>('client');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    const res = await register(name, email, password, role);
    setLoading(false);
    if (res.success) navigate('/');
    else setError(res.error ?? 'Registration failed');
  };

  return (
    <div className="auth-page">
      <div className="auth-glow auth-glow--1" />
      <div className="auth-glow auth-glow--2" />

      <div className="auth-card animate-fade-up">
        <div className="auth-logo">
          <div className="logo-icon"><Zap size={16} /></div>
          <span className="logo-text">AgreeMi</span>
        </div>

        <div className="auth-header">
          <h1>Create account</h1>
          <p className="text-muted">Join your team workspace</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {/* Name */}
          <div className="field">
            <label className="field-label" htmlFor="register-name">Full name</label>
            <div className="field-wrap">
              <User size={15} className="field-icon" />
              <input id="register-name" className="input field-input" type="text" placeholder="Your name"
                value={name} onChange={e => setName(e.target.value)} required />
            </div>
          </div>

          {/* Email */}
          <div className="field">
            <label className="field-label" htmlFor="register-email">Email</label>
            <div className="field-wrap">
              <Mail size={15} className="field-icon" />
              <input id="register-email" className="input field-input" type="email" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
          </div>

          {/* Password */}
          <div className="field">
            <label className="field-label" htmlFor="register-password">Password</label>
            <div className="field-wrap">
              <Lock size={15} className="field-icon" />
              <input id="register-password" className="input field-input" type="password" placeholder="Min 6 characters"
                value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
          </div>

          {/* Role picker */}
          <div className="field">
            <label className="field-label">I am a…</label>
            <div className="role-picker">
              <button
                type="button"
                className={`role-btn ${role === 'client' ? 'active' : ''}`}
                onClick={() => setRole('client')}
                aria-pressed={role === 'client'}
              >
                <span className="role-emoji">👤</span>
                Client
                <span className="text-muted text-xs">I have a project</span>
              </button>
              <button
                type="button"
                className={`role-btn ${role === 'developer' ? 'active' : ''}`}
                onClick={() => setRole('developer')}
                aria-pressed={role === 'developer'}
              >
                <span className="role-emoji">⚡</span>
                Developer
                <span className="text-muted text-xs">I build things</span>
              </button>
            </div>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" className="auth-link">Sign in →</Link>
        </p>
      </div>
    </div>
  );
};
