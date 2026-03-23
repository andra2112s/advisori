import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './lib/theme'
import { AuthProvider, useAuth } from './lib/auth'
import Landing from './pages/Landing'
import Login from './pages/Login'
import SoulSetup from './pages/SoulSetup'
import Chat from './pages/Chat'
import Channels from './pages/Channels'
import Notes from './pages/Notes'
import { Spinner } from './components/ui'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={28} />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

function SoulRoute({ children }) {
  const { user, soul, loading } = useAuth()
  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={28} />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (!soul?.is_setup) return <Navigate to="/soul-setup" replace />
  return children
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/"           element={<Landing />} />
            <Route path="/login"      element={<Login />} />
            <Route path="/soul-setup" element={<PrivateRoute><SoulSetup /></PrivateRoute>} />
            <Route path="/chat"       element={<SoulRoute><Chat /></SoulRoute>} />
            <Route path="/channels"   element={<SoulRoute><Channels /></SoulRoute>} />
            <Route path="/notes"      element={<SoulRoute><Notes /></SoulRoute>} />
            <Route path="*"           element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
