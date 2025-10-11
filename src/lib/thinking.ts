/**
 * Utility functions for extracting thinking/reasoning from LLM responses
 * Client-side version for the webapp
 */

/**
 * Extracts thinking content from <think>...</think> tags
 * Returns both the thinking and the cleaned content
 */
export function extractThinking(content: string): {
  thinking: string | null;
  cleanedContent: string;
} {
  if (!content || typeof content !== 'string') {
    return { thinking: null, cleanedContent: content || '' };
  }
  
  // Match <think>...</think> tags (case insensitive, multiline)
  const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
  const matches = [...content.matchAll(thinkRegex)];
  
  if (matches.length === 0) {
    // No thinking tags - return content as-is
    return { thinking: null, cleanedContent: content };
  }
  
  // Extract all thinking sections
  const thinkingSections = matches.map(m => m[1].trim());
  const thinking = thinkingSections.join('\n\n---\n\n');
  
  // Remove thinking tags from content and clean up whitespace
  let cleanedContent = content.replace(thinkRegex, '');
  
  // Remove leading/trailing whitespace and collapse multiple newlines
  cleanedContent = cleanedContent
    .trim()
    .replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
  
  return { thinking, cleanedContent };
}
