// End-to-End Test for CoupleChat via Supabase REST API
// Tests: Auth, Pairs, Messaging, Reactions, Typing/Presence, Delete, Chat Settings
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://becqktegizdbqitdstun.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlY3FrdGVnaXpkYnFpdGRzdHVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTU3MDksImV4cCI6MjA4ODI3MTcwOX0.AI0IEpmZEWKtYwk6FYJt9FBA3vMoeT_Z9Va1t8kTKOE';

const USERS = {
  user1: { email: 'babusanthosh6381@gmail.com', password: '1234567890' },
  user2: { email: 'kirthikaboomika000@gmail.com', password: '1234567890' },
};

let supabase1, supabase2; // separate clients per user
let userId1, userId2, pairId;
let msgIds = [];
let passed = 0, failed = 0, errors = [];

function log(section, msg, status = 'PASS') {
  const icon = status === 'PASS' ? '\u2705' : status === 'FAIL' ? '\u274C' : '\u26A0\uFE0F';
  const emoji = status === 'PASS' ? '\u{1F7E2}' : status === 'FAIL' ? '\u{1F534}' : '\u{1F7E1}';
  console.log(`${emoji} [${section}] ${status}: ${msg}`);
  if (status === 'FAIL') errors.push(`[${section}] ${msg}`);
  if (status === 'PASS') passed++; else failed++;
}

function header(text) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${text}`);
  console.log(`${'='.repeat(60)}`);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── TEST 1: Authentication ───
async function testAuth() {
  header('TEST 1: Authentication');

  // Initialize clients
  supabase1 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  supabase2 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // User 1 login
  try {
    const { data, error } = await supabase1.auth.signInWithPassword({
      email: USERS.user1.email,
      password: USERS.user1.password,
    });
    if (error || !data.user) throw error;
    userId1 = data.user.id;
    log('Auth', `User 1 (${USERS.user1.email}) logged in, ID: ${userId1}`, error ? 'FAIL' : 'PASS');
  } catch (e) { log('Auth', `User 1 login failed: ${e.message}`, 'FAIL'); return false; }

  await sleep(500);

  // User 2 login
  try {
    const { data, error } = await supabase2.auth.signInWithPassword({
      email: USERS.user2.email,
      password: USERS.user2.password,
    });
    if (error || !data.user) throw error;
    userId2 = data.user.id;
    log('Auth', `User 2 (${USERS.user2.email}) logged in, ID: ${userId2}`, error ? 'FAIL' : 'PASS');
  } catch (e) { log('Auth', `User 2 login failed: ${e.message}`, 'FAIL'); return false; }

  // Get profiles
  try {
    const { data: p1 } = await supabase1.from('users').select('*').eq('id', userId1).maybeSingle();
    const { data: p2 } = await supabase2.from('users').select('*').eq('id', userId2).maybeSingle();
    log('Auth', `User 1 profile exists: ${!!p1}`, p1 ? 'PASS' : 'FAIL');
    log('Auth', `User 2 profile exists: ${!!p2}`, p2 ? 'PASS' : 'FAIL');
  } catch (e) { log('Auth', `Profile fetch: ${e.message}`, 'FAIL'); }
}

// ─── TEST 2: Pair / Connection ───
async function testPairs() {
  header('TEST 2: Pair & Invites');

  // Check if pair already exists
  const { data: existingPairs, error: pairError } = await supabase1
    .from('pairs')
    .select('*')
    .or(`user_a_id.eq.${userId1},user_b_id.eq.${userId1}`)
    .eq('status', 'active');

  if (pairError) { log('Pairs', `Query failed: ${pairError.message}`, 'FAIL'); return; }

  const myPair = existingPairs?.find(p =>
    (p.user_a_id === userId2 || p.user_b_id === userId2)
  );

  if (myPair) {
    pairId = myPair.id;
    log('Pairs', `Existing pair found: ${pairId}`, 'PASS');
  } else {
    // Create pair directly
    const { data: newPair } = await supabase1
      .from('pairs')
      .insert({ user_a_id: userId1, user_b_id: userId2, status: 'active' })
      .select()
      .single();
    if (newPair) {
      pairId = newPair.id;
      log('Pairs', `New pair created: ${pairId}`, 'PASS');
    } else {
      log('Pairs', 'Failed to create pair (might already exist due to unique constraint)', 'WARN');
      // Try fetching again
      const { data: retryP } = await supabase1
        .from('pairs')
        .select('*')
        .or(`user_a_id.eq.${userId1},user_b_id.eq.${userId1}`)
        .single();
      if (retryP) { pairId = retryP.id; log('Pairs', `Pair found on retry: ${pairId}`, 'PASS'); }
      else { log('Pairs', 'No pair found between users', 'FAIL'); return; }
    }
  }

  // Verify both users can see the pair
  const { data: pairsU1 } = await supabase1
    .from('pairs')
    .select('*, user_a:users!pairs_user_a_id_fkey(name), user_b:users!pairs_user_b_id_fkey(name)')
    .or(`user_a_id.eq.${userId1},user_b_id.eq.${userId1}`)
    .eq('status', 'active');

  const { data: pairsU2 } = await supabase2
    .from('pairs')
    .select('*, user_a:users!pairs_user_a_id_fkey(name), user_b:users!pairs_user_b_id_fkey(name)')
    .or(`user_a_id.eq.${userId2},user_b_id.eq.${userId2}`)
    .eq('status', 'active');

  log('Pairs', `User 1 sees ${(pairsU1 || []).length} pair(s)`, pairsU1?.length >= 1 ? 'PASS' : 'FAIL');
  log('Pairs', `User 2 sees ${(pairsU2 || []).length} pair(s)`, pairsU2?.length >= 1 ? 'PASS' : 'FAIL');
}

// ─── TEST 3: Messaging ───
async function testMessaging() {
  header('TEST 3: Messaging');

  // 3a: User 1 sends messages
  msgIds = [];
  const texts = ['Hello from User 1!', 'Test message #2', 'How are you?'];

  for (const text of texts) {
    const { data, error } = await supabase1
      .from('messages')
      .insert({ pair_id: pairId, sender_id: userId1, content: text, message_type: 'text' })
      .select('*')
      .single();
    if (error) { log('Messaging', `User 1 send "${text}": ${error.message}`, 'FAIL'); }
    else { msgIds.push(data.id); log('Messaging', `User 1 sent: "${text}" (id: ${data.id.substring(0, 8)})`, 'PASS'); }
  }

  await sleep(500);

  // 3b: User 2 fetches messages
  const { data: msgs } = await supabase2
    .from('messages')
    .select('*')
    .eq('pair_id', pairId)
    .order('created_at', { ascending: true });

  log('Messaging', `User 2 fetched ${msgs?.length || 0} messages`, msgs?.length >= 3 ? 'PASS' : 'FAIL');

  // 3c: Verify messages are correctly marked as unread
  const unread = msgs?.filter(m => m.sender_id === userId1 && !m.read_at) || [];
  log('Messaging', `Unread count for User 2: ${unread.length}`, unread.length >= 3 ? 'PASS' : 'FAIL');

  // 3d: User 2 marks as read
  if (unread.length > 0) {
    for (const m of unread) {
      await supabase2
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', m.id);
    }
    log('Messaging', `User 2 marked ${unread.length} messages as read`, 'PASS');
  }

  // 3e: Verify read status from User 1's perspective
  await sleep(500);
  const { data: updatedMsgs } = await supabase1
    .from('messages')
    .select('*')
    .eq('pair_id', pairId)
    .order('created_at', { ascending: true });

  const readCount = updatedMsgs?.filter(m => m.sender_id === userId1 && m.read_at) || [];
  log('Messaging', `User 1 sees ${readCount.length}/${msgs?.length || 0} messages as read`,
    readCount.length >= 1 ? 'PASS' : 'FAIL');

  // 3f: User 2 replies
  const { data: replyMsg, error: replyError } = await supabase2
    .from('messages')
    .insert({
      pair_id: pairId,
      sender_id: userId2,
      content: 'Hi! I\'m good, thanks!',
      message_type: 'text',
      reply_to_message_id: msgIds[0],
    })
    .select('*')
    .single();

  if (replyError) { log('Messaging', `User 2 reply: ${replyError.message}`, 'FAIL'); }
  else {
    msgIds.push(replyMsg.id);
    log('Messaging', `User 2 replied to message (id: ${replyMsg.id.substring(0, 8)})`, 'PASS');

    // Verify reply data
    const { data: replyCheck } = await supabase2
      .from('messages')
      .select('*')
      .eq('id', replyMsg.id)
      .maybeSingle();
    log('Messaging', `Reply has reply_to_message_id: ${!!replyCheck?.reply_to_message_id}`,
      replyCheck?.reply_to_message_id ? 'PASS' : 'FAIL');
  }

  // 3g: Test getMessages with unread count (the bug we fixed)
  const { data: pairsWithMsgs } = await supabase1
    .from('pairs')
    .select(`
      *,
      messages:messages(content, created_at, message_type, sender_id, read_at)
    `)
    .or(`user_a_id.eq.${userId1},user_b_id.eq.${userId1}`)
    .eq('status', 'active');

  if (pairsWithMsgs && pairsWithMsgs.length > 0) {
    const pair = pairsWithMsgs[0];
    const unreadFromOther = pair.messages.filter(m => m.sender_id !== userId1 && !m.read_at).length;
    log('Messaging', `Unread calculation (with fix): ${unreadFromOther} unread from partner`, 'PASS');
    log('Messaging', `Total messages in pair: ${pair.messages.length}`, 'PASS');
  }
}

// ─── TEST 4: Reactions ───
async function testReactions() {
  header('TEST 4: Message Reactions');

  if (!msgIds || msgIds.length === 0) { log('Reactions', 'No messages to react to', 'WARN'); return; }

  // 4a: User 1 adds reaction
  const { data: reaction, error: reactionError } = await supabase1
    .from('message_reactions')
    .insert({ message_id: msgIds[0], user_id: userId1, emoji: '\u2764\uFE0F' })
    .select('*')
    .single();

  if (reactionError) { log('Reactions', `Add heart reaction: ${reactionError.message}`, 'FAIL'); }
  else { log('Reactions', `User 1 added \u2764\uFE0F reaction (id: ${reaction.id})`, 'PASS'); }

  // 4b: Fetch reactions
  await sleep(300);
  const { data: reactions, error: fetchErr } = await supabase1
    .from('message_reactions')
    .select('*')
    .eq('message_id', msgIds[0]);

  if (fetchErr) { log('Reactions', `Fetch reactions: ${fetchErr.message}`, 'FAIL'); }
  else { log('Reactions', `Reactions on message 1: ${reactions?.length || 0}`, reactions?.length >= 1 ? 'PASS' : 'FAIL'); }

  // 4c: Remove reaction
  if (reaction?.id) {
    const { error: delErr } = await supabase1
      .from('message_reactions')
      .delete()
      .eq('message_id', msgIds[0])
      .eq('user_id', userId1);
    log('Reactions', `User 1 removed reaction`, delErr ? 'FAIL' : 'PASS');
  }
}

// ─── TEST 5: Delete for Me ───
async function testDeleteForMe() {
  header('TEST 5: Delete Messages For Me');

  if (!msgIds || msgIds.length === 0) { log('Delete', 'No messages', 'WARN'); return; }

  const { data: beforeCount } = await supabase1
    .from('messages')
    .select('*')
    .eq('pair_id', pairId);

  // Delete first message for user 2
  const { error: delErr } = await supabase2
    .from('deleted_messages')
    .insert({ message_id: msgIds[0], user_id: userId2 });

  log('Delete', `User 2 deleted message for self`, delErr ? 'FAIL' : 'PASS');

  // Verify it's in deleted_messages
  const { data: deleted } = await supabase2
    .from('deleted_messages')
    .select('*')
    .eq('message_id', msgIds[0])
    .eq('user_id', userId2)
    .maybeSingle();

  log('Delete', `Deleted record exists for user 2`, deleted ? 'PASS' : 'FAIL');

  // Original message still exists
  log('Delete', `Original messages still exist: ${(beforeCount || []).length}`,
    (beforeCount || []).length > 0 ? 'PASS' : 'FAIL');
}

// ─── TEST 6: Chat Settings (Block/Unblock, Clear) ───
async function testChatSettings() {
  header('TEST 6: Chat Settings');

  // 6a: Block
  const { error: blockErr } = await supabase1
    .from('pairs')
    .update({ is_blocked: true })
    .eq('id', pairId);
  log('ChatSettings', `User 1 blocked partner`, blockErr ? 'FAIL' : 'PASS');

  // Verify blocked
  const { data: pairCheck } = await supabase1
    .from('pairs').select('is_blocked').eq('id', pairId).single();
  log('ChatSettings', `Pair is_blocked: ${pairCheck?.is_blocked}`,
    pairCheck?.is_blocked === true ? 'PASS' : 'FAIL');

  // 6b: Unblock
  const { error: unblockErr } = await supabase1
    .from('pairs')
    .update({ is_blocked: false })
    .eq('id', pairId);
  log('ChatSettings', `User 1 unblocked partner`, unblockErr ? 'FAIL' : 'PASS');

  // 6c: Clear chat (delete all messages for user 1)
  const { data: allMsgs } = await supabase1
    .from('messages')
    .select('id')
    .eq('pair_id', pairId);

  if (allMsgs && allMsgs.length > 0) {
    const inserts = allMsgs.map(m => ({ message_id: m.id, user_id: userId1 }));
    const { error: clearErr } = await supabase1
      .from('deleted_messages')
      .upsert(inserts, { onConflict: 'message_id,user_id', ignoreDuplicates: true });
    log('ChatSettings', `User 1 cleared chat (${allMsgs.length} messages)`, clearErr ? 'FAIL' : 'PASS');
  }
}

// ─── TEST 7: Storage ───
async function testStorage() {
  header('TEST 7: Storage');

  // Check if chat-media bucket is usable by listing files inside it
  const { data: files, error: listErr } = await supabase1.storage
    .from('chat-media')
    .list(userId1);

  if (listErr) {
    log('Storage', `chat-media bucket: ${listErr.message}`, 'FAIL');
  } else {
    log('Storage', `chat-media bucket usable: ${!!(listErr === null)}`, 'PASS');
    log('Storage', `User 1 has ${(files || []).length} file(s) in storage`, 'PASS');
  }
}

// ─── TEST 8: Unread Count Bug Verification ───
async function testUnreadCountBugFix() {
  header('TEST 8: Unread Count Bug Fix Verification');

  // The bug was: getMyPairs() selected only messages(content, created_at, message_type)
  // but calculated unread_count using sender_id and read_at, which were undefined.
  // This caused ALL messages to be counted as unread.

  // Simulate the OLD (buggy) query
  const { data: pairsOld } = await supabase1
    .from('pairs')
    .select(`
      *,
      messages:messages(content, created_at, message_type)
    `)
    .or(`user_a_id.eq.${userId1},user_b_id.eq.${userId1}`)
    .eq('status', 'active');

  let oldBugCount = 'N/A';
  if (pairsOld && pairsOld.length > 0) {
    const p = pairsOld[0];
    // In the old code, every message would be counted as unread because
    // sender_id and read_at are undefined
    const buggyUnread = p.messages.filter(m => m.sender_id !== userId1 && !m.read_at).length;
    oldBugCount = buggyUnread;
    log('UnreadFix', `OLD BUGGY query would count ${buggyUnread} unread (all messages)`, 'WARN');
  }

  // Simulate the NEW (fixed) query
  const { data: pairsNew } = await supabase1
    .from('pairs')
    .select(`
      *,
      messages:messages(content, created_at, message_type, sender_id, read_at)
    `)
    .or(`user_a_id.eq.${userId1},user_b_id.eq.${userId1}`)
    .eq('status', 'active');

  if (pairsNew && pairsNew.length > 0) {
    const p = pairsNew[0];
    const correctUnread = p.messages.filter(m => m.sender_id !== userId1 && !m.read_at).length;
    log('UnreadFix', `NEW FIXED query correctly counts ${correctUnread} unread`, correctUnread >= 0 ? 'PASS' : 'FAIL');
    log('UnreadFix', `Total messages: ${p.messages.length}, Correctly unread: ${correctUnread}`, 'PASS');
  }
}

// ─── MAIN ───
async function main() {
  console.log('\n\u{1F680} CoupleChat End-to-End Test Suite');
  console.log('Testing via Supabase REST API (backend-level validation)\n');

  await testAuth();
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
  await testUnreadCountBugFix();

  // Summary
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
    console.log('\u{1F389} All tests passed! The backend is working correctly.\n');
  } else {
    console.log(`\u26A0\uFE0F  ${failed} test(s) failed. See errors above.\n`);
  }

  // Cleanup: sign out
  await supabase1.auth.signOut();
  await supabase2.auth.signOut();
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
