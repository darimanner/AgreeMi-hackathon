import { lazy, Suspense } from 'react';
import { useAppStore } from './app/store';
import './App.css';

// Each screen is a separate page — clean feature-sliced separation
const UploadPage   = lazy(() => import('./pages/UploadPage'));
const AnalyzingPage = lazy(() => import('./pages/AnalyzingPage'));
const ReviewPage   = lazy(() => import('./pages/ReviewPage').then(m => ({ default: m.ReviewPage })));
const RoadmapPage  = lazy(() => import('./pages/RoadmapPage'));

function App() {
  const appState = useAppStore(s => s.appState);

  return (
    <div id="app-root">
      <Suspense fallback={null}>
        {appState === 'upload'    && <UploadPage />}
        {appState === 'analyzing' && <AnalyzingPage />}
        {appState === 'review'    && <ReviewPage />}
        {appState === 'roadmap'   && <RoadmapPage />}
     </Suspense>
    </div>
  );
}

export default App;
