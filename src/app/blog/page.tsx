import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArticlePreview } from '@/types/article'

export const metadata = {
  title: 'Blog & Wiki - Turnusplanlegging',
  description: 'Les artiklar om arbeidsmiljøloven, tariffavtalar, og turnusplanlegging'
}

export default async function BlogPage() {
  const supabase = await createClient()

  // Fetch published articles
  const { data: articles } = await supabase
    .from('articles')
    .select('id, slug, title, description, tags, author_name, published_at, reading_time_minutes, featured_image_url')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(50)

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-2xl font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
                Turnusplanleggar
              </Link>
              <Link href="/" className="text-sm text-gray-600 hover:text-indigo-600 transition-colors">
                ← Tilbake til hovudsida
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

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl font-bold mb-4">
              Turnusplanlegging & Arbeidsmiljø
            </h1>
            <p className="text-xl text-indigo-100">
              Lær om dine rettar, arbeidsmiljøloven, tariffavtalar og beste praksis for turnusarbeid
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-7xl mx-auto">
          
          {/* Featured Article (Hero) */}
          {articles && articles.length > 0 && (
            <section className="mb-16">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-gray-900">Siste nytt</h2>
                <span className="text-sm text-gray-500">Oppdatert {new Date().toLocaleDateString('no', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              
              <Link
                href={`/blog/${articles[0].slug}`}
                className="block group"
              >
                <div className="grid md:grid-cols-2 gap-8 bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300">
                  {/* Image */}
                  <div className="relative h-80 md:h-auto overflow-hidden">
                    {articles[0].featured_image_url ? (
                      <img
                        src={articles[0].featured_image_url}
                        alt={articles[0].title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                        <svg className="w-24 h-24 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute top-4 left-4">
                      <span className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg">
                        NYTT
                      </span>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="p-8 flex flex-col justify-center">
                    <div className="flex items-center gap-3 text-sm text-gray-600 mb-4">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(articles[0].published_at!).toLocaleDateString('no', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                      {articles[0].reading_time_minutes && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {articles[0].reading_time_minutes} min lesing
                          </span>
                        </>
                      )}
                    </div>
                    
                    <h3 className="text-3xl font-bold text-gray-900 mb-4 group-hover:text-indigo-600 transition-colors">
                      {articles[0].title}
                    </h3>
                    
                    <p className="text-lg text-gray-600 mb-6 line-clamp-3">
                      {articles[0].description}
                    </p>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{articles[0].author_name}</p>
                          <p className="text-xs text-gray-500">Forfatter</p>
                        </div>
                      </div>
                      
                      <div className="ml-auto">
                        <span className="inline-flex items-center gap-2 text-indigo-600 font-semibold group-hover:gap-3 transition-all">
                          Les heile artikkelen
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </section>
          )}

          {/* Latest Articles Grid */}
          {articles && articles.length > 1 && (
            <section className="mb-16">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-bold text-gray-900">Siste artiklar</h2>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>{articles.length - 1} artiklar</span>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {articles.slice(1).map(article => (
                  <Link
                    key={article.id}
                    href={`/blog/${article.slug}`}
                    className="group"
                  >
                    <article className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 h-full flex flex-col">
                      {/* Image */}
                      <div className="relative h-56 overflow-hidden">
                        {article.featured_image_url ? (
                          <img
                            src={article.featured_image_url}
                            alt={article.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                            <svg className="w-16 h-16 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="p-6 flex-1 flex flex-col">
                        <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {new Date(article.published_at!).toLocaleDateString('no', { day: 'numeric', month: 'short' })}
                          </span>
                          {article.reading_time_minutes && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {article.reading_time_minutes} min
                              </span>
                            </>
                          )}
                        </div>
                        
                        <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-indigo-600 transition-colors line-clamp-2">
                          {article.title}
                        </h3>
                        
                        <p className="text-gray-600 mb-4 line-clamp-3 flex-1">
                          {article.description}
                        </p>
                        
                        {article.tags && article.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {article.tags.slice(0, 3).map((tag: string) => (
                              <span
                                key={tag}
                                className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                          <span className="text-xs text-gray-500">{article.author_name}</span>
                          <span className="inline-flex items-center gap-1 text-indigo-600 font-semibold text-sm group-hover:gap-2 transition-all">
                            Les meir
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* CTA Section */}
          <section className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-12 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">Klar til å sjekke din turnus?</h2>
            <p className="text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">
              Bruk kunnskapen du har lært til å sjekke om din turnus følgjer alle reglar og lover
            </p>
            <Link
              href="/login"
              className="inline-block bg-white text-indigo-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-all hover:shadow-xl"
            >
              Start gratis i dag
            </Link>
          </section>
        </div>
      </div>
    </div>
  )
}