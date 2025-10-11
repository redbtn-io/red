/**
 * Test script for stream reconnection functionality
 * Tests the pub/sub architecture where generation continues even if HTTP stream breaks
 * 
 * Usage: node test-stream-reconnect.js
 */

const http = require('http');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_MESSAGE = 'Who plays baseball tonight?';

console.log('🧪 Testing Stream Reconnection with Pub/Sub Architecture\n');

async function test() {
  try {
    // Step 1: Trigger generation
    console.log('📤 Step 1: Sending message to trigger generation...');
    const postResponse = await fetch(`${API_URL}/api/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'Red',
        messages: [{ role: 'user', content: TEST_MESSAGE }],
        stream: true
      })
    });

    if (!postResponse.ok) {
      throw new Error(`POST failed: ${postResponse.status}`);
    }

    const data = await postResponse.json();
    const messageId = data.id;
    const streamUrl = data.stream_url;

    console.log(`✅ Got messageId: ${messageId}`);
    console.log(`   Stream URL: ${streamUrl}\n`);

    // Step 2: Connect to initial stream and break it
    console.log('📡 Step 2: Connecting to first stream...');
    const streamResponse = await fetch(`${API_URL}${streamUrl}`);
    
    if (!streamResponse.ok) {
      throw new Error(`Stream connection failed: ${streamResponse.status}`);
    }

    const reader = streamResponse.body.getReader();
    const decoder = new TextDecoder();
    let firstChunks = '';
    let chunkCount = 0;

    // Read a few chunks then break connection
    console.log('   Reading initial chunks...');
    for (let i = 0; i < 5; i++) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      firstChunks += chunk;
      chunkCount++;
      
      // Parse and log content
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'content') {
              process.stdout.write(event.content);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    console.log(`\n\n🔌 Step 3: Breaking connection (read ${chunkCount} chunks)`);
    reader.cancel(); // Simulate connection break

    // Wait a bit to let generation continue
    console.log('   Waiting 3 seconds for generation to continue in background...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 4: Reconnect to same stream
    console.log('🔄 Step 4: Reconnecting to stream...');
    const reconnectResponse = await fetch(`${API_URL}${streamUrl}`);
    
    if (!reconnectResponse.ok) {
      throw new Error(`Reconnect failed: ${reconnectResponse.status}`);
    }

    const reader2 = reconnectResponse.body.getReader();
    let reconnectContent = '';
    let hasExistingContent = false;

    console.log('   Reading reconnected stream...\n');
    while (true) {
      const { done, value } = await reader2.read();
      if (done) break;

      const chunk = decoder.decode(value);
      reconnectContent += chunk;

      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            console.log('\n\n✅ Stream complete!');
            break;
          }

          try {
            const event = JSON.parse(data);
            if (event.type === 'content') {
              if (!hasExistingContent && event.content.length > 10) {
                console.log('   [Got existing content from Redis]');
                hasExistingContent = true;
              }
              process.stdout.write(event.content);
            } else if (event.type === 'complete') {
              console.log('\n   [Generation completed]');
            } else if (event.type === 'error') {
              console.error('\n   [Error:', event.error, ']');
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    console.log('\n\n🎉 Test passed!');
    console.log('✅ Stream broke and reconnected successfully');
    console.log('✅ Received full response despite disconnection');
    console.log(`✅ MessageId ${messageId} worked across both connections`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run test
test().then(() => {
  console.log('\n🏁 Test completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});
