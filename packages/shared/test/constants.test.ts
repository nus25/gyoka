import { describe, it, expect } from 'vitest';

import { All_LANGS, DOCUMENT_TYPES } from '../src/constants';

describe('Success cases', () => {
  it('Given constants are loaded When checking All_LANGS Then it is wildcard', () => {
    expect(All_LANGS).toBe('*');
  });

  it('Given constants are loaded When checking document type values Then expected literals are defined', () => {
    expect(DOCUMENT_TYPES.TOS).toBe('tos');
    expect(DOCUMENT_TYPES.PRIVACY_POLICY).toBe('privacy_policy');
  });
});
