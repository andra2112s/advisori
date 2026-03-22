import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api } from './api'

const AuthCtx = createContext()

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [soul, setSoul]       = useState(null)
  const [loading, setLoading] = useState(true)

  const syncUser = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get('/auth/me')
      setUser(data.user)
      setSoul(data.soul || null)
    } catch (error) {
      console.error('Failed to sync user:', error)
      localStorage.removeItem('advisori_token')
      localStorage.removeItem('advisori_user')
      setUser(null)
      setSoul(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    console.log('🔐 Auth initialization...');
    
    const token = localStorage.getItem('advisori_token')
    console.log('   Token:', token ? `EXISTS (${token.length} chars)` : 'NOT FOUND');
    
    if (!token) { 
      console.log('❌ No token available');
      setLoading(false); 
      return 
    }
    syncUser()
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
    localStorage.removeItem('advisori_token')
    localStorage.removeItem('advisori_user')
    setUser(null)
    setSoul(null)
    window.location.href = '/'
  }

  const refreshSoul = async () => {
    try {
      const data = await api.get('/soul')
      setSoul(data)
      return data
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
