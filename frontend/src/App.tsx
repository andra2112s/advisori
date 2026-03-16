import React, { useState } from 'react';
import './App.css';

const App: React.FC = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');

  const openAuth = (tab: 'login' | 'register') => {
    setAuthTab(tab);
    setShowAuthModal(true);
  };

  return (
    <div className="app-container">
      {/* NAV */}
      <nav>
        <div className="nav-inner">
          <div className="logo">
            Advisori<span className="logo-dot"></span>
          </div>
          <div className="nav-actions">
            <button className="btn-ghost" onClick={() => openAuth('login')}>Masuk</button>
            <button className="btn-solid" onClick={() => openAuth('register')}>Daftar</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-content">
          <div className="eyebrow">Personal AI Companion</div>
          <h1>Asisten Cerdas <em>Pribadi</em> Kamu</h1>
          <p className="hero-desc">
            Dari urusan pajak, analisis saham IDX, hingga obrolan santai — Advisori siap menemani produktivitasmu 24/7.
          </p>
          <div className="hero-cta">
            <button className="btn-primary" onClick={() => openAuth('register')}>Coba Sekarang — Gratis</button>
            <button className="btn-secondary">Lihat Kemampuan</button>
          </div>
        </div>

        <div className="hero-visual">
          <div className="float-card">
            <div className="card-top">
              <div className="card-avi">🤖</div>
              <div>
                <div className="card-name">Advisori AI</div>
                <div className="card-role">Your Intelligence Partner</div>
              </div>
            </div>
            <div className="card-msg user">"Bagaimana tren saham BBCA minggu ini?"</div>
            <div className="card-msg">"BBCA menunjukkan tren bullish dengan support di level..."</div>
            <div className="float-tag">✦ Smart Analysis</div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features">
        <div className="features-inner">
          <div className="feat">
            <div className="feat-icon">📊</div>
            <div className="feat-name">Analisis Keuangan</div>
            <div className="feat-desc">Insight mendalam untuk portofolio saham dan perencanaan keuangan pribadi.</div>
          </div>
          <div className="feat">
            <div className="feat-icon">⚖️</div>
            <div className="feat-name">Bantuan Pajak</div>
            <div className="feat-desc">Navigasi peraturan pajak yang kompleks dengan penjelasan yang mudah dimengerti.</div>
          </div>
          <div className="feat">
            <div className="feat-icon">🧠</div>
            <div className="feat-name">Custom Personality</div>
            <div className="feat-desc">Atur sendiri gaya bahasa dan kepribadian AI sesuai kenyamananmu.</div>
          </div>
        </div>
      </section>

      {/* AUTH MODAL */}
      {showAuthModal && (
        <div className="overlay show" onClick={() => setShowAuthModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-wrap">
              <button className="m-close" onClick={() => setShowAuthModal(false)}>&times;</button>
              <div className="modal-logo">Advisori<span className="logo-dot"></span></div>
              <div className="modal-sub">
                {authTab === 'login' ? 'Masuk ke akun kamu' : 'Buat akun gratis, 30 detik'}
              </div>
              
              <div className="modal-tabs">
                <button 
                  className={`modal-tab ${authTab === 'login' ? 'active' : ''}`}
                  onClick={() => setAuthTab('login')}
                >
                  Masuk
                </button>
                <button 
                  className={`modal-tab ${authTab === 'register' ? 'active' : ''}`}
                  onClick={() => setAuthTab('register')}
                >
                  Daftar
                </button>
              </div>

              {authTab === 'login' ? (
                <div id="form-login">
                  <div className="m-field">
                    <label className="m-label">Email</label>
                    <input type="email" className="m-input" placeholder="nama@email.com" />
                  </div>
                  <div className="m-field">
                    <label className="m-label">Password</label>
                    <input type="password" className="m-input" placeholder="••••••••" />
                  </div>
                  <button className="m-btn">Masuk →</button>
                </div>
              ) : (
                <div id="form-register">
                  <div className="m-field">
                    <label className="m-label">Nama Lengkap</label>
                    <input type="text" className="m-input" placeholder="Budi Santoso" />
                  </div>
                  <div className="m-field">
                    <label className="m-label">Email</label>
                    <input type="email" className="m-input" placeholder="nama@email.com" />
                  </div>
                  <div className="m-field">
                    <label className="m-label">Password</label>
                    <input type="password" className="m-input" placeholder="Minimal 8 karakter" />
                  </div>
                  <button className="m-btn">Buat Akun & Lanjutkan →</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
