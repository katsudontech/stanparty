import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { isAuthSessionMissingError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { getDefaultAvatarUrl } from '@/lib/avatarTemplates';

export interface GuestDisplayProfile {
    name: string;
    avatar: string;
}

export interface GuestProfile extends GuestDisplayProfile {
    id: string;
}

const GUEST_PROFILE_STORAGE_KEY = 'guest_profile';
let authenticatedUserPromise: Promise<User> | null = null;

const RECOVERABLE_AUTH_ERROR_CODES = new Set([
    'refresh_token_not_found',
    'refresh_token_already_used',
    'session_not_found',
    'session_expired',
    'user_not_found',
    'bad_jwt'
]);

export function isRecoverableAuthError(error: unknown): boolean {
    if (isAuthSessionMissingError(error)) return true;

    if (typeof error !== 'object' || error === null || !('code' in error)) {
        return false;
    }

    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' && RECOVERABLE_AUTH_ERROR_CODES.has(code);
}

function readGuestDisplayProfile(): GuestDisplayProfile | null {
    const storedProfile = localStorage.getItem(GUEST_PROFILE_STORAGE_KEY);
    if (!storedProfile) return null;

    try {
        const parsedProfile: unknown = JSON.parse(storedProfile);
        if (
            typeof parsedProfile === 'object' &&
            parsedProfile !== null &&
            'name' in parsedProfile &&
            typeof parsedProfile.name === 'string' &&
            'avatar' in parsedProfile &&
            typeof parsedProfile.avatar === 'string'
        ) {
            return {
                name: parsedProfile.name,
                avatar: parsedProfile.avatar
            };
        }
    } catch {
        // Invalid legacy data is replaced with a new display profile below.
    }

    return null;
}

export function saveGuestDisplayProfile(profile: GuestDisplayProfile) {
    localStorage.setItem(
        GUEST_PROFILE_STORAGE_KEY,
        JSON.stringify({ name: profile.name, avatar: profile.avatar })
    );
}

async function signInAnonymously(supabase: ReturnType<typeof createClient>): Promise<User> {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    if (!data.user) throw new Error('Anonymous authentication did not return a user.');

    return data.user;
}

async function clearLocalAuthSession(supabase: ReturnType<typeof createClient>): Promise<void> {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
}

export async function initializeAuthenticatedUser(): Promise<User> {
    const supabase = createClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
        if (!isRecoverableAuthError(sessionError)) throw sessionError;

        await clearLocalAuthSession(supabase);
        return signInAnonymously(supabase);
    }

    if (!sessionData.session) return signInAnonymously(supabase);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
        if (!isRecoverableAuthError(userError)) throw userError;

        await clearLocalAuthSession(supabase);
        return signInAnonymously(supabase);
    }

    if (!userData.user) {
        throw new Error('Authenticated session did not return a user.');
    }

    return userData.user;
}

function getAuthenticatedUser(): Promise<User> {
    if (!authenticatedUserPromise) {
        authenticatedUserPromise = initializeAuthenticatedUser().finally(() => {
            authenticatedUserPromise = null;
        });
    }

    return authenticatedUserPromise;
}

export function useGuestAuth() {
    const [profile, setProfile] = useState<GuestProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const initAuth = async () => {
            try {
                const authenticatedUser = await getAuthenticatedUser();
                const storedProfile = readGuestDisplayProfile();
                const displayProfile = storedProfile ?? {
                    name: `Guest_${Math.floor(1000 + Math.random() * 9000)}`,
                    avatar: getDefaultAvatarUrl(authenticatedUser.id)
                };
                const authenticatedProfile = {
                    id: authenticatedUser.id,
                    ...displayProfile
                };

                // Remove the old impersonation key and rewrite legacy profiles without their UUID.
                localStorage.removeItem('mock_user_id');
                saveGuestDisplayProfile(displayProfile);

                const supabase = createClient();
                const { error: profileError } = await supabase
                    .from('users')
                    .upsert([authenticatedProfile]);

                if (profileError) {
                    console.warn('Could not synchronize guest profile:', profileError);
                }

                setProfile(authenticatedProfile);
                setError(null);
            } catch (err) {
                console.error('Failed to init guest auth', err);
                setError(err instanceof Error ? err : new Error('Failed to initialize guest authentication.'));
            } finally {
                setLoading(false);
            }
        };

        initAuth();
    }, []);

    return { profile, loading, error };
}
