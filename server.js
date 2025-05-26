import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';
import Cerebras from '@cerebras/cerebras_cloud_sdk';
import cors from 'cors';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const cerebras = new Cerebras({ apiKey: process.env.CEREBRAS_API_KEY });

app.use(cors());
app.use(express.static('public'));

wss.on('connection', (ws) => {
  console.log('[🔌] WebSocket client connected');

  ws.on('message', async (message) => {
    const userMessage = message.toString();
    try {
      const stream = await cerebras.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are bixx, a helpful assistant. you are created by omer ai be friendly' },
          { role: 'user', content: userMessage }
        ],
        model: 'llama-3.3-70b',
        stream: true,
        max_completion_tokens: 2048,
        temperature: 0.2,
        top_p: 1
      });

      for await (const chunk of stream) {
        ws.send(chunk.choices[0]?.delta?.content || '');
      }

      ws.send('[DONE]');
    } catch (err) {
      console.error('[❌] Error:', err);
      ws.send('[ERROR]');
    }
  });

  ws.on('close', () => console.log('[🔌] WebSocket client disconnected'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`⚡ Bixx listening on http://localhost:${PORT}`);
});
