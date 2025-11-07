// src/components/ai/TurnusPopulator.tsx - Populates existing plan with AI
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface TurnusPopulatorProps {
  planId: string
  onClose?: () => void
}

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

export default function TurnusPopulator({ planId, onClose }: TurnusPopulatorProps) {
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<UploadProgress>({
    stage: 'idle',
    message: '',
  })
  const [error, setError] = useState('')
  const [extractedData, setExtractedData] = useState<{
    custom_shifts_count: number
    rotation_entries_count: number
  } | null>(null)
  const router = useRouter()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

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
      formData.append('planId', planId)

      const response = await fetch('/api/ai/populate-turnus', {
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
      await new Promise(resolve => setTimeout(resolve, 1000))

      setProgress({ stage: 'creating', message: 'Fyller turnusplan med vakter...' })
      await new Promise(resolve => setTimeout(resolve, 1000))

      setExtractedData({
        custom_shifts_count: data.data.custom_shifts_count,
        rotation_entries_count: data.data.rotation_entries_count,
      })
      setProgress({ stage: 'done', message: 'Ferdig! 🎉' })

      // Refresh the page after a short delay
      setTimeout(() => {
        router.refresh()
        if (onClose) onClose()
      }, 1500)

    } catch (err) {
      console.error('Upload error:', err)
      console.error('Error details:', err instanceof Error ? {
        message: err.message,
        stack: err.stack,
        name: err.name
      } : err)
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

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold">Fyll plan med AI</h3>
            <p className="text-gray-600 text-sm">Last opp turnus-dokument</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-400 transition-colors">
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
              <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-gray-900 font-semibold mb-1">
                Klikk for å laste opp
              </span>
              <span className="text-gray-500 text-sm">
                PDF, DOCX, RTF • Maks 10MB
              </span>
            </div>
          </label>
        )}
      </div>

      {/* Progress indicator */}
      {progress.stage !== 'idle' && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin w-5 h-5 border-3 border-blue-600 border-t-transparent rounded-full"></div>
            <div className="flex-1">
              <p className="font-semibold text-blue-900 text-sm">{progress.message}</p>
              <div className="flex gap-1 mt-2">
                <div className={`w-2 h-2 rounded-full ${progress.stage === 'uploading' || progress.stage === 'processing' || progress.stage === 'creating' || progress.stage === 'done' ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                <div className={`w-2 h-2 rounded-full ${progress.stage === 'processing' || progress.stage === 'creating' || progress.stage === 'done' ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                <div className={`w-2 h-2 rounded-full ${progress.stage === 'creating' || progress.stage === 'done' ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                <div className={`w-2 h-2 rounded-full ${progress.stage === 'done' ? 'bg-green-600' : 'bg-gray-300'}`}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success preview */}
      {extractedData && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Turnus fylt!
          </h4>
          <div className="text-sm text-green-800 space-y-1">
            <p>✓ {extractedData.custom_shifts_count} vaktypar oppretta</p>
            <p>✓ {extractedData.rotation_entries_count} rotasjonsinnslag fylt</p>
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
        className="w-full mt-4 bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {progress.stage !== 'idle' ? 'Prosesserer...' : 'Fyll plan med AI 🤖'}
      </button>

      <div className="mt-4 bg-gray-50 rounded-lg p-3">
        <p className="text-xs text-gray-600">
          AI vil ekstrahere alle vaktkoder og fylle rotasjonsgridet automatisk. Eksisterande data vil bli overskrive.
        </p>
      </div>
    </div>
  )
}