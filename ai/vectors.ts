import { AI } from "@redbtn/ai";

export async function checkVector(threadId: string) {
    /**
     * 1. Check if the thread has a vector
     * 2. If it does, return the vector
     * 3. If it doesn't, create a vector and add it to the thread
     * 4. Return the vector
     */
    const thread = await AI.getThread(threadId);
    if (thread?.tool_resources?.file_search?.vector_store_ids) {
      return thread.tool_resources.file_search.vector_store_ids[0];
    } else {
      const vector = await AI.createVector({ name: threadId as string, file_ids:[] });
      await AI.editThread(threadId, { tool_resources: { file_search: { vector_store_ids: [vector.id] } } });
      return vector.id;
    }
  }