export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BATCH_CONFIGS = [
  { domain: 'People', approach: 'Predictive', focus: 'Leadership, conflict resolution, stakeholder engagement, motivation theories, communication planning, team development stages' },
  { domain: 'People', approach: 'Agile/Hybrid', focus: 'Servant leadership, self-organizing teams, psychological safety, Product Owner, Scrum Master, sprint ceremonies' },
  { domain: 'Process', approach: 'Predictive', focus: 'Change control, WBS, schedule compression, earned value (CPI/SPI/EAC), critical path, quality, procurement, project closure' },
  { domain: 'Process', approach: 'Agile/Hybrid', focus: 'Sprint planning, daily scrum, retrospective, backlog refinement, definition of done, velocity, kanban WIP limits' },
  { domain: 'Business Environment', approach: 'Predictive/Agile', focus: 'Benefits realization, organizational change, governance, strategic alignment, NPV/BCR/IRR, lessons learned' },
  { domain: 'Risk & Change', approach: 'Predictive/Agile', focus: 'Risk vs issue, risk register, risk responses, contingency vs management reserve, EMV, change control board, workarounds' },
]

export async function POST(request: NextRequest) {
  try {
    const { sessionId, batchIndex, startPosition } = await request.json()

    if (!sessionId) return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    if (batchIndex === undefined) return NextResponse.json({ error: 'Batch index required' }, { status: 400 })

    const { data: session, error: sessionError } = await supabase
      .from('test_sessions')
      .select('status')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    if (session.status !== 'paid' && session.status !== 'generating') return NextResponse.json({ error: 'Payment not verified' }, { status: 403 })

    // Mark as generating on first batch
    if (batchIndex === 0) {
      await supabase.from('test_sessions').update({ status: 'generating' }).eq('id', sessionId)
    }

    const batch = BATCH_CONFIGS[batchIndex]

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 5000,
      messages: [{
        role: 'user',
        content: `You are a PMI exam item writer. Generate exactly 10 PMP exam questions for domain: ${batch.domain} (${batch.approach}).

Focus: ${batch.focus}

PMI rules every question must follow:
- Process first: always follow the process even in crisis
- Escalate last: exhaust own authority before going to sponsor
- Collaborate: facilitate, don't dictate
- In agile: team decides HOW, PM removes blockers only

Every question needs these 4 distractor types:
A) Common sense but PMI-wrong (skips process or acts unilaterally)  
B) Technically valid but wrong timing
C) Escalates too early to sponsor/management
D) CORRECT: follows process, facilitates, or documents properly

Return ONLY a raw JSON array. No markdown, no explanation, start with [ end with ].

[{"q":"3-5 sentence realistic scenario with pressure","options":["A text","B text","C text","D text"],"answer":2,"explanation":"4 sentences: why correct, why each wrong answer fails","domain":"${batch.domain}","approach":"${batch.approach}","difficulty":"medium","trap_type":"escalation_trap"}]`
      }]
    })

    const content = response.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')

    let jsonText = content.text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const questions = JSON.parse(jsonText)

    const formattedQuestions = questions.slice(0, 10).map((q: any, i: number) => ({
      session_id: sessionId,
      position: startPosition + i,
      q: q.q,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
      domain: q.domain || batch.domain,
      approach: q.approach || batch.approach,
      difficulty: q.difficulty || 'medium',
      trap_type: q.trap_type || null
    }))

    const { error: insertError } = await supabase.from('test_questions').insert(formattedQuestions)
    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save questions' }, { status: 500 })
    }

    // On last batch, mark as ready
    const isLastBatch = batchIndex === BATCH_CONFIGS.length - 1
    if (isLastBatch) {
      await supabase
        .from('test_sessions')
        .update({ status: 'questions_ready', total_questions: (batchIndex + 1) * 10 })
        .eq('id', sessionId)
    }

    return NextResponse.json({ success: true, batchIndex, questionCount: formattedQuestions.length, isLastBatch })

  } catch (error) {
    console.error('Generate questions error:', error)
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
  }
}
