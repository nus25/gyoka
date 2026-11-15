import { describe, expect, it } from 'vitest';

import { ENDPOINT_PATH, getDidDocument } from './getDidDocument.shared';

describe(ENDPOINT_PATH, () => {
  describe('Boundary cases', () => {
    it('Given did document endpoint is called When response is parsed Then required DID fields are present', async () => {
      const { response, json } = await getDidDocument();

      expect(response.status).toBe(200);
      expect(Array.isArray(json['@context'])).toBe(true);
      expect(typeof json.id).toBe('string');
      expect(Array.isArray(json.service)).toBe(true);
      expect(json.service).toHaveLength(1);
    });
  });
});
