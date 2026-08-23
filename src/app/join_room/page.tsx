'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useGuestAuth } from '@/hooks/useGuestAuth'
import { Avatar } from '@/components/shared/Avatar'

interface RoomDirectoryEntry {
    id: string
    room_name: string | null
    game_type: string
    status: string
    player_count: number
    created_at: string
}

export default function RoomsListPage() {
    const [rooms, setRooms] = useState<RoomDirectoryEntry[]>([])
    const [loading, setLoading] = useState(true)
    const { profile, loading: authLoading } = useGuestAuth()

    useEffect(() => {
        if (authLoading) return

        const supabase = createClient()

        const fetchRooms = async () => {
            try {
                setLoading(true)
                const { data, error } = await supabase
                    .from('room_directory')
                    .select('id, room_name, game_type, status, player_count, created_at')
                    .order('created_at', { ascending: false })

                if (error) throw error
                if (data) setRooms(data as RoomDirectoryEntry[])
            } catch (err) {
                console.error('ルーム一覧の取得に失敗:', err)
            } finally {
                setLoading(false)
            }
        }

        void fetchRooms()

        const channel = supabase
            .channel('rooms_list_realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'room_directory' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newRoom = payload.new as RoomDirectoryEntry
                        setRooms((previousRooms) => [
                            newRoom,
                            ...previousRooms.filter((room) => room.id !== newRoom.id)
                        ])
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedRoom = payload.new as RoomDirectoryEntry
                        setRooms((previousRooms) =>
                            previousRooms.map((room) =>
                                room.id === updatedRoom.id ? updatedRoom : room
                            )
                        )
                    } else if (payload.eventType === 'DELETE') {
                        const deletedRoom = payload.old as { id?: string }
                        setRooms((previousRooms) =>
                            previousRooms.filter((room) => room.id !== deletedRoom.id)
                        )
                    }
                }
            )
            .subscribe()

        return () => {
            void supabase.removeChannel(channel)
        }
    }, [authLoading])

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="w-8 h-8 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-6 flex flex-col items-center selection:bg-fuchsia-500/30 relative overflow-x-hidden">
            {/* Background elements */}
            <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-fuchsia-600/10 blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '7s' }} />
            <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '5s' }} />

            <div className="w-full max-w-2xl pt-12 relative z-10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 gap-6">
                    <div>
                        <Link href="/" className="inline-flex items-center gap-2 text-fuchsia-400 hover:text-fuchsia-300 font-bold mb-4 transition-colors group">
                            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            ホームに戻る
                        </Link>
                        <h1 className="text-4xl font-black text-white tracking-tight">稼働中のルーム</h1>
                    </div>
                    
                    <Link
                        href="/create_room"
                        className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-2xl font-bold transition-all hover:-translate-y-1 shadow-[0_0_30px_-10px_rgba(192,38,211,0.5)] hover:shadow-[0_0_40px_-10px_rgba(192,38,211,0.7)]"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        新しい部屋を作る
                    </Link>
                </div>

                {/* Profile Banner */}
                <div className="flex items-center gap-4 px-6 py-4 mb-10 bg-white/5 border border-white/10 rounded-[2rem] backdrop-blur-md shadow-lg">
                    <Avatar avatarUrl={profile?.avatar} name={profile?.name ?? 'ゲスト'} size="lg" />
                    <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">あなたのプロフィール</div>
                        <div className="font-bold text-white text-lg">{profile?.name}</div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                        <div className="w-10 h-10 border-4 border-slate-700 border-t-fuchsia-500 rounded-full animate-spin mb-6"></div>
                        <p className="font-bold tracking-wider">ルームを探しています...</p>
                    </div>
                ) : rooms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 px-6 text-center border-2 border-dashed border-white/10 rounded-[2.5rem] bg-black/20 backdrop-blur-sm">
                        <div className="w-20 h-20 mb-6 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                            <svg className="w-10 h-10 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        </div>
                        <h3 className="text-2xl font-black text-white mb-3">開かれている部屋がありません</h3>
                        <p className="text-slate-400 max-w-sm mb-6 font-medium leading-relaxed">
                            現在参加できる部屋がないようです。上のボタンから最初の部屋を作ってみませんか？
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-5">
                        {rooms.map((room) => {
                            const roomName = room.room_name || '無名のルーム'
                            const playerCount = room.player_count
                            const isWaiting = room.status === 'waiting'

                            return (
                                <Link
                                    key={room.id}
                                    href={`/room/${room.id}`}
                                    className="group relative flex items-center justify-between p-6 sm:p-8 bg-slate-900/50 border border-white/10 rounded-[2rem] hover:bg-slate-800/80 hover:border-fuchsia-500/50 transition-all duration-300 hover:shadow-[0_0_40px_-15px_rgba(192,38,211,0.3)] hover:-translate-y-1 overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/0 via-fuchsia-500/5 to-fuchsia-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                    
                                    <div className="relative z-10 flex-1 pr-6">
                                        <div className="flex items-center gap-3 mb-3">
                                            <h2 className="text-2xl font-black text-white group-hover:text-fuchsia-300 transition-colors line-clamp-1">
                                                {roomName}
                                            </h2>
                                            <span className={`shrink-0 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest ${
                                                isWaiting 
                                                    ? 'bg-green-500/20 text-green-400 border border-green-500/20' 
                                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                            }`}>
                                                {isWaiting ? '待機中' : 'プレイ中'}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-6 text-sm font-bold">
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <svg className="w-4 h-4 text-fuchsia-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                <span className="text-slate-300">{room.game_type}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <svg className="w-4 h-4 text-indigo-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                                <span className="text-slate-300">{playerCount} 人参加中</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="relative z-10 flex items-center justify-center w-14 h-14 rounded-full bg-white/5 border border-white/10 group-hover:bg-fuchsia-600 group-hover:border-fuchsia-500 transition-all duration-300 shrink-0">
                                        <svg className="w-6 h-6 text-white group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
