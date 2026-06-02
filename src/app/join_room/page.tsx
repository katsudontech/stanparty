// src/app/rooms/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Room {
    id: string
    host_id: string
    game_type: string
    status: string
    players: any[]
    game_state: {
        roomName?: string
        [key: string]: any
    }
    created_at: string
}

export default function RoomsListPage() {
    const [rooms, setRooms] = useState<Room[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        // ① 最初に、現在DBにあるルーム一覧を全部持ってくる
        const fetchRooms = async () => {
            try {
                setLoading(true)
                const { data, error } = await supabase
                    .from('rooms')
                    .select('*')
                    .order('created_at', { ascending: false }) // 新しい部屋が上に来るように

                if (error) throw error
                if (data) setRooms(data as Room[])
            } catch (err) {
                console.error('ルーム一覧の取得に失敗:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchRooms()

        // ② リアルタイム通信（Realtime）でroomsテーブルの動きを監視！
        const channel = supabase
            .channel('rooms_list_realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'rooms' },
                (payload) => {
                    console.log('部屋に変化があったよ！', payload)

                    if (payload.eventType === 'INSERT') {
                        // 新しく部屋が作られたら、一覧の先頭に追加
                        setRooms((prev) => [payload.new as Room, ...prev])
                    } else if (payload.eventType === 'UPDATE') {
                        // 部屋の状態（ステータスや参加人数など）が変わったら、一覧のデータを更新
                        setRooms((prev) =>
                            prev.map((room) =>
                                room.id === payload.new.id ? (payload.new as Room) : room
                            )
                        )
                    } else if (payload.eventType === 'DELETE') {
                        // 部屋が削除されたら、一覧から消す
                        setRooms((prev) => prev.filter((room) => room.id === payload.old.id))
                    }
                }
            )
            .subscribe()

        // 画面を閉じるときは監視をストップ
        return () => {
            supabase.removeChannel(channel)
        }
    }, [supabase])

    if (loading) return <div className="p-8">ルーム一覧を読み込み中...</div>

    return (
        <div className="p-8 font-sans max-w-xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">🏠 稼働中のルーム一覧</h1>
                {/* さっき作った部屋作成画面へのリンクもついでに配置 */}
                <Link
                    href="/create_room"
                    className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors"
                >
                    ＋ 新しい部屋を作る
                </Link>
            </div>

            {rooms.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-gray-200 rounded-2xl text-gray-400">
                    現在、開かれている部屋はありません。<br />
                    右上のボタンから最初の部屋を作ってみてね！
                </div>
            ) : (
                <div className="space-y-4">
                    {rooms.map((room) => {
                        // game_stateの中に入れたルーム名を取り出す（なければ暫定の文字）
                        const roomName = room.game_state?.roomName || '無名のルーム'
                        const playerCount = room.players?.length || 0

                        return (
                            <Link
                                key={room.id}
                                href={`/room/${room.id}`}
                                className="block p-5 bg-white border border-gray-200 rounded-2xl shadow-sm hover:border-blue-400 hover:shadow-md transition-all group"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h2 className="text-lg font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                                        {roomName}
                                    </h2>
                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${room.status === 'waiting'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        {room.status === 'waiting' ? '待機中' : 'プレイ中'}
                                    </span>
                                </div>

                                <div className="flex gap-4 text-xs text-gray-500 font-medium">
                                    <div>ゲーム: <span className="text-gray-700 font-semibold">{room.game_type}</span></div>
                                    <div>参加人数: <span className="text-gray-700 font-semibold">{playerCount} 人</span></div>
                                </div>

                                <div className="mt-3 text-right text-xs text-blue-500 font-bold group-hover:underline">
                                    この部屋に入る →
                                </div>
                            </Link>
                        )
                    })}
                </div>
            )}
        </div>
    )
}