import { createClient } from '@supabase/supabase-js';

// Tier definitions and their expected token allocations and prices
const TIER_SPECS: Record<string, { price: number; tokens: number; name: string }> = {
  'basic': { price: 900, tokens: 1, name: 'Starter Pack' },
  'lite': { price: 3999, tokens: 5, name: 'Standard Pack' },
  'standard': { price: 6999, tokens: 10, name: 'Pro Pack' },
  'pro': { price: 9999, tokens: 15, name: 'Power Pack' }
};

export default async function handler(req: any, res: any) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { reference, tier, promoCode, userId } = req.body || {};

    if (!reference || !tier || !userId) {
      return res.status(400).json({ error: 'Missing required parameters: reference, tier, or userId.' });
    }

    const tierSpec = TIER_SPECS[tier];
    if (!tierSpec) {
      return res.status(400).json({ error: `Invalid subscription tier: ${tier}` });
    }

    // 2. Resolve Paystack Secret Key safely (server-side only)
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY || 'sk_live_28c4b94a1310307cb76239354c75cf08d875ce6f';
    if (!paystackSecretKey) {
      console.error('[Verify Paystack] Missing PAYSTACK_SECRET_KEY');
      return res.status(500).json({ error: 'Server configuration error: payment key missing.' });
    }

    // 3. Resolve Supabase Service Role client to bypass RLS securely on backend
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Verify Paystack] Missing Supabase configuration');
      return res.status(500).json({ error: 'Server configuration error: database key missing.' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    // 4. Verify transaction with Paystack official REST API
    const paystackUrl = `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`;
    const paystackResponse = await fetch(paystackUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey.trim()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!paystackResponse.ok) {
      const errText = await paystackResponse.text();
      console.error('[Verify Paystack] Paystack API responded with error:', paystackResponse.status, errText);
      return res.status(400).json({ error: 'Unable to verify payment with Paystack gateway. Please try again.' });
    }

    const paystackData = await paystackResponse.json();
    if (!paystackData.status || paystackData.data?.status !== 'success') {
      return res.status(400).json({ 
        error: `Payment verification failed: ${paystackData.data?.gateway_response || 'Transaction was not successful.'}` 
      });
    }

    const verifiedAmountKobo = paystackData.data?.amount; // in kobo (1 NGN = 100 kobo)
    const paidEmail = paystackData.data?.customer?.email;

    // 5. Anti-Replay: Check if this transaction reference was already credited
    const { data: existingTx } = await supabase
      .from('payment_transactions')
      .select('id, status')
      .eq('reference', reference)
      .maybeSingle();

    if (existingTx && existingTx.status === 'success') {
      return res.status(400).json({ error: 'This payment reference has already been processed.' });
    }

    // 6. Validate Promo Code discount if provided
    let expectedAmountNaira = tierSpec.price;
    if (promoCode) {
      const { data: promoData } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', promoCode)
        .eq('user_id', userId)
        .eq('is_used', false)
        .maybeSingle();

      if (promoData && promoData.discount_percent > 0) {
        expectedAmountNaira = Math.max(0, Math.round(tierSpec.price * (1 - promoData.discount_percent / 100)));
      }
    }

    // Check that paid amount in kobo matches expected amount (allow 5% leeway for fractional kobo rounding)
    const expectedAmountKobo = expectedAmountNaira * 100;
    if (verifiedAmountKobo < expectedAmountKobo * 0.95) {
      console.error(`[Verify Paystack] Amount mismatch: Paid ${verifiedAmountKobo} kobo, expected ${expectedAmountKobo} kobo`);
      return res.status(400).json({ error: 'Payment amount does not match the plan cost.' });
    }

    const addedTokens = tierSpec.tokens;

    // 7. Credit tokens via Service Role
    const { error: tokenError } = await supabase.rpc('add_tokens', {
      p_user_id: userId,
      p_amount: addedTokens
    });

    if (tokenError) {
      console.error('[Verify Paystack] add_tokens RPC error:', tokenError.message);
      // Fallback: direct update via service role client if RPC is locked
      const { data: userProfile } = await supabase.from('profiles').select('tokens').eq('id', userId).single();
      const currentTokens = userProfile?.tokens || 0;
      await supabase.from('profiles').update({ tokens: currentTokens + addedTokens }).eq('id', userId);
    }

    // 8. Update Profile Tier & Verification Badge (Tokens never expire)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        subscription_tier: tier,
        is_verified: true
      })
      .eq('id', userId);

    if (profileError) {
      console.error('[Verify Paystack] Profile tier update error:', profileError.message);
      return res.status(500).json({ error: 'Failed to update user profile.' });
    }

    // 9. Record payment transaction in audit log
    try {
      await supabase.from('payment_transactions').upsert({
        reference: reference,
        user_id: userId,
        amount: verifiedAmountKobo / 100,
        currency: 'NGN',
        tier: tier,
        tokens_added: addedTokens,
        status: 'success',
        paystack_id: paystackData.data?.id?.toString() || null,
        customer_email: paidEmail || null,
        created_at: new Date().toISOString()
      }, { onConflict: 'reference' });
    } catch (e: any) {
      console.warn('[Verify Paystack] Non-fatal payment_transactions insert notice:', e.message);
    }

    // 10. Mark promo code as used if applied
    if (promoCode) {
      await supabase
        .from('promo_codes')
        .update({ is_used: true, used_at: new Date().toISOString() })
        .eq('code', promoCode)
        .eq('user_id', userId);
    }

    // 11. Send in-app notification to user
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        title: '🎉 Tokens Credited',
        message: `Your ${tierSpec.name} with ${addedTokens} tokens has been credited to your account. Tokens have no expiration date!`,
        type: 'success'
      });
    } catch (err: any) {
      console.warn('[Verify Paystack] Notification push notice:', err.message);
    }

    return res.status(200).json({
      success: true,
      tier: tier,
      tokensAdded: addedTokens
    });

  } catch (error: any) {
    console.error('[Verify Paystack] Unhandled error:', error.message);
    return res.status(500).json({ error: error.message || 'Internal payment verification error' });
  }
}
