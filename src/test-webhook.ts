import { app } from './index.js';

async function runTests() {
  console.log('=== STARTING LOCAL WEBHOOK TESTS ===\n');

  // Test 1: GET Webhook Verification (Success)
  console.log('Test 1: Webhook GET Verification (Correct token)');
  const verifyToken = process.env.VERIFY_TOKEN || 'my_secure_verify_token';
  const getRes = await app.request(
    `/webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=CHALLENGE_ACCEPTED`
  );
  const getBody = await getRes.text();
  console.log(`Status: ${getRes.status}`);
  console.log(`Body: ${getBody}`);
  if (getRes.status === 200 && getBody === 'CHALLENGE_ACCEPTED') {
    console.log('✅ GET Verification Success\n');
  } else {
    console.log('❌ GET Verification Failed\n');
  }

  // Test 2: GET Webhook Verification (Failure)
  console.log('Test 2: Webhook GET Verification (Wrong token)');
  const getResFail = await app.request(
    `/webhook?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=CHALLENGE_ACCEPTED`
  );
  const getBodyFail = await getResFail.text();
  console.log(`Status: ${getResFail.status}`);
  console.log(`Body: ${getBodyFail}`);
  if (getResFail.status === 403) {
    console.log('✅ GET Verification Correctly Rejected\n');
  } else {
    console.log('❌ GET Verification Failed to Reject\n');
  }

  // Test 3: POST Webhook - Keyword Matches
  console.log('Test 3: Webhook POST Event (Keyword Matches)');
  const keyword = process.env.TRIGGER_KEYWORD || 'hello';
  const matchPayload = {
    object: 'instagram',
    entry: [
      {
        id: '123456789',
        time: Date.now(),
        messaging: [
          {
            sender: { id: 'sender_test_123' },
            recipient: { id: 'recipient_test_456' },
            timestamp: Date.now(),
            message: {
              mid: 'msg_001',
              text: `This is a test message containing ${keyword} keyword.`
            }
          }
        ]
      }
    ]
  };

  const postResMatch = await app.request('/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(matchPayload)
  });
  const postBodyMatch = await postResMatch.text();
  console.log(`Status: ${postResMatch.status}`);
  console.log(`Body: ${postBodyMatch}`);
  if (postResMatch.status === 200 && postBodyMatch === 'EVENT_RECEIVED') {
    console.log('✅ POST Keyword Match Handled Successfully\n');
  } else {
    console.log('❌ POST Keyword Match Failed\n');
  }

  // Test 4: POST Webhook - Keyword Does Not Match
  console.log('Test 4: Webhook POST Event (Keyword Mismatch)');
  const mismatchPayload = {
    object: 'instagram',
    entry: [
      {
        id: '123456789',
        time: Date.now(),
        messaging: [
          {
            sender: { id: 'sender_test_123' },
            recipient: { id: 'recipient_test_456' },
            timestamp: Date.now(),
            message: {
              mid: 'msg_002',
              text: 'This message does not have the trigger keyword.'
            }
          }
        ]
      }
    ]
  };

  const postResMismatch = await app.request('/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mismatchPayload)
  });
  const postBodyMismatch = await postResMismatch.text();
  console.log(`Status: ${postResMismatch.status}`);
  console.log(`Body: ${postBodyMismatch}`);
  if (postResMismatch.status === 200 && postBodyMismatch === 'EVENT_RECEIVED') {
    console.log('✅ POST Keyword Mismatch Handled (No auto-reply triggered)\n');
  } else {
    console.log('❌ POST Keyword Mismatch Failed\n');
  }

  console.log('=== TESTS COMPLETED ===');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
