export interface KnowledgeDocument {
  sourceId: string;
  fingerprint: string;
  title: string;
  sections: readonly { title: string; text: string }[];
}
export interface KnowledgeIngestionAdapter {
  ingest(document: KnowledgeDocument): Promise<{ providerReference: string }>;
  remove(sourceId: string): Promise<void>;
}
// No configured adapter or worker: publication must never imply successful indexing.
export function configuredKnowledgeAdapter(): KnowledgeIngestionAdapter | null { return null; }
