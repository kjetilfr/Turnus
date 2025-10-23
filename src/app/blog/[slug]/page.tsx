import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Metadata } from 'next'
import ReactMarkdown from 'react-markdown'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  
  const { data: article } = await supabase
    .from('articles')
    .select('title, meta_description, description')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (!article) {
    return { title: 'Article Not Found' }
  }

  return {
    title: `${article.title} - Turnusplanlegging`,
    description: article.meta_description || article.description || article.title
  }
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()

  // Fetch article
  const { data: article } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (!article) {
    notFound()
  }

  // Increment view count (fire and forget)
  supabase
    .from('articles')
    .update({ view_count: article.view_count + 1 })
    .eq('id', article.id)
    .then(() => {})

  // Fetch related articles
  const { data: relatedArticles } = await supabase
    .from('articles')
    .select('id, slug, title, description, reading_time_minutes')
    .eq('category', article.category)
    .eq('is_published', true)
    .neq('id', article.id)
    .limit(3)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <Link href="/blog" className="text-indigo-600 hover:text-indigo-700 text-sm">
            ← Tilbake til blog
          </Link>
        </div>
      </header>

      {/* Article Content */}
      <article className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Article Header */}
          <div className="bg-white rounded-lg shadow-md p-8 mb-6">
            {article.featured_image_url && (
              <div className="mb-6 -mx-8 -mt-8">
                <img
                  src={article.featured_image_url}
                  alt={article.title}
                  className="w-full h-64 object-cover rounded-t-lg"
                />
              </div>
            )}

            <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-medium">
                {article.category}
              </span>
              <span>{new Date(article.published_at!).toLocaleDateString('no', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
              {article.reading_time_minutes && (
                <span>{article.reading_time_minutes} minutt lesing</span>
              )}
            </div>

            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {article.title}
            </h1>

            {article.description && (
              <p className="text-xl text-gray-600 mb-6">
                {article.description}
              </p>
            )}

            <div className="flex items-center gap-3 text-sm text-gray-600 pb-6 border-b">
              <span>Av {article.author_name}</span>
              <span>•</span>
              <span>{article.view_count} visningar</span>
            </div>

            {/* Article Body */}
            <div className="prose prose-lg max-w-none mt-8">
              <ReactMarkdown
                components={{
                  h2: ({ children }) => (
                    <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-xl font-bold text-gray-900 mt-6 mb-3">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-gray-700 leading-relaxed mb-4">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside space-y-2 mb-4 text-gray-700">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-2 mb-4 text-gray-700">{children}</ol>
                  ),
                  a: ({ href, children }) => (
                    <a href={href} className="text-indigo-600 hover:text-indigo-700 underline">
                      {children}
                    </a>
                  ),
                  code: ({ children }) => (
                    <code className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm">
                      {children}
                    </code>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-indigo-500 pl-4 italic text-gray-700 my-4">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {article.content}
              </ReactMarkdown>
            </div>

            {/* Tags */}
            {article.tags.length > 0 && (
              <div className="mt-8 pt-6 border-t">
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
              </div>
            )}
          </div>

          {/* CTA Box */}
          <div className="bg-indigo-600 rounded-lg p-8 text-white text-center mb-6">
            <h3 className="text-2xl font-bold mb-3">Klar til å lage din eigen turnus?</h3>
            <p className="mb-6">
              Prøv vår turnusplanleggar og få automatiske lovsjekkar
            </p>
            <Link
              href="/login"
              className="inline-block bg-white text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Start gratis
            </Link>
          </div>

          {/* Related Articles */}
          {relatedArticles && relatedArticles.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Relaterte artiklar</h3>
              <div className="space-y-4">
                {relatedArticles.map(related => (
                  <Link
                    key={related.id}
                    href={`/blog/${related.slug}`}
                    className="block p-4 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <h4 className="font-semibold text-gray-900 mb-1">
                      {related.title}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {related.description}
                    </p>
                    {related.reading_time_minutes && (
                      <span className="text-xs text-gray-500 mt-2 inline-block">
                        {related.reading_time_minutes} min lesing
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>
    </div>
  )
}