import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'temporal-polyfill/global'
import '@schedule-x/theme-default/dist/index.css'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
