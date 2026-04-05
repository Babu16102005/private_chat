// Cleanup script: Removes all stale deleted_messages entries from the database.
// Run before testing to ensure no test pollution:
//   node cleanup-deleted-messages.js
//
// This script logs in as user1, clears their deleted_messages, then signs out.
// Requires the same credentials that were used to sign up the test account.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://becqktegizdbqitdstun.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlY3FrdGVnaXpkYnFpdGRzdHVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTU3MDksImV4cCI6MjA4ODI3MTcwOX0.AI0IEpmZEWKtYwk6FYJt9FBA3vMoeT_Z9Va1t8kTKOE';

const USERS = [
  { email: 'babusanthosh6381@gmail.com', password: '1234567890' },
  { email: 'kirthikaboomika000@gmail.com', password: '1234567890' },
];

(async () => {
  console.log('\n🧹 Cleaning up deleted_messages entries...');

  for (const u of USERS) {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Login
    const { data, error: loginErr } = await sb.auth.signInWithPassword({ email: u.email, password: u.password });
    if (loginErr) { console.log(`  ⚠️  Failed to login ${u.email}: ${loginErr.message}`); continue; }

    // Delete all deleted_messages for this user
    const { error: delErr } = await sb.from('deleted_messages').delete().eq('user_id', data.user.id);
    if (delErr) {
      console.log(`  ❌ Failed to clean ${u.email}: ${delErr.message}`);
    } else {
      console.log(`  ✅ Cleaned deleted_messages for ${u.email}`);
    }

    await sb.auth.signOut();
  }

  console.log('\n✨ Cleanup complete.\n');
})();
