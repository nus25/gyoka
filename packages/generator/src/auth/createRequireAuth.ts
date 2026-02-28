import { type Nsid } from '@atcute/lexicons';
import { normalizeWebDid } from '@atcute/identity';
import { AuthRequiredError } from '@atcute/xrpc-server';
import { ServiceJwtVerifier, type VerifiedJwt } from '@atcute/xrpc-server/auth';
import { Logger } from 'shared/src/logger';
import {
  CompositeDidDocumentResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
} from '@atcute/identity-resolver';

import { createDidResolverFetch } from './didResolverFetch';

export function createRequireAuth(
  requiedAuth: boolean,
  host: string,
  ttlSeconds: number,
  logger: Logger
) {
  const serviceDid = normalizeWebDid(`did:web:${host}`);
  const didResolverFetch = createDidResolverFetch(ttlSeconds, logger);
  const didDocResolver = new CompositeDidDocumentResolver({
    methods: {
      plc: new PlcDidDocumentResolver({
        fetch: didResolverFetch,
      }),
      web: new WebDidDocumentResolver({
        fetch: didResolverFetch,
      }),
    },
  });

  const jwtVerifier = new ServiceJwtVerifier({
    serviceDid,
    resolver: didDocResolver,
  });

  return async (request: Request, lxm: Nsid): Promise<VerifiedJwt | null> => {
    if (!requiedAuth) {
      return null;
    }

    const auth = request.headers.get('authorization');
    if (auth === null) {
      throw new AuthRequiredError({ description: 'missing authorization header' });
    }
    if (!auth.startsWith('Bearer ')) {
      throw new AuthRequiredError({ description: 'invalid authorization scheme' });
    }

    const jwtString = auth.slice('Bearer '.length).trim();

    const result = await jwtVerifier.verify(jwtString, { lxm });
    if (!result.ok) {
      if ('error' in result) {
        throw new AuthRequiredError(result.error);
      }
      throw new AuthRequiredError({ description: 'invalid authorization token' });
    }

    return result.value;
  };
}
