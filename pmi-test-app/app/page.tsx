'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

export default function HomePage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('cancelled')) setCancelled(true);
  }, []);

  async function handleCheckout() {
    setError('');
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Failed to create checkout. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.bgGlow1} />
      <div className={styles.bgGlow2} />

      <div className={styles.hero}>
        <div className={styles.badge}>✦ AI-Powered PMP Prep Platform</div>

        <h1 className={styles.title}>
          PMP Mock Exam<br />
          <span className={styles.titleGold}>Practice Tests</span>
        </h1>

        <p className={styles.subtitle}>
          AI-generated questions aligned to the <strong>PMI Exam Content Outline 2021+</strong>.
          Each test is unique — no repetition, no static question banks.
        </p>

        {cancelled && (
          <div className={styles.cancelBanner}>
            Payment cancelled — no charge made. Try again when ready.
          </div>
        )}

        <div className={styles.priceCard}>
          <div className={styles.priceHeader}>
            <div>
              <div className={styles.priceLabel}>Per Test Session</div>
              <div className={styles.price}>$1.99</div>
              <div className={styles.priceSub}>One-time · No subscription</div>
            </div>
            <div className={styles.priceRight}>
              <div className={styles.qCount}>60 Questions</div>
              <div className={styles.timerNote}>90 min timer</div>
            </div>
          </div>

          <ul className={styles.features}>
            {[
              'All 5 PMI domains covered across 60 questions',
              'AI-generated unique questions every test — never repeats',
              'Instant answer explanations after each question',
              'Domain-by-domain score breakdown',
              'Pass/Fail based on PMI threshold (61%)',
              'Flag questions and review before submitting',
            ].map(f => (
              <li key={f}><span className={styles.check}>✓</span>{f}</li>
            ))}
          </ul>

          <div className={styles.emailRow}>
            <label className="form-label">Your Email (receipt + access)</label>
            <input
              className="input"
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCheckout()}
            />
          </div>

          {error && <div className={styles.errorMsg}>{error}</div>}

          <button
            className="btn-primary"
            style={{ width: '100%', marginTop: '1rem', fontSize: '1.05rem', padding: '15px' }}
            onClick={handleCheckout}
            disabled={loading}
          >
            {loading ? <><span className="spinner" /> Processing…</> : 'Pay $1.99 · Start Test →'}
          </button>

          <div className={styles.lockNote}>
            🔒 Secured by Stripe · 256-bit TLS · No card data stored
          </div>
        </div>

        <div className={styles.domainsSection}>
          <div className={styles.domainsLabel}>Domains Covered</div>
          <div className={styles.domainPills}>
            {['People & Leadership', 'Process & PM Methods', 'Business Environment', 'Agile & Hybrid', 'Risk & Change'].map(d => (
              <span key={d} className={styles.pill}>{d}</span>
            ))}
          </div>
        </div>

        <p style={{fontSize:'12px', color:'#555', marginTop:'2rem', textAlign:'center'}}>
          Independent practice tool — not affiliated with or endorsed by PMI®
        </p>
      </div>
    </main>
  );
}
