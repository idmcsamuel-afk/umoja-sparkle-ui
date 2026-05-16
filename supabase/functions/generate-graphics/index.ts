import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  console.log('Graphics generation started');

  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return json({ error: 'Prompt required' }, 400);
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      console.error('OPENAI_API_KEY missing');
      return json({ error: 'OpenAI key not configured' }, 500);
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-2',
        prompt,
        n: 1,
        size: '1024x1024',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('DALL-E error:', response.status, JSON.stringify(data).slice(0, 500));
      return json({ error: data.error?.message || 'Generation failed' }, response.status);
    }

    return json({
      image_url: data.data[0].url,
      revised_prompt: data.data[0].revised_prompt,
    });
  } catch (error) {
    console.error('Error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
