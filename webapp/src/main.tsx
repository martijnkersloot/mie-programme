import 'temporal-polyfill/global'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// schedule-x theme imported after Tailwind so its styles win
import '@schedule-x/theme-default/dist/index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
