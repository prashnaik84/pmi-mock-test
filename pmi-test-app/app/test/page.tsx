'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import styles from './test.module.css';
import { ClientQuestion, DomainResult } from '@/types';

type Phase = 'verifying' | 'generating' | 'testing' | 'submitting' | 'error';

function TestPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const stripeSessionId = params.get('session_id');

  const [phase, setPhase] = useState<Phase>('verifying');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ClientQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [explanations, setExplanations] = useState<Record<number, string>>({});
  const [correctAnswers, setCorrectAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(3600);
  const [genProgress, setGenProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Polling to verify Stripe payment (webhook may lag slightly)
  useEffect(() => {
    if (!stripeSessionId) {
      setErrorMsg('No session ID found. Please complete payment first.');
      setPhase('error');
      return;
    }

    let attempts = 0;
    const poll = async () => {
      try {
        const res = await fetch(`/api/session?stripe_session_id=${stripeSessionId}`);
        const data = await res.json();

        if (data.status === 'pending' && attempts < 12) {
          attempts++;
          setTimeout(poll, 2500);
          return;
        }

        if (!data.id || !['paid', 'questions_ready', 'in_progress'].includes(data.status)) {
          setErrorMsg('Payment not verified. Please contact support.');
          setPhase('error');
          return;
        }

        if (data.status === 'completed') {
          router.replace(`/results/${data.id}`);
          return;
        }

        setSessionId(data.id);
        setPhase('generating');
        generateQuestions(data.id);
      } catch {
        setErrorMsg('Network error. Please refresh the page.');
        setPhase('error');
      }
    };
    poll();
  }, [stripeSessionId]);

  async function generateQuestions(sid: string) {
    // Animate progress bar
    let pct = 0;
    const prog = setInterval(() => {
      pct = Math.min(pct + 3, 85);
      setGenProgress(pct);
    }, 180);

    try {
      const res = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      });
      const data = await res.json();
      clearInterval(prog);

      if (!data.questions) throw new Error(data.error || 'Failed to generate questions');

      setGenProgress(100);
      await new Promise(r => setTimeout(r, 400));

      const qs = data.questions as ClientQuestion[];
      setQuestions(qs);
      setAnswers(Array(qs.length).fill(null));
      setPhase('testing');
      startTimeRef.current = Date.now();
      startTimer();
    } catch (err: any) {
      clearInterval(prog);
      setErrorMsg(err.message);
      setPhase('error');
    }
  }

  function startTimer() {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  const handleSubmit = useCallback(async (timedOut = false) => {
    if (!sessionId) return;
    clearInterval(timerRef.current!);
    setPhase('submitting');
    const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);

    try {
      const res = await fetch('/api/submit-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, answers, timeTakenSeconds: timeTaken }),
      });
      const data = await res.json();
      if (data.score !== undefined) {
        router.push(`/results/${sessionId}`);
      } else {
        setErrorMsg(data.error || 'Submission failed');
        setPhase('error');
      }
    } catch {
      setErrorMsg('Network error during submission.');
      setPhase('error');
    }
  }, [sessionId, answers, router]);

  function selectAnswer(idx: number) {
    if (answers[currentQ] !== null) return; // already answered
    const newAnswers = [...answers];
    newAnswers[currentQ] = idx;
    setAnswers(newAnswers);
    setSelected(idx);
    // Fetch explanation from server after answer
    fetchExplanation(currentQ, idx);
  }

  async function fetchExplanation(qIdx: number, chosen: number) {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/session?stripe_session_id=${stripeSessionId}&explain=true&sessionId=${sessionId}&qIdx=${qIdx}`);
      // For now, we show explanation from the question itself (stored after submit)
      // Alternatively, use a lightweight endpoint; here we inline what we have
    } catch {}
  }

  function nextQuestion() {
    const isLast = currentQ === questions.length - 1;
    if (isLast) { handleSubmit(); return; }
    setCurrentQ(prev => prev + 1);
    setSelected(answers[currentQ + 1]);
  }

  const q = questions[currentQ];
  const LETTERS = ['A', 'B', 'C', 'D'];
  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');
  const timerClass = timeLeft <= 300 ? styles.timerDanger : timeLeft <= 600 ? styles.timerWarn : '';
  const answeredCount = answers.filter(a => a !== null).length;

  if (phase === 'verifying') return (
    <div className={styles.centered}>
      <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      <p style={{ marginTop: '1rem', color: 'var(--muted)' }}>Verifying payment…</p>
    </div>
  );

  if (phase === 'generating') return (
    <div className={styles.centered}>
      <div className={styles.genIcon}>🧠</div>
      <h2 className={styles.genTitle}>Generating Your Test</h2>
      <p className={styles.genSub}>Crafting 20 unique PMP questions just for you…</p>
      <div className={styles.progressWrap}>
        <div className={styles.progressFill} style={{ width: `${genProgress}%` }} />
      </div>
      <p style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
        {genProgress < 30 ? 'Analyzing PMI domains…' : genProgress < 60 ? 'Building situational scenarios…' : genProgress < 85 ? 'Adding explanations…' : 'Almost ready…'}
      </p>
    </div>
  );

  if (phase === 'submitting') return (
    <div className={styles.centered}>
      <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      <p style={{ marginTop: '1rem', color: 'var(--muted)' }}>Scoring your test…</p>
    </div>
  );

  if (phase === 'error') return (
    <div className={styles.centered}>
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
      <h2 style={{ color: 'var(--gold2)', fontFamily: 'Playfair Display, serif', marginBottom: '0.5rem' }}>Something went wrong</h2>
      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>{errorMsg}</p>
      <button className="btn-primary" onClick={() => router.push('/')}>← Back to Home</button>
    </div>
  );

  return (
    <div className={styles.testWrap}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.brand}>PMP Mock Exam</div>
        <div className={styles.headerMeta}>
          <span className={styles.qCounter}>Q {currentQ + 1} / {questions.length}</span>
          <span className={`${styles.timer} ${timerClass}`}>⏱ {mm}:{ss}</span>
        </div>
      </header>

      {/* Progress bar */}
      <div className={styles.progressTrack}>
        <div className={styles.progressBar} style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
      </div>

      {/* Body */}
      <div className={styles.body}>
        <div className={styles.qMeta}>
          <span className={styles.qNum}>Question {currentQ + 1} of {questions.length}</span>
          <span className={styles.qDomain}>{q?.domain}</span>
          {q?.difficulty && (
            <span className={`${styles.qDiff} ${styles[q.difficulty] || ''}`}>{q.difficulty}</span>
          )}
        </div>

        <p className={styles.qText}>{q?.q}</p>

        <ul className={styles.optionsList}>
          {q?.options.map((opt, i) => {
            const answered = answers[currentQ] !== null;
            let cls = styles.optionBtn;
            if (answered && i === answers[currentQ]) cls += ' ' + styles.selected;
            return (
              <li key={i}>
                <button
                  className={cls}
                  onClick={() => selectAnswer(i)}
                  disabled={answered}
                >
                  <span className={styles.letter}>{LETTERS[i]}</span>
                  <span>{opt}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {answers[currentQ] !== null && (
          <div className={styles.answerNote}>
            ✓ Answer recorded — explanations shown after test submission
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.dots}>
          {answers.map((a, i) => (
            <div key={i} className={`${styles.dot} ${i === currentQ ? styles.dotActive : ''} ${a !== null ? styles.dotDone : ''}`} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {currentQ > 0 && (
            <button className="btn-secondary" style={{ padding: '10px 18px', fontSize: '0.85rem' }} onClick={() => { setCurrentQ(prev => prev - 1); setSelected(answers[currentQ - 1]); }}>
              ← Prev
            </button>
          )}
          <button
            className="btn-primary"
            style={{ padding: '11px 22px', fontSize: '0.9rem' }}
            onClick={nextQuestion}
            disabled={answers[currentQ] === null}
          >
            {currentQ === questions.length - 1 ? 'Submit Test →' : 'Next →'}
          </button>
        </div>
      </footer>
    </div>
  );
}

export default function TestPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><span className="spinner" /></div>}>
      <TestPageInner />
    </Suspense>
  );
}
