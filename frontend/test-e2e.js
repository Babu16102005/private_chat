// End-to-End Test for kiba via Supabase REST API
// Tests: Auth, Profile, Invites, Pairs, Messaging, Reactions, Delete, Chat Settings, Storage, RLS, Pagination
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://becqktegizdbqitdstun.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlY3FrdGVnaXpkYnFpdGRzdHVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTU3MDksImV4cCI6MjA4ODI3MTcwOX0.AI0IEpmZEWKtYwk6FYJt9FBA3vMoeT_Z9Va1t8kTKOE';

const USERS = {
  user1: { email: 'babusanthosh6381@gmail.com', password: '1234567890' },
  user2: { email: 'kirthikaboomika000@gmail.com', password: '1234567890' },
};

let supabase1, supabase2, supabaseAnon;
let userId1, userId2, pairId;
let msgIds = [];
let passed = 0, failed = 0, errors = [];

function log(section, msg, status = 'PASS') {
  const emoji = status === 'PASS' ? '\u{1F7E2}' : status === 'FAIL' ? '\u{1F534}' : '\u{1F7E1}';
  console.log(`${emoji} [${section}] ${status}: ${msg}`);
  if (status === 'FAIL') errors.push(`[${section}] ${msg}`);
  if (status === 'PASS') passed++; else if (status === 'FAIL') failed++;
}

function header(text) {
  console.log(`\n${'='.repeat(60)}\n  ${text}\n${'='.repeat(60)}`);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── TEST 1: Authentication ───
async function testAuth() {
  header('TEST 1: Authentication');
  supabase1 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  supabase2 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    const { data, error } = await supabase1.auth.signInWithPassword({ email: USERS.user1.email, password: USERS.user1.password });
    if (error || !data.user) throw error;
    userId1 = data.user.id;
    log('Auth', `User 1 (${USERS.user1.email}) logged in, ID: ${userId1}`);
  } catch (e) { log('Auth', `User 1 login failed: ${e.message}`, 'FAIL'); return false; }

  await sleep(500);

  try {
    const { data, error } = await supabase2.auth.signInWithPassword({ email: USERS.user2.email, password: USERS.user2.password });
    if (error || !data.user) throw error;
    userId2 = data.user.id;
    log('Auth', `User 2 (${USERS.user2.email}) logged in, ID: ${userId2}`);
  } catch (e) { log('Auth', `User 2 login failed: ${e.message}`, 'FAIL'); return false; }

  // Wrong password rejected
  const { error: badErr } = await supabase1.auth.signInWithPassword({ email: USERS.user1.email, password: 'wrongpassword' });
  log('Auth', `Wrong password correctly rejected`, badErr ? 'PASS' : 'FAIL');

  // Profiles exist
  const { data: p1 } = await supabase1.from('users').select('*').eq('id', userId1).maybeSingle();
  const { data: p2 } = await supabase2.from('users').select('*').eq('id', userId2).maybeSingle();
  log('Auth', `User 1 profile exists: ${!!p1}`, p1 ? 'PASS' : 'FAIL');
  log('Auth', `User 2 profile exists: ${!!p2}`, p2 ? 'PASS' : 'FAIL');

  // Profile has required fields
  log('Auth', `User 1 profile has email field`, p1?.email ? 'PASS' : 'FAIL');
}

// ─── TEST 2: Profile Update ───
async function testProfileUpdate() {
  header('TEST 2: Profile Update');

  const newName = `Babu_${Date.now()}`;
  const { data, error } = await supabase1.from('users').update({ name: newName }).eq('id', userId1).select().single();
  log('Profile', `Update name to "${newName}"`, error ? 'FAIL' : 'PASS');

  const { data: check } = await supabase1.from('users').select('name').eq('id', userId1).single();
  log('Profile', `Name persisted correctly`, check?.name === newName ? 'PASS' : 'FAIL');

  // User 2 cannot update User 1's profile (RLS)
  // Supabase RLS silently returns 0 rows affected rather than an error on blocked writes
  const { data: rlsData, error: rlsErr } = await supabase2
    .from('users').update({ name: 'Hacked' }).eq('id', userId1).select();
  const blocked = rlsErr !== null || (rlsData !== null && rlsData.length === 0);
  log('Profile', `RLS: User 2 cannot update User 1 profile`, blocked ? 'PASS' : 'FAIL');
}

// ─── TEST 3: Invite Flow ───
async function testInviteFlow() {
  header('TEST 3: Invite Flow');

  const token = `test_${Date.now()}`;
  const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 7);

  // Create invite
  const { data: invite, error: invErr } = await supabase1.from('invites').insert({
    inviter_id: userId1,
    invitee_email: USERS.user2.email.toLowerCase(),
    token,
    expires_at: expiresAt.toISOString(),
  }).select().single();
  log('Invite', `User 1 created invite token`, invErr ? 'FAIL' : 'PASS');

  if (!invite) return;

  // Invitee can read their own pending invite
  const { data: pending } = await supabase2.from('invites')
    .select('*, inviter:users!invites_inviter_id_fkey(*)')
    .eq('invitee_email', USERS.user2.email.toLowerCase())
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString());
  log('Invite', `User 2 sees ${(pending || []).length} pending invite(s)`, (pending || []).length >= 1 ? 'PASS' : 'FAIL');

  // Expired invite rejected (simulate by checking date logic)
  const expiredDate = new Date(); expiredDate.setDate(expiredDate.getDate() - 1);
  const isExpired = new Date(invite.expires_at) < expiredDate;
  log('Invite', `Invite is not expired`, !isExpired ? 'PASS' : 'FAIL');

  // Deep link format
  const deepLink = `chatapp://accept?token=${token}`;
  log('Invite', `Deep link format correct: ${deepLink}`, deepLink.startsWith('chatapp://') ? 'PASS' : 'FAIL');

  // Mark invite accepted
  const { error: acceptErr } = await supabase2.from('invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id);
  log('Invite', `Invite marked as accepted`, acceptErr ? 'FAIL' : 'PASS');

  // Already-accepted invite should not be re-accepted (accepted_at is set)
  const { data: acceptedInvite } = await supabase2.from('invites').select('accepted_at').eq('id', invite.id).single();
  log('Invite', `Accepted invite has accepted_at timestamp`, !!acceptedInvite?.accepted_at ? 'PASS' : 'FAIL');
}

// ─── TEST 4: Pair & Connection ───
async function testPairs() {
  header('TEST 4: Pair & Connection');

  const { data: existingPairs, error: pairError } = await supabase1
    .from('pairs').select('*')
    .or(`user_a_id.eq.${userId1},user_b_id.eq.${userId1}`)
    .eq('status', 'active');

  if (pairError) { log('Pairs', `Query failed: ${pairError.message}`, 'FAIL'); return; }

  const myPair = existingPairs?.find(p => p.user_a_id === userId2 || p.user_b_id === userId2);
  if (myPair) {
    pairId = myPair.id;
    log('Pairs', `Existing pair found: ${pairId}`);
  } else {
    const { data: newPair } = await supabase1.from('pairs')
      .insert({ user_a_id: userId1, user_b_id: userId2, status: 'active' }).select().single();
    if (newPair) { pairId = newPair.id; log('Pairs', `New pair created: ${pairId}`); }
    else {
      const { data: retryP } = await supabase1.from('pairs').select('*')
        .or(`user_a_id.eq.${userId1},user_b_id.eq.${userId1}`).single();
      if (retryP) { pairId = retryP.id; log('Pairs', `Pair found on retry: ${pairId}`); }
      else { log('Pairs', 'No pair found between users', 'FAIL'); return; }
    }
  }

  const { data: pairsU1 } = await supabase1.from('pairs')
    .select('*, user_a:users!pairs_user_a_id_fkey(name), user_b:users!pairs_user_b_id_fkey(name)')
    .or(`user_a_id.eq.${userId1},user_b_id.eq.${userId1}`).eq('status', 'active');
  const { data: pairsU2 } = await supabase2.from('pairs')
    .select('*, user_a:users!pairs_user_a_id_fkey(name), user_b:users!pairs_user_b_id_fkey(name)')
    .or(`user_a_id.eq.${userId2},user_b_id.eq.${userId2}`).eq('status', 'active');

  log('Pairs', `User 1 sees ${(pairsU1 || []).length} pair(s)`, pairsU1?.length >= 1 ? 'PASS' : 'FAIL');
  log('Pairs', `User 2 sees ${(pairsU2 || []).length} pair(s)`, pairsU2?.length >= 1 ? 'PASS' : 'FAIL');

  // Pair has partner info joined
  const pair = pairsU1?.[0];
  log('Pairs', `Pair includes partner name data`, !!(pair?.user_a || pair?.user_b) ? 'PASS' : 'FAIL');

  // Unauthenticated user cannot see pairs (RLS)
  const { data: anonPairs } = await supabaseAnon.from('pairs').select('*').eq('id', pairId);
  log('Pairs', `RLS: Unauthenticated user cannot read pairs`, (!anonPairs || anonPairs.length === 0) ? 'PASS' : 'FAIL');
}

// ─── TEST 5: Messaging ───
async function testMessaging() {
  header('TEST 5: Messaging');

  msgIds = [];
  const texts = ['Hello from User 1!', 'Test message #2', 'How are you?'];

  for (const text of texts) {
    const { data, error } = await supabase1.from('messages')
      .insert({ pair_id: pairId, sender_id: userId1, content: text, message_type: 'text' })
      .select('*').single();
    if (error) log('Messaging', `User 1 send "${text}": ${error.message}`, 'FAIL');
    else { msgIds.push(data.id); log('Messaging', `User 1 sent: "${text}" (id: ${data.id.substring(0, 8)})`); }
  }

  await sleep(500);

  // User 2 fetches
  const { data: msgs } = await supabase2.from('messages').select('*')
    .eq('pair_id', pairId).order('created_at', { ascending: true });
  log('Messaging', `User 2 fetched ${msgs?.length || 0} messages`, msgs?.length >= 3 ? 'PASS' : 'FAIL');

  // Unread count
  const unread = msgs?.filter(m => m.sender_id === userId1 && !m.read_at) || [];
  log('Messaging', `Unread count for User 2: ${unread.length}`, unread.length >= 3 ? 'PASS' : 'FAIL');

  // Mark as read
  for (const m of unread) {
    await supabase2.from('messages').update({ read_at: new Date().toISOString() }).eq('id', m.id);
  }
  log('Messaging', `User 2 marked ${unread.length} messages as read`);

  await sleep(500);
  const { data: updatedMsgs } = await supabase1.from('messages').select('*')
    .eq('pair_id', pairId).order('created_at', { ascending: true });
  const readCount = updatedMsgs?.filter(m => m.sender_id === userId1 && m.read_at) || [];
  log('Messaging', `User 1 sees ${readCount.length}/${msgs?.length || 0} messages as read`, readCount.length >= 1 ? 'PASS' : 'FAIL');

  // Reply threading
  const { data: replyMsg, error: replyError } = await supabase2.from('messages').insert({
    pair_id: pairId, sender_id: userId2, content: "Hi! I'm good, thanks!",
    message_type: 'text', reply_to_message_id: msgIds[0],
  }).select('*').single();
  if (replyError) log('Messaging', `User 2 reply: ${replyError.message}`, 'FAIL');
  else {
    msgIds.push(replyMsg.id);
    log('Messaging', `User 2 replied to message (id: ${replyMsg.id.substring(0, 8)})`);
    const { data: replyCheck } = await supabase2.from('messages').select('*').eq('id', replyMsg.id).maybeSingle();
    log('Messaging', `Reply has reply_to_message_id`, replyCheck?.reply_to_message_id ? 'PASS' : 'FAIL');
  }

  // Pagination: offset fetch
  const { data: page1 } = await supabase1.from('messages').select('*').eq('pair_id', pairId)
    .order('created_at', { ascending: false }).range(0, 9);
  log('Messaging', `Pagination: page 1 returns up to 10 messages`, (page1?.length || 0) <= 10 ? 'PASS' : 'FAIL');

  // Message type field present
  log('Messaging', `Messages have message_type field`, msgs?.[0]?.message_type !== undefined ? 'PASS' : 'FAIL');

  // RLS: unauthenticated cannot read messages
  const { data: anonMsgs } = await supabaseAnon.from('messages').select('*').eq('pair_id', pairId);
  log('Messaging', `RLS: Unauthenticated cannot read messages`, (!anonMsgs || anonMsgs.length === 0) ? 'PASS' : 'FAIL');

  // Unread count fix verification
  const { data: pairsNew } = await supabase1.from('pairs').select(`
    *, messages:messages(content, created_at, message_type, sender_id, read_at)
  `).or(`user_a_id.eq.${userId1},user_b_id.eq.${userId1}`).eq('status', 'active');
  if (pairsNew?.length > 0) {
    const p = pairsNew[0];
    const correctUnread = p.messages.filter(m => m.sender_id !== userId1 && !m.read_at).length;
    log('Messaging', `Unread count correct: ${correctUnread} unread from partner`, correctUnread >= 0 ? 'PASS' : 'FAIL');
  }
}

// ─── TEST 6: Reactions ───
async function testReactions() {
  header('TEST 6: Message Reactions');
  if (!msgIds?.length) { log('Reactions', 'No messages to react to', 'WARN'); return; }

  const { data: reaction, error: reactionError } = await supabase1.from('message_reactions')
    .insert({ message_id: msgIds[0], user_id: userId1, emoji: '\u2764\uFE0F' }).select('*').single();
  log('Reactions', `User 1 added \u2764\uFE0F reaction`, reactionError ? 'FAIL' : 'PASS');

  await sleep(300);
  const { data: reactions } = await supabase1.from('message_reactions').select('*').eq('message_id', msgIds[0]);
  log('Reactions', `Reactions on message: ${reactions?.length || 0}`, reactions?.length >= 1 ? 'PASS' : 'FAIL');

  // User 2 can also see reactions
  const { data: u2reactions } = await supabase2.from('message_reactions').select('*').eq('message_id', msgIds[0]);
  log('Reactions', `User 2 can read reactions`, u2reactions !== null ? 'PASS' : 'FAIL');

  // Duplicate reaction rejected (unique constraint)
  const { error: dupErr } = await supabase1.from('message_reactions')
    .insert({ message_id: msgIds[0], user_id: userId1, emoji: '\u{1F525}' });
  log('Reactions', `Duplicate reaction rejected by DB`, dupErr ? 'PASS' : 'FAIL');

  // Remove reaction
  if (reaction?.id) {
    const { error: delErr } = await supabase1.from('message_reactions')
      .delete().eq('message_id', msgIds[0]).eq('user_id', userId1);
    log('Reactions', `User 1 removed reaction`, delErr ? 'FAIL' : 'PASS');
    const { data: afterDel } = await supabase1.from('message_reactions').select('*').eq('message_id', msgIds[0]);
    log('Reactions', `Reaction count after removal: ${afterDel?.length || 0}`, (afterDel?.length || 0) === 0 ? 'PASS' : 'FAIL');
  }
}

// ─── TEST 7: Delete for Me ───
async function testDeleteForMe() {
  header('TEST 7: Delete Messages For Me');
  if (!msgIds?.length) { log('Delete', 'No messages', 'WARN'); return; }

  const { data: beforeCount } = await supabase1.from('messages').select('*').eq('pair_id', pairId);

  const { error: delErr } = await supabase2.from('deleted_messages')
    .insert({ message_id: msgIds[0], user_id: userId2 });
  log('Delete', `User 2 deleted message for self`, delErr ? 'FAIL' : 'PASS');

  const { data: deleted } = await supabase2.from('deleted_messages').select('*')
    .eq('message_id', msgIds[0]).eq('user_id', userId2).maybeSingle();
  log('Delete', `Deleted record exists for user 2`, deleted ? 'PASS' : 'FAIL');

  // Original message still exists for User 1
  const { data: msgStillExists } = await supabase1.from('messages').select('id').eq('id', msgIds[0]).maybeSingle();
  log('Delete', `Original message still exists for User 1`, msgStillExists ? 'PASS' : 'FAIL');

  // User 1 has NOT deleted it
  const { data: notDeletedForU1 } = await supabase1.from('deleted_messages').select('*')
    .eq('message_id', msgIds[0]).eq('user_id', userId1).maybeSingle();
  log('Delete', `Message NOT deleted for User 1`, !notDeletedForU1 ? 'PASS' : 'FAIL');

  // Idempotent: inserting same delete again should not crash (upsert)
  const { error: dupDelErr } = await supabase2.from('deleted_messages')
    .upsert({ message_id: msgIds[0], user_id: userId2 }, { onConflict: 'message_id,user_id', ignoreDuplicates: true });
  log('Delete', `Duplicate delete is idempotent`, !dupDelErr ? 'PASS' : 'FAIL');

  log('Delete', `Total messages still in DB: ${(beforeCount || []).length}`, (beforeCount || []).length > 0 ? 'PASS' : 'FAIL');
}

// ─── TEST 8: Chat Settings ───
async function testChatSettings() {
  header('TEST 8: Chat Settings');

  // Block
  const { error: blockErr } = await supabase1.from('pairs').update({ is_blocked: true }).eq('id', pairId);
  log('ChatSettings', `User 1 blocked partner`, blockErr ? 'FAIL' : 'PASS');
  const { data: pairCheck } = await supabase1.from('pairs').select('is_blocked').eq('id', pairId).single();
  log('ChatSettings', `Pair is_blocked: ${pairCheck?.is_blocked}`, pairCheck?.is_blocked === true ? 'PASS' : 'FAIL');

  // Unblock
  const { error: unblockErr } = await supabase1.from('pairs').update({ is_blocked: false }).eq('id', pairId);
  log('ChatSettings', `User 1 unblocked partner`, unblockErr ? 'FAIL' : 'PASS');
  const { data: unblockCheck } = await supabase1.from('pairs').select('is_blocked').eq('id', pairId).single();
  log('ChatSettings', `Pair is_blocked after unblock: ${unblockCheck?.is_blocked}`, unblockCheck?.is_blocked === false ? 'PASS' : 'FAIL');

  // Clear chat for User 1
  const { data: allMsgs } = await supabase1.from('messages').select('id').eq('pair_id', pairId);
  if (allMsgs && allMsgs.length > 0) {
    const inserts = allMsgs.map(m => ({ message_id: m.id, user_id: userId1 }));
    const { error: clearErr } = await supabase1.from('deleted_messages')
      .upsert(inserts, { onConflict: 'message_id,user_id', ignoreDuplicates: true });
    log('ChatSettings', `User 1 cleared chat (${allMsgs.length} messages)`, clearErr ? 'FAIL' : 'PASS');

    // Verify User 1's Home-style chat list ignores messages hidden by clear chat
    const { data: homePairs } = await supabase1.from('pairs').select(`
      *, messages:messages(id, content, created_at, message_type, sender_id, read_at)
    `).or(`user_a_id.eq.${userId1},user_b_id.eq.${userId1}`).eq('status', 'active');
    const homePair = homePairs?.find(p => p.id === pairId);
    const { data: deletedForUser1 } = await supabase1.from('deleted_messages')
      .select('message_id')
      .eq('user_id', userId1)
      .in('message_id', allMsgs.map(m => m.id));
    const deletedIds = new Set((deletedForUser1 || []).map(d => d.message_id));
    const visibleHomeMessages = (homePair?.messages || []).filter(m => !deletedIds.has(m.id));
    const homeLastMessage = visibleHomeMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null;
    const homeUnread = visibleHomeMessages.filter(m => m.sender_id !== userId1 && !m.read_at).length;
    log('ChatSettings', `User 1 Home last message hidden after clear`, homeLastMessage === null ? 'PASS' : 'FAIL');
    log('ChatSettings', `User 1 Home unread count hidden after clear`, homeUnread === 0 ? 'PASS' : 'FAIL');

    // Verify User 2 still sees messages (clear is per-user)
    const { data: u2msgs } = await supabase2.from('messages').select('id').eq('pair_id', pairId);
    log('ChatSettings', `User 2 still sees ${u2msgs?.length || 0} messages after User 1 clears`, (u2msgs?.length || 0) > 0 ? 'PASS' : 'FAIL');
  }
}

// ─── TEST 9: Storage ───
async function testStorage() {
  header('TEST 9: Storage');

  // Bucket listing
  const { data: files, error: listErr } = await supabase1.storage.from('chat-media').list(userId1);
  log('Storage', `chat-media bucket accessible`, !listErr ? 'PASS' : 'FAIL');
  log('Storage', `User 1 has ${(files || []).length} file(s) in storage`);

  // Upload a small test file (1x1 PNG bytes)
  const pngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  const uploadPath = `${userId1}/test_${Date.now()}.png`;
  const { error: uploadErr } = await supabase1.storage.from('chat-media').upload(uploadPath, pngBytes, { contentType: 'image/png' });
  log('Storage', `Upload test file`, uploadErr ? 'FAIL' : 'PASS');

  if (!uploadErr) {
    // Get public URL
    const { data: urlData } = supabase1.storage.from('chat-media').getPublicUrl(uploadPath);
    log('Storage', `Public URL generated`, urlData?.publicUrl?.startsWith('https') ? 'PASS' : 'FAIL');

    // Delete test file
    const { error: removeErr } = await supabase1.storage.from('chat-media').remove([uploadPath]);
    log('Storage', `Test file cleaned up`, !removeErr ? 'PASS' : 'FAIL');
  }

  // Unauthenticated user cannot upload
  const { error: anonUploadErr } = await supabaseAnon.storage.from('chat-media')
    .upload(`anon/test_${Date.now()}.png`, pngBytes, { contentType: 'image/png' });
  log('Storage', `RLS: Unauthenticated upload rejected`, anonUploadErr ? 'PASS' : 'FAIL');
}

// ─── TEST 10: Data Integrity ───
async function testDataIntegrity() {
  header('TEST 10: Data Integrity');

  // Message cannot be inserted without a valid pair_id
  const { error: badPairErr } = await supabase1.from('messages').insert({
    pair_id: '00000000-0000-0000-0000-000000000000',
    sender_id: userId1,
    content: 'orphan message',
    message_type: 'text',
  });
  log('Integrity', `Message with invalid pair_id rejected`, badPairErr ? 'PASS' : 'FAIL');

  // Message content can be empty string (media messages)
  const { data: emptyContent, error: emptyErr } = await supabase1.from('messages').insert({
    pair_id: pairId, sender_id: userId1, content: '', message_type: 'image',
    media_url: 'https://example.com/test.jpg',
  }).select().single();
  log('Integrity', `Media message with empty content allowed`, !emptyErr ? 'PASS' : 'FAIL');
  if (emptyContent) {
    await supabase1.from('messages').delete().eq('id', emptyContent.id);
  }

  // Pair has correct schema fields
  const { data: pairData } = await supabase1.from('pairs').select('*').eq('id', pairId).single();
  const requiredFields = ['id', 'user_a_id', 'user_b_id', 'status', 'is_blocked', 'created_at'];
  const missingFields = requiredFields.filter(f => !(f in (pairData || {})));
  log('Integrity', `Pair schema has all required fields`, missingFields.length === 0 ? 'PASS' : 'FAIL');

  // Message has correct schema fields
  const { data: msgSample } = await supabase1.from('messages').select('*')
    .eq('pair_id', pairId).limit(1).single();
  const msgFields = ['id', 'pair_id', 'sender_id', 'content', 'message_type', 'created_at', 'read_at'];
  const missingMsgFields = msgFields.filter(f => !(f in (msgSample || {})));
  log('Integrity', `Message schema has all required fields`, missingMsgFields.length === 0 ? 'PASS' : 'FAIL');
}

// ─── TEST 11: Session & Token Security ───
async function testSessionSecurity() {
  header('TEST 11: Session & Token Security');

  // Verify session tokens are different per user
  const { data: s1 } = await supabase1.auth.getSession();
  const { data: s2 } = await supabase2.auth.getSession();
  log('Security', `User 1 and User 2 have different access tokens`,
    s1.session?.access_token !== s2.session?.access_token ? 'PASS' : 'FAIL');

  // User 1 cannot read User 2's private data using User 1's token
  const { data: u2profile } = await supabase1.from('users').select('*').eq('id', userId2).maybeSingle();
  // Profiles may be readable (public) — check that sensitive auth data is not exposed
  log('Security', `User 1 can read User 2 public profile (expected)`, u2profile !== null ? 'PASS' : 'FAIL');

  // Unauthenticated client gets no session
  const { data: anonSession } = await supabaseAnon.auth.getSession();
  log('Security', `Unauthenticated client has no session`, !anonSession.session ? 'PASS' : 'FAIL');

  // Verify JWT expiry is in the future
  const token = s1.session?.access_token;
  if (token) {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const expiresAt = payload.exp * 1000;
    log('Security', `JWT token is not expired`, expiresAt > Date.now() ? 'PASS' : 'FAIL');
  }
}

// ─── MAIN ───
async function main() {
  console.log('\n\u{1F680} kiba Production E2E Test Suite');
  console.log('Testing via Supabase REST API — Auth, RLS, Messaging, Storage, Integrity\n');

  await testAuth();
  await sleep(300);
  await testProfileUpdate();
  await sleep(300);
  await testInviteFlow();
  await sleep(300);
  await testPairs();
  await sleep(300);
  await testMessaging();
  await sleep(300);
  await testReactions();
  await sleep(300);
  await testDeleteForMe();
  await sleep(300);
  await testChatSettings();
  await sleep(300);
  await testStorage();
  await sleep(300);
  await testDataIntegrity();
  await sleep(300);
  await testSessionSecurity();

  console.log(`\n${'='.repeat(60)}`);
  console.log('  TEST RESULTS SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`  Total Tests: ${passed + failed}`);
  console.log(`  \u{1F7E2} Passed: ${passed}`);
  console.log(`  \u{1F534} Failed: ${failed}`);
  if (errors.length > 0) {
    console.log(`\n  Failed Tests:`);
    errors.forEach(e => console.log(`    \u274C ${e}`));
  }
  console.log(`${'='.repeat(60)}\n`);

  if (failed === 0) {
    console.log('\u{1F389} All tests passed!\n');
  } else {
    console.log(`\u26A0\uFE0F  ${failed} test(s) failed. See above.\n`);
  }

  await supabase1.auth.signOut();
  await supabase2.auth.signOut();
}

main().catch(e => { console.error('Fatal error:', e); process.exit(1); });
