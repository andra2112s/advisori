import { MemoryService } from '../services/memoryService.js';

export default async function memoryRoutes(app) {
  // Get memory context for AI
  app.get('/context', {
    preHandler: [app.authenticate]
  }, async (req, reply) => {
    const { sessionId } = req.query;
    const userId = req.user.id;

    const context = await MemoryService.getMemoryContext(userId, sessionId || 'default');
    reply.send(context);
  });

  // Add session message
  app.post('/session', {
    preHandler: [app.authenticate]
  }, async (req, reply) => {
    const { sessionId, message } = req.body;
    const userId = req.user.id;

    const result = await MemoryService.addSessionMessage(userId, sessionId, message);
    reply.send(result);
  });

  // Get session messages
  app.get('/session/:sessionId', {
    preHandler: [app.authenticate]
  }, async (req, reply) => {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const messages = await MemoryService.getSessionMessages(userId, sessionId);
    reply.send({ messages });
  });

  // Add long-term memory
  app.post('/long-term', {
    preHandler: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['type', 'content'],
        properties: {
          type: { 
            type: 'string', 
            enum: ['preference', 'event', 'relationship', 'goal', 'insight', 'learning']
          },
          title: { type: 'string', maxLength: 255 },
          content: { type: 'string', minLength: 1 },
          importance: { type: 'integer', minimum: 1, maximum: 10 },
          tags: { type: 'array', items: { type: 'string' } },
          metadata: { type: 'object' }
        }
      }
    }
  }, async (req, reply) => {
    const userId = req.user.id;
    const memory = await MemoryService.addLongTermMemory(userId, req.body);
    reply.send({ memory, ok: true });
  });

  // Get long-term memories
  app.get('/long-term', {
    preHandler: [app.authenticate]
  }, async (req, reply) => {
    const { type, limit = 50 } = req.query;
    const userId = req.user.id;

    let memories;
    if (type) {
      memories = await MemoryService.getMemoriesByType(userId, type, parseInt(limit));
    } else {
      memories = await MemoryService.getImportantMemories(userId, parseInt(limit));
    }

    reply.send({ memories });
  });

  // Consolidate session memories
  app.post('/consolidate/:sessionId', {
    preHandler: [app.authenticate]
  }, async (req, reply) => {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const result = await MemoryService.consolidateSessionMemories(userId, sessionId);
    reply.send({ result, ok: true });
  });

  // Update session context
  app.patch('/session/:sessionId/context', {
    preHandler: [app.authenticate]
  }, async (req, reply) => {
    const { sessionId } = req.params;
    const { context } = req.body;
    const userId = req.user.id;

    const result = await MemoryService.updateSessionContext(userId, sessionId, context);
    reply.send({ result, ok: true });
  });
}
