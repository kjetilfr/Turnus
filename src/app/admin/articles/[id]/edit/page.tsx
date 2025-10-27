// src/app/admin/articles/[id]/edit/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import ArticleEditor from '@/components/admin/ArticleEditor'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditArticlePage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch the article
  const { data: article, error } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !article) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Edit Article</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <ArticleEditor article={article} />
        </div>
      </main>
    </div>
  )
}