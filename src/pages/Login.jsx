import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'
import { Btn, Input, Spinner, Divider } from '../components/ui'

export default function Login() {
  const navigate = useNavigate()
  const { user, soul, login, register, loading: authLoading } = useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  })

  useEffect(() => {
    if (!authLoading && user) {
      navigate(soul?.is_setup ? '/channels' : '/soul-setup')
    }
  }, [user, soul, authLoading, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isRegister) {
        await register(form.name, form.email, form.password)
      } else {
        await login(form.email, form.password)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      })
      if (error) throw error
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 20
    }}>
      <div style={{
        width: '100%', maxWidth: 400, background: 'var(--surface)',
        padding: 40, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 8 }}>
            Advisori<span style={{ color: 'var(--gold)' }}>.</span>
          </div>
          <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>
            {isRegister ? 'Buat akun untuk mulai' : 'Masuk ke akun kamu'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <Input
              label="Nama Lengkap"
              placeholder="Budi Santoso"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
            />
          )}
          <Input
            label="Email"
            type="email"
            placeholder="nama@email.com"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            required
            hint={isRegister ? 'Minimal 8 karakter' : ''}
          />

          {error && (
            <div style={{
              padding: '10px 14px', background: 'var(--danger-bg)',
              color: 'var(--danger)', borderRadius: 'var(--radius)',
              fontSize: 13, marginBottom: 20, border: '1px solid var(--danger)'
            }}>
              {error}
            </div>
          )}

          <Btn type="submit" loading={loading} style={{ width: '100%' }}>
            {isRegister ? 'Daftar Sekarang' : 'Masuk →'}
          </Btn>

          <Divider style={{ margin: '24px 0' }} />

          <Btn 
            onClick={handleGoogleLogin} 
            variant="ghost" 
            style={{ width: '100%', gap: 10 }}
            disabled={loading}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {isRegister ? 'Daftar dengan Google' : 'Masuk dengan Google'}
          </Btn>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--ink-3)' }}>
          {isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'}
          <button
            onClick={() => setIsRegister(!isRegister)}
            style={{
              background: 'none', border: 'none', color: 'var(--gold-text)',
              marginLeft: 6, cursor: 'pointer', fontWeight: 500
            }}
          >
            {isRegister ? 'Masuk di sini' : 'Daftar gratis'}
          </button>
        </div>
      </div>
    </div>
  )
}
