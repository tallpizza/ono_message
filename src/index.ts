import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import 'dotenv/config';

export const app = new Hono();

const PORT = Number(process.env.PORT) || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
const TRIGGER_KEYWORD = process.env.TRIGGER_KEYWORD?.toLowerCase() || 'hello';
const REPLY_TEXT = process.env.REPLY_TEXT || 'Hello!';

// GET: Webhook verification
app.get('/webhook', (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified successfully!');
    return c.text(challenge || '');
  }

  console.error('Verification failed. Token mismatch.');
  return c.text('Forbidden', 403);
});

// POST: Handle Webhook Events
app.post('/webhook', async (c) => {
  try {
    const body = await c.req.json();
    console.log('Received webhook event:', JSON.stringify(body, null, 2));

    // Confirm webhook is from instagram
    if (body.object === 'instagram') {
      for (const entry of body.entry || []) {
        for (const messagingEvent of entry.messaging || []) {
          if (messagingEvent.message && messagingEvent.message.text) {
            const senderId = messagingEvent.sender.id;
            const messageText = messagingEvent.message.text.toLowerCase();

            console.log(`Received message: "${messagingEvent.message.text}" from sender: ${senderId}`);

            // Check keyword
            if (messageText.includes(TRIGGER_KEYWORD)) {
              console.log(`Keyword "${TRIGGER_KEYWORD}" matched! Sending reply...`);
              await sendInstagramReply(senderId, REPLY_TEXT);
            }
          }
        }
      }
      return c.text('EVENT_RECEIVED');
    }

    return c.text('Not Found', 404);
  } catch (error) {
    console.error('Error processing webhook:', error);
    return c.text('Internal Server Error', 500);
  }
});

async function sendInstagramReply(recipientId: string, text: string) {
  if (!PAGE_ACCESS_TOKEN || PAGE_ACCESS_TOKEN === 'your_facebook_page_access_token_here') {
    console.error('PAGE_ACCESS_TOKEN is not set or placeholder!');
    return;
  }

  const url = `https://graph.facebook.com/v20.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: text },
      }),
    });

    const result: any = await response.json();
    if (response.ok) {
      console.log(`Reply sent successfully to ${recipientId}:`, result);
    } else {
      console.error(`Failed to send reply to ${recipientId}:`, result);
    }
  } catch (error) {
    console.error('Error sending Instagram reply:', error);
  }
}

console.log(`Server starting on port ${PORT}`);
serve({
  fetch: app.fetch,
  port: PORT,
  hostname: '0.0.0.0',
});
