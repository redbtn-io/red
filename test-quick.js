const http = require('http');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(COLORS[color] + message + COLORS.reset);
}

function separator(char = '-') {
  log(char.repeat(80), 'bright');
}

async function testNonStreaming(query, description) {
  separator('=');
  log(`\n📤 ${description}`, 'bright');
  log(`Query: "${query}"`, 'cyan');
  log('\n⏳ Sending request...', 'yellow');
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      messages: [{ role: 'user', content: query }],
      stream: false
    });

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          log('✅ Response received!\n', 'green');
          log('📊 Response:', 'magenta');
          const content = response.choices?.[0]?.message?.content || '(no content)';
          log(content.substring(0, 200) + (content.length > 200 ? '...' : ''), 'cyan');
          log(`\n  Tokens: ${response.usage?.total_tokens || 'unknown'}`, 'yellow');
          resolve(response);
        } catch (e) {
          log('❌ Parse error: ' + e.message, 'red');
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function testStreaming(query, description) {
  separator('=');
  log(`\n📤 ${description}`, 'bright');
  log(`Query: "${query}"`, 'cyan');
  log('\n⏳ Sending streaming request...', 'yellow');
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      messages: [{ role: 'user', content: query }],
      stream: true
    });

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let buffer = '';
      res.on('data', chunk => buffer += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(buffer);
          if (parsed.stream_url) {
            log(`✅ Got stream URL: ${parsed.stream_url}\n`, 'green');
            log('📝 Streaming content:', 'yellow');
            
            let fullResponse = '';
            const streamReq = http.request({
              hostname: 'localhost',
              port: 3000,
              path: parsed.stream_url,
              method: 'GET'
            }, (streamRes) => {
              streamRes.on('data', chunk => {
                const text = chunk.toString();
                const lines = text.split('\n');
                
                lines.forEach(line => {
                  if (line.startsWith('data: ')) {
                    const data = line.substring(6).trim();
                    if (data === '[DONE]') {
                      log('\n\n✅ Streaming complete!', 'green');
                      log(`📊 Total: ${fullResponse.length} chars`, 'magenta');
                      resolve({ content: fullResponse });
                      return;
                    }
                    
                    try {
                      const event = JSON.parse(data);
                      if (event.type === 'content' && event.content) {
                        fullResponse += event.content;
                        process.stdout.write(COLORS.cyan + event.content + COLORS.reset);
                      } else if (event.type === 'complete' && event.metadata) {
                        log(`\n📊 Tokens: ${event.metadata.tokens?.total || 'unknown'}`, 'magenta');
                      }
                    } catch (e) {}
                  }
                });
              });
              
              streamRes.on('end', () => {
                resolve({ content: fullResponse });
              });
            });
            
            streamReq.on('error', reject);
            streamReq.end();
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  log('\n🧪 QUICK TEST SUITE', 'bright');
  separator('=');
  
  try {
    await testNonStreaming('What is 2+2?', 'Test 1: Simple Math (CHAT)');
    await new Promise(r => setTimeout(r, 1000));
    
    await testStreaming('Tell me a joke about robots', 'Test 2: Streaming (CHAT)');
    
    separator('=');
    log('\n✅ ALL TESTS COMPLETE!', 'green');
    separator('=');
  } catch (error) {
    log('\n❌ Test failed: ' + error.message, 'red');
    process.exit(1);
  }
}

run();
