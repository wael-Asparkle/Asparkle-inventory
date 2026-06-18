import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

const SAUDI_RIYAL_SYMBOL = '\u20C1'

function applySaudiRiyalSymbol(root = document.body) {
  if (!root) return

  const container = root.nodeType === Node.ELEMENT_NODE ? root : document.body

  container.querySelectorAll?.('svg.lucide-dollar-sign').forEach((svg) => {
    const symbol = document.createElement('span')
    symbol.className = `${svg.getAttribute('class') || ''} font-black leading-none text-lg`
    symbol.setAttribute('aria-label', 'رمز الريال السعودي')
    symbol.textContent = SAUDI_RIYAL_SYMBOL
    svg.replaceWith(symbol)
  })

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)

  nodes.forEach((node) => {
    const nextValue = node.nodeValue.replace(/([٠-٩0-9][٠-٩0-9٬,.]*)\s*ر(?![\u0600-\u06FF])/g, `${SAUDI_RIYAL_SYMBOL} $1`)
    if (nextValue !== node.nodeValue) node.nodeValue = nextValue
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

requestAnimationFrame(() => applySaudiRiyalSymbol())

new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        applySaudiRiyalSymbol(node)
      }
    })
  })
}).observe(document.body, { childList: true, subtree: true })
