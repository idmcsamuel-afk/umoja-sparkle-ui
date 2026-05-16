import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  console.log('Graphics generation started');

  let body: any;
  try {
    body = await req.json();
  } catch (e) {
    console.error('Invalid JSON body:', e);
    return json({ error: 'Invalid JSON body' }, 400);
  }

  console.log('Request body:', body);

  const { prompt, size, style } = body ?? {};

  if (!prompt || typeof prompt !== 'string') {
    return json({ error: 'Prompt is required', received: body }, 400);
  }

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    console.error('OPENAI_API_KEY missing');
    return json({ error: 'OpenAI key not configured' }, 500);
  }

  // DALL-E 2 only supports 256x256, 512x512, 1024x1024
  const allowed = new Set(['256x256', '512x512', '1024x1024']);
  const imageSize = allowed.has(size) ? size : '1024x1024';
  const fullPrompt = style ? `${prompt}\n\nStyle: ${style}` : prompt;

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-2',
        prompt: fullPrompt,
        n: 1,
        size: imageSize,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('DALL-E error:', response.status, JSON.stringify(data).slice(0, 500));
      return json({ error: data.error?.message || 'Generation failed' }, response.status);
    }

    return json({
      image_url: data.data[0].url,
      revised_prompt: data.data[0].revised_prompt ?? fullPrompt,
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
