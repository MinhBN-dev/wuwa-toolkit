import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import HomePage from './pages/Home'
import SavedPage from './pages/Saved'
import SetPage from './pages/Set'
import CharactersPage from './pages/Characters'
import ConvenePage from './pages/Convene'
import EvcBanner from './components/EvcBanner'
import Logo from './components/Logo'

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `relative font-display uppercase tracking-[0.18em] text-sm px-4 py-2 transition-all duration-200
         ${
           isActive
             ? 'text-ww-cyan text-glow-cyan'
             : 'text-ww-muted hover:text-ww-text'
         }`
      }
    >
      {({ isActive }) => (
        <>
          <span>{children}</span>
          {isActive && (
            <span className="absolute -bottom-px left-1/2 -translate-x-1/2 w-8 h-px bg-ww-cyan shadow-glow-cyan" />
          )}
        </>
      )}
    </NavLink>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col above-stars">
        {/* Header */}
        <header className="sticky top-0 z-50 backdrop-blur-md bg-ww-bg-deep/70 border-b border-ww-border">
          {/* gradient hairline */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ww-cyan/40 to-transparent" />

          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
            <NavLink to="/" className="flex items-center gap-3 group">
              <Logo size={36} className="transition-transform group-hover:scale-110" />
              <div className="flex flex-col leading-none">
                <span className="font-display font-bold uppercase tracking-[0.25em] text-base text-ww-text">
                  Echoes
                </span>
                <span className="font-display uppercase tracking-[0.4em] text-[10px] text-ww-cyan/80 mt-0.5">
                  Optimizer
                </span>
              </div>
            </NavLink>

            <nav className="flex gap-1 ml-auto">
              <NavItem to="/">Analyze</NavItem>
              <NavItem to="/set">Full Set</NavItem>
              <NavItem to="/saved">Library</NavItem>
              <NavItem to="/characters">Resonators</NavItem>
              <NavItem to="/convene">Convene</NavItem>
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
            <Route path="/convene" element={<ConvenePage />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="relative border-t border-ww-border py-3 text-center text-[11px] uppercase tracking-[0.25em] text-ww-muted/70 font-display">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ww-cyan/30 to-transparent" />
          Echoes Optimizer · EVC 3.2 Scoring · Wuthering Waves
        </footer>
      </div>
    </BrowserRouter>
  )
}
