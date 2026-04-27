import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { unregisterStaleServiceWorkers } from './shared/pwa/cleanup.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

const runAfterFirstPaint = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => {
  window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 1)
})

runAfterFirstPaint(() => {
  void unregisterStaleServiceWorkers()
})
