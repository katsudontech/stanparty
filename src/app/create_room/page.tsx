'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getPlayerColor } from '@/games/core/constants'
import { useGuestAuth } from '@/hooks/useGuestAuth'
import { ProfileInput } from '@/components/shared/ProfileInput'
import Link from 'next/link'

export default function CreateRoomPage() {
    const [roomName, setRoomName] = useState('')
    const [hostName, setHostName] = useState('')
    const [isPublic, setIsPublic] = useState(true)
    const [createdRoomId, setCreatedRoomId] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    
    const { profile: myProfile, loading: checkingAuth } = useGuestAuth()


    useEffect(() => {
        if (myProfile?.name && !hostName) {
            setHostName(myProfile.name)
        }
    }, [myProfile])

    const router = useRouter()
    const supabase = createClient()

    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!roomName.trim() || !myProfile || !hostName.trim()) return

        setLoading(true)
        setCreatedRoomId(null)

        try {
            // 部屋を作る前に、確実にホストのユーザー情報をusersテーブルに登録（upsert）する
            const updatedProfile = { ...myProfile, name: hostName }
            
            // ローカルストレージも最新状態に保つ
            localStorage.setItem('guest_profile', JSON.stringify(updatedProfile))
            
            // usersテーブルに登録（すでに存在していれば名前だけ更新される）
            const { error: upsertError } = await supabase.from('users').upsert([updatedProfile])
            if (upsertError) {
                console.error('ユーザー情報の登録に失敗しました:', upsertError)
                throw upsertError // 登録に失敗した場合は部屋作成も中断する
            }

            // その後、部屋を作成する
            const { data, error } = await supabase
                .from('rooms')
                .insert([
                    {
                        host_id: myProfile.id,
                        game_type: 'fake-artist', // 第一弾ゲーム固定
                        status: 'waiting',
                        players: [
                            {
                                userId: myProfile.id,
                                name: hostName,
                                avatarUrl: myProfile.avatar,
                                isHost: true,
                                color: getPlayerColor(0),
                                isOnline: true
                            }
                        ],
                        room_name: roomName,
                        is_public: isPublic
                    }
                ])
                .select()
                .single()

            if (error) throw error

            if (data) {
                setCreatedRoomId(data.id)
                router.push(`/room/${data.id}`)
            }
        } catch (err: any) {
            console.error('部屋作成エラー:', err)
            alert(`エラーが発生しました: ${err.message}`)
        } finally {
            setLoading(false)
        }
    }

    if (checkingAuth) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-6 flex flex-col items-center selection:bg-indigo-500/30">
            <div className="w-full max-w-md pt-12">
                <Link href="/" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-bold mb-8 transition-colors group">
                    <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    ホームに戻る
                </Link>

                <div className="bg-slate-900/50 border border-white/10 p-8 rounded-[2rem] backdrop-blur-xl shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-3xl"></div>
                    
                    <div className="relative z-10">
                        <h1 className="text-3xl font-black text-white mb-2 tracking-tight">部屋を作成</h1>
                        <p className="text-slate-400 mb-8 font-medium">友達を招待してゲームを始めよう！</p>

                        <div className="mb-8">
                            <ProfileInput
                                name={hostName}
                                onChangeName={setHostName}
                                avatarUrl={myProfile?.avatar}
                                label="あなたの名前 (ホスト)"
                                variant="horizontal"
                            />
                        </div>

                        <form onSubmit={handleCreateRoom} className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
                                    ルーム名
                                </label>
                                <input
                                    type="text"
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    placeholder="例: ユニバ待ち時間部屋"
                                    required
                                    className="w-full px-4 py-4 bg-black/40 border border-white/10 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-slate-600 transition-all text-lg font-bold shadow-inner"
                                />
                            </div>

                            <div className="flex items-center gap-4 bg-black/40 border border-white/10 p-4 rounded-2xl shadow-inner cursor-pointer" onClick={() => setIsPublic(!isPublic)}>
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={isPublic}
                                        onChange={(e) => setIsPublic(e.target.checked)}
                                        className="peer relative h-6 w-6 cursor-pointer appearance-none rounded-md border border-slate-500 transition-all checked:border-indigo-500 checked:bg-indigo-500"
                                    />
                                    <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                                        </svg>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-white font-bold text-sm">「ルームを探す」の一覧に表示する</p>
                                    <p className="text-slate-400 text-xs mt-0.5">オフにするとURLを知っている人だけが参加できる「プライベートルーム」になります</p>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !roomName.trim()}
                                className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-lg font-bold rounded-2xl text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all overflow-hidden shadow-[0_0_20px_-5px_rgba(79,70,229,0.5)]"
                            >
                                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                                <span className="relative flex items-center gap-2">
                                    {loading ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            作成中...
                                        </>
                                    ) : (
                                        '部屋を作成する'
                                    )}
                                </span>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}