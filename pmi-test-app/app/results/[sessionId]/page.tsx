'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './results.module.css';
import { DomainResult } from '@/types';

interface ResultData {
  score: number;
  correct_answers: number;
  total_questions: number;
  time_taken_seconds: number;
  domain_results: DomainResult[];
  passed: boolean;
  detailed_results: Array<{
    position: number;
    q: string;
    options: string[];
    userAnswer: number;
    correctAnswer: number;
    isCorrect: boolean;
    explanation: string;
    domain: string;
  }>;
  email: string;
}

const LETTERS = ['A', 'B', 'C', 'D'];

export default function ResultsPage({ params }: { params: { sessionId: string } }) {
  const router = useRouter();
  const [data, setData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    fetchResults();
  }, []);

  async function fetchResults() {
    try {
      const res = await fetch(`/api/results/${params.sessionId}`);
      const json = await res.json();
      if (json.error) { setError(json.error); return; }
      setData(json);
    } catch {
      setError('Failed to load results.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div className={styles.centered}>
      <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      <p style={{ marginTop: '1rem', color: 'var(--muted)' }}>Loading results…</p>
    </div>
  );

  if (error || !data) return (
    <div className={styles.centered}>
      <p style={{ color: '#fca5a5' }}>{error || 'Results not found.'}</p>
      <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => router.push('/')}>← Home</button>
    </div>
  );

  const { score, correct_answers, total_questions, time_taken_seconds, domain_results, passed, detailed_results, email } = data;
  const mm = String(Math.floor(time_taken_seconds / 60)).padStart(2, '0');
  const ss = String(time_taken_seconds % 60).padStart(2, '0');
  const pct = score;
  const conicPct = Math.round(pct * 3.6); // degrees

  return (
    <main className={styles.main}>
      <div className={styles.bgGlow} />

      <div className={styles.container}>
        {/* Header */}
        <div className={styles.resultHeader}>
          <div className={styles.resultIcon}>{passed ? '🎉' : '📚'}</div>
          <h1 className={styles.resultTitle}>
            {passed ? 'Congratulations!' : 'Keep Practicing'}
          </h1>
          <p className={styles.resultSub}>
            {passed
              ? `You passed with ${pct}% — above the PMI threshold of 61%`
              : `You scored ${pct}% — PMI passing threshold is 61%. Review your weak domains below.`}
          </p>
          <span className={`${styles.badge} ${passed ? styles.badgePass : styles.badgeFail}`}>
            {passed ? '✓ PASS' : '✗ NEEDS IMPROVEMENT'}
          </span>
        </div>

        {/* Score circle + stats */}
        <div className={styles.scoreSection}>
          <div
            className={styles.scoreCircle}
            style={{
              background: `conic-gradient(${passed ? '#c9a84c' : '#ef4444'} ${conicPct}deg, rgba(255,255,255,0.06) 0deg)`,
            }}
          >
            <div className={styles.scoreInner}>
              <div className={styles.scorePct}>{pct}%</div>
              <div className={styles.scoreLabel}>Score</div>
            </div>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statNum} style={{ color: 'var(--green)' }}>{correct_answers}</div>
              <div className={styles.statLabel}>Correct</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNum} style={{ color: 'var(--red)' }}>{total_questions - correct_answers}</div>
              <div className={styles.statLabel}>Incorrect</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNum} style={{ color: 'var(--gold2)' }}>{mm}:{ss}</div>
              <div className={styles.statLabel}>Time Used</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNum} style={{ color: 'var(--text)' }}>{total_questions}</div>
              <div className={styles.statLabel}>Questions</div>
            </div>
          </div>
        </div>

        {/* Domain Breakdown */}
        {domain_results && domain_results.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Domain Breakdown</h2>
            <div className={styles.domainList}>
              {domain_results.map(d => (
                <div key={d.domain} className={styles.domainRow}>
                  <div className={styles.domainName}>{d.domain}</div>
                  <div className={styles.domainBarWrap}>
                    <div
                      className={styles.domainBar}
                      style={{
                        width: `${d.pct}%`,
                        background: d.pct >= 70 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : d.pct >= 50 ? 'linear-gradient(90deg,#c9a84c,#e8c96a)' : 'linear-gradient(90deg,#ef4444,#f87171)',
                      }}
                    />
                  </div>
                  <div className={styles.domainPct}
                    style={{ color: d.pct >= 70 ? '#4ade80' : d.pct >= 50 ? 'var(--gold2)' : '#f87171' }}>
                    {d.pct}%
                  </div>
                  <div className={styles.domainFrac}>{d.correct}/{d.total}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Review Answers toggle */}
        {detailed_results && detailed_results.length > 0 && (
          <div className={styles.section}>
            <button
              className={`btn-secondary ${styles.reviewToggle}`}
              onClick={() => setShowReview(v => !v)}
            >
              {showReview ? '▲ Hide Answer Review' : '▼ Review All Answers'}
            </button>

            {showReview && (
              <div className={styles.reviewList}>
                {detailed_results.map((r, i) => (
                  <div key={i} className={`${styles.reviewItem} ${r.isCorrect ? styles.reviewCorrect : styles.reviewWrong}`}>
                    <div className={styles.reviewHeader}>
                      <span className={`${styles.reviewBadge} ${r.isCorrect ? styles.rbCorrect : styles.rbWrong}`}>
                        {r.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                      </span>
                      <span className={styles.reviewDomain}>{r.domain}</span>
                      <span className={styles.reviewNum}>Q{i + 1}</span>
                    </div>
                    <p className={styles.reviewQ}>{r.q}</p>
                    <div className={styles.reviewOptions}>
                      {r.options.map((opt, oi) => (
                        <div
                          key={oi}
                          className={`${styles.reviewOpt} ${oi === r.correctAnswer ? styles.roCorrect : ''} ${oi === r.userAnswer && !r.isCorrect ? styles.roWrong : ''}`}
                        >
                          <span className={styles.roLetter}>{LETTERS[oi]}</span>
                          <span>{opt}</span>
                          {oi === r.correctAnswer && <span className={styles.roTag}>Correct</span>}
                          {oi === r.userAnswer && !r.isCorrect && <span className={styles.roTag} style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}>Your answer</span>}
                        </div>
                      ))}
                    </div>
                    <div className={styles.reviewExplanation}>
                      <strong>Explanation:</strong> {r.explanation}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CTA buttons */}
        <div className={styles.ctaRow}>
          <button className="btn-primary" onClick={() => router.push('/')}>
            🔄 Take Another Test — $1.99
          </button>
          <button className="btn-secondary" onClick={() => router.push('/')}>
            ← Home
          </button>
        </div>

        {email && (
          <p className={styles.emailNote}>Results saved to {email}</p>
        )}
      </div>
    </main>
  );
}
