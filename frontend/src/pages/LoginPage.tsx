import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '../app/store';
import './auth.css';

export const LoginPage: React.FC = () => {
  const login = useAppStore(s => s.login);
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.success) {
      navigate('/');
    } else {
      setError(res.error ?? 'Login failed');
    }
  };

  return (
    <div className="auth-page">
      {/* Background glow */}
      <div className="auth-glow auth-glow--1" />
      <div className="auth-glow auth-glow--2" />

      <div className="auth-card animate-fade-up">
        {/* Logo */}
        <div className="auth-logo">
          <div className="logo-icon"><Zap size={16} /></div>
          <span className="logo-text">AgreeMi</span>
        </div>

        <div className="auth-header">
          <h1>Welcome back</h1>
          <p className="text-muted">Sign in to your workspace</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="login-email">Email</label>
            <div className="field-wrap">
              <Mail size={15} className="field-icon" />
              <input
                id="login-email"
                className="input field-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="login-password">Password</label>
            <div className="field-wrap">
              <Lock size={15} className="field-icon" />
              <input
                id="login-password"
                className="input field-input"
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="field-eye"
                onClick={() => setShowPass(v => !v)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account?{' '}
          <Link to="/register" className="auth-link">Create one →</Link>
        </p>
      </div>
    </div>
  );
};
