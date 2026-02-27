/**
 * @file /api/v1/fetch-url/route.ts
 * @description Fetch and extract text content from a URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

/**
 * SECURITY: Check if hostname resolves to a private/internal IP
 * Prevents SSRF attacks against internal services
 */
async function isPrivateOrInternalUrl(url: URL): Promise<boolean> {
  const hostname = url.hostname.toLowerCase();
  
  // Block localhost variations
  const blockedHosts = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '[::1]',
  ];
  
  if (blockedHosts.includes(hostname)) {
    return true;
  }
  
  // Block internal domain patterns
  if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.localhost')) {
    return true;
  }
  
  // Private IP ranges regex patterns
  const privateIPPatterns = [
    /^10\./, // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
    /^192\.168\./, // 192.168.0.0/16
    /^169\.254\./, // Link-local / AWS metadata
    /^127\./, // Loopback
    /^0\./, // Current network
    /^fc00:/i, // IPv6 unique local
    /^fe80:/i, // IPv6 link-local
    /^::1$/, // IPv6 loopback
    /^::ffff:127\./i, // IPv4-mapped IPv6 loopback
    /^::ffff:10\./i, // IPv4-mapped IPv6 private
    /^::ffff:192\.168\./i, // IPv4-mapped IPv6 private
    /^::ffff:172\.(1[6-9]|2[0-9]|3[01])\./i, // IPv4-mapped IPv6 private
  ];
  
  // Check if hostname is already an IP
  if (privateIPPatterns.some(pattern => pattern.test(hostname))) {
    return true;
  }
  
  // DNS lookup to check resolved IP
  try {
    const { address } = await dnsLookup(hostname);
    if (privateIPPatterns.some(pattern => pattern.test(address))) {
      console.warn(`[Fetch URL] SSRF blocked: ${hostname} resolved to private IP ${address}`);
      return true;
    }
  } catch {
    // DNS lookup failed - could be invalid hostname
    // Let the fetch fail naturally
  }
  
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // SECURITY: Check for SSRF - block internal/private IPs
    if (await isPrivateOrInternalUrl(parsedUrl)) {
      return NextResponse.json(
        { error: 'URL not allowed: internal or private addresses are blocked' },
        { status: 400 }
      );
    }

    // Fetch the URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RedBot/1.0; +https://redbtn.io)',
        'Accept': 'text/html,application/xhtml+xml,text/plain,text/markdown',
      },
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.status}` },
        { status: 400 }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    const html = await response.text();

    // Extract text content
    let content = html;
    let title = parsedUrl.hostname;

    if (contentType.includes('text/html')) {
      // Basic HTML text extraction
      content = extractTextFromHtml(html);
      
      // Try to extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].trim();
      }
    }

    return NextResponse.json({
      content: content.trim(),
      title,
      url,
      contentType,
      charCount: content.length,
    });
  } catch (error) {
    console.error('[Fetch URL] Error:', error);
    
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Request timed out' }, { status: 408 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch URL' },
      { status: 500 }
    );
  }
}

function extractTextFromHtml(html: string): string {
  // Remove script and style tags with content
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Replace common block elements with newlines
  text = text
    .replace(/<\/?(p|div|br|h[1-6]|li|tr|article|section|header|footer|aside|nav)[^>]*>/gi, '\n')
    .replace(/<\/?(ul|ol|table|thead|tbody)[^>]*>/gi, '\n\n');

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));

  // Clean up whitespace
  text = text
    .replace(/\t/g, ' ')
    .replace(/ +/g, ' ')
    .replace(/\n +/g, '\n')
    .replace(/ +\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}
