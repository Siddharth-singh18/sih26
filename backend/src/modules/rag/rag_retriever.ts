import { VERIFIED_HEALTH_DOCUMENTS, KnowledgeDocument } from './knowledge_documents';
import { isSourceAllowed, AUTHORITATIVE_SOURCES } from './source_registry';

export interface RetrievedChunk {
  documentId: string;
  source: string;
  title: string;
  section: string;
  url: string;
  publisher: string;
  retrievedAt: string;
  relevanceScore: number;
  snippet: string;
}

export interface RetrievalResult {
  query: string;
  chunks: RetrievedChunk[];
  hasSufficientEvidence: boolean;
  sanitizedQuery: string;
  adversarialAttemptDetected: boolean;
}

/**
 * Sanitizes input text and neutralizes prompt injection patterns.
 * External documents and queries are treated strictly as passive data.
 */
export function sanitizeTextForRAG(input: string): { sanitized: string; isInjectionAttempt: boolean } {
  if (!input) return { sanitized: '', isInjectionAttempt: false };

  const adversarialPatterns = [
    /ignore\s+all\s+previous\s+instructions/i,
    /system\s*:\s*you\s+are\s+now/i,
    /override\s+(safety|clinical|rules)/i,
    /jailbreak/i,
    /bypass\s+policy/i,
    /drop\s+table/i,
    /<script[\s\S]*?>[\s\S]*?<\/script>/i
  ];

  let isInjectionAttempt = false;
  for (const pattern of adversarialPatterns) {
    if (pattern.test(input)) {
      isInjectionAttempt = true;
      break;
    }
  }

  // Strip malicious command overrides
  const sanitized = input
    .replace(/ignore\s+all\s+previous\s+instructions/gi, '[REDACTED_ADVERSARIAL_INSTRUCTION]')
    .replace(/system\s*:\s*you\s+are\s+now/gi, '[REDACTED_ADVERSARIAL_INSTRUCTION]')
    .replace(/override\s+safety/gi, '[REDACTED_ADVERSARIAL_INSTRUCTION]')
    .trim();

  return { sanitized, isInjectionAttempt };
}

/**
 * BM25 / Keyword token matching across verified documents
 */
export function retrieveVerifiedHealthKnowledge(query: string, topK: number = 3): RetrievalResult {
  const { sanitized, isInjectionAttempt } = sanitizeTextForRAG(query);
  const searchTerms = sanitized
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);

  if (searchTerms.length === 0) {
    return {
      query,
      chunks: [],
      hasSufficientEvidence: false,
      sanitizedQuery: sanitized,
      adversarialAttemptDetected: isInjectionAttempt
    };
  }

  const scoredDocs = VERIFIED_HEALTH_DOCUMENTS.map(doc => {
    // Confirm source is approved in registry
    if (!isSourceAllowed(doc.source)) {
      return { doc, score: 0 };
    }

    let score = 0;
    const docText = `${doc.title} ${doc.topic} ${doc.keywords.join(' ')} ${doc.summary} ${doc.content}`.toLowerCase();

    for (const term of searchTerms) {
      if (doc.keywords.some(k => k.toLowerCase() === term)) {
        score += 15; // High weight for keyword match
      }
      if (doc.title.toLowerCase().includes(term)) {
        score += 10;
      }
      if (doc.summary.toLowerCase().includes(term)) {
        score += 5;
      }
      if (docText.includes(term)) {
        score += 2;
      }
    }

    return { doc, score };
  });

  // Filter and sort by relevance score
  const validScored = scoredDocs
    .filter(item => item.score > 5)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const chunks: RetrievedChunk[] = validScored.map(({ doc, score }) => {
    // Treat snippet strictly as passive sanitized data
    const safeSnippet = doc.summary.replace(/system:/gi, '');
    return {
      documentId: doc.documentId,
      source: doc.source,
      title: doc.title,
      section: doc.section,
      url: doc.url,
      publisher: doc.publisher,
      retrievedAt: doc.retrievedAt,
      relevanceScore: score,
      snippet: safeSnippet
    };
  });

  const hasSufficientEvidence = chunks.length > 0 && chunks[0].relevanceScore >= 10;

  return {
    query,
    chunks,
    hasSufficientEvidence,
    sanitizedQuery: sanitized,
    adversarialAttemptDetected: isInjectionAttempt
  };
}

