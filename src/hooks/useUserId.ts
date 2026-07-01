import { useGuestAuth } from './useGuestAuth';

export function useUserId() {
    const { profile } = useGuestAuth();
    return profile?.id || null;
}
