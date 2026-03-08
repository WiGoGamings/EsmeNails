import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// import './index.css' // Eliminado, ahora todo está en App.css
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
