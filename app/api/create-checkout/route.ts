import { NextRequest, NextResponse } from 'next/server';
import { stripe, TEST_PRICE_CENTS, CURRENCY } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: CURRENCY,
            product_data: {
              name: PMP Mock Exam — 180 Questions
              description: 'AI-generated PMP practice test · Instant access · Explanations included',
              images: [`${baseUrl}/og-image.png`],
            },
            unit_amount: TEST_PRICE_CENTS,
          },
          quantity: 1,
        },
      ],
      metadata: { email },
      success_url: `${baseUrl}/test?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?cancelled=true`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 min to complete payment
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err: any) {
    console.error('Checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
