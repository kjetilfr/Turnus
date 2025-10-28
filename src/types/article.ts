// src/types/article.ts

export interface ArticleSource {
  text: string
  url?: string | null
}

export interface Article {
  id: string
  title: string
  slug: string
  content: string
  description: string | null
  tags: string[]
  author_name: string
  reading_time_minutes: number | null
  featured_image_url: string | null
  meta_description: string | null
  is_published: boolean
  published_at: string | null
  view_count: number
  sources: ArticleSource[]  // Updated: Array of {text, url} objects
  created_at: string
  updated_at: string
}

export interface ArticlePreview {
  id: string
  slug: string
  title: string
  description: string | null
  tags: string[]
  author_name: string
  reading_time_minutes: number | null
  featured_image_url: string | null
  published_at: string | null
}