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
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', fontFamily: 'system-ui' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: 40, height: 40, border: '3px solid #eee',
            borderTop: '3px solid #FF6B35', borderRadius: '50%',
            animation: 'spin 1s linear infinite', margin: '0 auto 20px'
          }}></div>
          <p style={{ color: '#666' }}>Loading channels...</p>
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: 'system-ui' }}>
      {/* Header */}
      <header style={{
        height: 64, background: '#fff', borderBottom: '1px solid #eee',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16,
      }}>
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
      </header>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>
            📱 Connected Channels
          </h1>
          <p style={{ color: '#666', fontSize: 16 }}>
            Connect your messaging platforms to chat with your AI assistant
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div style={{ padding: 12, borderRadius: 8, marginBottom: 20, fontSize: 14, background: '#FFEBEE', color: '#C62828', border: '1px solid #FFCDD2' }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ padding: 12, borderRadius: 8, marginBottom: 20, fontSize: 14, background: '#E8F5E9', color: '#2E7D32', border: '1px solid #C8E6C9' }}>
            {success}
          </div>
        )}

        {/* Channel Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>
          
          {/* WhatsApp Card */}
          <div style={{
            background: '#fff', border: '1px solid #eee', borderRadius: 16,
            padding: 24, transition: 'all 0.3s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 48, height: 48, background: 'linear-gradient(135deg, #25D366, #128C7E)', 
                  borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24
                }}>📱</div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a', marginBottom: 2 }}>WhatsApp</h3>
                  <p style={{ fontSize: 13, color: '#666' }}>Scan QR to connect</p>
                </div>
              </div>
              <span style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                background: connections.whatsapp?.connected ? '#E8F5E9' : '#f5f5f5',
                color: connections.whatsapp?.connected ? '#2E7D32' : '#999',
              }}>
                {connections.whatsapp?.connected ? 'Connected' : 'Not Connected'}
              </span>
            </div>

            {connections.whatsapp?.connected ? (
              <div>
                <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
                  WhatsApp is connected and ready to receive messages
                </p>
                <button onClick={() => handleDisconnect('whatsapp')} style={{
                  background: '#FFEBEE', color: '#C62828', border: '1px solid #FFCDD2',
                  padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 500,
                }}>
                  Disconnect
                </button>
              </div>
            ) : (
              <div>
                {whatsappQR ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ background: 'white', padding: 20, borderRadius: 12, display: 'inline-block', marginBottom: 16 }}>
                      <QRCodeSVG value={whatsappQR} size={200} />
                    </div>
                    <p style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>
                      Scan this QR code with WhatsApp
                    </p>
                    <button onClick={() => setWhatsappQR(null)} style={{
                      background: 'transparent', border: 'none', color: '#FF6B35', cursor: 'pointer', fontSize: 14,
                    }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={handleGenerateWhatsAppQR} style={{
                    background: '#FF6B35', color: 'white', border: 'none',
                    padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 500, width: '100%',
                  }}>
                    Generate QR Code
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Telegram Card */}
          <div style={{
            background: '#fff', border: '1px solid #eee', borderRadius: 16,
            padding: 24, transition: 'all 0.3s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 48, height: 48, background: 'linear-gradient(135deg, #0088cc, #004466)', 
                  borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24
                }}>✈️</div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a', marginBottom: 2 }}>Telegram</h3>
                  <p style={{ fontSize: 13, color: '#666' }}>Use bot token</p>
                </div>
              </div>
              <span style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                background: connections.telegram?.connected ? '#E8F5E9' : '#f5f5f5',
                color: connections.telegram?.connected ? '#2E7D32' : '#999',
              }}>
                {connections.telegram?.connected ? 'Connected' : 'Not Connected'}
              </span>
            </div>

            {connections.telegram?.connected ? (
              <div>
                <p style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
                  Telegram bot is active and listening
                </p>
                <div style={{ background: '#f5f5f5', padding: '8px 12px', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>🤖</span>
                  <span style={{ fontSize: 14, color: '#FF6B35' }}>
                    @{connections.telegram?.credentials?.botUsername || 'Bot'}
                  </span>
                </div>
                <button onClick={() => handleDisconnect('telegram')} style={{
                  background: '#FFEBEE', color: '#C62828', border: '1px solid #FFCDD2',
                  padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 500,
                }}>
                  Disconnect
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text" value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  placeholder="Bot Token from @BotFather"
                  style={{
                    width: '100%', padding: '10px 12px', border: '1px solid #ddd',
                    borderRadius: 8, background: '#fafafa', fontSize: 14, marginBottom: 12, boxSizing: 'border-box',
                  }}
                />
                <button onClick={handleConnectTelegram} disabled={!telegramToken} style={{
                  background: '#FF6B35', color: 'white', border: 'none',
                  padding: '10px 20px', borderRadius: 8, cursor: telegramToken ? 'pointer' : 'not-allowed',
                  fontWeight: 500, width: '100%', opacity: telegramToken ? 1 : 0.5,
                }}>
                  Connect Telegram
                </button>
                <div style={{ marginTop: 12 }}>
                  <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" style={{
                    color: '#FF6B35', textDecoration: 'none', fontSize: 13,
                  }}>
                    Get bot token from @BotFather →
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Discord Card */}
          <div style={{
            background: '#fff', border: '1px solid #eee', borderRadius: 16,
            padding: 24, transition: 'all 0.3s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 48, height: 48, background: 'linear-gradient(135deg, #5865F2, #4752C4)', 
                  borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24
                }}>🎮</div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a', marginBottom: 2 }}>Discord</h3>
                  <p style={{ fontSize: 13, color: '#666' }}>Use bot token</p>
                </div>
              </div>
              <span style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                background: connections.discord?.connected ? '#E8F5E9' : '#f5f5f5',
                color: connections.discord?.connected ? '#2E7D32' : '#999',
              }}>
                {connections.discord?.connected ? 'Connected' : 'Not Connected'}
              </span>
            </div>

            {connections.discord?.connected ? (
              <div>
                <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
                  Discord bot is online and ready
                </p>
                <button onClick={() => handleDisconnect('discord')} style={{
                  background: '#FFEBEE', color: '#C62828', border: '1px solid #FFCDD2',
                  padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 500,
                }}>
                  Disconnect
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text" value={discordToken}
                  onChange={(e) => setDiscordToken(e.target.value)}
                  placeholder="Bot Token from Discord Developer Portal"
                  style={{
                    width: '100%', padding: '10px 12px', border: '1px solid #ddd',
                    borderRadius: 8, background: '#fafafa', fontSize: 14, marginBottom: 12, boxSizing: 'border-box',
                  }}
                />
                <button onClick={handleConnectDiscord} disabled={!discordToken} style={{
                  background: '#FF6B35', color: 'white', border: 'none',
                  padding: '10px 20px', borderRadius: 8, cursor: discordToken ? 'pointer' : 'not-allowed',
                  fontWeight: 500, width: '100%', opacity: discordToken ? 1 : 0.5,
                }}>
                  Connect Discord
                </button>
                <div style={{ marginTop: 12 }}>
                  <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" style={{
                    color: '#FF6B35', textDecoration: 'none', fontSize: 13,
                  }}>
                    Create bot on Discord Developer Portal →
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div style={{ 
          marginTop: 40, padding: 24, background: '#fff', border: '1px solid #eee', borderRadius: 16
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a', marginBottom: 16 }}>📚 How to use</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
            {[
              { icon: '📱', title: 'WhatsApp', desc: 'Scan QR code with your WhatsApp app to connect' },
              { icon: '✈️', title: 'Telegram', desc: 'Create a bot via @BotFather and paste the token' },
              { icon: '🎮', title: 'Discord', desc: 'Create a bot and paste the token here' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <div>
                  <p style={{ fontSize: 14, color: '#333', fontWeight: 500, marginBottom: 4 }}>{item.title}</p>
                  <p style={{ fontSize: 13, color: '#666' }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #eee' }}>
            <p style={{ fontSize: 14, color: '#666' }}>
              ✨ <strong>Once connected, send messages to your bot and get AI responses instantly!</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
