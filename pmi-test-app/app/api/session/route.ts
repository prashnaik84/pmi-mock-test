import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  const stripeSessionId = req.nextUrl.searchParams.get('stripe_session_id');
  const session = req.nextUrl.searchParams.get('session');

  if (!sessionId && !stripeSessionId && !session) {
    return NextResponse.json({ error: 'Missing session ID' }, { status: 400 });
  }

  let query = supabaseAdmin
    .from('test_sessions')
    .select('id, status, email, total_questions, is_free_trial, score, correct_answers, time_taken_seconds, domain_results, completed_at');

  if (session && session.startsWith('cs_')) {
    query = query.eq('stripe_session_id', session);
  } else if (session) {
    query = query.eq('id', session);
  } else if (sessionId) {
    query = query.eq('id', sessionId);
  } else {
    query = query.eq('stripe_session_id', stripeSessionId);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return NextResponse.json({ status: 'pending' });
  }

  return NextResponse.json(data);
}
