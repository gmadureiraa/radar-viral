/**
 * Server-side JWT validation — espelha pattern do reels-viral.
 *
 * Dois helpers:
 *  - getOptionalUserId(req): retorna user ou null silenciosamente
 *  - requireUserId(req): retorna { user } ou { response: 401 }
 */

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const JWKS_URL =
  process.env.NEON_AUTH_JWKS_URL ??
  process.env.NEXT_PUBLIC_NEON_AUTH_JWKS_URL ??
  "";

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!JWKS_URL) return null;
  if (!_jwks) _jwks = createRemoteJWKSet(new URL(JWKS_URL));
  return _jwks;
}

export interface AuthedUser {
  id: string;
  email?: string;
  payload: JWTPayload;
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!auth) return null;
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return m ? m[1] : null;
}

export async function getOptionalUserId(req: Request): Promise<AuthedUser | null> {
  const token = getBearerToken(req);
  if (!token) return null;
  const jwks = getJwks();
  if (!jwks) return null;
  try {
    const { payload } = await jwtVerify(token, jwks);
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      payload,
    };
  } catch {
    return null;
  }
}

export async function requireUserId(
  req: Request,
): Promise<{ user: AuthedUser } | { response: Response }> {
  const user = await getOptionalUserId(req);
  if (!user) {
    return {
      response: Response.json(
        { error: "Login necessário pra essa ação." },
        { status: 401 },
      ),
    };
  }
  return { user };
}
