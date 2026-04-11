import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PASS_THRESHOLD = 0.61
const TOTAL_QUESTIONS = 180

interface AnswerPayload {
  [position: string]: number
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, answers, timeTaken, timeExpired } = await request.json() as {
      sessionId: string
      answers: AnswerPayload
      timeTaken: number
      timeExpired?: boolean
    }

    const { data: questions, error: qError } = await supabase
      .from('test_questions')
      .select('position, answer, domain, approach, difficulty, trap_type')
      .eq('session_id', sessionId)
      .order('position', { ascending: true })

    if (qError || !questions || questions.length === 0) {
      return NextResponse.json({ error: 'Questions not found' }, { status: 404 })
    }

    let correct = 0
    const domainMap: Record<string, { correct: number; total: number }> = {}
    const approachMap: Record<string, { correct: number; total: number }> = {}
    const trapMap: Record<string, { correct: number; total: number }> = {}
    const detailedResults: any[] = []

    questions.forEach(q => {
      const userAnswer = answers[q.position] ?? null
      const isCorrect = userAnswer === q.answer
      if (isCorrect) correct++

      detailedResults.push({
        position: q.position,
        userAnswer,
        correctAnswer: q.answer,
        isCorrect,
        domain: q.domain,
        approach: q.approach,
        difficulty: q.difficulty,
        trap_type: q.trap_type
      })

      if (!domainMap[q.domain]) domainMap[q.domain] = { correct: 0, total: 0 }
      domainMap[q.domain].total++
      if (isCorrect) domainMap[q.domain].correct++

      if (!approachMap[q.approach]) approachMap[q.approach] = { correct: 0, total: 0 }
      approachMap[q.approach].total++
      if (isCorrect) approachMap[q.approach].correct++

      if (q.trap_type) {
        if (!trapMap[q.trap_type]) trapMap[q.trap_type] = { correct: 0, total: 0 }
        trapMap[q.trap_type].total++
        if (isCorrect) trapMap[q.trap_type].correct++
      }
    })

    const totalAnswered = questions.length
    const score = Math.round((correct / totalAnswered) * 100)
    const passed = score >= Math.round(PASS_THRESHOLD * 100)

    const getPerformanceBand = (pct: number): string => {
      if (pct >= 80) return 'Above Target'
      if (pct >= 61) return 'Target'
      if (pct >= 45) return 'Below Target'
      return 'Needs Improvement'
    }

    const domainResults = Object.entries(domainMap).map(([domain, data]) => ({
      domain,
      correct: data.correct,
      total: data.total,
      percentage: Math.round((data.correct / data.total) * 100),
      band: getPerformanceBand(Math.round((data.correct / data.total) * 100))
    }))

    const approachResults = Object.entries(approachMap).map(([approach, data]) => ({
      approach,
      correct: data.correct,
      total: data.total,
      percentage: Math.round((data.correct / data.total) * 100)
    }))

    const trapResults = Object.entries(trapMap)
      .map(([trap, data]) => ({
        trap,
        correct: data.correct,
        total: data.total,
        percentage: Math.round((data.correct / data.total) * 100)
      }))
      .sort((a, b) => a.percentage - b.percentage)

    const { error: updateError } = await supabase
      .from('test_sessions')
      .update({
        status: 'completed',
        score,
        correct_answers: correct,
        total_questions: totalAnswered,
        time_taken_seconds: timeTaken,
        passed,
        time_expired: timeExpired || false,
        domain_results: domainResults,
        approach_results: approachResults,
        trap_results: trapResults,
        detailed_results: detailedResults,
        completed_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Failed to save results' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      sessionId,
      score,
      correct,
      total: totalAnswered,
      passed,
      domainResults,
      approachResults,
      trapResults
    })

  } catch (error) {
    console.error('Submit test error:', error)
    return NextResponse.json({ error: 'Failed to submit test' }, { status: 500 })
  }
}