export const runtime = "nodejs";
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import Stripe from 'stripe';

// Must disable Next.js body parser to get raw body for Stripe signature verification

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status === 'paid') {
      const email = session.metadata?.email || session.customer_email || '';

      // Create a test session record in Supabase
      const { error } = await supabaseAdmin
        .from('test_sessions')
        .insert({
          stripe_session_id: session.id,
          email,
          status: 'paid',
          total_questions: 20,
        });

      if (error) {
        console.error('Supabase insert error:', error);
        return NextResponse.json({ error: 'DB insert failed' }, { status: 500 });
      }

      console.log(`✅ Test session created for ${email} — Stripe: ${session.id}`);
    }
  }

  return NextResponse.json({ received: true });
}
