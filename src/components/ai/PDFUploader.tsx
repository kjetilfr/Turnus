// src/components/ai/PDFUploader.tsx - IMPROVED VERSION
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAIAccess } from '@/hooks/useAIAccess'

interface UploadProgress {
  stage: 'idle' | 'uploading' | 'processing' | 'creating' | 'done'
  message: string
}

export default function PDFUploader() {
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<UploadProgress>({
    stage: 'idle',
    message: '',
  })
  const [error, setError] = useState('')
  const [extractedData, setExtractedData] = useState<{
    plan_name: string
    start_date: string
    end_date: string
    shift_count: number
    rotation_pattern?: string[]
  } | null>(null)
  const router = useRouter()
  const { hasAccess, loading: accessLoading, tier } = useAIAccess()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (selectedFile.type !== 'application/pdf') {
      setError('Fila må vere ein PDF')
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('Fila er for stor (maks 10MB)')
      return
    }

    setFile(selectedFile)
    setError('')
  }

  const handleUpload = async () => {
    if (!file) return

    try {
      setError('')
      setProgress({ stage: 'uploading', message: 'Lastar opp PDF...' })

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/ai/upload-pdf', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Du treng Premium-abonnement for å bruke denne funksjonen')
        }
        throw new Error(data.error || 'Noko gjekk galt')
      }

      setProgress({ stage: 'processing', message: 'AI analyserer planen...' })
      
      // Small delay to show processing
      await new Promise(resolve => setTimeout(resolve, 1000))

      setProgress({ stage: 'creating', message: 'Lagar turnusplan...' })
      
      // Small delay to show creating
      await new Promise(resolve => setTimeout(resolve, 1000))

      setExtractedData(data.data)
      setProgress({ stage: 'done', message: 'Ferdig! 🎉' })

      // Redirect to the new plan
      setTimeout(() => {
        router.push(`/app/plans/${data.planId}`)
      }, 1500)

    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'Kunne ikkje laste opp PDF')
      setProgress({ stage: 'idle', message: '' })
    }
  }

  if (accessLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full mx-auto"></div>
        <p className="text-gray-600 mt-4">Sjekkar tilgang...</p>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl shadow-lg p-8 border-2 border-red-200">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Premium krevst
          </h3>
          <p className="text-gray-700 mb-6">
            For å laste opp PDF og få AI til å lage turnusplan automatisk, treng du Premium-abonnementet.
          </p>
          <button
            onClick={() => router.push('/subscribe')}
            className="bg-red-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors"
          >
            Oppgrader til Premium
          </button>
          <p className="text-sm text-gray-600 mt-4">
            Du har {tier || 'gratis'}-abonnement
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold">Last opp turnusplan (PDF)</h2>
          <p className="text-gray-600 text-sm">AI lagar automatisk ein digital plan</p>
        </div>
      </div>
      
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-red-400 transition-colors">
        {file ? (
          <div>
            <svg className="w-16 h-16 text-green-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-green-600 font-semibold text-lg mb-1">{file.name}</p>
            <p className="text-gray-500 text-sm mb-4">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <button
              onClick={() => {
                setFile(null)
                setError('')
                setProgress({ stage: 'idle', message: '' })
              }}
              className="text-red-600 text-sm font-semibold hover:text-red-700"
            >
              Fjern fil
            </button>
          </div>
        ) : (
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
              disabled={progress.stage !== 'idle'}
            />
            <div className="flex flex-col items-center">
              <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-gray-900 font-semibold mb-2">
                Klikk for å laste opp PDF
              </span>
              <span className="text-gray-500 text-sm">
                Maks 10MB • Berre PDF-format
              </span>
            </div>
          </label>
        )}
      </div>

      {/* Progress indicator */}
      {progress.stage !== 'idle' && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full"></div>
            <div>
              <p className="font-semibold text-blue-900">{progress.message}</p>
              <div className="flex gap-2 mt-2">
                <div className={`w-3 h-3 rounded-full ${progress.stage === 'uploading' || progress.stage === 'processing' || progress.stage === 'creating' || progress.stage === 'done' ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                <div className={`w-3 h-3 rounded-full ${progress.stage === 'processing' || progress.stage === 'creating' || progress.stage === 'done' ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                <div className={`w-3 h-3 rounded-full ${progress.stage === 'creating' || progress.stage === 'done' ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                <div className={`w-3 h-3 rounded-full ${progress.stage === 'done' ? 'bg-green-600' : 'bg-gray-300'}`}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extracted data preview */}
      {extractedData && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-900 mb-2">Plan ekstrahert! ✅</h3>
          <div className="text-sm text-green-800 space-y-1">
            <p><strong>Namn:</strong> {extractedData.plan_name}</p>
            <p><strong>Periode:</strong> {extractedData.start_date} til {extractedData.end_date}</p>
            <p><strong>Antal vakter:</strong> {extractedData.shift_count}</p>
            {extractedData.rotation_pattern && (
              <p><strong>Rotasjonsmønster:</strong> {extractedData.rotation_pattern.join(' → ')}</p>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || progress.stage !== 'idle'}
        className="w-full mt-6 bg-red-600 text-white py-4 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg"
      >
        {progress.stage !== 'idle' ? 'Prosesserer...' : 'Last opp og analyser med AI 🤖'}
      </button>

      <div className="mt-6 bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2 text-sm">Korleis fungerer det?</h3>
        <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
          <li>Last opp din turnusplan som PDF</li>
          <li>AI les og forstår planen din</li>
          <li>AI lagar ein digital versjon med alle vakter</li>
          <li>Du kan redigere og forbetre planen vidare</li>
        </ol>
      </div>
    </div>
  )
}