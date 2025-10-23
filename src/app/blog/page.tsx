import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArticlePreview, ArticleCategory } from '@/types/article'

export const metadata = {
  title: 'Blog & Wiki - Turnusplanlegging',
  description: 'Les artiklar om arbeidsmiljøloven, tariffavtalar, og turnusplanlegging'
}

export default async function BlogPage() {
  const supabase = await createClient()

  // Fetch published articles
  const { data: articles } = await supabase
    .from('articles')
    .select('id, slug, title, description, category, tags, author_name, published_at, reading_time_minutes, featured_image_url')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(50)

  // Fetch categories
  const { data: categories } = await supabase
    .from('article_categories')
    .select('*')
    .order('sort_order')

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-700 mb-2 inline-block">
                ← Tilbake til appen
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Blog & Wiki</h1>
              <p className="text-gray-600 mt-1">
                Lær om turnusplanlegging, arbeidsmiljøloven og tariffavtalar
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Categories */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
            {categories?.map(category => (
              <Link
                key={category.id}
                href={`/blog/category/${category.slug}`}
                className="bg-white rounded-lg p-4 text-center hover:shadow-lg transition-shadow"
              >
                <div className="text-3xl mb-2">{category.icon}</div>
                <div className="text-sm font-medium text-gray-900">{category.name}</div>
              </Link>
            ))}
          </div>

          {/* Featured Article */}
          {articles && articles.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Nyaste artiklar</h2>
              <Link
                href={`/blog/${articles[0].slug}`}
                className="block bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow"
              >
                {articles[0].featured_image_url && (
                  <div className="h-64 bg-gray-200">
                    <img
                      src={articles[0].featured_image_url}
                      alt={articles[0].title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                    <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-medium">
                      {articles[0].category}
                    </span>
                    <span>{new Date(articles[0].published_at!).toLocaleDateString('no')}</span>
                    {articles[0].reading_time_minutes && (
                      <span>{articles[0].reading_time_minutes} min lesing</span>
                    )}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {articles[0].title}
                  </h3>
                  <p className="text-gray-600">
                    {articles[0].description}
                  </p>
                </div>
              </Link>
            </div>
          )}

          {/* Article Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles?.slice(1).map(article => (
              <Link
                key={article.id}
                href={`/blog/${article.slug}`}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow"
              >
                {article.featured_image_url && (
                  <div className="h-48 bg-gray-200">
                    <img
                      src={article.featured_image_url}
                      alt={article.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium">
                      {article.category}
                    </span>
                    {article.reading_time_minutes && (
                      <span>{article.reading_time_minutes} min</span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {article.title}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {article.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
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
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}