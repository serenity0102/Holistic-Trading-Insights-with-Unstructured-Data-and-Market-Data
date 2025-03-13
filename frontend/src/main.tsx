import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyMode, Mode } from '@cloudscape-design/global-styles'
import './index.css'
import App from './App.tsx'

// Apply the light theme by default
applyMode(Mode.Light)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
