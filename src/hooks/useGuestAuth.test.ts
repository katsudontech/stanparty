import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { AuthSessionMissingError } from '@supabase/supabase-js';

const authMocks = vi.hoisted(() => ({
    getSession: vi.fn(),
    getUser: vi.fn(),
    signInAnonymously: vi.fn(),
    signOut: vi.fn()
}));

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => ({ auth: authMocks })
}));
vi.mock('@/lib/avatarTemplates', () => ({
    getDefaultAvatarUrl: vi.fn()
}));

import { initializeAuthenticatedUser } from './useGuestAuth';

function createUser(id: string): User {
    return { id } as User;
}

describe('initializeAuthenticatedUser', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authMocks.signOut.mockResolvedValue({ error: null });
    });

    it('validates a locally stored session with getUser', async () => {
        const localUser = createUser('local-user');
        const verifiedUser = createUser('verified-user');
        authMocks.getSession.mockResolvedValue({ data: { session: { user: localUser } }, error: null });
        authMocks.getUser.mockResolvedValue({ data: { user: verifiedUser }, error: null });

        await expect(initializeAuthenticatedUser()).resolves.toBe(verifiedUser);
        expect(authMocks.getUser).toHaveBeenCalledOnce();
        expect(authMocks.signInAnonymously).not.toHaveBeenCalled();
    });

    it('signs in anonymously when no local session exists', async () => {
        const anonymousUser = createUser('anonymous-user');
        authMocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
        authMocks.signInAnonymously.mockResolvedValue({ data: { user: anonymousUser }, error: null });

        await expect(initializeAuthenticatedUser()).resolves.toBe(anonymousUser);
        expect(authMocks.signInAnonymously).toHaveBeenCalledOnce();
        expect(authMocks.getUser).not.toHaveBeenCalled();
        expect(authMocks.signOut).not.toHaveBeenCalled();
    });

    it('clears a stale refresh-token session before signing in anonymously', async () => {
        const anonymousUser = createUser('new-anonymous-user');
        authMocks.getSession.mockResolvedValue({
            data: { session: null },
            error: { code: 'refresh_token_not_found', message: 'Invalid Refresh Token' }
        });
        authMocks.signInAnonymously.mockResolvedValue({ data: { user: anonymousUser }, error: null });

        await expect(initializeAuthenticatedUser()).resolves.toBe(anonymousUser);
        expect(authMocks.signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'local' });
        expect(authMocks.signInAnonymously).toHaveBeenCalledOnce();
    });

    it('recovers when the local session is rejected by the Auth server', async () => {
        const anonymousUser = createUser('replacement-user');
        authMocks.getSession.mockResolvedValue({ data: { session: { user: createUser('stale-user') } }, error: null });
        authMocks.getUser.mockResolvedValue({
            data: { user: null },
            error: { code: 'user_not_found', message: 'User not found' }
        });
        authMocks.signInAnonymously.mockResolvedValue({ data: { user: anonymousUser }, error: null });

        await expect(initializeAuthenticatedUser()).resolves.toBe(anonymousUser);
        expect(authMocks.signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'local' });
        expect(authMocks.signInAnonymously).toHaveBeenCalledOnce();
    });

    it('recovers an SDK session-missing error', async () => {
        const anonymousUser = createUser('replacement-user');
        authMocks.getSession.mockResolvedValue({ data: { session: { user: createUser('stale-user') } }, error: null });
        authMocks.getUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() });
        authMocks.signInAnonymously.mockResolvedValue({ data: { user: anonymousUser }, error: null });

        await expect(initializeAuthenticatedUser()).resolves.toBe(anonymousUser);
        expect(authMocks.signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'local' });
        expect(authMocks.signInAnonymously).toHaveBeenCalledOnce();
    });

    it('surfaces nonrecoverable Auth errors without rotating identity', async () => {
        const error = { code: 'over_request_rate_limit', message: 'Try again later' };
        authMocks.getSession.mockResolvedValue({ data: { session: null }, error });

        await expect(initializeAuthenticatedUser()).rejects.toBe(error);
        expect(authMocks.signOut).not.toHaveBeenCalled();
        expect(authMocks.signInAnonymously).not.toHaveBeenCalled();
    });

    it('surfaces anonymous sign-in failures', async () => {
        const error = new Error('anonymous sign-in failed');
        authMocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
        authMocks.signInAnonymously.mockResolvedValue({ data: { user: null }, error });

        await expect(initializeAuthenticatedUser()).rejects.toBe(error);
        expect(authMocks.signInAnonymously).toHaveBeenCalledOnce();
        expect(authMocks.signOut).not.toHaveBeenCalled();
    });
});
