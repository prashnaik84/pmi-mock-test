import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('test_questions')
    .select('id, position, q, options, domain, approach, difficulty')
    .eq('session_id', sessionId)
    .order('position', { ascending: true });

  if (error || !data) {
    return NextResponse.json({ error: 'Questions not found' }, { status: 404 });
  }

  return NextResponse.json({ questions: data });
}
