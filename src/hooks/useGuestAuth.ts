import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface GuestProfile {
    id: string;
    name: string;
    avatar: string;
}

export function useGuestAuth() {
    const [profile, setProfile] = useState<GuestProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const initAuth = async () => {
            try {
                // Check if we already have a profile
                const storedStr = localStorage.getItem('guest_profile');
                if (storedStr) {
                    const parsed = JSON.parse(storedStr);
                    setProfile(parsed);
                    setLoading(false);
                    return;
                }

                // Fallback to legacy mock_user_id to migrate existing test users if they have one
                const legacyId = localStorage.getItem('mock_user_id');
                if (legacyId) {
                    const { data } = await supabase.from('users').select('*').eq('id', legacyId).single();
                    if (data) {
                        const legacyProfile = { id: data.id, name: data.name, avatar: data.avatar };
                        localStorage.setItem('guest_profile', JSON.stringify(legacyProfile));
                        setProfile(legacyProfile);
                        setLoading(false);
                        return;
                    }
                }

                // Create new guest profile
                const newId = crypto.randomUUID();
                const newName = `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
                const newAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${newId}`;

                const newProfile = { id: newId, name: newName, avatar: newAvatar };

                try {
                    // Try to insert into users table just in case it's required for foreign keys
                    const { error } = await supabase.from('users').insert([newProfile]);
                    if (error) {
                        console.warn('Could not insert guest into users table:', error);
                    }
                } catch (insertError) {
                    console.warn('Network error or Supabase unavailable, continuing with local guest profile:', insertError);
                }

                localStorage.setItem('guest_profile', JSON.stringify(newProfile));
                setProfile(newProfile);
            } catch (err) {
                console.error('Failed to init guest auth', err);
            } finally {
                setLoading(false);
            }
        };

        initAuth();
    }, [supabase]);

    return { profile, loading };
}
