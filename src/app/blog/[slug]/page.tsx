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
    .select('title, meta_description, description, featured_image_url')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (!article) {
    return { title: 'Article Not Found' }
  }

  return {
    title: `${article.title} - Turnusplanlegging`,
    description: article.meta_description || article.description || article.title,
    openGraph: article.featured_image_url ? {
      images: [article.featured_image_url]
    } : undefined
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
    .select('id, slug, title, description, reading_time_minutes, featured_image_url, published_at')
    .eq('category', article.category)
    .eq('is_published', true)
    .neq('id', article.id)
    .limit(3)

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-xl font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
                Turnusplanleggar
              </Link>
              <Link href="/blog" className="text-sm text-gray-600 hover:text-indigo-600 transition-colors flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Tilbake til artiklar
              </Link>
            </div>
            <Link
              href="/login"
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-all"
            >
              Prøv appen
            </Link>
          </div>
        </div>
      </header>

      {/* Article Content */}
      <article className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Article Header */}
          <div className="mb-8">
            {/* Category and Meta */}
            <div className="flex items-center gap-4 text-sm text-gray-600 mb-6">
              <Link
                href={`/blog/category/${article.category}`}
                className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full font-semibold hover:bg-indigo-200 transition-colors"
              >
                {article.category}
              </Link>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {new Date(article.published_at!).toLocaleDateString('no', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
              {article.reading_time_minutes && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {article.reading_time_minutes} minutt lesing
                  </span>
                </>
              )}
              <span>•</span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {article.view_count} visningar
              </span>
            </div>

            {/* Title */}
            <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
              {article.title}
            </h1>

            {/* Description */}
            {article.description && (
              <p className="text-2xl text-gray-600 mb-8 leading-relaxed font-light">
                {article.description}
              </p>
            )}

            {/* Author Info */}
            <div className="flex items-center gap-4 pb-8 border-b border-gray-200">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{article.author_name}</p>
                <p className="text-sm text-gray-600">Forfatter</p>
              </div>
            </div>
          </div>

          {/* Featured Image */}
          {article.featured_image_url && (
            <div className="mb-12 -mx-4 sm:mx-0 rounded-xl overflow-hidden">
              <img
                src={article.featured_image_url}
                alt={article.title}
                className="w-full h-auto"
              />
            </div>
          )}

          {/* Article Body */}
          <div className="prose prose-lg max-w-none">
            <ReactMarkdown
              components={{
                h2: ({ children }) => (
                  <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-6 pb-3 border-b border-gray-200">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-2xl font-bold text-gray-900 mt-10 mb-4">
                    {children}
                  </h3>
                ),
                h4: ({ children }) => (
                  <h4 className="text-xl font-bold text-gray-900 mt-8 mb-3">
                    {children}
                  </h4>
                ),
                p: ({ children }) => (
                  <p className="text-lg text-gray-700 leading-relaxed mb-6">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-outside ml-6 space-y-3 mb-6 text-lg text-gray-700">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-outside ml-6 space-y-3 mb-6 text-lg text-gray-700">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="leading-relaxed">
                    {children}
                  </li>
                ),
                a: ({ href, children }) => (
                  <a 
                    href={href} 
                    className="text-indigo-600 hover:text-indigo-700 underline decoration-2 underline-offset-2 font-medium transition-colors"
                  >
                    {children}
                  </a>
                ),
                code: ({ children }) => (
                  <code className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-base font-mono">
                    {children}
                  </code>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-indigo-500 pl-6 my-8 italic text-gray-700 bg-indigo-50 py-4 rounded-r-lg">
                    {children}
                  </blockquote>
                ),
                strong: ({ children }) => (
                  <strong className="font-bold text-gray-900">
                    {children}
                  </strong>
                ),
                em: ({ children }) => (
                  <em className="italic">
                    {children}
                  </em>
                ),
              }}
            >
              {article.content}
            </ReactMarkdown>
          </div>

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="mt-12 pt-8 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Stikkord:</h3>
              <div className="flex flex-wrap gap-2">
                {article.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Share Section */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Del denne artikkelen:</h3>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
                Twitter
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                WhatsApp
              </button>
            </div>
          </div>
        </div>
      </article>

      {/* CTA Box */}
      <section className="bg-gradient-to-r from-indigo-600 to-purple-600 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center text-white">
            <h2 className="text-3xl font-bold mb-4">Klar til å lage din eigen turnus?</h2>
            <p className="text-xl text-indigo-100 mb-8">
              Prøv vår turnusplanleggar og få automatiske lovsjekkar
            </p>
            <Link
              href="/login"
              className="inline-block bg-white text-indigo-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-all hover:shadow-xl"
            >
              Start gratis i dag
            </Link>
          </div>
        </div>
      </section>

      {/* Related Articles */}
      {relatedArticles && relatedArticles.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-7xl mx-auto">
              <h2 className="text-3xl font-bold text-gray-900 mb-8">Relaterte artiklar</h2>
              <div className="grid md:grid-cols-3 gap-8">
                {relatedArticles.map(related => (
                  <Link
                    key={related.id}
                    href={`/blog/${related.slug}`}
                    className="group bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all"
                  >
                    {related.featured_image_url ? (
                      <div className="h-48 overflow-hidden">
                        <img
                          src={related.featured_image_url}
                          alt={related.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div className="h-48 bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                        <svg className="w-16 h-16 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="p-6">
                      <h3 className="font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors line-clamp-2">
                        {related.title}
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                        {related.description}
                      </p>
                      {related.reading_time_minutes && (
                        <span className="text-xs text-gray-500">
                          {related.reading_time_minutes} min lesing
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}