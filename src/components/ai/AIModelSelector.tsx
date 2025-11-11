// src/components/ai/AIModelSelector.tsx - Let user choose AI model
'use client'

import { useState } from 'react'

interface AIModelSelectorProps {
  onModelSelect: (model: 'claude' | 'gpt4o' | 'gemini' | 'auto') => void
  selectedModel: 'claude' | 'gpt4o' | 'gemini' | 'auto'
}

export default function AIModelSelector({ onModelSelect, selectedModel }: AIModelSelectorProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Vel AI-modell
      </label>
      <div className="grid grid-cols-2 gap-3">
        {/* Auto (Default) */}
        <button
          onClick={() => onModelSelect('auto')}
          className={`p-3 rounded-lg border-2 transition-all ${
            selectedModel === 'auto'
              ? 'border-purple-600 bg-purple-50'
              : 'border-gray-200 hover:border-purple-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🤖</span>
            <span className="font-bold text-sm">Auto (Anbefalt)</span>
          </div>
          <p className="text-xs text-gray-600">Vel beste modell automatisk</p>
        </button>

        {/* GPT-4o */}
        <button
          onClick={() => onModelSelect('gpt4o')}
          className={`p-3 rounded-lg border-2 transition-all ${
            selectedModel === 'gpt4o'
              ? 'border-green-600 bg-green-50'
              : 'border-gray-200 hover:border-green-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">⚡</span>
            <span className="font-bold text-sm">GPT-4o</span>
          </div>
          <p className="text-xs text-gray-600">Rask & presis (OpenAI)</p>
        </button>

        {/* Claude */}
        <button
          onClick={() => onModelSelect('claude')}
          className={`p-3 rounded-lg border-2 transition-all ${
            selectedModel === 'claude'
              ? 'border-blue-600 bg-blue-50'
              : 'border-gray-200 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🧠</span>
            <span className="font-bold text-sm">Claude</span>
          </div>
          <p className="text-xs text-gray-600">Djup forståing (Anthropic)</p>
        </button>

        {/* Gemini */}
        <button
          onClick={() => onModelSelect('gemini')}
          className={`p-3 rounded-lg border-2 transition-all ${
            selectedModel === 'gemini'
              ? 'border-orange-600 bg-orange-50'
              : 'border-gray-200 hover:border-orange-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">💎</span>
            <span className="font-bold text-sm">Gemini</span>
          </div>
          <p className="text-xs text-gray-600">Stor kontekst (Google)</p>
        </button>
      </div>
    </div>
  )
}