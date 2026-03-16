import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'
import { supabase } from './supabase'

const AuthCtx = createContext()

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [soul, setSoul]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Check current session from Supabase (for OAuth)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Handle OAuth session
        const { user: sbUser } = session
        // Map Supabase user to our system
        // Note: You might need a platform-login style endpoint to sync OAuth users
        localStorage.setItem('advisori_token', session.access_token)
        syncUser()
      } else {
        // 2. Check legacy token
        const token = localStorage.getItem('advisori_token')
        if (!token) { setLoading(false); return }
        syncUser()
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        localStorage.setItem('advisori_token', session.access_token)
        syncUser()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const syncUser = () => {
    setLoading(true)
    api.me()
      .then(data => {
        if (data && data.user) {
          setUser(data.user)
          setSoul(data.soul)
        } else {
          setUser(null)
          setSoul(null)
        }
      })
      .catch(() => {
        localStorage.removeItem('advisori_token')
        localStorage.removeItem('advisori_user')
        setUser(null)
        setSoul(null)
      })
      .finally(() => setLoading(false))
  }

  const login = async (email, password) => {
    const data = await api.login({ email, password })
    localStorage.setItem('advisori_token', data.token)
    localStorage.setItem('advisori_user', JSON.stringify(data.user))
    setUser(data.user)
    return data
  }

  const register = async (name, email, password) => {
    const data = await api.register({ name, email, password })
    localStorage.setItem('advisori_token', data.token)
    localStorage.setItem('advisori_user', JSON.stringify(data.user))
    setUser(data.user)
    return data
  }

  const logout = () => {
    localStorage.removeItem('advisori_token')
    localStorage.removeItem('advisori_user')
    setUser(null)
    setSoul(null)
    window.location.href = '/'
  }

  const refreshSoul = async () => {
    const data = await api.me()
    setSoul(data.soul)
    return data.soul
  }

  return (
    <AuthCtx.Provider value={{ user, soul, setSoul, loading, login, register, logout, refreshSoul }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
