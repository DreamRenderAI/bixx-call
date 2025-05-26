import express from 'express';
import dotenv from 'dotenv';
import Cerebras from '@cerebras/cerebras_cloud_sdk';
import cors from 'cors';

dotenv.config();

const app = express();
const cerebras = new Cerebras({ apiKey: process.env.CEREBRAS_API_KEY });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.post('/chat', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const userMessage = req.body.message;

  if (!userMessage) {
    res.write(`data: [ERROR] Missing message\n\n`);
    return res.end();
  }

  const messages = [
    { role: 'system', content: 'You are bixx, a helpful assistant. you are created by omer ai be friendly' },
    { role: 'user', content: userMessage }
  ];

  try {
    const stream = await cerebras.chat.completions.create({
      messages,
      model: 'llama-3.3-70b',
      stream: true,
      max_completion_tokens: 2048,
      temperature: 0.2,
      top_p: 1,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      // SSE format: data: <message>\n\n
      res.write(`data: ${text.replace(/\n/g, '\\n')}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('[❌] Error:', err);
    res.write('data: [ERROR]\n\n');
    res.end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`⚡ Bixx SSE server running on http://localhost:${PORT}`);
});
