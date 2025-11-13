// src/components/ai/AIModelSelector.tsx
'use client'

interface AIModelSelectorProps {
  onModelSelect: (model: 'claude' | 'gpt4o' | 'gemini') => void
  selectedModel: 'claude' | 'gpt4o' | 'gemini'
  fileType?: string
}

export default function AIModelSelector({ onModelSelect, selectedModel, fileType }: AIModelSelectorProps) {
  const getModelCompatibility = (model: string) => {
    if (!fileType) return true
    
    const ext = fileType.toLowerCase()
    
    switch (model) {
      case 'claude':
        return ext === '.pdf'
      case 'gpt4o':
        return ['.pdf', '.docx', '.doc', '.rtf'].includes(ext)
      case 'gemini':
        return ['.pdf', '.docx', '.doc', '.rtf'].includes(ext)
      default:
        return true
    }
  }

  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Vel AI-modell
      </label>
      <div className="grid grid-cols-3 gap-3">
        {/* Gemini (Primary/Default) */}
        <button
          onClick={() => onModelSelect('gemini')}
          disabled={!getModelCompatibility('gemini')}
          className={`p-3 rounded-lg border-2 transition-all ${
            selectedModel === 'gemini'
              ? 'border-orange-600 bg-orange-50'
              : getModelCompatibility('gemini')
              ? 'border-gray-200 hover:border-orange-300'
              : 'border-gray-200 opacity-50 cursor-not-allowed'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">💎</span>
            <span className="font-bold text-gray-500 text-sm">Gemini</span>
          </div>
          <p className="text-xs text-gray-600">
            {getModelCompatibility('gemini') ? 'Stor kontekst (Google)' : 'Støttar alle format'}
          </p>
        </button>

        {/* GPT-4o (Secondary) */}
        <button
          onClick={() => onModelSelect('gpt4o')}
          disabled={!getModelCompatibility('gpt4o')}
          className={`p-3 rounded-lg border-2 transition-all ${
            selectedModel === 'gpt4o'
              ? 'border-green-600 bg-green-50'
              : getModelCompatibility('gpt4o')
              ? 'border-gray-200 hover:border-green-300'
              : 'border-gray-200 opacity-50 cursor-not-allowed'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">⚡</span>
            <span className="font-bold text-gray-500 text-sm">GPT-4o</span>
          </div>
          <p className="text-xs text-gray-600">
            {getModelCompatibility('gpt4o') ? 'Rask & presis (OpenAI)' : 'Støttar alle format'}
          </p>
        </button>

        {/* Claude (Tertiary) */}
        <button
          onClick={() => onModelSelect('claude')}
          disabled={!getModelCompatibility('claude')}
          className={`p-3 rounded-lg border-2 transition-all ${
            selectedModel === 'claude'
              ? 'border-blue-600 bg-blue-50'
              : getModelCompatibility('claude')
              ? 'border-gray-200 hover:border-blue-300'
              : 'border-gray-200 opacity-50 cursor-not-allowed'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🧠</span>
            <span className="font-bold text-gray-500 text-sm">Claude</span>
          </div>
          <p className="text-xs text-gray-600">
            {getModelCompatibility('claude') ? 'Djup forståing (Anthropic)' : 'Berre PDF'}
          </p>
        </button>
      </div>
      
      {fileType && !getModelCompatibility(selectedModel) && (
        <div className="mt-2 text-xs text-orange-600">
          ⚠️ Denne modellen støttar ikkje {fileType}-filer. Vel ein annan modell.
        </div>
      )}
    </div>
  )
}