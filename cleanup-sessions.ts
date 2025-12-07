import { supabaseAdmin } from './src/lib/supabaseAdmin';

async function cleanup() {
  console.log('🧹 Cleaning up old sessions...');

  // Get all sessions
  const { data: sessions, error } = await supabaseAdmin
    .from('whatsapp_sessions')
    .select('id, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching sessions:', error);
    return;
  }

  if (!sessions || sessions.length === 0) {
    console.log('✅ No sessions found');
    return;
  }

  console.log(`📊 Found ${sessions.length} sessions`);

  // Keep only the newest 3
  const toKeep = sessions.slice(0, 3);
  const toDelete = sessions.slice(3);

  console.log(`✅ Keeping ${toKeep.length} newest sessions:`);
  toKeep.forEach(s => console.log(`   - ${s.id}`));

  if (toDelete.length === 0) {
    console.log('✅ No old sessions to delete');
    return;
  }

  console.log(`🗑️  Deleting ${toDelete.length} old sessions...`);

  for (const session of toDelete) {
    const { error: deleteError } = await supabaseAdmin
      .from('whatsapp_sessions')
      .delete()
      .eq('id', session.id);

    if (deleteError) {
      console.error(`❌ Error deleting ${session.id}:`, deleteError);
    } else {
      console.log(`   ✅ Deleted ${session.id}`);
    }
  }

  console.log('🎉 Cleanup done!');
  process.exit(0);
}

cleanup().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
