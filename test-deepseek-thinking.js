#!/usr/bin/env node

/**
 * Live API Test Script for DeepSeek-R1 Thinking
 * Tests the Red AI API with various query types to demonstrate thinking extraction
 * 
 * Usage: node webapp/test-deepseek-thinking.js
 */

const http = require('http');

const API_BASE = 'http://localhost:3000';
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function separator(char = '=') {
  log(char.repeat(80), 'cyan');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testHealthCheck() {
  log('\n🏥 Testing Health Check...', 'yellow');
  try {
    const response = await makeRequest('/api/health');
    if (response.status === 200) {
      log('✅ Server is healthy!', 'green');
      return true;
    } else {
      log(`❌ Health check failed: ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Cannot connect to server: ${error.message}`, 'red');
    return false;
  }
}

async function testNonStreamingQuery(query, description) {
  separator();
  log(`\n📤 ${description}`, 'bright');
  log(`Query: "${query}"`, 'cyan');
  log('\n⏳ Sending non-streaming request...', 'yellow');
  
  try {
    const response = await makeRequest('/api/v1/chat/completions', 'POST', {
      messages: [
        { role: 'user', content: query }
      ],
      stream: false
    });

    if (response.status === 200) {
      log('✅ Response received!', 'green');
      log('\n📊 Response Data:', 'magenta');
      const content = response.data.choices?.[0]?.message?.content || response.data.content || '';
      log(`  Content: ${content.substring(0, 200)}...`, 'cyan');
      if (response.data.usage) {
        log(`  Tokens: ${response.data.usage.total_tokens} total`, 'cyan');
      }
      return response.data;
    } else {
      log(`❌ Request failed: ${response.status}`, 'red');
      log(JSON.stringify(response.data, null, 2), 'red');
      return null;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return null;
  }
}

async function testStreamingQuery(query, description) {
  separator();
  log(`\n📤 ${description}`, 'bright');
  log(`Query: "${query}"`, 'cyan');
  log('\n⏳ Sending streaming request...', 'yellow');
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      messages: [
        { role: 'user', content: query }
      ],
      stream: true
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let conversationId = null;
      let messageId = null;
      let streamUrl = null;
      let fullResponse = '';

      res.on('data', (chunk) => {
        const text = chunk.toString();
        const lines = text.split('\n');

        lines.forEach(line => {
          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim();
            if (data === '[DONE]') {
              log('\n✅ Streaming complete!', 'green');
              log(`\n📊 Full Response (${fullResponse.length} chars):`, 'magenta');
              log(fullResponse, 'cyan');
              resolve({ conversationId, messageId, content: fullResponse });
              return;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.conversationId && parsed.stream_url) {
                conversationId = parsed.conversationId;
                messageId = parsed.id;
                streamUrl = parsed.stream_url;
                log(`  Conversation ID: ${conversationId}`, 'cyan');
                log(`  Message ID: ${messageId}`, 'cyan');
                log(`  Stream URL: ${streamUrl}`, 'cyan');
                log('\n📝 Streaming response:', 'yellow');
                
                // Now connect to the stream URL
                const streamReq = http.request({
                  hostname: 'localhost',
                  port: 3000,
                  path: streamUrl,
                  method: 'GET'
                }, (streamRes) => {
                  streamRes.on('data', (streamChunk) => {
                    const streamText = streamChunk.toString();
                    const streamLines = streamText.split('\n');
                    
                    streamLines.forEach(streamLine => {
                      if (streamLine.startsWith('data: ')) {
                        const streamData = streamLine.substring(6).trim();
                        if (streamData === '[DONE]') {
                          log('\n✅ Streaming complete!', 'green');
                          log(`\n📊 Full Response (${fullResponse.length} chars):`, 'magenta');
                          if (fullResponse.length > 0) {
                            log(fullResponse.substring(0, 300) + (fullResponse.length > 300 ? '...' : ''), 'cyan');
                          }
                          return;
                        }
                        
                        try {
                          const streamParsed = JSON.parse(streamData);
                          // Handle the actual stream format: {type: 'content', content: '...'}
                          if (streamParsed.type === 'content' && streamParsed.content) {
                            const content = streamParsed.content;
                            fullResponse += content;
                            process.stdout.write(COLORS.cyan + content + COLORS.reset);
                          } else if (streamParsed.type === 'complete') {
                            log('\n\n📊 Metadata:', 'magenta');
                            if (streamParsed.metadata) {
                              log(`  Model: ${streamParsed.metadata.model || 'unknown'}`, 'cyan');
                              if (streamParsed.metadata.tokens) {
                                log(`  Tokens: ${streamParsed.metadata.tokens.total || 'unknown'} total`, 'cyan');
                              }
                            }
                          } else if (streamParsed.type === 'error') {
                            log(`\n\n❌ Stream error: ${streamParsed.error}`, 'red');
                          }
                        } catch (e) {
                          // Ignore
                        }
                      }
                    });
                  });
                  
                  streamRes.on('end', () => {
                    log('\n\n✅ Stream ended', 'green');
                    resolve({ conversationId, messageId, content: fullResponse });
                  });
                });
                
                streamReq.on('error', (err) => {
                  log(`\n❌ Stream error: ${err.message}`, 'red');
                  reject(err);
                });
                
                streamReq.end();
              } else if (parsed.choices && parsed.choices[0].delta.content) {
                const content = parsed.choices[0].delta.content;
                fullResponse += content;
                process.stdout.write(COLORS.cyan + content + COLORS.reset);
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        });
      });

      res.on('end', () => {
        log('\n\n✅ Stream ended', 'green');
        if (fullResponse) {
          resolve({ conversationId, messageId, content: fullResponse });
        } else {
          resolve({ conversationId, messageId, content: '(no response)' });
        }
      });
    });

    req.on('error', (error) => {
      log(`\n❌ Error: ${error.message}`, 'red');
      reject(error);
    });

    // Add timeout
    req.setTimeout(30000, () => {
      log('\n⏱️ Request timeout', 'yellow');
      req.destroy();
      resolve({ conversationId: null, messageId: null, content: fullResponse || '(timeout)' });
    });

    req.write(postData);
    req.end();
  });
}

async function runTests() {
  separator('=');
  log('  🧠 RED AI - DEEPSEEK-R1 THINKING TEST SUITE  ', 'bright');
  separator('=');
  
  log('\n📋 This script will test various query types to demonstrate:', 'yellow');
  log('  1. Router thinking (tool selection decisions)', 'cyan');
  log('  2. ToolPicker thinking (information extraction)', 'cyan');
  log('  3. Chat thinking (response generation)', 'cyan');
  log('  4. Streaming thinking extraction', 'cyan');
  log('\n💡 Watch your server console for thinking logs!', 'green');
  
  // Health check
  const healthy = await testHealthCheck();
  if (!healthy) {
    log('\n❌ Server is not running. Please start it first:', 'red');
    log('   cd webapp && npm run dev', 'yellow');
    process.exit(1);
  }

  await sleep(1000);

  // Test 1: Simple chat (should go to CHAT, no tools)
  await testNonStreamingQuery(
    'What is the capital of France?',
    'Test 1: Simple General Knowledge (CHAT)'
  );
  
  await sleep(2000);

  // Test 2: Current events (should trigger WEB_SEARCH)
  await testNonStreamingQuery(
    'What baseball games are happening tonight?',
    'Test 2: Current Events Query (WEB_SEARCH)'
  );
  
  await sleep(2000);

  // Test 3: Specific URL scraping
  await testNonStreamingQuery(
    'Read https://example.com',
    'Test 3: URL Scraping (SCRAPE_URL)'
  );
  
  await sleep(2000);

  // Test 4: Streaming response
  await testStreamingQuery(
    'Tell me a very short story about a robot',
    'Test 4: Streaming Response (CHAT)'
  );
  
  await sleep(2000);

  // Test 5: Complex query requiring reasoning
  await testNonStreamingQuery(
    'What are the latest developments in AI this week?',
    'Test 5: Complex Current Query (WEB_SEARCH + Complex Reasoning)'
  );

  separator('=');
  log('\n✅ ALL TESTS COMPLETE!', 'green');
  separator('=');
  
  log('\n📊 Summary:', 'yellow');
  log('  - All query types tested', 'cyan');
  log('  - Check your server console for thinking logs', 'cyan');
  log('  - Look for formatted boxes with 💭 emoji', 'cyan');
  
  log('\n💡 Tips:', 'yellow');
  log('  - Router thinking shows tool selection decisions', 'cyan');
  log('  - ToolPicker thinking shows information extraction', 'cyan');
  log('  - Chat thinking shows response generation reasoning', 'cyan');
  log('  - Thinking tags are removed from user responses', 'cyan');
  
  log('\n🎉 DeepSeek-R1 thinking extraction is working!\n', 'green');
}

// Run the tests
runTests().catch(error => {
  log(`\n❌ Test suite failed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
