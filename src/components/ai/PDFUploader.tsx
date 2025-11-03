// src/components/ai/PDFUploader.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PDFUploader() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleUpload = async () => {
    if (!file) return

    try {
      setLoading(true)
      setError('')

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/ai/upload-pdf', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        router.push(`/app/plans/${data.planId}`)
      } else {
        setError(data.error || 'Noko gjekk galt')
      }
    } catch (err) {
      setError('Kunne ikkje laste opp PDF')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold mb-4">Last opp turnusplan (PDF)</h2>
      
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        {file ? (
          <div>
            <p className="text-green-600 font-semibold">{file.name}</p>
            <button
              onClick={() => setFile(null)}
              className="text-red-600 text-sm mt-2"
            >
              Fjern
            </button>
          </div>
        ) : (
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <div className="flex flex-col items-center">
              <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-gray-600">Klikk for å laste opp PDF</span>
            </div>
          </label>
        )}
      </div>

      {error && (
        <p className="text-red-600 text-sm mt-2">{error}</p>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className="w-full mt-4 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Prosesserer...' : 'Last opp og analyser'}
      </button>
    </div>
  )
}