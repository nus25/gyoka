export const All_LANGS = '*';

export const DOCUMENT_TYPES = {
  TOS: 'tos' as const,
  PRIVACY_POLICY: 'privacy_policy' as const,
} as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES];
