// src/components/admin/ArticleEditor.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Article } from '@/types/article'
import Link from 'next/link'

interface ArticleEditorProps {
  article?: Article
}

export default function ArticleEditor({ article }: ArticleEditorProps) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Form state
  const [title, setTitle] = useState(article?.title || '')
  const [slug, setSlug] = useState(article?.slug || '')
  const [description, setDescription] = useState(article?.description || '')
  const [content, setContent] = useState(article?.content || '')
  const [tags, setTags] = useState<string[]>(article?.tags || [])
  const [tagInput, setTagInput] = useState('')
  const [authorName, setAuthorName] = useState(article?.author_name || '')
  const [readingTime, setReadingTime] = useState(article?.reading_time_minutes?.toString() || '')
  const [featuredImage, setFeaturedImage] = useState(article?.featured_image_url || '')
  const [metaDescription, setMetaDescription] = useState(article?.meta_description || '')
  const [isPublished, setIsPublished] = useState(article?.is_published || false)

  // Auto-generate slug from title
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
    if (!article) { // Only auto-generate slug for new articles
      const newSlug = newTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      setSlug(newSlug)
    }
  }

  // Add tag
  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  // Handle save
  const handleSave = async (publish: boolean) => {
    setSaving(true)
    setMessage(null)

    try {
      // Validation
      if (!title.trim()) {
        throw new Error('Title is required')
      }
      if (!slug.trim()) {
        throw new Error('Slug is required')
      }
      if (!content.trim()) {
        throw new Error('Content is required')
      }
      if (!authorName.trim()) {
        throw new Error('Author name is required')
      }

      const articleData = {
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        content: content.trim(),
        tags,
        author_name: authorName.trim(),
        reading_time_minutes: readingTime ? parseInt(readingTime) : null,
        featured_image_url: featuredImage.trim() || null,
        meta_description: metaDescription.trim() || null,
        is_published: publish,
        published_at: publish && !article?.is_published ? new Date().toISOString() : article?.published_at || null,
      }

      if (article) {
        // Update existing article
        const { error } = await supabase
          .from('articles')
          .update(articleData)
          .eq('id', article.id)

        if (error) throw error

        setMessage({ type: 'success', text: 'Article updated successfully!' })
      } else {
        // Create new article
        const { data, error } = await supabase
          .from('articles')
          .insert([articleData])
          .select()
          .single()

        if (error) throw error

        setMessage({ type: 'success', text: 'Article created successfully!' })
        
        // Redirect to edit page for the new article
        setTimeout(() => {
          router.push(`/admin/articles/${data.id}/edit`)
        }, 1000)
      }

      router.refresh()
    } catch (error) {
      console.error('Error saving article:', error)
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to save article' 
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="border-b p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {article ? 'Edit Article' : 'Create New Article'}
          </h2>
          <Link
            href="/admin/articles"
            className="text-gray-600 hover:text-gray-900"
          >
            ← Back to Articles
          </Link>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mx-6 mt-6 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Form */}
      <div className="p-6 space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Article title"
            required
          />
        </div>

        {/* Slug */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Slug *
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="article-slug-url"
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            URL: /blog/{slug || 'article-slug'}
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Brief description (shown in article cards)"
          />
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Content * (Markdown)
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={20}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
            placeholder="Write your article content in Markdown..."
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            Supports Markdown formatting
          </p>
        </div>

        {/* Category and Author Row */}
        <div className="grid grid-cols-2 gap-6">

          {/* Author Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Author Name *
            </label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Author name"
              required
            />
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Add tag"
            />
            <button
              type="button"
              onClick={handleAddTag}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-indigo-900"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Reading Time and Featured Image Row */}
        <div className="grid grid-cols-2 gap-6">
          {/* Reading Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reading Time (minutes)
            </label>
            <input
              type="number"
              value={readingTime}
              onChange={(e) => setReadingTime(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="5"
              min="1"
            />
          </div>

          {/* Featured Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Featured Image URL
            </label>
            <input
              type="url"
              value={featuredImage}
              onChange={(e) => setFeaturedImage(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="https://..."
            />
          </div>
        </div>

        {/* Meta Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Meta Description (SEO)
          </label>
          <textarea
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="SEO description for search engines"
          />
        </div>

        {/* Publish Status */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isPublished"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
          />
          <label htmlFor="isPublished" className="text-sm font-medium text-gray-700">
            Published
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t p-6 flex justify-end gap-3">
        <Link
          href="/admin/articles"
          className="px-6 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={() => handleSave(false)}
          disabled={saving}
          className="px-6 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save as Draft'}
        </button>
        <button
          type="button"
          onClick={() => handleSave(true)}
          disabled={saving}
          className="px-6 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Publishing...' : isPublished ? 'Update & Publish' : 'Publish'}
        </button>
      </div>
    </div>
  )
}