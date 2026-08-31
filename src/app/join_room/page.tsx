'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useGuestAuth } from '@/hooks/useGuestAuth'
import { Avatar } from '@/components/shared/Avatar'
import { SiteHeader } from '@/components/site/SiteHeader'
import { getGameById } from '@/games/catalog'

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
                    .eq('status', 'waiting')
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
                        if (newRoom.status === 'waiting') {
                            setRooms((previousRooms) => [
                                newRoom,
                                ...previousRooms.filter((room) => room.id !== newRoom.id)
                            ])
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedRoom = payload.new as RoomDirectoryEntry
                        setRooms((previousRooms) => {
                            if (updatedRoom.status !== 'waiting') {
                                return previousRooms.filter((room) => room.id !== updatedRoom.id)
                            }

                            const roomExists = previousRooms.some((room) => room.id === updatedRoom.id)
                            return roomExists
                                ? previousRooms.map((room) =>
                                    room.id === updatedRoom.id ? updatedRoom : room
                                )
                                : [updatedRoom, ...previousRooms]
                        })
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
            <div className="site-shell mobile-page flex min-h-dvh items-center justify-center">
                <div className="h-9 w-9 animate-spin rounded-full border-4 border-[var(--paper-deep)] border-t-[var(--orange)]" />
            </div>
        )
    }

    return (
        <div className="site-shell mobile-page">
            <SiteHeader compact />
            <main className="site-container py-12 sm:py-16">
                    <div className="mb-10 flex min-w-0 flex-col justify-between gap-6 sm:flex-row sm:items-end">
                    <div>
                        <p className="section-kicker">Open rooms</p>
                        <h1 className="mt-3 text-4xl font-black tracking-[-.055em] sm:text-6xl">参加できる公開ルーム</h1>
                        <p className="mt-3 text-[var(--muted)]">ゲーム開始前の部屋だけを表示しています。</p>
                    </div>
                    
                    <Link
                        href="/create_room"
                        className="button-primary"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        新しい部屋をつくる
                    </Link>
                </div>

                {/* Profile Banner */}
                <div className="mb-10 flex items-center gap-4 border-y-2 border-[var(--line)] py-4">
                    <Avatar avatarUrl={profile?.avatar} name={profile?.name ?? 'ゲスト'} size="lg" />
                    <div>
                        <div className="mb-0.5 text-[10px] font-black tracking-widest text-[var(--muted)]">この端末のプレイヤー</div>
                        <div className="text-lg font-black">{profile?.name}</div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center border-t-2 border-[var(--line)] py-20 text-[var(--muted)]">
                        <div className="mb-6 h-10 w-10 animate-spin rounded-full border-4 border-[var(--paper-deep)] border-t-[var(--orange)]" />
                        <p className="font-bold">部屋を探しています…</p>
                    </div>
                ) : rooms.length === 0 ? (
                    <div className="paper-card flex flex-col items-start justify-center px-7 py-16 text-left sm:px-10">
                        <span className="mb-6 text-6xl font-black text-[var(--orange)]">0</span>
                        <h3 className="mb-3 text-2xl font-black">開かれている部屋がありません</h3>
                        <p className="max-w-sm font-medium leading-7 text-[var(--muted)]">
                            現在参加できる部屋がないようです。上のボタンから最初の部屋を作ってみませんか？
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {rooms.map((room) => {
                            const roomName = room.room_name || '無名のルーム'
                            const playerCount = room.player_count
                            const game = getGameById(room.game_type)

                            return (
                                <Link
                                    key={room.id}
                                    href={`/room/${room.id}`}
                                    className="group paper-card flex min-w-0 items-center justify-between gap-3 p-4 transition hover:translate-x-1 hover:shadow-[3px_3px_0_var(--line)] sm:gap-4 sm:p-7"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                                            <h2 className="line-clamp-1 text-xl font-black tracking-[-.03em] sm:text-2xl">
                                                {roomName}
                                            </h2>
                                            <span className="shrink-0 border border-[var(--green)] bg-[#dbe9db] px-2 py-1 text-[10px] font-black text-[var(--green)]">
                                                待機中
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-6 text-sm font-bold">
                                            <div className="flex items-center gap-2 text-[var(--muted)]">
                                                <span className="font-black text-[var(--orange)]">□</span>
                                                <span>{game?.shortName || room.game_type}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[var(--muted)]">
                                                <span className="font-black text-[var(--blue)]">●</span>
                                                <span>{playerCount}人参加中</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid h-12 w-12 shrink-0 place-items-center border-2 border-[var(--line)] bg-[var(--yellow)] text-xl font-black transition-transform group-hover:translate-x-1">
                                        →
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                )}
            </main>
        </div>
    )
}
