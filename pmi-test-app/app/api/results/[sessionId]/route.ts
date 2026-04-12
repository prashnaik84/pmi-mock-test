import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const { sessionId } = params;

  const { data, error } = await supabaseAdmin
    .from('test_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Results not found' }, { status: 404 });
  }

  if (data.status !== 'completed') {
    return NextResponse.json({ error: 'Test not yet completed' }, { status: 400 });
  }

  // Fetch full questions with options and explanations
  const { data: questions } = await supabaseAdmin
    .from('test_questions')
    .select('position, q, options, answer, explanation, domain, approach, difficulty')
    .eq('session_id', sessionId)
    .order('position', { ascending: true });

  // Merge question details into detailed_results
  if (questions && data.detailed_results) {
    const questionMap: Record<number, any> = {};
    questions.forEach(q => { questionMap[q.position] = q; });

    data.detailed_results = data.detailed_results.map((r: any) => {
      const q = questionMap[r.position];
      return {
        ...r,
        q: q?.q || '',
        options: q?.options || [],
        explanation: q?.explanation || ''
      };
    });
  }

  return NextResponse.json(data);
}
