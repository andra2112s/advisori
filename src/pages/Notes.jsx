import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { Avatar } from '../components/ui'

export default function Notes() {
  const { soul, logout } = useAuth()
  const [notes, setNotes] = useState([])
  const [selectedNote, setSelectedNote] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  useEffect(() => {
    loadNotes()
  }, [])

  const loadNotes = async () => {
    try {
      const res = await api.get('/notes')
      setNotes(res.notes || [])
    } catch (err) {
      console.error('Load notes error:', err)
    } finally {
      setLoading(false)
    }
  }

  const createNote = async () => {
    try {
      const res = await api.post('/notes', {
        title: 'New Note',
        content: '',
        source_type: 'manual',
      })
      setNotes(prev => [res.note, ...prev])
      setSelectedNote(res.note)
      setIsEditing(true)
      setEditTitle(res.note.title)
      setEditContent('')
    } catch (err) {
      console.error('Create note error:', err)
    }
  }

  const saveNote = async () => {
    if (!selectedNote) return
    try {
      const res = await api.put(`/notes/${selectedNote.id}`, {
        title: editTitle,
        content: editContent,
      })
      setNotes(prev => prev.map(n => n.id === res.note.id ? res.note : n))
      setSelectedNote(res.note)
      setIsEditing(false)
    } catch (err) {
      console.error('Save note error:', err)
    }
  }

  const deleteNote = async (id) => {
    if (!confirm('Delete this note?')) return
    try {
      await api.delete(`/notes/${id}`)
      setNotes(prev => prev.filter(n => n.id !== id))
      if (selectedNote?.id === id) {
        setSelectedNote(null)
        setIsEditing(false)
      }
    } catch (err) {
      console.error('Delete note error:', err)
    }
  }

  const toggleStar = async (note) => {
    try {
      const res = await api.updateNote(note.id, { is_starred: !note.is_starred })
      setNotes(prev => prev.map(n => n.id === res.note.id ? res.note : n))
    } catch (err) {
      console.error('Toggle star error:', err)
    }
  }

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      chunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(track => track.stop())
        
        const reader = new FileReader()
        reader.onloadend = async () => {
          const base64 = reader.result.split(',')[1]
          try {
            const res = await api.post('/notes', {
              title: `Voice Note ${new Date().toLocaleDateString()}`,
              content: '[Voice recording - transcription pending]',
              source_type: 'voice',
            })
            setNotes(prev => [res.note, ...prev])
            setSelectedNote(res.note)
          } catch (err) {
            console.error('Create voice note error:', err)
          }
        }
        reader.readAsDataURL(audioBlob)
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
    } catch (err) {
      console.error('Start recording error:', err)
      alert('Cannot access microphone')
    }
  }

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const filteredNotes = notes.filter(note => {
    const query = searchQuery.toLowerCase()
    return (
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query) ||
      (note.tags && note.tags.some(tag => tag.toLowerCase().includes(query)))
    )
  })

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui' }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: 'system-ui' }}>

      {/* Header - Matching Landing Page */}
      <header style={{
        height: 64, background: '#fff', borderBottom: '1px solid #eee',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, flexShrink: 0,
        position: 'relative', zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => window.location.href = '/'}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #FF6B35 0%, #FF8F5C 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 20 }}>🦞</span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>
            Advisori<span style={{ color: '#FF6B35' }}>.</span>
          </span>
        </div>

        {/* Nav Links */}
        <div style={{ display: 'flex', gap: 8, marginLeft: 24 }}>
          {[
            { label: 'Chat', href: '/chat', icon: '💬' },
            { label: 'Notes', href: '/notes', icon: '📝' },
            { label: 'Channels', href: '/channels', icon: '📱' },
          ].map(link => (
            <a key={link.href} href={link.href} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              fontSize: 14, fontWeight: 500,
              color: window.location.pathname === link.href ? '#FF6B35' : '#666',
              background: window.location.pathname === link.href ? '#FFF3F0' : 'transparent',
              textDecoration: 'none',
            }}>
              <span>{link.icon}</span>
              {link.label}
            </a>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <button onClick={logout} style={{
          padding: '8px 14px', border: '1px solid #ddd', borderRadius: 8,
          background: 'transparent', color: '#666', cursor: 'pointer', fontSize: 13,
        }}>
          Logout
        </button>
      </header>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Sidebar - Notes List */}
        <div style={{
          width: 320,
          background: '#f8f9fa',
          borderRight: '1px solid #eee',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{ padding: 16, borderBottom: '1px solid #eee', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>📝 Notes</span>
              <button
                onClick={createNote}
                style={{
                  width: 32, height: 32,
                  background: '#FF6B35',
                  border: 'none',
                  borderRadius: 8,
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                +
              </button>
            </div>
            
            {/* Search */}
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: 8,
                background: '#f8f9fa',
                fontSize: 13,
                boxSizing: 'border-box',
              }}
            />

            {/* Voice Record Button */}
            <button
              onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
              style={{
                width: '100%',
                marginTop: 10,
                padding: '8px 12px',
                background: isRecording ? '#f44336' : '#FFF3F0',
                border: `1px solid ${isRecording ? '#f44336' : '#FF6B35'}`,
                borderRadius: 8,
                color: isRecording ? 'white' : '#FF6B35',
                cursor: 'pointer',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {isRecording ? (
                <>
                  <span style={{ width: 8, height: 8, background: 'white', borderRadius: '50%' }} />
                  Stop Recording
                </>
              ) : (
                <>🎤 Record Voice Note</>
              )}
            </button>
          </div>

          {/* Notes List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {filteredNotes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                {notes.length === 0 ? 'No notes yet' : 'No matching notes'}
              </div>
            ) : (
              filteredNotes.map(note => (
                <div
                  key={note.id}
                  onClick={() => { setSelectedNote(note); setIsEditing(false) }}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: selectedNote?.id === note.id ? '#fff' : 'transparent',
                    border: selectedNote?.id === note.id ? '1px solid #FF6B35' : '1px solid transparent',
                    marginBottom: 4,
                    boxShadow: selectedNote?.id === note.id ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, flex: 1, fontWeight: 500, color: '#1a1a1a' }}>{note.title}</span>
                    {note.is_starred && <span>⭐</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                    {formatDate(note.updated_at)}
                  </div>
                  {note.tags?.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                      {note.tags.slice(0, 3).map(tag => (
                        <span key={tag} style={{
                          fontSize: 10, padding: '2px 6px',
                          background: '#f0f0f0', borderRadius: 4, color: '#666',
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Note Detail */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {selectedNote ? (
            <>
              {/* Note Header */}
              <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid #eee',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                {isEditing ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    autoFocus
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '1px solid #FF6B35',
                      borderRadius: 8,
                      fontSize: 16,
                      fontWeight: 600,
                    }}
                  />
                ) : (
                  <h2 style={{ flex: 1, margin: 0, fontSize: 18, color: '#1a1a1a' }}>{selectedNote.title}</h2>
                )}
                
                <button onClick={() => toggleStar(selectedNote)} style={{
                  padding: '8px 12px', background: 'transparent', border: '1px solid #ddd',
                  borderRadius: 8, cursor: 'pointer', fontSize: 14,
                }}>
                  {selectedNote.is_starred ? '⭐' : '☆'}
                </button>
                
                <button
                  onClick={() => isEditing ? saveNote() : (setIsEditing(true), setEditTitle(selectedNote.title), setEditContent(selectedNote.content))}
                  style={{
                    padding: '8px 16px', background: '#FF6B35', border: 'none',
                    borderRadius: 8, color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  }}
                >
                  {isEditing ? 'Save' : 'Edit'}
                </button>
                
                <button
                  onClick={() => deleteNote(selectedNote.id)}
                  style={{
                    padding: '8px 12px', background: 'transparent', border: '1px solid #f44336',
                    borderRadius: 8, color: '#f44336', cursor: 'pointer', fontSize: 13,
                  }}
                >
                  Delete
                </button>
              </div>

              {/* Note Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#fff' }}>
                {isEditing ? (
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    placeholder="Write your notes here..."
                    style={{
                      width: '100%', minHeight: 400, padding: 16,
                      border: '1px solid #ddd', borderRadius: 8,
                      background: '#fafafa', fontSize: 14, lineHeight: 1.7,
                      resize: 'vertical', fontFamily: 'system-ui',
                    }}
                  />
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#333' }}>
                    {selectedNote.content || (
                      <span style={{ color: '#999', fontStyle: 'italic' }}>
                        No content yet. Click Edit to add content.
                      </span>
                    )}
                  </div>
                )}

                {/* AI Actions */}
                {!isEditing && selectedNote.content && (
                  <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #eee' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#1a1a1a' }}>AI Study Tools</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button style={{
                        padding: '10px 16px', background: '#fff', border: '1px solid #ddd',
                        borderRadius: 8, cursor: 'pointer', fontSize: 13, display: 'flex',
                        alignItems: 'center', gap: 6,
                      }}>
                        🎴 Generate Flashcards
                      </button>
                      <button style={{
                        padding: '10px 16px', background: '#fff', border: '1px solid #ddd',
                        borderRadius: 8, cursor: 'pointer', fontSize: 13, display: 'flex',
                        alignItems: 'center', gap: 6,
                      }}>
                        📝 Create Quiz
                      </button>
                      <button
                        onClick={() => window.location.href = `/chat?note=${selectedNote.id}`}
                        style={{
                          padding: '10px 16px', background: '#FFF3F0', border: '1px solid #FF6B35',
                          borderRadius: 8, cursor: 'pointer', fontSize: 13, display: 'flex',
                          alignItems: 'center', gap: 6, color: '#FF6B35',
                        }}
                      >
                        💬 Chat about this Note
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>
                <img src="/icons/notes.svg" style={{ width: 80, height: 80, opacity: 0.5 }} />
              </div>
              <div style={{ fontSize: 18, marginBottom: 8, color: '#666' }}>No note selected</div>
              <div style={{ fontSize: 14 }}>Select a note or create a new one</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
