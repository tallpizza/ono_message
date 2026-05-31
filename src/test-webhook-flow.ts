import { app } from './index.js';

// Save original fetch
const originalFetch = globalThis.fetch;

let fetchCallCount = 0;
let fetchCalls: { url: string; options?: any }[] = [];

// Mock fetch
globalThis.fetch = (async (url: string | URL, options?: any): Promise<Response> => {
  const urlStr = url.toString();
  fetchCallCount++;
  fetchCalls.push({ url: urlStr, options });

  console.log(`[MOCK FETCH] Request to: ${urlStr}`);
  if (options?.body) {
    console.log(`[MOCK FETCH] Body: ${options.body}`);
  }

  // 1. Follow check endpoint
  if (urlStr.includes('fields=username,name,is_user_follow_business')) {
    // Return true for sender_following, false for sender_not_following
    const isFollowing = urlStr.includes('sender_following');
    return new Response(
      JSON.stringify({
        username: 'test_user',
        name: 'Test User',
        is_user_follow_business: isFollowing,
        is_business_follow_user: true,
        id: 'sender_test'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. Default success response for messages sending
  return new Response(
    JSON.stringify({ message_id: 'mid.12345' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}) as any;

async function runFlowTests() {
  console.log('=== STARTING INTEGRATED FLOW TESTS ===\n');

  // Test 1: GET Webhook Verification
  console.log('--- Test 1: GET Webhook Verification ---');
  const verifyToken = process.env.HUB_VERIFY_TOKEN || 'my_secure_verify_token';
  const getRes = await app.request(`/webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=VERIFIED_CHALLENGE`);
  console.log(`Status: ${getRes.status}`);
  console.log(`Body: ${await getRes.text()}\n`);

  // Test 2: Comment Webhook - Matched Keyword
  console.log('--- Test 2: Comment Webhook (Matched Keyword "테마") ---');
  const commentPayload = {
    object: 'instagram',
    entry: [
      {
        id: '17841430523933655',
        time: Date.now(),
        changes: [
          {
            field: 'comments',
            value: {
              id: 'comment_111',
              text: '오앤오 카톡테마 공유 해주세요!',
              from: { id: 'commenter_123', username: 'commenter_user' },
              media: { id: 'media_999' }
            }
          }
        ]
      }
    ]
  };

  const commentRes = await app.request('/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(commentPayload)
  });
  console.log(`Status: ${commentRes.status}`);
  console.log(`Body: ${await commentRes.text()}\n`);

  // Test 3: Comment Webhook - Duplicate Check
  console.log('--- Test 3: Comment Webhook (Duplicate Check) ---');
  const commentResDup = await app.request('/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(commentPayload)
  });
  console.log(`Status: ${commentResDup.status}`);
  console.log(`Body: ${await commentResDup.text()}\n`);

  // Test 4: DM Webhook - Quick Reply FOLLOW_CHECK (User is NOT following)
  console.log('--- Test 4: DM Webhook - Quick Reply FOLLOW_CHECK (Not Following) ---');
  const dmNotFollowingPayload = {
    object: 'instagram',
    entry: [
      {
        id: '17841430523933655',
        time: Date.now(),
        messaging: [
          {
            sender: { id: 'sender_not_following' },
            recipient: { id: '297253340139924' },
            timestamp: Date.now(),
            message: {
              mid: 'msg_222',
              text: '팔로우 했어요',
              quick_reply: { payload: 'FOLLOW_CHECK' }
            }
          }
        ]
      }
    ]
  };

  const dmNotFollowingRes = await app.request('/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dmNotFollowingPayload)
  });
  console.log(`Status: ${dmNotFollowingRes.status}`);
  console.log(`Body: ${await dmNotFollowingRes.text()}\n`);

  // Test 5: DM Webhook - Text Trigger "완료" (User IS following)
  console.log('--- Test 5: DM Webhook - Text Trigger "완료" (Following) ---');
  const dmFollowingPayload = {
    object: 'instagram',
    entry: [
      {
        id: '17841430523933655',
        time: Date.now(),
        messaging: [
          {
            sender: { id: 'sender_following' },
            recipient: { id: '297253340139924' },
            timestamp: Date.now(),
            message: {
              mid: 'msg_333',
              text: '완료했습니다!'
            }
          }
        ]
      }
    ]
  };

  const dmFollowingRes = await app.request('/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dmFollowingPayload)
  });
  console.log(`Status: ${dmFollowingRes.status}`);
  console.log(`Body: ${await dmFollowingRes.text()}\n`);

  // Test 6: DM Webhook - Duplicate Reward Check
  console.log('--- Test 6: DM Webhook - Duplicate Reward Check (Following user tries again) ---');
  const dmFollowingDupRes = await app.request('/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dmFollowingPayload)
  });
  console.log(`Status: ${dmFollowingDupRes.status}`);
  console.log(`Body: ${await dmFollowingDupRes.text()}\n`);

  console.log('=== FLOW TESTS COMPLETED ===');
  
  // Restore original fetch
  globalThis.fetch = originalFetch;
  process.exit(0);
}

runFlowTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
