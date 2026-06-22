'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

type Task = {
  id: string; title: string; description: string | null
  status: string; priority: string; progress: number
  due_date: string | null; accepted_at: string | null
  created_at: string
  cases: { name: string; unit: string | null } | null
  assignee: { name: string } | null
  creator: { name: string } | null
}
type Comment = { id: string; content: string; created_at: string; author: { name: string } | null }

const STATUS_OPTIONS = [
  { value: 'accepted', label: '已接受' },
  { value: 'in_progress', label: '進行中' },
  { value: 'completed', label: '已完成' },
]

export default function TaskDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const [task, setTask] = useState<Task | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [profileId, setProfileId] = useState<string>('')
  const [newComment, setNewComment] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editProgress, setEditProgress] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadTask() }, [id])

  async function loadTask() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setProfileId(user.id)

    const { data: t } = await supabase
      .from('tasks')
      .select('*, cases(name, unit), assignee:profiles!tasks_assigned_to_fkey(name), creator:profiles!tasks_created_by_fkey(name)')
      .eq('id', id)
      .single()
    if (t) {
      setTask(t as Task)
      setEditStatus(t.status)
      setEditProgress(t.progress)
    }

    const { data: c } = await supabase
      .from('task_comments')
      .select('*, author:profiles!task_comments_author_id_fkey(name)')
      .eq('task_id', id)
      .order('created_at', { ascending: true })
    setComments((c as Comment[]) || [])
  }

  async function saveProgress(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('tasks').update({ status: editStatus, progress: editProgress }).eq('id', id)
    setSaving(false)
    loadTask()
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim()) return
    await supabase.from('task_comments').insert({ task_id: id, author_id: profileId, content: newComment })
    setNewComment('')
    loadTask()
  }

  if (!task) return <div className="flex items-center justify-center min-h-screen text-gray-400">載入中...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">← 返回看板</Link>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-medium text-gray-900 truncate">{task.title}</span>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* 任務基本資訊 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h1 className="text-xl font-bold text-gray-900 mb-3">{task.title}</h1>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {task.cases && (
              <div><span className="text-gray-400">案件</span> <span className="ml-2 text-gray-700">{task.cases.name}{task.cases.unit ? ` ${task.cases.unit}` : ''}</span></div>
            )}
            {task.assignee && (
              <div><span className="text-gray-400">負責人</span> <span className="ml-2 text-gray-700">{task.assignee.name}</span></div>
            )}
            {task.due_date && (
              <div><span className="text-gray-400">截止日</span> <span className="ml-2 text-gray-700">{task.due_date}</span></div>
            )}
            {task.creator && (
              <div><span className="text-gray-400">建立者</span> <span className="ml-2 text-gray-700">{task.creator.name}</span></div>
            )}
          </div>
          {task.description && (
            <p className="mt-3 text-sm text-gray-600 leading-relaxed">{task.description}</p>
          )}
        </div>

        {/* 更新進度 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">更新進度</h2>
          <form onSubmit={saveProgress} className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 block mb-1">狀態</label>
              <div className="flex gap-2 flex-wrap">
                {STATUS_OPTIONS.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setEditStatus(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${editStatus === opt.value ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">完成度 {editProgress}%</label>
              <input type="range" min={0} max={100} step={5}
                value={editProgress} onChange={e => setEditProgress(Number(e.target.value))}
                className="w-full accent-green-600" />
              <div className="mt-1 bg-gray-100 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${editProgress}%` }} />
              </div>
            </div>
            <button type="submit" disabled={saving}
              className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {saving ? '儲存中...' : '儲存進度'}
            </button>
          </form>
        </div>

        {/* 留言區 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">討論留言</h2>
          <div className="space-y-3 mb-4">
            {comments.length === 0 && <p className="text-sm text-gray-400">還沒有留言</p>}
            {comments.map(c => (
              <div key={c.id} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-medium shrink-0">
                  {c.author?.name?.[0] || '?'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-gray-800">{c.author?.name}</span>
                    <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={addComment} className="flex gap-2">
            <input value={newComment} onChange={e => setNewComment(e.target.value)}
              placeholder="輸入留言..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <button type="submit" className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">送出</button>
          </form>
        </div>
      </div>
    </div>
  )
}
