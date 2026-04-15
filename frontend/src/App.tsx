import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Zap } from 'lucide-react'
import HomePage from './pages/Home'
import SavedPage from './pages/Saved'
import SetPage from './pages/Set'
import CharactersPage from './pages/Characters'
import EvcBanner from './components/EvcBanner'

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-ww-accent text-black'
            : 'text-ww-muted hover:text-ww-text hover:bg-ww-border'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="bg-ww-surface border-b border-ww-border sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Zap className="w-6 h-6 text-ww-accent" />
              <span className="font-bold text-lg text-ww-text">Echoes Optimizer</span>
              <span className="text-xs text-ww-muted bg-ww-border px-2 py-0.5 rounded-full">WW</span>
            </div>
            <nav className="flex gap-1">
              <NavItem to="/">Analyze</NavItem>
              <NavItem to="/set">Full Set</NavItem>
              <NavItem to="/saved">Saved Echoes</NavItem>
              <NavItem to="/characters">Characters</NavItem>
            </nav>
          </div>
        </header>

        <EvcBanner />

        {/* Content */}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/set" element={<SetPage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="/characters" element={<CharactersPage />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="border-t border-ww-border py-3 text-center text-xs text-ww-muted">
          Echoes Optimizer — Wuthering Waves · Scoring algorithm based on community data
        </footer>
      </div>
    </BrowserRouter>
  )
}
