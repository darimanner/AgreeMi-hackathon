import React from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../app/store';
import './analyzing.css';

const STEPS = [
  { id: 1, label: 'Document parsing',      detail: 'Extracting text and structure' },
  { id: 2, label: 'Semantic analysis',     detail: 'NLP breakdown of requirements' },
  { id: 3, label: 'Agent: Completeness',   detail: 'Checking spec coverage' },
  { id: 4, label: 'Agent: Consistency',    detail: 'Detecting contradictions' },
  { id: 5, label: 'Agent: Measurability',  detail: 'Verifying metrics & KPIs' },
  { id: 6, label: 'Report generation',     detail: 'Building inline annotations' },
];

export const AnalyzingScreen: React.FC = () => {
  const progress = useAppStore(s => s.uploadProgress);
  const activeStep = Math.floor((progress / 100) * STEPS.length);

  return (
    <div className="analyzing-page animate-fade-in">
      <div className="analyzing-card glass">
        <div className="analyzing-icon">
          <div className="analyzing-ring" />
          <div className="analyzing-ring analyzing-ring--2" />
          <Loader2 size={28} className="analyzing-spinner" />
        </div>

        <h2 className="analyzing-title">Analysing document</h2>
        <p className="analyzing-subtitle">AI agents are reviewing your requirements…</p>

        {/* Progress bar */}
        <div className="analyzing-progress-track">
          <div className="analyzing-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="analyzing-percent">{progress}%</span>

        {/* Steps */}
        <div className="analyzing-steps">
          {STEPS.map((step, idx) => {
            const done = idx < activeStep;
            const active = idx === activeStep;
            return (
              <div key={step.id} className={`analyzing-step ${done ? 'done' : active ? 'active' : 'pending'}`}>
                <div className="analyzing-step-icon">
                  {done
                    ? <CheckCircle2 size={14} />
                    : active
                    ? <Loader2 size={14} className="analyzing-spinner" />
                    : <span className="analyzing-step-num">{step.id}</span>}
                </div>
                <div className="analyzing-step-info">
                  <span className="analyzing-step-label">{step.label}</span>
                  <span className="analyzing-step-detail">{step.detail}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
