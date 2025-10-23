export interface Article {
  id: string
  slug: string
  title: string
  description: string | null
  content: string
  category: 'blog' | 'wiki' | 'guide'
  tags: string[]
  author_name: string
  published_at: string | null
  updated_at: string
  is_published: boolean
  view_count: number
  reading_time_minutes: number | null
  featured_image_url: string | null
  meta_description: string | null
  created_at: string
}

export interface ArticleCategory {
  id: string
  slug: string
  name: string
  description: string | null
  icon: string | null
  sort_order: number
  created_at: string
}

export interface ArticlePreview {
  id: string
  slug: string
  title: string
  description: string | null
  category: string
  tags: string[]
  author_name: string
  published_at: string
  reading_time_minutes: number | null
  featured_image_url: string | null
}