// src/components/MarkdownRenderer.tsx
'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`prose prose-lg max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: (props) => (
            <h1 className="text-4xl font-bold text-gray-900 mt-8 mb-4" {...props} />
          ),
          h2: (props) => (
            <h2 className="text-3xl font-bold text-gray-900 mt-8 mb-4" {...props} />
          ),
          h3: (props) => (
            <h3 className="text-2xl font-bold text-gray-900 mt-6 mb-3" {...props} />
          ),
          h4: (props) => (
            <h4 className="text-xl font-bold text-gray-900 mt-6 mb-3" {...props} />
          ),
          h5: (props) => (
            <h5 className="text-lg font-bold text-gray-900 mt-4 mb-2" {...props} />
          ),
          h6: (props) => (
            <h6 className="text-base font-bold text-gray-900 mt-4 mb-2" {...props} />
          ),
          
          // Paragraphs
          p: (props) => (
            <p className="text-gray-700 leading-relaxed mb-4" {...props} />
          ),
          
          // Links
          a: (props) => (
            <a 
              className="text-indigo-600 hover:text-indigo-800 underline font-medium transition-colors" 
              target="_blank"
              rel="noopener noreferrer"
              {...props} 
            />
          ),
          
          // Lists
          ul: (props) => (
            <ul className="list-disc list-outside ml-6 mb-4 space-y-2 text-gray-700" {...props} />
          ),
          ol: (props) => (
            <ol className="list-decimal list-outside ml-6 mb-4 space-y-2 text-gray-700" {...props} />
          ),
          li: (props) => (
            <li className="leading-relaxed" {...props} />
          ),
          
          // Tables
          table: (props) => (
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full divide-y divide-gray-300 border border-gray-300" {...props} />
            </div>
          ),
          thead: (props) => (
            <thead className="bg-gray-50" {...props} />
          ),
          tbody: (props) => (
            <tbody className="divide-y divide-gray-200 bg-white" {...props} />
          ),
          tr: (props) => (
            <tr {...props} />
          ),
          th: (props) => (
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900" {...props} />
          ),
          td: (props) => (
            <td className="px-6 py-4 text-sm text-gray-700" {...props} />
          ),
          
          // Code blocks
          code: ({ inline, className, children, ...props }: any) => {
            return inline ? (
              <code className="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                {children}
              </code>
            ) : (
              <code className="block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono" {...props}>
                {children}
              </code>
            )
          },
          pre: (props) => (
            <pre className="mb-4 rounded-lg overflow-hidden" {...props} />
          ),
          
          // Blockquotes
          blockquote: (props) => (
            <blockquote className="border-l-4 border-indigo-500 pl-4 py-2 my-4 italic text-gray-700 bg-gray-50" {...props} />
          ),
          
          // Horizontal rule
          hr: (props) => (
            <hr className="my-8 border-gray-300" {...props} />
          ),
          
          // Images
          img: (props) => (
            <img className="rounded-lg shadow-md my-6 max-w-full h-auto" {...props} alt={props.alt || ''} />
          ),
          
          // Strong/Bold
          strong: (props) => (
            <strong className="font-bold text-gray-900" {...props} />
          ),
          
          // Emphasis/Italic
          em: (props) => (
            <em className="italic" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}