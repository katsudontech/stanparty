'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { saveGuestDisplayProfile, useGuestAuth } from '@/hooks/useGuestAuth'
import { ProfileInput } from '@/components/shared/ProfileInput'
import { SiteHeader } from '@/components/site/SiteHeader'

export default function CreateRoomPage() {
    const [roomName, setRoomName] = useState('')
    const [hostName, setHostName] = useState<string | null>(null)
    const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string | null>(null)
    const [isPublic, setIsPublic] = useState(true)
    const [loading, setLoading] = useState(false)
    
    const { profile: myProfile, loading: checkingAuth } = useGuestAuth()
    const resolvedHostName = hostName ?? myProfile?.name ?? ''
    const resolvedAvatarUrl = selectedAvatarUrl ?? myProfile?.avatar ?? ''



    const router = useRouter()
    const supabase = createClient()

    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!roomName.trim() || !myProfile || !resolvedHostName.trim()) return

        setLoading(true)

        try {
            // 部屋を作る前に、確実にホストのユーザー情報をusersテーブルに登録（upsert）する
            const normalizedHostName = resolvedHostName.trim()
            const updatedProfile = {
                ...myProfile,
                name: normalizedHostName,
                avatar: resolvedAvatarUrl
            }
            
            // ローカルストレージも最新状態に保つ
            saveGuestDisplayProfile({
                name: updatedProfile.name,
                avatar: updatedProfile.avatar
            })
            
            // usersテーブルに登録（すでに存在していれば名前だけ更新される）
            const { error: upsertError } = await supabase.from('users').upsert([updatedProfile])
            if (upsertError) {
                console.error('ユーザー情報の登録に失敗しました:', upsertError)
                throw upsertError // 登録に失敗した場合は部屋作成も中断する
            }

            // その後、部屋を作成する
            const { data: createdRoomId, error } = await supabase.rpc('create_room', {
                p_room_name: roomName.trim(),
                p_host_name: normalizedHostName,
                p_avatar_url: updatedProfile.avatar,
                p_is_public: isPublic
            })

            if (error) throw error

            if (createdRoomId) {
                router.push(`/room/${createdRoomId}`)
            }
        } catch (err: unknown) {
            const errorMessage =
                typeof err === 'object' && err !== null && 'message' in err
                    ? String(err.message)
                    : '不明なエラー'
            console.error('部屋作成エラー:', err)
            alert(`エラーが発生しました: ${errorMessage}`)
        } finally {
            setLoading(false)
        }
    }

    if (checkingAuth) {
        return (
            <div className="site-shell flex min-h-screen items-center justify-center">
                <div className="h-9 w-9 animate-spin rounded-full border-4 border-[var(--paper-deep)] border-t-[var(--orange)]" />
            </div>
        )
    }

    return (
        <div className="site-shell">
            <SiteHeader compact />
            <main className="site-container grid gap-12 py-12 lg:grid-cols-[.8fr_1.2fr] lg:py-16">
                <div className="lg:pt-8">
                    <p className="section-kicker">Create a room</p>
                    <h1 className="mt-4 text-[clamp(3rem,7vw,5.2rem)] font-black leading-[.95] tracking-[-.07em]">まずは、<br />遊ぶ場所をつくる。</h1>
                    <p className="mt-6 max-w-md leading-8 text-[var(--muted)]">名前と部屋名を決めたら準備完了。遊ぶゲームは、友達が集まってから選べます。</p>
                    <ol className="mt-10 hidden space-y-5 border-t-2 border-[var(--line)] pt-6 text-sm font-black lg:block">
                        <li><span className="mr-4 text-[var(--orange)]">01</span>部屋をつくる</li>
                        <li><span className="mr-4 text-[var(--orange)]">02</span>招待URLを送る</li>
                        <li><span className="mr-4 text-[var(--orange)]">03</span>ゲームを選んで開始</li>
                    </ol>
                </div>

                <div className="paper-card mx-auto w-full max-w-xl p-6 sm:p-9">
                    <div className="mb-7 border-b-2 border-[var(--line)] pb-5">
                        <p className="text-xs font-black tracking-[.13em] text-[var(--orange)]">ROOM TICKET</p>
                        <h2 className="mt-2 text-3xl font-black tracking-[-.05em]">部屋の設定</h2>
                    </div>

                    <div className="mb-7">
                        <ProfileInput
                            name={resolvedHostName}
                            onChangeName={setHostName}
                            avatarUrl={resolvedAvatarUrl}
                            onChangeAvatar={setSelectedAvatarUrl}
                            label="あなたの名前（ホスト）"
                            variant="horizontal"
                        />
                    </div>

                    <form onSubmit={handleCreateRoom} className="space-y-6">
                            <div>
                                <label className="form-label">
                                    ルーム名
                                </label>
                                <input
                                    type="text"
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    placeholder="例: ユニバ待ち時間部屋"
                                    required
                                    className="form-input text-lg"
                                />
                            </div>

                            <label className="flex cursor-pointer items-start gap-4 border-2 border-[var(--line)] bg-[var(--paper-deep)] p-4">
                                <div className="relative mt-0.5 flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={isPublic}
                                        onChange={(e) => setIsPublic(e.target.checked)}
                                        className="peer relative h-6 w-6 cursor-pointer appearance-none border-2 border-[var(--line)] bg-white checked:bg-[var(--orange)]"
                                    />
                                    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                                        </svg>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm font-black">「部屋を探す」の一覧に表示する</p>
                                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">オフにすると、URLを知っている人だけが参加できます。</p>
                                </div>
                            </label>

                            <button
                                type="submit"
                                disabled={loading || !roomName.trim()}
                                className="button-primary w-full text-lg"
                            >
                                <span className="flex items-center gap-2">
                                    {loading ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            作成中...
                                        </>
                                    ) : (
                                        'この内容で部屋をつくる →'
                                    )}
                                </span>
                            </button>
                    </form>
                </div>
            </main>
        </div>
    )
}
