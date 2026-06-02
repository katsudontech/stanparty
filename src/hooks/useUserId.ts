import { useState, useEffect } from 'react';

export function useUserId() {
    const [myUserId, setMyUserId] = useState<string | null>(null);

    useEffect(() => {
        // TODO: ここは、本来はSupabase AuthのユーザーIDを使う想定
        let id = localStorage.getItem('mock_user_id');
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem('mock_user_id', id);
        }
        setMyUserId(id);
    }, []);

    return myUserId;
}
