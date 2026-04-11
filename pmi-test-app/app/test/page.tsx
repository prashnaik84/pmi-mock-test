'use client'

import { Suspense } from 'react'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import styles from './exam.module.css'

interface Question {
  id: string
  position: number
  q: string
  options: string[]
  domain: string
  approach: string
  difficulty: string
}

type AnswerState = Record<number, number>
type FlagState = Record<number, boolean>
type ViewMode = 'loading' | 'ready' | 'exam' | 'review' | 'submitting'

const TOTAL_QUESTIONS = 180
const EXAM_DURATION = 240 * 60
const BREAK_POINT = 90

function ExamPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session')

  const [viewMode, setViewMode] = useState<ViewMode>('loading')
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<AnswerState>({})
  const [flags, setFlags] = useState<FlagState>({})
  const [current, setCurrent] = useState(0)
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION)
  const [showBreakPrompt, setShowBreakPrompt] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingMessage, setLoadingMessage] = useState('Initializing your exam...')
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  const loadingSteps = [
    { pct: 10, msg: 'Verifying payment...' },
    { pct: 20, msg: 'Generating People domain questions...' },
    { pct: 35, msg: 'Generating Process domain questions...' },
    { pct: 50, msg: 'Generating Business Environment questions...' },
    { pct: 65, msg: 'Generating Agile & Hybrid questions...' },
    { pct: 80, msg: 'Generating Risk & Change questions...' },
    { pct: 92, msg: 'Shuffling and finalizing 180 questions...' },
    { pct: 100, msg: 'Your exam is ready.' },
  ]

  useEffect(() => {
    if (viewMode !== 'loading') return
    let step = 0
    const advance = () => {
      if (step >= loadingSteps.length) return
      setLoadingProgress(loadingSteps[step].pct)
      setLoadingMessage(loadingSteps[step].msg)
      step++
    }
    advance()
    const interval = setInterval(advance, 3800)
    return () => clearInterval(interval)
  }, [viewMode])

  useEffect(() => {
    if (!sessionId) return
    const init = async () => {
      try {
        const sessionRes = await fetch(`/api/session?sessionId=${sessionId}`)
        const sessionData = await sessionRes.json()

        if (sessionData.status === 'questions_ready' || sessionData.status === 'completed') {
          await fetchQuestions()
          return
        }

        if (sessionData.status !== 'paid') {
          router.push('/')
          return
        }

        const genRes = await fetch('/api/generate-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        })

        if (!genRes.ok) throw new Error('Generation failed')
        await fetchQuestions()

      } catch (err) {
        console.error(err)
        setLoadingMessage('Something went wrong. Please refresh.')
      }
    }
    init()
  }, [sessionId])

  const fetchQuestions = async () => {
    const res = await fetch(`/api/questions?sessionId=${sessionId}`)
    const data = await res.json()
    if (data.questions) {
      setQuestions(data.questions)
      setLoadingProgress(100)
      setLoadingMessage('Your exam is ready.')
      setTimeout(() => setViewMode('ready'), 800)
    }
  }

  useEffect(() => {
    if (viewMode !== 'exam') return
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          handleSubmit(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [viewMode])

  useEffect(() => {
    if (current === BREAK_POINT && viewMode === 'exam' && !showBreakPrompt) {
      setShowBreakPrompt(true)
    }
  }, [current, viewMode])

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`
  }

  const timeWarning = timeLeft < 1800

  const selectAnswer = (optionIndex: number) => {
    setAnswers(prev => ({ ...prev, [current]: optionIndex }))
  }

  const toggleFlag = () => {
    setFlags(prev => ({ ...prev, [current]: !prev[current] }))
  }

  const goTo = (index: number) => {
    setCurrent(index)
  }

  const answeredCount = Object.keys(answers).length
  const flaggedCount = Object.values(flags).filter(Boolean).length
  const unansweredCount = TOTAL_QUESTIONS - answeredCount

  const handleSubmit = async (timeExpired = false) => {
    if (timerRef.current) clearInterval(timerRef.current)
    const timeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000)
    setViewMode('submitting')

    try {
      const res = await fetch('/api/submit-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, answers, timeTaken, timeExpired })
      })
      const data = await res.json()
      if (data.success) {
        router.push(`/results/${data.sessionId}`)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const q = questions[current]

  if (viewMode === 'loading') {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingContent}>
          <div className={styles.loadingLogo}>PMP<span>®</span></div>
          <h2 className={styles.loadingTitle}>Building Your Exam</h2>
          <p className={styles.loadingMsg}>{loadingMessage}</p>
          <div className={styles.progressTrack}>
            <div className={styles.progressBar} style={{ width: `${loadingProgress}%` }} />
          </div>
          <p className={styles.loadingHint}>
            Generating 180 AI-powered situational questions across all PMI domains.<br />
            This takes about 30 seconds. Do not close this tab.
          </p>
        </div>
      </div>
    )
  }

  if (viewMode === 'ready') {
    return (
      <div className={styles.readyScreen}>
        <div className={styles.readyCard}>
          <div className={styles.readyBadge}>Full Simulation</div>
          <h1 className={styles.readyTitle}>PMP® Practice Exam</h1>
          <div className={styles.readyStats}>
            <div className={styles.readyStat}>
              <span className={styles.readyNum}>180</span>
              <span className={styles.readyLabel}>Questions</span>
            </div>
            <div className={styles.readyStat}>
              <span className={styles.readyNum}>4:00</span>
              <span className={styles.readyLabel}>Hours</span>
            </div>
            <div className={styles.readyStat}>
              <span className={styles.readyNum}>61%</span>
              <span className={styles.readyLabel}>Pass threshold</span>
            </div>
          </div>
          <div className={styles.readyRules}>
            <div className={styles.rule}>Questions are situational — read every word carefully</div>
            <div className={styles.rule}>You can flag questions and return to them</div>
            <div className={styles.rule}>An optional break is available at question 90</div>
            <div className={styles.rule}>Timer begins when you click Start Exam</div>
          </div>
          <button className={styles.startBtn} onClick={() => setViewMode('exam')}>
            Start Exam
          </button>
          <p className={styles.disclaimer}>
            Independent practice tool — not affiliated with or endorsed by PMI®
          </p>
        </div>
      </div>
    )
  }

  if (viewMode === 'review') {
    return (
      <div className={styles.reviewScreen}>
        <div className={styles.reviewContent}>
          <h2 className={styles.reviewTitle}>Review Your Answers</h2>
          <div className={styles.reviewSummary}>
            <div className={styles.reviewStat}>
              <span className={styles.rsNum}>{answeredCount}</span>
              <span className={styles.rsLabel}>Answered</span>
            </div>
            <div className={styles.reviewStat}>
              <span className={styles.rsNum} style={{color:'var(--color-text-warning)'}}>{flaggedCount}</span>
              <span className={styles.rsLabel}>Flagged</span>
            </div>
            <div className={styles.reviewStat}>
              <span className={styles.rsNum} style={{color:'var(--color-text-danger)'}}>{unansweredCount}</span>
              <span className={styles.rsLabel}>Unanswered</span>
            </div>
          </div>
          <div className={styles.reviewGrid}>
            {Array.from({ length: TOTAL_QUESTIONS }, (_, i) => (
              <button
                key={i}
                className={`${styles.reviewDot} ${
                  flags[i] ? styles.dotFlagged :
                  answers[i] !== undefined ? styles.dotAnswered :
                  styles.dotEmpty
                }`}
                onClick={() => { setCurrent(i); setViewMode('exam') }}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className={styles.reviewActions}>
            <button className={styles.backBtn} onClick={() => setViewMode('exam')}>
              Return to Exam
            </button>
            <button className={styles.submitBtn} onClick={() => handleSubmit(false)}>
              Submit Exam
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (viewMode === 'submitting') {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingContent}>
          <div className={styles.loadingLogo}>PMP<span>®</span></div>
          <h2 className={styles.loadingTitle}>Scoring Your Exam</h2>
          <p className={styles.loadingMsg}>Calculating your results across all domains...</p>
          <div className={styles.progressTrack}>
            <div className={styles.progressBar} style={{ width: '70%' }} />
          </div>
        </div>
      </div>
    )
  }

  if (!q) return null

  return (
    <div className={styles.examShell}>
      <header className={styles.topBar}>
        <div className={styles.topLeft}>
          <span className={styles.examBrand}>PMP® Practice Exam</span>
        </div>
        <div className={styles.topCenter}>
          <span className={styles.qCounter}>
            Question {current + 1} of {TOTAL_QUESTIONS}
          </span>
        </div>
        <div className={styles.topRight}>
          <span className={`${styles.timer} ${timeWarning ? styles.timerWarn : ''}`}>
            ⏱ {formatTime(timeLeft)}
          </span>
        </div>
      </header>

      <div className={styles.progressStrip}>
        <div
          className={styles.progressFill}
          style={{ width: `${(answeredCount / TOTAL_QUESTIONS) * 100}%` }}
        />
      </div>

      <div className={styles.examBody}>
        <main className={styles.questionPanel}>
          <div className={styles.questionMeta}>
            <span className={styles.domainTag}>{q.domain}</span>
            <span className={styles.approachTag}>{q.approach}</span>
            <span className={`${styles.diffTag} ${styles['diff_' + q.difficulty]}`}>
              {q.difficulty}
            </span>
            {flags[current] && <span className={styles.flaggedTag}>⚑ Flagged</span>}
          </div>

          <p className={styles.questionText}>{q.q}</p>

          <div className={styles.optionsList}>
            {q.options.map((opt, i) => (
              <button
                key={i}
                className={`${styles.optionBtn} ${answers[current] === i ? styles.optionSelected : ''}`}
                onClick={() => selectAnswer(i)}
              >
                <span className={styles.optionLetter}>{String.fromCharCode(65 + i)}</span>
                <span className={styles.optionText}>{opt}</span>
              </button>
            ))}
          </div>

          <div className={styles.questionActions}>
            <button className={styles.flagBtn} onClick={toggleFlag}>
              {flags[current] ? '⚑ Unflag' : '⚐ Flag for Review'}
            </button>
            <div className={styles.navBtns}>
              <button
                className={styles.navBtn}
                disabled={current === 0}
                onClick={() => setCurrent(c => c - 1)}
              >
                ← Previous
              </button>
              {current < TOTAL_QUESTIONS - 1 ? (
                <button
                  className={`${styles.navBtn} ${styles.navNext}`}
                  onClick={() => setCurrent(c => c + 1)}
                >
                  Next →
                </button>
              ) : (
                <button
                  className={`${styles.navBtn} ${styles.navFinish}`}
                  onClick={() => setViewMode('review')}
                >
                  Review & Submit
                </button>
              )}
            </div>
          </div>
        </main>

        <aside className={styles.sidebar}>
          <div className={styles.sidebarSection}>
            <div className={styles.sidebarLabel}>Progress</div>
            <div className={styles.sidebarStats}>
              <div className={styles.ss}>
                <span className={styles.ssNum}>{answeredCount}</span>
                <span className={styles.ssLbl}>answered</span>
              </div>
              <div className={styles.ss}>
                <span className={styles.ssNum} style={{color:'var(--color-text-warning)'}}>{flaggedCount}</span>
                <span className={styles.ssLbl}>flagged</span>
              </div>
              <div className={styles.ss}>
                <span className={styles.ssNum} style={{color:'var(--color-text-danger)'}}>{unansweredCount}</span>
                <span className={styles.ssLbl}>remaining</span>
              </div>
            </div>
          </div>

          <div className={styles.sidebarSection}>
            <div className={styles.sidebarLabel}>Quick Jump</div>
            <div className={styles.miniGrid}>
              {Array.from({ length: TOTAL_QUESTIONS }, (_, i) => (
                <button
                  key={i}
                  className={`${styles.miniDot} ${
                    i === current ? styles.miniCurrent :
                    flags[i] ? styles.miniFlagged :
                    answers[i] !== undefined ? styles.miniAnswered :
                    styles.miniEmpty
                  }`}
                  onClick={() => goTo(i)}
                  title={`Q${i + 1}`}
                />
              ))}
            </div>
            <div className={styles.gridLegend}>
              <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.miniAnswered}`}/> answered</span>
              <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.miniFlagged}`}/> flagged</span>
              <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.miniEmpty}`}/> unanswered</span>
            </div>
          </div>

          <button className={styles.reviewBtn} onClick={() => setViewMode('review')}>
            Review & Submit
          </button>
        </aside>
      </div>

      {showBreakPrompt && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>Optional Break</h3>
            <p className={styles.modalBody}>
              You have completed the first 90 questions — halfway through the exam.
              The real PMP exam offers an optional 10-minute break at this point.
              Your timer continues during the break.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.modalDismiss} onClick={() => setShowBreakPrompt(false)}>
                Continue Exam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ExamPageWrapper() {
  return (
    <Suspense fallback={<div style={{background:'#0a0c10',minHeight:'100vh'}}/>}>
      <ExamPage />
    </Suspense>
  )
}