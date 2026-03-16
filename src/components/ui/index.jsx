import { useTheme } from '../../lib/theme'

const s = {
  // Button
  btn: `
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    font-family: var(--font-body); font-size: 14px; font-weight: 500;
    border: none; border-radius: var(--radius); cursor: pointer;
    transition: var(--trans); padding: 12px 24px; white-space: nowrap;
  `,
}

/* ── Button ── */
export function Btn({ children, variant = 'primary', size = 'md', loading, disabled, onClick, style, type = 'button' }) {
  const styles = {
    primary: {
      background: 'var(--ink)', color: 'var(--bg)',
    },
    secondary: {
      background: 'transparent', color: 'var(--ink-2)',
      border: '1px solid var(--border-str)',
    },
    ghost: {
      background: 'transparent', color: 'var(--ink-3)',
      border: '1px solid var(--border)',
    },
    gold: {
      background: 'var(--gold)', color: '#fff',
    },
    danger: {
      background: 'var(--danger-bg)', color: 'var(--danger)',
      border: '1px solid var(--danger)',
    },
  }

  const sizes = {
    sm: { padding: '7px 14px', fontSize: '12px' },
    md: { padding: '11px 22px', fontSize: '14px' },
    lg: { padding: '14px 28px', fontSize: '15px' },
    icon: { padding: '10px', fontSize: '14px' },
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        fontFamily: 'var(--font-body)', fontWeight: 500,
        border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer',
        transition: 'var(--trans)', whiteSpace: 'nowrap',
        opacity: (disabled || loading) ? 0.5 : 1,
        ...styles[variant],
        ...sizes[size],
        ...style,
      }}
    >
      {loading ? <Spinner size={14} /> : children}
    </button>
  )
}

/* ── Input ── */
export function Input({ label, error, hint, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{
          display: 'block', fontSize: 11, fontWeight: 500,
          letterSpacing: '.08em', textTransform: 'uppercase',
          color: 'var(--ink-3)', marginBottom: 7,
        }}>
          {label}
        </label>
      )}
      <input
        {...props}
        style={{
          width: '100%', background: 'var(--bg-2)',
          border: `1px solid ${error ? 'var(--danger)' : 'var(--border-md)'}`,
          borderRadius: 'var(--radius)', padding: '11px 14px',
          fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 300,
          color: 'var(--ink)', outline: 'none', transition: 'var(--trans)',
          ...props.style,
        }}
        onFocus={e => {
          e.target.style.borderColor = 'var(--border-str)'
          e.target.style.background = 'var(--surface)'
        }}
        onBlur={e => {
          e.target.style.borderColor = error ? 'var(--danger)' : 'var(--border-md)'
          e.target.style.background = 'var(--bg-2)'
        }}
      />
      {error && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 5 }}>{error}</p>}
      {hint && !error && <p style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 5 }}>{hint}</p>}
    </div>
  )
}

/* ── Textarea ── */
export function Textarea({ label, error, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{
          display: 'block', fontSize: 11, fontWeight: 500,
          letterSpacing: '.08em', textTransform: 'uppercase',
          color: 'var(--ink-3)', marginBottom: 7,
        }}>
          {label}
        </label>
      )}
      <textarea
        {...props}
        style={{
          width: '100%', background: 'var(--bg-2)',
          border: `1px solid ${error ? 'var(--danger)' : 'var(--border-md)'}`,
          borderRadius: 'var(--radius)', padding: '11px 14px',
          fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 300,
          color: 'var(--ink)', outline: 'none', transition: 'var(--trans)',
          resize: 'vertical', minHeight: 100,
          ...props.style,
        }}
      />
      {error && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 5 }}>{error}</p>}
    </div>
  )
}

/* ── Card ── */
export function Card({ children, style, onClick, hover = false }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '20px 24px',
        transition: 'var(--trans)', cursor: onClick ? 'pointer' : 'default',
        ...(hover && { ':hover': { borderColor: 'var(--border-str)', transform: 'translateY(-2px)' } }),
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/* ── Chip / Tag ── */
export function Chip({ children, selected, onClick, style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 13, padding: '7px 16px', borderRadius: 99,
        border: selected ? '1px solid var(--gold)' : '1px solid var(--border-md)',
        background: selected ? 'var(--gold-dim)' : 'transparent',
        color: selected ? 'var(--gold-text)' : 'var(--ink-3)',
        cursor: 'pointer', transition: 'var(--trans)', fontFamily: 'var(--font-body)',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

/* ── Spinner ── */
export function Spinner({ size = 18, color = 'currentColor' }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid ${color}`,
      borderTopColor: 'transparent',
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  )
}

/* ── Theme Toggle ── */
export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        background: 'transparent', border: '1px solid var(--border-md)',
        borderRadius: 'var(--radius)', padding: '8px 10px', cursor: 'pointer',
        fontSize: 16, lineHeight: 1, transition: 'var(--trans)',
        color: 'var(--ink-3)',
      }}
    >
      {theme === 'dark' ? '☀' : '◑'}
    </button>
  )
}

/* ── Avatar ── */
export function Avatar({ avatar = '✦', size = 40, style }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--bg-2)', border: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.45, flexShrink: 0, ...style,
    }}>
      {avatar}
    </div>
  )
}

/* ── Divider ── */
export function Divider({ style }) {
  return (
    <hr style={{
      border: 'none', borderTop: '1px solid var(--border)',
      margin: '20px 0', ...style,
    }} />
  )
}

/* ── Status dot ── */
export function StatusDot({ online = true }) {
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: online ? 'var(--success)' : 'var(--ink-4)',
      animation: online ? 'pulse 2s infinite' : 'none',
    }} />
  )
}
