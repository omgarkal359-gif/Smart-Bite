import { createClient } from '@/lib/supabase/server';

export const instant = false;

export default async function Notes() {
  const supabase = await createClient();
  const { data: notes, error } = await supabase.from("notes").select();
  
  if (error) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1 style={{ color: '#E4002B' }}>Supabase Notes Table Status</h1>
        <p><strong>Error:</strong> {error.message}</p>
        <p>This is expected if you haven't run the SQL snippet in your Supabase SQL Editor yet.</p>
        <p>To fix this, go to your Supabase SQL Editor and run:</p>
        <pre style={{ background: '#f4f4f4', padding: '15px', borderRadius: '5px', overflowX: 'auto' }}>
{`-- Create the table
create table notes (
  id bigint primary key generated always as identity,
  title text not null
);

-- Insert some sample data into the table
insert into notes (title)
values
  ('Today I created a Supabase project.'),
  ('I added some data and queried it from Next.js.'),
  ('It was awesome!');

alter table notes enable row level security;

-- Make the data in your table publicly readable
create policy "public can read notes"
on public.notes
for select to anon
using (true);`}
        </pre>
      </div>
    );
  }

  return <pre style={{ padding: '20px' }}>{JSON.stringify(notes, null, 2)}</pre>;
}
