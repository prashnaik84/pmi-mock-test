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
    domain: 'People',
    approach: 'Predictive',
    count: 30,
    focus: `Leadership styles and when to apply them (servant, transformational, situational).
Team development stages (Tuckman: forming/storming/norming/performing).
Conflict resolution techniques with emphasis on collaborative problem-solving.
Stakeholder engagement: moving stakeholders from resistant to neutral to supportive.
Power and influence in matrix organizations.
Motivation theories: Maslow, Herzberg, McGregor Theory X/Y, expectancy theory.
Communication planning: formal vs informal, push vs pull, channels formula n(n-1)/2.
Virtual team management, cultural differences, ground rules.`
  },
  {
    domain: 'People',
    approach: 'Agile/Hybrid',
    count: 30,
    focus: `Servant leadership: removing impediments, not directing work.
Self-organizing teams: the PM/SM facilitates, the team decides HOW.
Psychological safety: creating environments where teams can fail fast and learn.
Agile coaching vs. managing: coaching questions vs. giving answers.
Cross-functional team dynamics and T-shaped skills.
Product Owner role: backlog ownership, prioritization by value, stakeholder communication.
Scrum Master role: facilitating ceremonies, removing blockers, protecting the team.
Hybrid team challenges: blending waterfall governance with agile execution.`
  },
  {
    domain: 'Process',
    approach: 'Predictive',
    count: 30,
    focus: `Integrated change control: ALL changes require a change request — no exceptions.
Project charter vs. project management plan: what goes where.
WBS creation and decomposition to work packages.
Schedule compression: fast-tracking (parallel) vs. crashing (resources).
Earned value: CPI, SPI, EAC, VAC formulas and what they mean.
Critical path method: float, critical path, near-critical paths.
Quality: prevention over inspection, cost of quality, control charts.
Procurement: contract types, SOW, buyer/seller risks.
Closing: lessons learned, final reports, formal acceptance.`
  },
  {
    domain: 'Process',
    approach: 'Agile/Hybrid',
    count: 30,
    focus: `Sprint planning: capacity vs. velocity, committing to sprint goal not task list.
Daily scrum: 3 questions, 15 minutes, team-owned — not a status meeting for the PM.
Sprint review: demonstrating working software to stakeholders, getting feedback.
Sprint retrospective: inspect and adapt the process — team psychological safety critical.
Backlog refinement: right level of detail, just enough, just in time (JIT).
Definition of done vs. acceptance criteria: team-level vs. story-level.
Release planning: fixed date vs. fixed scope trade-offs.
Velocity tracking: don't use velocity as a performance metric or pressure tool.
Kanban: WIP limits, flow efficiency, cycle time vs. lead time.`
  },
  {
    domain: 'Business Environment',
    approach: 'Predictive/Agile',
    count: 30,
    focus: `Benefits realization: project delivers outputs, the business realizes benefits.
Organizational change management: ADKAR model, resistance patterns.
Project governance: steering committees, stage gates, decision rights.
Regulatory compliance: PM responsibilities when legal/regulatory constraints apply.
Strategic alignment: project selection methods (BCR, NPV, IRR, payback period).
Project vs. program vs. portfolio distinctions.
Organizational structures: functional to matrix to projectized and PM authority levels.
Lessons learned: capturing, storing, and actually using them in future projects.
Sustainability and ESG considerations in project delivery.`
  },
  {
    domain: 'Risk & Change',
    approach: 'Predictive/Agile',
    count: 30,
    focus: `Risk vs. issue distinction: risk is future/uncertain, issue is present/certain.
Risk register vs. issue log: what goes where and when.
Risk response strategies: avoid, transfer, mitigate, accept (threats); exploit, share, enhance, accept (opportunities).
Contingency reserve (for known unknowns) vs. management reserve (unknown unknowns).
Residual risks (after response) vs. secondary risks (caused by response).
Qualitative analysis: probability/impact matrix, risk urgency.
Quantitative: Monte Carlo simulation, decision tree, EMV calculation.
Change control board: composition, authority, escalation paths.
Workarounds: unplanned responses to risks that did not have response plans.
Agile risk: how backlogs and retrospectives serve as risk management tools.`
  }
]

function buildBatchPrompt(batch: typeof BATCHES[0], batchIndex: number): string {
  return `You are a senior PMI exam item writer with 20 years of experience. You have written questions for the actual PMP certification exam. You understand precisely how PMI thinks and exactly how test-takers' minds are trapped.

Generate ${batch.count} authentic PMP exam questions for the domain: ${batch.domain} (${batch.approach} approach).

Focus areas for this batch:
${batch.focus}

CRITICAL: THE PMI MINDSET YOU MUST ENCODE

PMI's worldview — every question must reflect these:
1. PROCESS FIRST: Even in a crisis, follow the process. Never skip change control.
2. PROACTIVE OVER REACTIVE: A good PM anticipates; a bad PM reacts.
3. COLLABORATE OVER COMMAND: Facilitate consensus; don't dictate answers.
4. ENGAGE STAKEHOLDERS, DON'T JUST INFORM THEM: Two-way communication always.
5. DOCUMENT EVERYTHING: If it's not written down, it didn't happen.
6. ESCALATE LAST, NOT FIRST: Exhaust your own tools before running to the sponsor.
7. IN AGILE — THE TEAM DECIDES HOW: The PM/SM removes blockers, does not assign tasks.
8. VALUE DELIVERY OVER SCHEDULE/COST: PMI cares about delivering business value.

THE ANATOMY OF A PMI TRAP (MANDATORY)

Every question MUST contain exactly these four answer types:

TYPE A — "Common Sense but PMI-Wrong": What a real PM might intuitively do. Sounds practical. Violates a PMI principle.

TYPE B — "Technically Valid but Wrong Timing": A legitimate PM activity, but not what should happen NOW.

TYPE C — "Escalation Too Early": Going to the sponsor before the PM has used their own authority and tools.

TYPE D — CORRECT ANSWER: Involves (a) following the formal process, (b) facilitating collaboration, (c) proactively engaging the stakeholder, (d) updating the right document, or (e) asking a clarifying question before acting.

SCENARIO CONSTRUCTION RULES

- Every scenario must feel REAL with a project context
- Include emotional/political pressure
- NEVER make the correct answer obvious
- Vary question stems: "What should the PM do FIRST?", "What is the BEST course of action?", "What should the PM do NEXT?"
- Mix easy (30%), medium (50%), hard (20%)

REQUIRED JSON OUTPUT FORMAT

Return ONLY a valid JSON array. No markdown, no preamble. Just the raw JSON array starting with [ and ending with ].

[
  {
    "q": "Full scenario question text.",
    "options": [
      "Option A text",
      "Option B text",
      "Option C text",
      "Option D text"
    ],
    "answer": 2,
    "explanation": "Detailed explanation of why this is correct and why each wrong answer fails.",
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

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    const { data: session, error: sessionError } = await supabase
      .from('test_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.status !== 'paid') {
      return NextResponse.json({ error: 'Payment not verified' }, { status: 403 })
    }

    const batchPromises = BATCHES.map(async (batch, batchIndex) => {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: buildBatchPrompt(batch, batchIndex)
          }
        ]
      })

      const content = response.content[0]
      if (content.type !== 'text') throw new Error('Unexpected response type')

      let jsonText = content.text.trim()
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

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

    const { error: insertError } = await supabase
      .from('test_questions')
      .insert(shuffled)

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save questions' }, { status: 500 })
    }

    await supabase
      .from('test_sessions')
      .update({
        status: 'questions_ready',
        total_questions: 180
      })
      .eq('id', sessionId)

    return NextResponse.json({ success: true, questionCount: shuffled.length })

  } catch (error) {
    console.error('Generate questions error:', error)
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
  }
}