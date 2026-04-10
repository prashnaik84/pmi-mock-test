import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const stripeSessionId = req.nextUrl.searchParams.get('stripe_session_id');

  if (!stripeSessionId) {
    return NextResponse.json({ error: 'Missing stripe_session_id' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('test_sessions')
    .select('id, status, email, total_questions, score, correct_answers, time_taken_seconds, domain_results, completed_at')
    .eq('stripe_session_id', stripeSessionId)
    .single();

  if (error || !data) {
    // Webhook might be slightly delayed — return pending state
    return NextResponse.json({ status: 'pending' });
  }

  return NextResponse.json(data);
}
