import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { QRCodeSVG } from 'qrcode.react';
import { ThemeToggle } from '../components/ui';

export default function Channels() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [whatsappQR, setWhatsappQR] = useState(null);
  const [telegramToken, setTelegramToken] = useState('');
  const [discordToken, setDiscordToken] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const data = await api.getChannelConnections();
      const connectionsMap = {};
      (data.connections || []).forEach(conn => {
        connectionsMap[conn.channel] = conn;
      });
      setConnections(connectionsMap);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateWhatsAppQR = async () => {
    try {
      setError(null);
      setSuccess(null);
      const data = await api.generateWhatsAppQR();
      setWhatsappQR(data.qr);
      setSuccess('Scan QR code dengan WhatsApp Anda');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleConnectTelegram = async () => {
    try {
      setError(null);
      setSuccess(null);
      if (!telegramToken) {
        setError('Masukkan bot token Telegram');
        return;
      }
      const data = await api.connectTelegramChannel(telegramToken);
      setSuccess(`Telegram bot connected: @${data.botUsername}`);
      setTelegramToken('');
      await loadConnections();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleConnectDiscord = async () => {
    try {
      setError(null);
      setSuccess(null);
      if (!discordToken) {
        setError('Masukkan bot token Discord');
        return;
      }
      await api.connectDiscordChannel(discordToken);
      setSuccess('Discord bot connected successfully');
      setDiscordToken('');
      await loadConnections();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDisconnect = async (channel) => {
    try {
      setError(null);
      setSuccess(null);
      if (channel === 'whatsapp') {
        await api.disconnectWhatsAppChannel();
        setWhatsappQR(null);
      } else if (channel === 'telegram') {
        await api.disconnectTelegramChannel();
      } else if (channel === 'discord') {
        await api.disconnectDiscordChannel();
      }
      setSuccess(`${channel} disconnected`);
      await loadConnections();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ 
            width: 40, 
            height: 40, 
            border: '3px solid var(--border)', 
            borderTop: '3px solid var(--gold)', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p style={{ color: 'var(--ink-3)' }}>Loading channels...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '20px' }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .channel-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
          transition: all 0.3s ease;
        }
        .channel-card:hover {
          border-color: var(--gold);
          box-shadow: 0 4px 20px rgba(212, 175, 55, 0.1);
        }
        .status-badge {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }
        .status-connected {
          background: rgba(34, 197, 94, 0.1);
          color: rgb(34, 197, 94);
        }
        .status-disconnected {
          background: var(--bg-2);
          color: var(--ink-3);
        }
        .connect-btn {
          background: var(--gold);
          color: var(--gold-text);
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .connect-btn:hover {
          background: var(--gold-dim);
          transform: translateY(-1px);
        }
        .disconnect-btn {
          background: rgba(239, 68, 68, 0.1);
          color: rgb(239, 68, 68);
          border: 1px solid rgba(239, 68, 68, 0.2);
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .disconnect-btn:hover {
          background: rgba(239, 68, 68, 0.2);
        }
        .input-field {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--bg);
          color: var(--ink);
          font-size: 14px;
          transition: all 0.2s ease;
        }
        .input-field:focus {
          outline: none;
          border-color: var(--gold);
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.1);
        }
        .link {
          color: var(--gold);
          text-decoration: none;
          font-size: 13px;
        }
        .link:hover {
          text-decoration: underline;
        }
        .alert {
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 14px;
        }
        .alert-error {
          background: rgba(239, 68, 68, 0.1);
          color: rgb(239, 68, 68);
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
        .alert-success {
          background: rgba(34, 197, 94, 0.1);
          color: rgb(34, 197, 94);
          border: 1px solid rgba(34, 197, 94, 0.2);
        }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--ink)', marginBottom: 8 }}>
              🦞 Connected Channels
            </h1>
            <p style={{ color: 'var(--ink-3)', fontSize: 16 }}>
              Connect your messaging platforms to chat with your AI assistant
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => window.location.href = '/chat'}
              style={{
                padding: '10px 20px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--ink-2)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseOver={(e) => {
                e.target.style.borderColor = 'var(--gold)';
                e.target.style.color = 'var(--ink)';
              }}
              onMouseOut={(e) => {
                e.target.style.borderColor = 'var(--border)';
                e.target.style.color = 'var(--ink-2)';
              }}
            >
              💬 Web Chat
            </button>
            <ThemeToggle />
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            {success}
          </div>
        )}

        {/* Channel Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>
          
          {/* WhatsApp Card */}
          <div className="channel-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 48, 
                  height: 48, 
                  background: 'linear-gradient(135deg, #25D366, #128C7E)', 
                  borderRadius: 12, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: 24
                }}>
                  📱
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>WhatsApp</h3>
                  <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>Scan QR to connect</p>
                </div>
              </div>
              <span className={`status-badge ${connections.whatsapp?.connected ? 'status-connected' : 'status-disconnected'}`}>
                {connections.whatsapp?.connected ? 'Connected' : 'Not Connected'}
              </span>
            </div>

            {connections.whatsapp?.connected ? (
              <div>
                <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 16 }}>
                  WhatsApp is connected and ready to receive messages
                </p>
                <button className="disconnect-btn" onClick={() => handleDisconnect('whatsapp')}>
                  Disconnect
                </button>
              </div>
            ) : (
              <div>
                {whatsappQR ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ 
                      background: 'white', 
                      padding: 20, 
                      borderRadius: 12, 
                      display: 'inline-block',
                      marginBottom: 16
                    }}>
                      <QRCodeSVG value={whatsappQR} size={200} />
                    </div>
                    <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 12 }}>
                      Scan this QR code with WhatsApp
                    </p>
                    <button 
                      onClick={() => setWhatsappQR(null)}
                      className="link"
                      style={{ fontSize: 14 }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button className="connect-btn" onClick={handleGenerateWhatsAppQR}>
                    Generate QR Code
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Telegram Card */}
          <div className="channel-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 48, 
                  height: 48, 
                  background: 'linear-gradient(135deg, #0088cc, #004466)', 
                  borderRadius: 12, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: 24
                }}>
                  ✈️
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>Telegram</h3>
                  <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>Use bot token</p>
                </div>
              </div>
              <span className={`status-badge ${connections.telegram?.connected ? 'status-connected' : 'status-disconnected'}`}>
                {connections.telegram?.connected ? 'Connected' : 'Not Connected'}
              </span>
            </div>

            {connections.telegram?.connected ? (
              <div>
                <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 8 }}>
                  Telegram bot is active and listening
                </p>
                <div style={{ 
                  background: 'var(--bg-2)', 
                  padding: '8px 12px', 
                  borderRadius: 8, 
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <span style={{ fontSize: 14 }}>🤖</span>
                  <span style={{ fontSize: 14, color: 'var(--gold)' }}>
                    @{connections.telegram?.credentials?.botUsername || 'Bot'}
                  </span>
                </div>
                <button className="disconnect-btn" onClick={() => handleDisconnect('telegram')}>
                  Disconnect
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  placeholder="Bot Token dari @BotFather"
                  className="input-field"
                  style={{ marginBottom: 12 }}
                />
                <button 
                  className="connect-btn" 
                  onClick={handleConnectTelegram}
                  disabled={!telegramToken}
                  style={{ opacity: telegramToken ? 1 : 0.5, cursor: telegramToken ? 'pointer' : 'not-allowed' }}
                >
                  Connect Telegram
                </button>
                <div style={{ marginTop: 12 }}>
                  <a 
                    href="https://t.me/BotFather" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="link"
                  >
                    Get bot token from @BotFather →
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Discord Card */}
          <div className="channel-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 48, 
                  height: 48, 
                  background: 'linear-gradient(135deg, #5865F2, #4752C4)', 
                  borderRadius: 12, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: 24
                }}>
                  🎮
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>Discord</h3>
                  <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>Use bot token</p>
                </div>
              </div>
              <span className={`status-badge ${connections.discord?.connected ? 'status-connected' : 'status-disconnected'}`}>
                {connections.discord?.connected ? 'Connected' : 'Not Connected'}
              </span>
            </div>

            {connections.discord?.connected ? (
              <div>
                <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 16 }}>
                  Discord bot is online and ready
                </p>
                <button className="disconnect-btn" onClick={() => handleDisconnect('discord')}>
                  Disconnect
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={discordToken}
                  onChange={(e) => setDiscordToken(e.target.value)}
                  placeholder="Bot Token dari Discord Developer Portal"
                  className="input-field"
                  style={{ marginBottom: 12 }}
                />
                <button 
                  className="connect-btn" 
                  onClick={handleConnectDiscord}
                  disabled={!discordToken}
                  style={{ opacity: discordToken ? 1 : 0.5, cursor: discordToken ? 'pointer' : 'not-allowed' }}
                >
                  Connect Discord
                </button>
                <div style={{ marginTop: 12 }}>
                  <a 
                    href="https://discord.com/developers/applications" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="link"
                  >
                    Create bot on Discord Developer Portal →
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div style={{ 
          marginTop: 40, 
          padding: 24, 
          background: 'var(--surface)', 
          border: '1px solid var(--border)', 
          borderRadius: 12 
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>📚 How to use</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 20 }}>📱</span>
              <div>
                <p style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 500, marginBottom: 4 }}>WhatsApp</p>
                <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>Scan QR code with your WhatsApp app to connect</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 20 }}>✈️</span>
              <div>
                <p style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 500, marginBottom: 4 }}>Telegram</p>
                <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>Create a bot via @BotFather and paste the token</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 20 }}>🎮</span>
              <div>
                <p style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 500, marginBottom: 4 }}>Discord</p>
                <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>Create a bot and paste the token here</p>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: 14, color: 'var(--ink-3)' }}>
              ✨ <strong>Once connected, send messages to your bot and get AI responses instantly!</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
