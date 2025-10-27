// src/app/admin/articles/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ArticlesList from '@/components/admin/ArticlesList'

export default async function AdminArticlesPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch all articles
  const { data: articles } = await supabase
    .from('articles')
    .select('*')
    .order('updated_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Article Management</h1>
              <p className="text-sm text-gray-600 mt-1">Manage blog articles and wiki content</p>
            </div>
            <Link
              href="/admin/articles/new"
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            >
              + Create Article
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <ArticlesList articles={articles || []} />
        </div>
      </main>
    </div>
  )
}