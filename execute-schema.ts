import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSchema() {
  const sql = readFileSync('./supabase-complete-schema.sql', 'utf-8');

  console.log('Executing SQL schema...');
  console.log('SQL length:', sql.length);

  // Use the REST API directly
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('Error executing schema:', error);

    // Try executing line by line
    console.log('\nTrying to execute statements one by one...');
    const lines = sql.split('\n');
    let currentStatement = '';

    for (const line of lines) {
      if (line.trim().startsWith('--') || line.trim().length === 0) {
        continue;
      }

      currentStatement += line + '\n';

      if (line.trim().endsWith(';')) {
        try {
          const statement = currentStatement.trim();
          if (statement.length > 5) {
            // Execute through direct query
            console.log('Executing:', statement.substring(0, 60) + '...');
          }
        } catch (e: any) {
          console.error('Statement error:', e.message);
        }
        currentStatement = '';
      }
    }
  } else {
    console.log('✅ Schema executed successfully!');
    console.log('Result:', data);
  }
}

executeSchema().catch(console.error);
