// src/app/create-room/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface MyProfile {
    id: string
    name: string
    avatar: string
}

export default function CreateRoomPage() {
    const [roomName, setRoomName] = useState('')
    const [myProfile, setMyProfile] = useState<MyProfile | null>(null)
    const [createdRoomId, setCreatedRoomId] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [checkingAuth, setCheckingAuth] = useState(true)

    const router = useRouter()
    const supabase = createClient()

    // ① 画面が開いた時に、いま誰でログイン（仮）しているかを確認する
    useEffect(() => {
        const checkMyAuth = async () => {
            try {
                // 仮の処理！本番環境は、googleログインにするよーー
                const savedUserId = localStorage.getItem('mock_user_id')
                if (!savedUserId) {
                    setCheckingAuth(false)
                    return
                }

                // localStorageにあるIDをもとに、usersテーブルから名前とかを取ってくる
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', savedUserId)
                    .single()

                if (data) {
                    setMyProfile(data as MyProfile)
                }
            } catch (err) {
                console.error('ユーザー情報の取得に失敗:', err)
            } finally {
                setCheckingAuth(false)
            }
        }

        checkMyAuth()
    }, [supabase])

    // ② 「部屋を作成」ボタンを押した時の処理
    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!roomName.trim() || !myProfile) return

        setLoading(true)
        setCreatedRoomId(null)

        try {
            // 仕様書の設計に沿って、roomsテーブルにインサートするよ
            const { data, error } = await supabase
                .from('rooms')
                .insert([
                    {
                        host_id: myProfile.id,
                        game_type: 'fake-artist', // 第一弾ゲーム固定
                        status: 'waiting',        // 待機室状態からスタート

                        // 参加者リスト（仕様書通り、まずは自分をホストとして配列に入れる）
                        players: [
                            {
                                userId: myProfile.id,
                                name: myProfile.name,
                                avatarUrl: myProfile.avatar,
                                isHost: true,
                                color: '#FF0000', // とりあえず赤
                                isOnline: true
                            }
                        ],
                        room_name: roomName
                    }
                ])
                .select() // インサートしたデータを返してもらう（IDを知るため）
                .single()

            if (error) throw error

            if (data) {
                setCreatedRoomId(data.id)
                // 部屋作成に成功したら自動的にその部屋へ遷移する
                router.push(`/room/${data.id}`)
            }
        } catch (err: any) {
            console.error('部屋作成エラー:', err)
            alert(`失敗しちゃった: ${err.message}`)
        } finally {
            setLoading(false)
        }
    }

    if (checkingAuth) return <div className="p-8">ログイン状態を確認中...</div>

    // 仮ログインしていない場合の警告
    if (!myProfile) {
        return (
            <div className="p-8 font-sans max-w-md mx-auto text-center">
                <p className="text-red-500 font-bold mb-4">⚠️ 仮ログインされていません</p>
                <p className="text-gray-600 text-sm mb-4">先にテストページ（/test）で操作するユーザーを選んできてね！</p>
            </div>
        )
    }

    return (
        <div className="p-8 font-sans max-w-md mx-auto">
            <h1 className="text-2xl font-bold mb-2">🎮 ルーム作成（システム試作）</h1>
            <p className="text-sm text-gray-500 mb-6">操作中: <span className="font-bold text-gray-800">{myProfile.name}</span></p>

            <form onSubmit={handleCreateRoom} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        ルーム名
                    </label>
                    <input
                        type="text"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        placeholder="みんなでワイワイ部屋、など"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading || !roomName.trim()}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-300 transition-colors"
                >
                    {loading ? '作成中...' : '部屋を作成する'}
                </button>
            </form>

            {/* 作成に成功したらIDを表示するシステム */}
            {createdRoomId && (
                <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-xl font-mono text-xs">
                    <p className="text-green-700 font-bold mb-1 text-sm font-sans">🎉 部屋が作られたよ！</p>
                    <p className="text-gray-500 mb-2">本来ならここからこのURLに遷移します：</p>
                    <div className="p-2 bg-white rounded border border-gray-100 font-bold text-blue-600">
                        /room/{createdRoomId}
                    </div>
                </div>
            )}
        </div>
    )
}