import React, { useCallback, useState } from 'react';
import { Upload, FileText, Zap, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../app/store';
import './upload.css';

export const UploadFeature: React.FC = () => {
  const uploadDocument = useAppStore(s => s.uploadDocument);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    uploadDocument(file);
  }, [uploadDocument]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDemo = () => {
    const mockFile = new File(['mock'], 'example-spec.pdf', { type: 'application/pdf' });
    handleFile(mockFile);
  };

  return (
    <div className="upload-page animate-fade-in">
      {/* Hero header */}
      <div className="upload-hero">
        <div className="upload-logo">
          <div className="upload-logo-icon">
            <Zap size={28} />
          </div>
          <span className="upload-logo-text">ReqLens</span>
        </div>

        <div className="upload-tagline">
          <div className="upload-badge">
            <span className="upload-badge-dot" />
            AI Requirements Analysis
          </div>
          <h1 className="upload-title">
            Find weak spots in your<br />
            <span className="upload-title-accent">spec in seconds</span>
          </h1>
          <p className="upload-subtitle">
            Upload a technical specification — AI agents will analyse every requirement,
            surface risks and generate a full project roadmap.
          </p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`upload-dropzone ${isDragging ? 'is-dragging' : ''}`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".pdf,.docx,.doc,.txt"
          style={{ display: 'none' }}
          onChange={handleChange}
        />
        <div className="upload-dropzone-inner">
          <div className="upload-dropzone-icon">
            <Upload size={32} />
          </div>
          <div>
            <p className="upload-dropzone-title">Drop your file here or click to browse</p>
            <p className="upload-dropzone-subtitle">PDF, DOCX, DOC, TXT · up to 50 MB</p>
          </div>
        </div>

        <div className="upload-formats">
          {['PDF', 'DOCX', 'TXT'].map(fmt => (
            <span key={fmt} className="upload-format-tag">
              <FileText size={12} />
              {fmt}
            </span>
          ))}
        </div>
      </div>

      {/* Demo button */}
      <div className="upload-demo">
        <button className="btn btn-ghost" onClick={handleDemo} style={{ margin: '0 auto', display: 'flex' }}>
          <Zap size={16} />
          Try demo — run with a sample spec
        </button>
      </div>

      {/* Features */}
      <div className="upload-features">
        {[
          { icon: '🔍', title: 'Semantic Analysis', desc: 'Agents check every requirement for measurability, unambiguity and feasibility.' },
          { icon: '🎯', title: 'Inline Annotations', desc: 'Problem areas are highlighted directly in the text — click for an AI explanation.' },
          { icon: '🗺️', title: 'Roadmap Generation', desc: 'Automatically creates a Kanban board with estimates and task priorities.' },
        ].map(f => (
          <div key={f.title} className="upload-feature-card glass glass-hover">
            <span className="upload-feature-icon">{f.icon}</span>
            <h3 className="upload-feature-title">{f.title}</h3>
            <p className="upload-feature-desc">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="upload-disclaimer">
        <AlertTriangle size={14} />
        <span>Mock version · no data is sent to a server · everything runs locally</span>
      </div>
    </div>
  );
};
