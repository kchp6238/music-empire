import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Fade out the launch splash once the app has painted its first frame.
requestAnimationFrame(() => {
  const splash = document.getElementById('app-splash')
  if (!splash) return
  setTimeout(() => {
    splash.classList.add('hide')
    setTimeout(() => splash.remove(), 500)
  }, 250)
})
