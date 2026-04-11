export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BATCHES = [
  {
    domain: 'People & Process',
    approach: 'Predictive',
    count: 30,
    focus: `Leadership styles: servant, transformational, situational. Team development (Tuckman). Conflict resolution — collaborative problem-solving. Stakeholder engagement. Motivation theories: Maslow, Herzberg, McGregor. Integrated change control — ALL changes need a CR. Schedule compression: fast-tracking vs crashing. Earned value: CPI, SPI, EAC. Critical path. Quality: prevention over inspection. Procurement contract types.`
  },
  {
    domain: 'People & Process',
    approach: 'Agile/Hybrid',
    count: 30,
    focus: `Servant leadership: removing impediments, not directing. Self-organizing teams. Psychological safety. Product Owner vs Scrum Master roles. Sprint planning, daily scrum, retrospective, review. Backlog refinement. Definition of done. Velocity tracking. Kanban WIP limits. Hybrid governance.`
  },
  {
    domain: 'Business Environment & Risk',
    approach: 'Predictive/Agile',
    count: 30,
    focus: `Benefits realization. Organizational change management. Project governance and stage gates. Strategic alignment: NPV, BCR, IRR. Risk vs issue distinction. Risk register vs issue log. Risk responses: avoid/transfer/mitigate/accept. Contingency vs management reserve. Residual vs secondary risks. EMV calculation. Change control board. Lessons learned throughout project lifecycle.`
  }
]

function buildBatchPrompt(batch: typeof BATCHES[0]): string {
  return `You are a senior PMI exam item writer. Generate ${batch.count} authentic PMP exam questions for: ${batch.domain} (${batch.approach}).

Focus: ${batch.focus}

PMI MINDSET — every question must reflect:
1. PROCESS FIRST: Follow the process even in a crisis
2. PROACTIVE OVER REACTIVE: Good PMs anticipate
3. COLLABORATE OVER COMMAND: Facilitate consensus
4. ESCALATE LAST: Exhaust own tools before sponsor
5. IN AGILE — TEAM DECIDES HOW: PM removes blockers only

EVERY question MUST have these four distractor types:
A) Common sense but PMI-wrong (skips process or acts unilaterally)
B) Technically valid but wrong timing
C) Escalation too early (goes to sponsor before using own authority)
D) CORRECT: follows process, facilitates, engages stakeholder, or documents properly

Include these trap patterns:
- Change request trap: verbal change request must go through ICC
- Conflict trap: facilitate resolution, don't pick sides
- Risk/issue trap: occurred risk = issue, use contingency plan + issue log
- Escalation trap: try own authority first
- Lessons learned trap: ongoing, not just at close

Return ONLY a valid JSON array. No markdown, no preamble.

[
  {
    "q": "Scenario question 3-5 sentences with real context and pressure",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": 2,
    "explanation": "4-5 sentence explanation of why correct and why others are wrong",
    "domain": "${batch.domain}",
    "approach": "${batch.approach}",
    "difficulty": "medium",
    "trap_type": "change_request_trap"
  }
]`
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json()
    if (!sessionId) return NextResponse.json({ error: 'Session ID required' }, { status: 400 })

    const { data: session, error: sessionError } = await supabase
      .from('test_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    if (session.status !== 'paid') return NextResponse.json({ error: 'Payment not verified' }, { status: 403 })

    const batchPromises = BATCHES.map(async (batch, batchIndex) => {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8000,
        messages: [{ role: 'user', content: buildBatchPrompt(batch) }]
      })
      const content = response.content[0]
      if (content.type !== 'text') throw new Error('Unexpected response type')
      let jsonText = content.text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const questions = JSON.parse(jsonText)
      return { questions, batch, startIndex: batchIndex * 30 }
    })

    const batchResults = await Promise.all(batchPromises)

    const allQuestions: any[] = []
    batchResults.forEach(({ questions, batch, startIndex }) => {
      questions.slice(0, batch.count).forEach((q: any, i: number) => {
        allQuestions.push({
          session_id: sessionId,
          position: startIndex + i,
          q: q.q,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation,
          domain: q.domain || batch.domain,
          approach: q.approach || batch.approach,
          difficulty: q.difficulty || 'medium',
          trap_type: q.trap_type || null
        })
      })
    })

    const shuffled = allQuestions
      .map(q => ({ q, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map((item, index) => ({ ...item.q, position: index }))

    const { error: insertError } = await supabase.from('test_questions').insert(shuffled)
    if (insertError) return NextResponse.json({ error: 'Failed to save questions' }, { status: 500 })

    await supabase
      .from('test_sessions')
      .update({ status: 'questions_ready', total_questions: shuffled.length })
      .eq('id', sessionId)

    return NextResponse.json({ success: true, questionCount: shuffled.length })

  } catch (error) {
    console.error('Generate questions error:', error)
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
  }
}
