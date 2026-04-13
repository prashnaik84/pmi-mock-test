import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    // Check if email already used free trial
    const { data: existing } = await supabaseAdmin
      .from('test_sessions')
      .select('id')
      .eq('email', email)
      .eq('is_free_trial', true)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Free trial already used for this email' }, { status: 403 });
    }

    // Create free trial session
    const { data, error } = await supabaseAdmin
      .from('test_sessions')
      .insert({
        email,
        status: 'paid',
        is_free_trial: true,
        stripe_session_id: `free_trial_${Date.now()}`
      })
      .select('id')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    return NextResponse.json({ sessionId: data.id });

  } catch (err) {
    console.error('Free trial error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
