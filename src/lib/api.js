const BASE = '/api'  // Vite proxy ke localhost:4000

function getToken() {
  return localStorage.getItem('advisori_token')
}

async function req(path, options = {}) {
  const token = getToken()
  const res = await fetch(BASE + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (res.status === 401) {
    localStorage.removeItem('advisori_token')
    localStorage.removeItem('advisori_user')
    // Jangan redirect otomatis di sini untuk menghindari loop
    // window.location.href = '/login' 
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || 'Unauthorized')
  }

  // Cek apakah response memiliki content
  const contentType = res.headers.get('content-type')
  let data = null
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await res.json()
    } catch (e) {
      console.error('Error parsing JSON:', e)
    }
  }

  if (!res.ok) throw new Error((data && data.error) || 'Terjadi kesalahan')
  return data
}

export const api = {
  get:    (path)         => req(path),
  post:   (path, body)   => req(path, { method: 'POST', body }),
  patch:  (path, body)   => req(path, { method: 'PATCH', body }),
  delete: (path)         => req(path, { method: 'DELETE' }),

  // Auth
  register: (data)  => req('/auth/register', { method: 'POST', body: data }),
  login:    (data)  => req('/auth/login',    { method: 'POST', body: data }),
  me:       ()      => req('/auth/me'),

  // Soul
  getSoul:    ()     => req('/soul'),
  setupSoul:  (data) => req('/soul/setup', { method: 'POST', body: data }),

  // Chat
  getHistory: (advisorId) => req(`/chat/history/${advisorId}`),
  getUsage:   ()          => req('/chat/usage'),

  // Shop
  getSkills:   () => req('/shop/skills'),
  getMySkills: () => req('/shop/my-skills'),
  activate:    (id) => req(`/shop/activate/${id}`, { method: 'POST' }),

  // Streaming chat — returns ReadableStream
  streamChat: async (message, advisorId) => {
    const token = getToken()
    return fetch(BASE + '/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ message, advisorId }),
    })
  },
}
