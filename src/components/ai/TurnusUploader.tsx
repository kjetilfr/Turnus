// src/components/ai/TurnusUploader.tsx - MULTI-FORMAT TURNUS UPLOAD
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAIAccess } from '@/hooks/useAIAccess'

interface UploadProgress {
  stage: 'idle' | 'uploading' | 'processing' | 'creating' | 'done'
  message: string
}

const SUPPORTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/rtf',
  'text/rtf'
]

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.rtf']

export default function TurnusUploader() {
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<UploadProgress>({
    stage: 'idle',
    message: '',
  })
  const [error, setError] = useState('')
  const [extractedData, setExtractedData] = useState<{
    plan_name: string
    employee_name?: string
    start_date: string
    end_date: string
    shift_count: number
    custom_shifts_count?: number
    rotation_pattern?: string[]
  } | null>(null)
  const router = useRouter()
  const { hasAccess, loading: accessLoading, tier } = useAIAccess()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Check file extension
    const fileExtension = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'))
    const isValidType = SUPPORTED_TYPES.includes(selectedFile.type) || SUPPORTED_EXTENSIONS.includes(fileExtension)

    if (!isValidType) {
      setError('Ugyldig filtype. Støtta format: PDF, DOCX, RTF')
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
      setProgress({ stage: 'uploading', message: 'Lastar opp fil...' })

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/ai/upload-turnus', {
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

      setProgress({ stage: 'processing', message: 'AI analyserer turnusplanen...' })
      
      // Small delay to show processing
      await new Promise(resolve => setTimeout(resolve, 1000))

      setProgress({ stage: 'creating', message: 'Lagar turnusplan med vakter...' })
      
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
      setError(err instanceof Error ? err.message : 'Kunne ikkje laste opp fil')
      setProgress({ stage: 'idle', message: '' })
    }
  }

  const getFileIcon = () => {
    if (!file) return null
    
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    
    if (fileExtension === '.pdf') {
      return (
        <svg className="w-16 h-16 text-red-600 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>
      )
    }
    
    if (fileExtension === '.docx' || fileExtension === '.doc') {
      return (
        <svg className="w-16 h-16 text-blue-600 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>
      )
    }
    
    if (fileExtension === '.rtf') {
      return (
        <svg className="w-16 h-16 text-purple-600 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>
      )
    }
    
    return null
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
            For å laste opp turnus-dokument og få AI til å lage plan automatisk, treng du Premium-abonnementet.
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold">Last opp turnusplan</h2>
          <p className="text-gray-600 text-sm">AI lagar automatisk ein digital plan med alle vakter</p>
        </div>
      </div>
      
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-red-400 transition-colors">
        {file ? (
          <div>
            {getFileIcon()}
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
              accept=".pdf,.docx,.doc,.rtf"
              onChange={handleFileSelect}
              className="hidden"
              disabled={progress.stage !== 'idle'}
            />
            <div className="flex flex-col items-center">
              <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-gray-900 font-semibold mb-2">
                Klikk for å laste opp fil
              </span>
              <span className="text-gray-500 text-sm">
                Støtta format: PDF, DOCX, RTF
              </span>
              <span className="text-gray-400 text-xs mt-1">
                Maks 10MB
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
            <div className="flex-1">
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
          <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Turnusplan ekstrahert!
          </h3>
          <div className="text-sm text-green-800 space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-green-700 font-medium">Plan</p>
                <p className="text-green-900">{extractedData.plan_name}</p>
              </div>
              {extractedData.employee_name && (
                <div>
                  <p className="text-green-700 font-medium">Medarbeidar</p>
                  <p className="text-green-900">{extractedData.employee_name}</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <p className="text-green-700 font-medium">Periode</p>
                <p className="text-green-900">{extractedData.start_date} → {extractedData.end_date}</p>
              </div>
              <div>
                <p className="text-green-700 font-medium">Antal vakter</p>
                <p className="text-green-900">{extractedData.shift_count} vakter</p>
              </div>
            </div>
            {extractedData.custom_shifts_count && extractedData.custom_shifts_count > 0 && (
              <div className="pt-2">
                <p className="text-green-700 font-medium">Spesialvakter identifisert</p>
                <p className="text-green-900">{extractedData.custom_shifts_count} unike vaktkoder</p>
              </div>
            )}
            {extractedData.rotation_pattern && extractedData.rotation_pattern.length > 0 && (
              <div className="pt-2">
                <p className="text-green-700 font-medium">Rotasjonsmønster</p>
                <p className="text-green-900 font-mono text-xs">
                  {extractedData.rotation_pattern.slice(0, 14).join(' → ')}
                  {extractedData.rotation_pattern.length > 14 && '...'}
                </p>
              </div>
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
        <h3 className="font-semibold text-gray-900 mb-3 text-sm">Korleis fungerer det?</h3>
        <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
          <li>Last opp turnusplan (PDF, DOCX eller RTF)</li>
          <li>AI les og forstår alle vaktkoder og tider</li>
          <li>AI lagar ein digital plan med rotasjon og spesialvakter</li>
          <li>Du kan redigere og kjøre lovsjekk på planen</li>
        </ol>
        
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-2 text-sm">AI forstår:</h4>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Alle vaktkoder (D1, K1, L1, osv.)</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Ukestruktur og datoar</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Vaktider og varigheit</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Rotasjonsmønster</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}