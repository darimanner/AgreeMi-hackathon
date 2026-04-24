import React from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../app/store';
import './analyzing.css';

const STEPS = [
  { id: 1, label: 'Парсинг документа',       detail: 'Извлечение текста и структуры' },
  { id: 2, label: 'Семантический анализ',     detail: 'NLP-разбор требований' },
  { id: 3, label: 'Агент: Completeness',      detail: 'Проверка полноты ТЗ' },
  { id: 4, label: 'Агент: Consistency',       detail: 'Поиск противоречий' },
  { id: 5, label: 'Агент: Measurability',     detail: 'Верификация метрик' },
  { id: 6, label: 'Генерация отчёта',         detail: 'Формирование аннотаций' },
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

        <h2 className="analyzing-title">Анализируем документ</h2>
        <p className="analyzing-subtitle">ИИ-агенты проверяют требования...</p>

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
