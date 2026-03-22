import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { api } from './api'
import { supabase } from './supabase'

const AuthCtx = createContext()

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [soul, setSoul]       = useState(null)
  const [loading, setLoading] = useState(true)
  const oauthRef = useRef(false)
  const initRef = useRef(false)

  const syncUser = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get('/auth/me')
      setUser(data.user)
      setSoul(data.soul || null)
    } catch (error) {
      console.error('Failed to sync user:', error)
      setUser(null)
      setSoul(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    
    console.log('🔐 Auth initialization...');
    
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session && !oauthRef.current) {
        oauthRef.current = true
        console.log('✅ Supabase session found');
        try {
          localStorage.removeItem('advisori_token')
          localStorage.removeItem('advisori_user')
          
          const data = await api.post('/auth/oauth-callback', {
            provider: 'google',
            provider_token: session.provider_token,
            user: session.user
          })
          console.log('💾 Saved token length:', data.token?.length)
          localStorage.setItem('advisori_token', data.token)
          localStorage.setItem('advisori_user', JSON.stringify(data.user))
          await syncUser()
        } catch (err) {
          console.error('OAuth callback error:', err)
          oauthRef.current = false
          setLoading(false)
        }
        return
      }
      
      const token = localStorage.getItem('advisori_token')
      console.log('   Token:', token ? `EXISTS (${token.length} chars)` : 'NOT FOUND');
      
      if (!token) { 
        console.log('❌ No token available');
        setLoading(false); 
        return 
      }
      syncUser()
    })

    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('advisori_token')
        localStorage.removeItem('advisori_user')
        setUser(null)
        setSoul(null)
        oauthRef.current = false
        initRef.current = false
      }
    })
  }, [syncUser])

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

  const logout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('advisori_token')
    localStorage.removeItem('advisori_user')
    setUser(null)
    setSoul(null)
    oauthRef.current = false
    initRef.current = false
    window.location.href = '/'
  }

  const refreshSoul = async () => {
    try {
      const data = await api.get('/soul')
      setSoul(data.soul)
      return data.soul
    } catch (error) {
      console.error('Failed to refresh soul:', error)
      setSoul(null)
      return null
    }
  }

  return (
    <AuthCtx.Provider value={{ user, soul, setSoul, loading, login, register, logout, refreshSoul }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
