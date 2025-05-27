import express from 'express';
import dotenv from 'dotenv';
import Cerebras from '@cerebras/cerebras_cloud_sdk';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json()); // Parse JSON bodies for POST requests
app.use(express.static('public'));

const cerebras = new Cerebras({ apiKey: process.env.CEREBRAS_API_KEY });

// In-memory queue to store message chunks for each client
const messageQueue = {};

// Endpoint to receive user messages
app.post('/api/send', async (req, res) => {
  const { message } = req.body;
  const clientId = req.query.clientId || uuidv4(); // Use provided clientId or generate a new one

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Initialize queue for this client if it doesn't exist
    if (!messageQueue[clientId]) {
      messageQueue[clientId] = [];
    }

    // Call Cerebras API to get response stream
    const stream = await cerebras.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are bixx, a helpful assistant. you are created by omer ai be friendly' },
        { role: 'user', content: message }
      ],
      model: 'llama-3.3-70b',
      stream: true,
      max_completion_tokens: 2048,
      temperature: 0.2,
      top_p: 1
    });

    // Collect stream chunks into the queue
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        messageQueue[clientId].push({ messageId: uuidv4(), message: content });
      }
    }

    // Add [DONE] to signal end of stream
    messageQueue[clientId].push({ messageId: uuidv4(), message: '[DONE]' });

    res.json({ clientId }); // Return clientId for polling
  } catch (err) {
    console.error('[❌] Error:', err);
    messageQueue[clientId].push({ messageId: uuidv4(), message: '[ERROR]' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint for polling messages
app.get('/api/poll', (req, res) => {
  const { clientId, lastMessageId } = req.query;

  if (!clientId) {
    return res.status(400).json({ error: 'clientId is required' });
  }

  const queue = messageQueue[clientId] || [];

  // Find the next message after lastMessageId
  let nextMessage = null;
  if (lastMessageId) {
    const lastIndex = queue.findIndex(msg => msg.messageId === lastMessageId);
    if (lastIndex !== -1 && lastIndex + 1 < queue.length) {
      nextMessage = queue[lastIndex + 1];
    }
  } else if (queue.length > 0) {
    nextMessage = queue[0];
  }

  if (nextMessage) {
    // Clean up queue after sending [DONE] or [ERROR]
    if (nextMessage.message === '[DONE]' || nextMessage.message === '[ERROR]') {
      delete messageQueue[clientId];
    }
    return res.json(nextMessage);
  }

  // No new messages, return empty response
  res.json({});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`⚡ Bixx listening on http://localhost:${PORT}`);
});
