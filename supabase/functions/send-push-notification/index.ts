import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type NotificationKind = 'message' | 'call';

type PushRequestBody = {
  recipientId?: string;
  type?: NotificationKind;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const isExpoPushToken = (token: string) => /^ExponentPushToken\[[^\]]+\]$|^ExpoPushToken\[[^\]]+\]$/.test(token);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Missing authorization header' }, 401);
  }

  let payload: PushRequestBody;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { recipientId, type, title, body, data = {} } = payload;
  if (!recipientId || !type || !title || !body) {
    return jsonResponse({ error: 'recipientId, type, title, and body are required' }, 400);
  }

  if (type !== 'message' && type !== 'call') {
    return jsonResponse({ error: 'Unsupported notification type' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Function is missing Supabase configuration' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

  if (authError || !authData.user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const { data: recipient, error: recipientError } = await supabase
    .from('users')
    .select('push_token')
    .eq('id', recipientId)
    .maybeSingle();

  if (recipientError) {
    console.error('Recipient lookup failed:', recipientError);
    return jsonResponse({ error: 'Could not load recipient' }, 500);
  }

  const pushToken = recipient?.push_token;
  if (!pushToken) {
    return jsonResponse({ ok: true, skipped: 'recipient has no push token' });
  }

  if (!isExpoPushToken(pushToken)) {
    return jsonResponse({ ok: true, skipped: 'recipient push token is invalid' });
  }

  const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: pushToken,
      sound: 'default',
      priority: 'high',
      title,
      body,
      data: { ...data, type },
    }),
  });

  const expoResult = await expoResponse.json().catch(() => null);

  if (!expoResponse.ok) {
    console.error('Expo push failed:', expoResult);
    return jsonResponse({ error: 'Expo push request failed', details: expoResult }, 502);
  }

  return jsonResponse({ ok: true, result: expoResult });
});
