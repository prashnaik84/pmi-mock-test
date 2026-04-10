import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;

  const { data, error } = await supabaseAdmin
    .from('test_sessions')
    .select('id, email, score, correct_answers, total_questions, time_taken_seconds, domain_results, passed, detailed_results, completed_at, status')
    .eq('id', sessionId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Results not found' }, { status: 404 });
  }

  if (data.status !== 'completed') {
    return NextResponse.json({ error: 'Test not yet completed' }, { status: 400 });
  }

  return NextResponse.json(data);
}
