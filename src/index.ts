import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import 'dotenv/config';

export const app = new Hono();

const PORT = Number(process.env.PORT) || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
console.log(`PAGE_ACCESS_TOKEN loaded: ${PAGE_ACCESS_TOKEN ? PAGE_ACCESS_TOKEN.substring(0, 10) + '...' : 'NOT LOADED'}`);
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

// HTML Layout for static policies
function htmlLayout(title: string, bodyContent: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #333; background-color: #fafafa; }
    .card { background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border: 1px solid #eef; }
    h1 { color: #111; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-top: 0; }
    h2 { color: #222; margin-top: 24px; font-size: 1.3em; }
    ul { padding-left: 20px; }
    li { margin-bottom: 8px; }
    p { margin: 16px 0; }
    .footer { margin-top: 40px; font-size: 0.9em; color: #666; border-top: 1px solid #eee; padding-top: 20px; }
    a { color: #3b82f6; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    ${bodyContent}
    <div class="footer">
      Contact: <a href="mailto:6789ekdms@naver.com">6789ekdms@naver.com</a><br>
      Last updated: May 27, 2026
    </div>
  </div>
</body>
</html>`;
}

// GET: Privacy Policy
app.get('/privacy', (c) => {
  const content = `
    <p>ONO Message uses Instagram API access only to receive and respond to Instagram messages for the connected Instagram professional account.</p>
    <h2>We may process the following data:</h2>
    <ul>
      <li>Instagram user ID</li>
      <li>Instagram account ID</li>
      <li>Message content sent to the connected Instagram account</li>
      <li>Message timestamps</li>
      <li>Webhook event metadata</li>
    </ul>
    <h2>Data Usage</h2>
    <p>We use this data only to provide automated customer message handling and reply features.</p>
    <p>We do not sell personal data. We do not share personal data with third parties except service providers required to operate this service.</p>
    <p>Data may be stored only as needed to operate, debug, secure, and improve the messaging service.</p>
    <p>Users may request deletion of their data by contacting: <a href="mailto:6789ekdms@naver.com">6789ekdms@naver.com</a></p>
  `;
  return c.html(htmlLayout('Privacy Policy', content));
});

// GET: Data Deletion Instructions
app.get('/delete-data', (c) => {
  const content = `
    <p>If you want your Instagram message data or account-related data deleted from ONO Message, please email us at: <a href="mailto:6789ekdms@naver.com">6789ekdms@naver.com</a></p>
    <h2>Please Include:</h2>
    <ul>
      <li>Your Instagram username</li>
      <li>A short request such as “Please delete my data”</li>
    </ul>
    <p>We will review and delete applicable data within a reasonable period, unless retention is required for legal, security, or abuse-prevention reasons.</p>
    <h2>Alternative Access Removal</h2>
    <p>You can also remove app access directly from Instagram:</p>
    <p><strong>Instagram Settings > Website permissions > Apps and websites > Remove ONO Message / ono-IG</strong></p>
  `;
  return c.html(htmlLayout('Data Deletion Instructions', content));
});

// GET: Terms of Service
app.get('/terms', (c) => {
  const content = `
    <p>ONO Message provides automated Instagram message handling for the connected Instagram professional account.</p>
    <h2>Terms Agreement</h2>
    <p>By using this service, you agree that:</p>
    <ul>
      <li>The service may receive and process Instagram messages sent to the connected account.</li>
      <li>The service may send replies through the Instagram API when configured to do so.</li>
      <li>You will use the service only for lawful business communication.</li>
      <li>You will not use the service to send spam, abusive content, or messages that violate Meta Platform Terms.</li>
    </ul>
    <p>The service is provided as-is and may be changed or discontinued at any time.</p>
  `;
  return c.html(htmlLayout('Terms of Service', content));
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
