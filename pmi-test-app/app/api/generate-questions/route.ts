import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase';
import { Question, ClientQuestion } from '@/types';

const client = new Anthropic();

const PROMPT = `Generate exactly 20 unique PMP exam-style practice questions.
Cover these 5 domains evenly (4 questions each):
1. People (Leadership, Team Management, Stakeholder Engagement)
2. Process (PM Methods, Planning, Execution, Monitoring)
3. Business Environment (Strategy, Compliance, Benefits Realization)
4. Agile & Hybrid Approaches (Scrum, Kanban, Hybrid Delivery)
5. Risk & Change Management (Risk Analysis, Change Control, Issue Resolution)

Each question must be:
- Situational / scenario-based (not just definitions)
- Realistic to the PMP Exam Content Outline 2021+
- Mixed difficulty (include easy, medium, hard labels)

Respond ONLY with a valid JSON array — no preamble, no markdown fences, no trailing text.
Schema for each item:
{
  "q": "Full situational question text",
  "options": ["Option A full text", "Option B full text", "Option C full text", "Option D full text"],
  "answer": 0,
  "explanation": "Concise explanation of why this answer is correct and why others are wrong",
  "domain": "exact domain name from the 5 above",
  "difficulty": "easy" | "medium" | "hard"
}
Generate all 20 now.`;

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    // Verify session exists and is paid
    const { data: session, error: sessionErr } = await supabaseAdmin
      .from('test_sessions')
      .select('id, status')
      .eq('id', sessionId)
      .single();

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!['paid', 'questions_ready'].includes(session.status)) {
      return NextResponse.json({ error: 'Session not authorized' }, { status: 403 });
    }

    // If questions already generated, return them
    if (session.status === 'questions_ready') {
      const { data: existingQs } = await supabaseAdmin
        .from('test_questions')
        .select('id, q, options, domain, difficulty')
        .eq('session_id', sessionId)
        .order('position');

      return NextResponse.json({ questions: existingQs });
    }

    // Generate questions via Claude
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 8000,
      messages: [{ role: 'user', content: PROMPT }],
    });

    const raw = (message.content[0] as any).text.trim().replace(/```json|```/g, '').trim();
    const questions: Question[] = JSON.parse(raw);

    if (!Array.isArray(questions) || questions.length < 20) {
      return NextResponse.json({ error: 'Invalid questions generated' }, { status: 500 });
    }

    // Save questions to Supabase (with answers stored server-side)
    const rows = questions.slice(0, 20).map((q, i) => ({
      session_id: sessionId,
      position: i,
      q: q.q,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
      domain: q.domain,
      difficulty: q.difficulty || 'medium',
    }));

    const { error: insertErr } = await supabaseAdmin.from('test_questions').insert(rows);

    if (insertErr) {
      console.error('Question insert error:', insertErr);
      return NextResponse.json({ error: 'Failed to save questions' }, { status: 500 });
    }

    // Update session status
    await supabaseAdmin
      .from('test_sessions')
      .update({ status: 'questions_ready' })
      .eq('id', sessionId);

    // Return questions WITHOUT answers (client never sees correct answers)
    const clientQuestions: ClientQuestion[] = rows.map((q, i) => ({
      id: `q_${i}`,
      q: q.q,
      options: q.options,
      domain: q.domain,
      difficulty: q.difficulty,
    }));

    return NextResponse.json({ questions: clientQuestions });
  } catch (err: any) {
    console.error('Generate questions error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
