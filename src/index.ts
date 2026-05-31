import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import 'dotenv/config';

export const app = new Hono();

const PORT = Number(process.env.PORT) || 3100;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const HUB_VERIFY_TOKEN = process.env.HUB_VERIFY_TOKEN;
const KAKAO_THEME_LINK = process.env.KAKAO_THEME_LINK || 'https://example.com/kakaotalk-theme-link';

const FACEBOOK_PAGE_ID = '297253340139924';
const INSTAGRAM_USERNAME = 'ono.giftshop_';

// Keywords to match in comments
const COMMENT_KEYWORDS = ['테마', '카톡테마', '카카오톡', '링크', '공유', 'ono', '오앤오'];

// Match triggers in DM
const FOLLOW_CHECK_TRIGGERS = ['팔로우 했어요', '완료', '팔로우', '확인'];

// In-memory stores for deduplication
const processedComments = new Set<string>();
const rewardedUsers = new Set<string>();

console.log(`PAGE_ACCESS_TOKEN loaded: ${PAGE_ACCESS_TOKEN ? PAGE_ACCESS_TOKEN.substring(0, 10) + '...' : 'NOT LOADED'}`);
console.log(`HUB_VERIFY_TOKEN loaded: ${HUB_VERIFY_TOKEN ? 'YES' : 'NO'}`);

// GET /webhook: Webhook verification
app.get('/webhook', (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  if (mode === 'subscribe' && token === HUB_VERIFY_TOKEN) {
    console.log('Webhook verified successfully!');
    return c.text(challenge || '');
  }

  console.error('Verification failed. Token mismatch.');
  return c.text('Forbidden', 403);
});

// POST /webhook: Handle webhook events
app.post('/webhook', async (c) => {
  try {
    const body = await c.req.json();
    
    // Ignore non-instagram objects
    if (body.object !== 'instagram') {
      return c.text('Not Found', 404);
    }

    for (const entry of body.entry || []) {
      // 1. Handle Comments (sent inside changes)
      if (entry.changes) {
        for (const change of entry.changes) {
          if (change.field === 'comments') {
            await handleCommentEvent(change.value);
          }
        }
      }

      // 2. Handle Messages & Postbacks (sent inside messaging)
      if (entry.messaging) {
        for (const messagingEvent of entry.messaging) {
          await handleMessagingEvent(messagingEvent);
        }
      }
    }

    return c.text('EVENT_RECEIVED');
  } catch (error) {
    console.error('Error processing webhook:', error);
    return c.text('Internal Server Error', 500);
  }
});

// Process Instagram Comments
async function handleCommentEvent(value: any) {
  if (!value || !value.id || !value.text) return;

  const commentId = value.id;
  const commentText = value.text;
  const commenterId = value.from?.id;
  const commenterUsername = value.from?.username;
  const mediaId = value.media?.id;

  console.log(`[comment received] ID: ${commentId}, User: ${commenterUsername} (${commenterId}), Media: ${mediaId}, Text: "${commentText}"`);

  // Check duplicate comment_id
  if (processedComments.has(commentId)) {
    console.log(`[duplicate skipped] Comment ID: ${commentId} already processed.`);
    return;
  }

  // Check keyword match (case-insensitive and partial match)
  const lowerText = commentText.toLowerCase();
  const isMatched = COMMENT_KEYWORDS.some(keyword => lowerText.includes(keyword.toLowerCase()));

  if (!isMatched) {
    return;
  }

  console.log(`[keyword matched] Comment: "${commentText}" matched keywords.`);
  
  // Mark as processed
  processedComments.add(commentId);

  // Send Private Reply
  await sendPrivateReply(commentId, commenterUsername);
}

// Send Private Reply with Quick Reply Button
async function sendPrivateReply(commentId: string, username: string) {
  const url = `https://graph.facebook.com/v25.0/${FACEBOOK_PAGE_ID}/messages`;
  
  const payload = {
    recipient: {
      comment_id: commentId
    },
    message: {
      text: `카카오톡 테마 링크를 보내드릴게요. 먼저 ${INSTAGRAM_USERNAME} 팔로우를 완료하셨나요?`,
      quick_replies: [
        {
          content_type: 'text',
          title: '팔로우 했어요',
          payload: 'FOLLOW_CHECK'
        }
      ]
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PAGE_ACCESS_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    const result: any = await response.json();
    if (response.ok) {
      console.log(`[private reply sent] To comment: ${commentId}, Result:`, JSON.stringify(result));
    } else {
      console.error(`[Meta API error body] Private reply failed:`, JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('Error sending private reply:', error);
  }
}

// Process DM Messages & Postbacks
async function handleMessagingEvent(event: any) {
  const senderId = event.sender?.id;
  if (!senderId) return;

  // Skip echo messages (messages sent by the page itself)
  if (event.message?.is_echo) {
    return;
  }

  let isFollowCheckRequested = false;

  // 1. Check Quick Replies
  if (event.message?.quick_reply?.payload === 'FOLLOW_CHECK') {
    console.log(`[quick reply received] FOLLOW_CHECK from sender: ${senderId}`);
    isFollowCheckRequested = true;
  }

  // 2. Check Postbacks
  if (event.postback?.payload === 'FOLLOW_CHECK') {
    console.log(`[postback received] FOLLOW_CHECK from sender: ${senderId}`);
    isFollowCheckRequested = true;
  }

  // 3. Check Normal Text Matches
  if (event.message?.text) {
    const text = event.message.text.trim().toLowerCase();
    console.log(`[message received] From sender: ${senderId}, Text: "${event.message.text}"`);

    const isTriggerWord = FOLLOW_CHECK_TRIGGERS.some(trigger => text.includes(trigger.toLowerCase()));
    if (isTriggerWord) {
      isFollowCheckRequested = true;
    }
  }

  if (isFollowCheckRequested) {
    await processFollowCheckFlow(senderId);
  }
}

// Follow Check Flow
async function processFollowCheckFlow(senderId: string) {
  // Check if already rewarded
  if (rewardedUsers.has(senderId)) {
    console.log(`[duplicate skipped] Sender: ${senderId} already received the link.`);
    await sendDM(senderId, '이미 링크를 보내드렸어요. 위 메시지를 확인해주세요.');
    return;
  }

  console.log(`[follow check started] Checking follow status for sender: ${senderId}`);
  const followStatus = await checkUserFollowsBusiness(senderId);
  console.log(`[follow check result] Sender: ${senderId}, IsFollowing: ${followStatus}`);

  if (followStatus) {
    // Add to rewarded list
    rewardedUsers.add(senderId);
    
    // Send Success Link
    await sendDM(senderId, `팔로우 확인됐어요! 카카오톡 테마 링크 보내드릴게요 💛\n${KAKAO_THEME_LINK}`);
    console.log(`[reward sent] Link sent to sender: ${senderId}`);
  } else {
    // Send Retry Request
    await sendDM(senderId, `아직 팔로우 확인이 안 되는 것 같아요. ${INSTAGRAM_USERNAME} 팔로우 후 다시 '팔로우 했어요' 버튼을 눌러주세요.`);
  }
}

// Fetch user profile to check follow status
async function checkUserFollowsBusiness(senderId: string): Promise<boolean> {
  const url = `https://graph.facebook.com/v25.0/${senderId}?fields=username,name,is_user_follow_business,is_business_follow_user&access_token=${PAGE_ACCESS_TOKEN}`;

  try {
    const response = await fetch(url);
    const result: any = await response.json();

    if (response.ok) {
      return result.is_user_follow_business === true;
    } else {
      console.error(`[Meta API error body] Follow check failed:`, JSON.stringify(result, null, 2));
      return false;
    }
  } catch (error) {
    console.error('Error in checkUserFollowsBusiness:', error);
    return false;
  }
}

// Send standard DM message
async function sendDM(recipientId: string, text: string) {
  const url = `https://graph.facebook.com/v25.0/${FACEBOOK_PAGE_ID}/messages`;

  const payload = {
    recipient: {
      id: recipientId
    },
    message: {
      text: text
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PAGE_ACCESS_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    const result: any = await response.json();
    if (!response.ok) {
      console.error(`[Meta API error body] Send DM failed:`, JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('Error sending DM:', error);
  }
}

// Start Server
console.log(`Server starting on port ${PORT}`);
serve({
  fetch: app.fetch,
  port: PORT,
  hostname: '0.0.0.0',
});
