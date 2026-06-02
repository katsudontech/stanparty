// src/app/test/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface User {
    id: string
    name: string
    avatar: string
}

export default function TestPage() {
    const [users, setUsers] = useState<User[]>([])
    const [currentUser, setCurrentUser] = useState<User | null>(null)
    const [loading, setLoading] = useState<boolean>(true)

    const supabase = createClient()

    useEffect(() => {
        const initTestPage = async () => {
            try {
                setLoading(true)

                // ① DBからダミーユーザー（たかし・えみ）の一覧を取得
                const { data: usersData, error: usersError } = await supabase
                    .from('users')
                    .select('*')

                if (usersError) throw usersError
                if (usersData) setUsers(usersData as User[])

                // ② localStorage から前回選択したユーザーIDがあるか確認
                const savedUserId = localStorage.getItem('mock_user_id')

                if (savedUserId && usersData) {
                    // 取得したユーザーの中に、保存されたIDの人がいるか探す
                    const found = usersData.find((u) => u.id === savedUserId)
                    if (found) setCurrentUser(found as User)
                }
            } catch (err) {
                console.error('初期化エラー:', err)
            } finally {
                setLoading(false)
            }
        }

        initTestPage()
    }, [supabase])

    // ③ ユーザーを選択（仮ログイン）したときの処理
    const handleLogin = (user: User) => {
        localStorage.setItem('mock_user_id', user.id)
        setCurrentUser(user)
        alert(`「${user.name}」として仮ログインしたよ！`)
    }

    // ④ ログアウト（リセット）処理
    const handleLogout = () => {
        localStorage.removeItem('mock_user_id')
        setCurrentUser(null)
    }

    if (loading) return <div className="p-8">読み込み中...</div>

    return (
        <div className="p-8 font-sans max-w-md mx-auto">
            <h1 className="text-2xl font-bold mb-6">🔑 開発用・仮ログインテスト</h1>

            {/* 現在のログイン状態の表示 */}
            {currentUser ? (
                <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <p className="text-sm text-green-700 font-semibold mb-2">🟢 ログイン中</p>
                    <div className="flex items-center gap-3">
                        <img src={currentUser.avatar} alt={currentUser.name} className="w-10 h-10 rounded-full bg-white" />
                        <div>
                            <div className="font-bold text-gray-800">{currentUser.name}</div>
                            <div className="text-xs text-gray-400 font-mono truncate w-64">{currentUser.id}</div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="mt-4 text-xs text-red-500 hover:underline"
                    >
                        ログアウト（ユーザーを解除）
                    </button>
                </div>
            ) : (
                <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-700 text-sm font-semibold">
                    ⚠️ ユーザーが選択されていません。下のリストから選んでね！
                </div>
            )}

            {/* ユーザー選択リスト */}
            <h2 className="text-lg font-bold mb-3 text-gray-700">操作するユーザーを選択</h2>
            <div className="grid gap-3">
                {users.map((user) => {
                    const isSelected = currentUser?.id === user.id
                    return (
                        <button
                            key={user.id}
                            onClick={() => handleLogin(user)}
                            disabled={isSelected}
                            className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${isSelected
                                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 cursor-not-allowed'
                                    : 'border-gray-200 bg-white hover:border-gray-400'
                                }`}
                        >
                            <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-full bg-gray-50" />
                            <div className="flex-1">
                                <div className="font-bold text-gray-800">{user.name}</div>
                                <div className="text-xs text-gray-400 font-mono">
                                    {isSelected ? '選択中のアカウント' : 'この人で操作する'}
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}