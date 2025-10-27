// src/components/admin/ArticlesList.tsx
'use client'

import Link from 'next/link'
import { Article } from '@/types/article'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface ArticlesListProps {
  articles: Article[]
}

export default function ArticlesList({ articles: initialArticles }: ArticlesListProps) {
  const [articles, setArticles] = useState(initialArticles)
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all')
  const router = useRouter()
  const supabase = createClient()

  const filteredArticles = articles.filter(article => {
    if (filter === 'published') return article.is_published
    if (filter === 'draft') return !article.is_published
    return true
  })

  const handleTogglePublish = async (articleId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('articles')
        .update({ 
          is_published: !currentStatus,
          published_at: !currentStatus ? new Date().toISOString() : null
        })
        .eq('id', articleId)

      if (error) throw error

      // Update local state
      setArticles(prev => prev.map(article => 
        article.id === articleId 
          ? { ...article, is_published: !currentStatus, published_at: !currentStatus ? new Date().toISOString() : null }
          : article
      ))

      router.refresh()
    } catch (error) {
      console.error('Error toggling publish status:', error)
      alert('Failed to update article status')
    }
  }

  const handleDelete = async (articleId: string, articleTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${articleTitle}"?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('articles')
        .delete()
        .eq('id', articleId)

      if (error) throw error

      // Update local state
      setArticles(prev => prev.filter(article => article.id !== articleId))
      router.refresh()
    } catch (error) {
      console.error('Error deleting article:', error)
      alert('Failed to delete article')
    }
  }

  return (
    <div>
      {/* Filter Tabs */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="flex border-b">
          <button
            onClick={() => setFilter('all')}
            className={`px-6 py-3 font-medium transition-colors ${
              filter === 'all'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All ({articles.length})
          </button>
          <button
            onClick={() => setFilter('published')}
            className={`px-6 py-3 font-medium transition-colors ${
              filter === 'published'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Published ({articles.filter(a => a.is_published).length})
          </button>
          <button
            onClick={() => setFilter('draft')}
            className={`px-6 py-3 font-medium transition-colors ${
              filter === 'draft'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Drafts ({articles.filter(a => !a.is_published).length})
          </button>
        </div>
      </div>

      {/* Articles List */}
      <div className="space-y-4">
        {filteredArticles.map(article => (
          <div
            key={article.id}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-xl font-bold text-gray-900">
                    {article.title}
                  </h2>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    article.is_published
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {article.is_published ? 'Published' : 'Draft'}
                  </span>
                </div>

                <p className="text-gray-600 mb-3">
                  {article.description || 'No description'}
                </p>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>By {article.author_name}</span>
                  <span>•</span>
                  <span>{article.view_count} views</span>
                  {article.reading_time_minutes && (
                    <>
                      <span>•</span>
                      <span>{article.reading_time_minutes} min read</span>
                    </>
                  )}
                  <span>•</span>
                  <span>
                    {article.published_at 
                      ? new Date(article.published_at).toLocaleDateString('no')
                      : 'Not published'}
                  </span>
                </div>

                {article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {article.tags.map(tag => (
                      <span
                        key={tag}
                        className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 ml-4">
                {article.is_published && (
                  <Link
                    href={`/blog/${article.slug}`}
                    target="_blank"
                    className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    View
                  </Link>
                )}
                <Link
                  href={`/admin/articles/${article.id}/edit`}
                  className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleTogglePublish(article.id, article.is_published)}
                  className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                    article.is_published
                      ? 'text-yellow-700 bg-yellow-100 hover:bg-yellow-200'
                      : 'text-green-700 bg-green-100 hover:bg-green-200'
                  }`}
                >
                  {article.is_published ? 'Unpublish' : 'Publish'}
                </button>
                <button
                  onClick={() => handleDelete(article.id, article.title)}
                  className="px-4 py-2 text-sm text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}