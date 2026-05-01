/**
 * Neon Auth client — lazy load (espelha pattern do reels-viral).
 *
 * IMPORTANTE: Não chamar `client.getJWTToken()` direto. Better Auth client
 * é Proxy: método inexistente vira POST kebab-case (`getJWTToken` →
 * /get-j-w-t-token 404). Use getSession() e extraia data.session.token.
 */

"use client";

import { useEffect, useState } from "react";

const NEON_AUTH_URL = process.env.NEXT_PUBLIC_NEON_AUTH_URL ?? "";

export function isAuthConfigured(): boolean {
  return Boolean(NEON_AUTH_URL && NEON_AUTH_URL.startsWith("http"));
}

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
}

export interface SessionState {
  data: { user: SessionUser } | null;
  isPending: boolean;
}

interface SignInResult {
  error?: { message?: string } | null;
}

interface SocialSignInArgs {
  provider: "google";
  callbackURL?: string;
}

export interface NeonAuthClient {
  signIn: {
    email: (args: { email: string; password: string }) => Promise<SignInResult>;
    social: (args: SocialSignInArgs) => Promise<SignInResult>;
  };
  signUp: {
    email: (args: {
      email: string;
      password: string;
      name?: string;
    }) => Promise<SignInResult>;
  };
  signOut: () => Promise<unknown>;
  getSession: () => Promise<{
    data?: {
      user?: { id: string; email?: string; name?: string | null };
      session?: { token?: string };
    };
  } | null>;
}

let cachedClient: NeonAuthClient | null = null;
let pendingPromise: Promise<NeonAuthClient> | null = null;

export async function getAuthClient(): Promise<NeonAuthClient> {
  if (cachedClient) return cachedClient;
  if (pendingPromise) return pendingPromise;
  pendingPromise = (async () => {
    const [{ createAuthClient }, { BetterAuthReactAdapter }] = await Promise.all([
      import("@neondatabase/auth"),
      import("@neondatabase/auth/react/adapters"),
    ]);
    const client = createAuthClient(NEON_AUTH_URL, {
      adapter: BetterAuthReactAdapter(),
    }) as unknown as NeonAuthClient;
    cachedClient = client;
    return client;
  })();
  try {
    return await pendingPromise;
  } finally {
    pendingPromise = null;
  }
}

export async function getJwtToken(): Promise<string | null> {
  if (!isAuthConfigured()) return null;
  try {
    const client = await getAuthClient();
    const session = await client.getSession();
    return session?.data?.session?.token ?? null;
  } catch {
    return null;
  }
}

export function useNeonSession(): SessionState & { refresh: () => void } {
  const initialPending = isAuthConfigured();
  const [state, setState] = useState<SessionState>({
    data: null,
    isPending: initialPending,
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!isAuthConfigured()) return;
    let cancel = false;
    void (async () => {
      try {
        const client = await getAuthClient();
        const sess = await client.getSession();
        if (cancel) return;
        const user = sess?.data?.user;
        if (user) {
          setState({
            data: {
              user: {
                id: user.id,
                email: user.email ?? "",
                name: user.name ?? null,
              },
            },
            isPending: false,
          });
        } else {
          setState({ data: null, isPending: false });
        }
      } catch {
        if (!cancel) setState({ data: null, isPending: false });
      }
    })();
    return () => {
      cancel = true;
    };
  }, [version]);

  return { ...state, refresh: () => setVersion((v) => v + 1) };
}
