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

async function testStreaming() {
  log('\n🧪 Testing Streaming API', 'bright');
  
  const postData = JSON.stringify({
    messages: [
      { role: 'user', content: 'Tell me a very short story about a robot' }
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
    let buffer = '';
    
    res.on('data', (chunk) => {
      buffer += chunk.toString();
      
      // Try to parse the response
      try {
        const parsed = JSON.parse(buffer);
        
        if (parsed.stream_url) {
          log(`\n✅ Got stream URL: ${parsed.stream_url}`, 'green');
          log(`📋 Message ID: ${parsed.id}`, 'cyan');
          log(`🔗 Conversation ID: ${parsed.conversationId}`, 'cyan');
          log('\n📝 Connecting to stream...', 'yellow');
          
          // Connect to stream
          const streamReq = http.request({
            hostname: 'localhost',
            port: 3000,
            path: parsed.stream_url,
            method: 'GET'
          }, (streamRes) => {
            log('📡 Stream connected!\n', 'green');
            
            streamRes.on('data', (streamChunk) => {
              const text = streamChunk.toString();
              const lines = text.split('\n');
              
              lines.forEach(line => {
                if (line.startsWith('data: ')) {
                  const data = line.substring(6).trim();
                  
                  if (data === '[DONE]') {
                    log('\n\n✅ Stream completed!', 'green');
                    process.exit(0);
                  }
                  
                  try {
                    const chunk = JSON.parse(data);
                    // Handle the actual stream format: {type: 'content', content: '...'}
                    if (chunk.type === 'content' && chunk.content) {
                      process.stdout.write(COLORS.cyan + chunk.content + COLORS.reset);
                    } else if (chunk.type === 'complete') {
                      log('\n\n📊 Metadata:', 'magenta');
                      log(JSON.stringify(chunk.metadata, null, 2), 'cyan');
                    } else if (chunk.type === 'error') {
                      log(`\n\n❌ Error: ${chunk.error}`, 'red');
                    }
                  } catch (e) {
                    // Ignore parse errors
                  }
                }
              });
            });
            
            streamRes.on('end', () => {
              log('\n\n✅ Stream ended', 'green');
              process.exit(0);
            });
          });
          
          streamReq.on('error', (err) => {
            log(`\n❌ Stream error: ${err.message}`, 'red');
            process.exit(1);
          });
          
          streamReq.end();
        }
      } catch (e) {
        // Not JSON yet, keep buffering
      }
    });
  });

  req.on('error', (err) => {
    log(`❌ Request error: ${err.message}`, 'red');
    process.exit(1);
  });

  req.write(postData);
  req.end();
}

testStreaming();
