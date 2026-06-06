import React, { useState, useEffect } from 'react'
import Auth from './components/Auth'
import Chat from './components/Chat'

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')))

  useEffect(() => {
    if (!token) {
      setToken(null)
      setUser(null)
    }
  }, [token])

  const handleLogout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      {!token || !user ? (
        <Auth setToken={setToken} setUser={setUser} />
      ) : (
        <Chat token={token} user={user} onLogout={handleLogout} />
      )}
    </div>
  )
}

export default App
