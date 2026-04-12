import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  const { data: session } = await supabaseAdmin
    .from('test_sessions')
    .select('status, detailed_results')
    .eq('id', sessionId)
    .single();

  if (!session || session.status !== 'completed') {
    return NextResponse.json({ error: 'Test not completed' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('test_questions')
    .select('position, q, options, answer, explanation, domain, approach, difficulty')
    .eq('session_id', sessionId)
    .order('position', { ascending: true });

  if (error || !data) {
    return NextResponse.json({ error: 'Questions not found' }, { status: 404 });
  }

  const userAnswers: Record<number, number> = {};
  if (session.detailed_results) {
    session.detailed_results.forEach((r: any) => {
      userAnswers[r.position] = r.userAnswer;
    });
  }

  return NextResponse.json({ questions: data, userAnswers });
}