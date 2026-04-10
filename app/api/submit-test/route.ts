import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DomainResult } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { sessionId, answers, timeTakenSeconds } = await req.json();
    // answers: number[] — index of selected option per question (position-ordered)

    if (!sessionId || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify session
    const { data: session } = await supabaseAdmin
      .from('test_sessions')
      .select('id, status')
      .eq('id', sessionId)
      .single();

    if (!session || session.status === 'completed') {
      return NextResponse.json({ error: 'Invalid or already completed session' }, { status: 403 });
    }

    // Fetch stored questions (with correct answers)
    const { data: questions, error: qErr } = await supabaseAdmin
      .from('test_questions')
      .select('position, answer, domain, explanation, options, q')
      .eq('session_id', sessionId)
      .order('position');

    if (qErr || !questions) {
      return NextResponse.json({ error: 'Questions not found' }, { status: 404 });
    }

    // Score
    let correct = 0;
    const domainMap: Record<string, { c: number; t: number }> = {};
    const detailedResults: any[] = [];

    questions.forEach((q, i) => {
      const userAnswer = answers[i] ?? -1;
      const isCorrect = userAnswer === q.answer;
      if (isCorrect) correct++;

      const d = q.domain || 'General';
      if (!domainMap[d]) domainMap[d] = { c: 0, t: 0 };
      domainMap[d].t++;
      if (isCorrect) domainMap[d].c++;

      detailedResults.push({
        position: i,
        q: q.q,
        options: q.options,
        userAnswer,
        correctAnswer: q.answer,
        isCorrect,
        explanation: q.explanation,
        domain: q.domain,
      });
    });

    const total = questions.length;
    const score = Math.round((correct / total) * 100);
    const pass = score >= 61; // PMI passing threshold

    const domainResults: DomainResult[] = Object.entries(domainMap).map(([domain, v]) => ({
      domain,
      correct: v.c,
      total: v.t,
      pct: Math.round((v.c / v.t) * 100),
    }));

    // Save results
    await supabaseAdmin
      .from('test_sessions')
      .update({
        status: 'completed',
        score,
        correct_answers: correct,
        time_taken_seconds: timeTakenSeconds || null,
        domain_results: domainResults,
        completed_at: new Date().toISOString(),
        passed: pass,
        detailed_results: detailedResults,
      })
      .eq('id', sessionId);

    return NextResponse.json({
      score,
      correct,
      total,
      pass,
      domainResults,
      detailedResults,
      timeTakenSeconds,
    });
  } catch (err: any) {
    console.error('Submit error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
