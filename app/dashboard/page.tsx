'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

type Profile = { id: string; name: string; role: string }
type Case = { id: string; name: string; unit: string | null; status: string }
type Task = {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  progress: number
  accepted_at: string | null
  case_id: string
  cases: { name: string; unit: string | null } | null
  assignee: { name: string } | null
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  normal: 'bg-blue-100 text-blue-700',
  low: 'bg-gray-100 text-gray-600',
}

const STATUS_LABEL: Record<string, string> = {
  pending: '待接受',
  accepted: '已接受',
  in_progress: '進行中',
  completed: '已完成',
}

function urgencyDot(dueDate: string | null, status: string) {
  if (status === 'completed') return '⚪'
  if (!dueDate) return '🟢'
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000)
  if (days < 0) return '🔴'
  if (days <= 3) return '🔴'
  if (days <= 7) return '🟡'
  return '🟢'
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [cases, setCases] = useState<Case[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [showNewCase, setShowNewCase] = useState(false)
  const [showNewTask, setShowNewTask] = useState(false)
  const [newCaseName, setNewCaseName] = useState('')
  const [newCaseUnit, setNewCaseUnit] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskCaseId, setNewTaskCaseId] = useState('')
  const [newTaskDue, setNewTaskDue] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState('normal')
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [newTaskAssignee, setNewTaskAssignee] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('all')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof) { router.push('/login'); return }
    setProfile(prof)

    const { data: c } = await supabase.from('cases').select('*').order('created_at', { ascending: false })
    setCases(c || [])

    const { data: t } = await supabase
      .from('tasks')
      .select('*, cases(name, unit), assignee:profiles!tasks_assigned_to_fkey(name)')
      .order('created_at', { ascending: false })
    setTasks((t as Task[]) || [])

    const { data: p } = await supabase.from('profiles').select('*')
    setAllProfiles(p || [])
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function createCase(e: React.FormEvent) {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('cases').insert({ name: newCaseName, unit: newCaseUnit || null, created_by: user!.id })
    setNewCaseName(''); setNewCaseUnit(''); setShowNewCase(false)
    loadData()
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('tasks').insert({
      title: newTaskTitle,
      case_id: newTaskCaseId || null,
      due_date: newTaskDue || null,
      priority: newTaskPriority,
      assigned_to: newTaskAssignee || null,
      created_by: user!.id,
    })
    setNewTaskTitle(''); setNewTaskCaseId(''); setNewTaskDue(''); setNewTaskPriority('normal')
    setNewTaskAssignee(''); setShowNewTask(false)
    loadData()
  }

  async function acceptTask(taskId: string) {
    await supabase.from('tasks').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', taskId)
    loadData()
  }

  const filteredTasks = tasks.filter(t => {
    if (activeFilter === 'mine') return t.assignee?.name === profile?.name
    if (activeFilter === 'pending') return t.status === 'pending'
    if (activeFilter === 'active') return ['accepted', 'in_progress'].includes(t.status)
    return true
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 頂部導覽 */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-gray-900">茁日設計</h1>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-600">任務看板</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{profile?.name}</span>
          <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600">登出</button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* 操作列 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {['all', 'mine', 'pending', 'active'].map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeFilter === f ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'}`}
              >
                {{ all: '全部', mine: '我的', pending: '待接受', active: '進行中' }[f]}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {profile?.role === 'boss' && (
              <button onClick={() => setShowNewCase(true)} className="px-3 py-1.5 bg-white border border-gray-200 text-sm text-gray-700 rounded-lg hover:border-gray-300">
                ＋ 新增案件
              </button>
            )}
            <button onClick={() => setShowNewTask(true)} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
              ＋ 新增任務
            </button>
          </div>
        </div>

        {/* 任務卡片列表 */}
        <div className="space-y-3">
          {filteredTasks.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">目前沒有任務</div>
          )}
          {filteredTasks.map(task => (
            <div key={task.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{urgencyDot(task.due_date, task.status)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/tasks/${task.id}`} className="font-medium text-gray-900 hover:text-green-700">
                      {task.title}
                    </Link>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLOR[task.priority]}`}>
                      {task.priority === 'urgent' ? '緊急' : task.priority === 'high' ? '高' : task.priority === 'normal' ? '一般' : '低'}
                    </span>
                    {task.status === 'pending' && (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs">⚠ 未接受</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 flex-wrap">
                    {task.cases && (
                      <span>📁 {task.cases.name}{task.cases.unit ? ` ${task.cases.unit}` : ''}</span>
                    )}
                    {task.assignee && <span>👤 {task.assignee.name}</span>}
                    {task.due_date && <span>📅 {task.due_date}</span>}
                    <span className="text-gray-400">{STATUS_LABEL[task.status]}</span>
                  </div>
                  {task.status !== 'pending' && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${task.progress}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{task.progress}%</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {task.status === 'pending' && task.assignee?.name === profile?.name && (
                    <button
                      onClick={() => acceptTask(task.id)}
                      className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700"
                    >
                      🤝 接受任務
                    </button>
                  )}
                  <Link href={`/tasks/${task.id}`} className="text-xs text-gray-400 hover:text-gray-600">
                    詳情 →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 新增案件 Modal */}
      {showNewCase && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="font-bold text-gray-900 mb-4">新增案件</h2>
            <form onSubmit={createCase} className="space-y-3">
              <input value={newCaseName} onChange={e => setNewCaseName(e.target.value)} required
                placeholder="建案名稱（如：竹北林宅）"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <input value={newCaseUnit} onChange={e => setNewCaseUnit(e.target.value)}
                placeholder="戶別（選填，如：A棟3樓）"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowNewCase(false)}
                  className="flex-1 border border-gray-300 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-50">取消</button>
                <button type="submit"
                  className="flex-1 bg-green-600 text-white text-sm py-2 rounded-lg hover:bg-green-700">建立</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 新增任務 Modal */}
      {showNewTask && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="font-bold text-gray-900 mb-4">新增任務</h2>
            <form onSubmit={createTask} className="space-y-3">
              <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} required
                placeholder="任務名稱"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <select value={newTaskCaseId} onChange={e => setNewTaskCaseId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">選擇案件（選填）</option>
                {cases.filter(c => c.status === 'active').map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.unit ? ` ${c.unit}` : ''}</option>
                ))}
              </select>
              <select value={newTaskAssignee} onChange={e => setNewTaskAssignee(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">指派給（選填）</option>
                {allProfiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="low">低優先</option>
                <option value="normal">一般</option>
                <option value="high">高優先</option>
                <option value="urgent">緊急</option>
              </select>
              <input type="date" value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowNewTask(false)}
                  className="flex-1 border border-gray-300 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-50">取消</button>
                <button type="submit"
                  className="flex-1 bg-green-600 text-white text-sm py-2 rounded-lg hover:bg-green-700">建立</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
