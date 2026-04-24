import { useAppStore } from './app/store';
import { UploadFeature } from './features/upload/UploadFeature';
import { AnalyzingScreen } from './features/analyzer/AnalyzingScreen';
import { ReviewPage } from './pages/ReviewPage';
import { KanbanBoard } from './features/roadmap/KanbanBoard';
import './App.css';

function App() {
  const appState = useAppStore(s => s.appState);

  return (
    <div id="app-root">
      {appState === 'upload' && <UploadFeature />}
      {appState === 'analyzing' && <AnalyzingScreen />}
      {appState === 'review' && <ReviewPage />}
      {appState === 'roadmap' && <KanbanBoard />}
    </div>
  );
}

export default App;
