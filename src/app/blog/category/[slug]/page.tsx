import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function CategoryPage({ params }: PageProps) {
  const supabase = await createClient()

  // Fetch articles in this category
  const { data: articles } = await supabase
    .from('articles')
    .select('id, slug, title, description, tags, published_at, reading_time_minutes')
    .eq('is_published', true)
    .order('published_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <Link href="/blog" className="text-indigo-600 hover:text-indigo-700 text-sm mb-3 inline-block">
            ← Tilbake til blog
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {articles && articles.length > 0 ? (
            <div className="space-y-6">
              {articles.map(article => (
                <Link
                  key={article.id}
                  href={`/blog/${article.slug}`}
                  className="block bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow"
                >
                  <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
                    <span>{new Date(article.published_at!).toLocaleDateString('no')}</span>
                    {article.reading_time_minutes && (
                      <>
                        <span>•</span>
                        <span>{article.reading_time_minutes} min lesing</span>
                      </>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {article.title}
                  </h2>
                  <p className="text-gray-600 mb-4">
                    {article.description}
                  </p>
                  {article.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {article.tags.map((tag: string) => (
                        <span
                            key={tag}
                            className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded"
                        >
                            #{tag}
                        </span>
                        ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg p-12 text-center">
              <p className="text-gray-600">Ingen artiklar i denne kategorien enno.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}