import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/rtl.css' // RTL layout overrides for Arabic / Hebrew (scoped under .rtl)
import './i18n' // initialize i18next (lazy-loads the active locale)
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
