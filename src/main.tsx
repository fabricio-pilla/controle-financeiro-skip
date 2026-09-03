/* Main entry point for the application - renders the root React component */
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './main.css'
import { runTests } from './lib/nlp-parser.test'

// Self-verify NLP parser in dev / test environments
if (import.meta.env.DEV) {
  const result = runTests()
  if (result.failed > 0) {
    console.error('[NLP Parser Tests Failed]', result.errors)
  } else {
    console.log(`[NLP Parser Tests Passed]: ${result.passed} assertions passed`)
  }
}

// @skip-protected: Do not remove. Required for React rendering.
createRoot(document.getElementById('root')!).render(<App />)
