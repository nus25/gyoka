import type { AtprotoAudience } from '@atcute/lexicons/syntax';

import { normalizeWebDid } from '@atcute/identity';
import {
  CompositeDidDocumentResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
} from '@atcute/identity-resolver';
import { type Nsid } from '@atcute/lexicons';
import { AuthRequiredError } from '@atcute/xrpc-server';
import { ServiceJwtVerifier, type VerifiedJwt } from '@atcute/xrpc-server/auth';
import { Logger } from 'shared/src/logger';

import { createDidResolverFetch } from './didResolverFetch';

const authErrorMessage = 'Missing or invalid authentication credentials';

export function createRequireAuth(
  requiredAuth: boolean,
  host: string,
  ttlSeconds: number,
  logger: Logger
) {
  const serviceDid = normalizeWebDid(`did:web:${host}`);
  const serviceAudience: AtprotoAudience = (serviceDid + '#atproto') as AtprotoAudience;
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
    acceptAudiences: [serviceDid, serviceAudience],
    resolver: didDocResolver,
  });

  return async (request: Request, lxm: Nsid): Promise<VerifiedJwt | null> => {
    if (!requiredAuth) {
      return null;
    }

    try {
      return await jwtVerifier.verifyRequest(request, { lxm });
    } catch (error) {
      if (error instanceof AuthRequiredError) {
        throw new AuthRequiredError({
          message: authErrorMessage,
          headers: error.headers,
        });
      }

      // Keep the auth response shape stable for unexpected verifier failures.
      throw new AuthRequiredError({ message: authErrorMessage });
    }
  };
}
