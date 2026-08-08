import type { AtprotoAudience } from '@atcute/lexicons/syntax';

import { normalizeWebDid } from '@atcute/identity';
import {
  CompositeDidDocumentResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
} from '@atcute/identity-resolver';
import { type Nsid } from '@atcute/lexicons';
import { AuthRequiredError, ForbiddenError } from '@atcute/xrpc-server';
import { ServiceJwtVerifier, type VerifiedJwt } from '@atcute/xrpc-server/auth';
import { Logger } from 'shared/src/logger';

import { createDidResolverFetch } from './didResolverFetch';

const authErrorMessage = 'Missing or invalid authentication credentials';

function parseAdminDidSet(raw: string): Set<string> {
  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

export function createRequireAuth(
  requiredAuth: boolean,
  host: string,
  adminDidsRaw: string,
  ttlSeconds: number,
  logger: Logger
) {
  const serviceDid = normalizeWebDid(`did:web:${host}`);
  const serviceAudience: AtprotoAudience = `${serviceDid}#gyoka_editor` as AtprotoAudience;
  const didResolverFetch = createDidResolverFetch(ttlSeconds, logger);
  const adminDids = parseAdminDidSet(adminDidsRaw);
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
      const verifiedJwt = await jwtVerifier.verifyRequest(request, { lxm });
      if (!adminDids.has(verifiedJwt.issuer)) {
        throw new ForbiddenError({ message: 'Caller is not allowed to access this service' });
      }
      return verifiedJwt;
    } catch (error) {
      if (error instanceof ForbiddenError) {
        throw error;
      }

      if (error instanceof AuthRequiredError) {
        throw new AuthRequiredError({
          message: authErrorMessage,
          headers: error.headers,
        });
      }

      throw new AuthRequiredError({ message: authErrorMessage });
    }
  };
}
