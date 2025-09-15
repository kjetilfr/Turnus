'use client'

import { useDarkMode } from '@/lib/dark-mode-context'

export default function DarkModeTest() {
  const { darkMode, toggleDarkMode, mounted } = useDarkMode()

  if (!mounted) return null

  return (
    <div className="fixed bottom-4 right-4 p-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg">
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Dark Mode Test</h3>
        <div className="text-xs space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"></div>
            <span className="text-gray-600 dark:text-gray-300">Background test</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-500 dark:bg-blue-400 rounded"></div>
            <span className="text-gray-600 dark:text-gray-300">Color test</span>
          </div>
          <p className="text-gray-900 dark:text-white">Text: {darkMode ? 'Dark' : 'Light'}</p>
        </div>
        <button
          onClick={toggleDarkMode}
          className="w-full px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
        >
          Toggle Test
        </button>
      </div>
    </div>
  )
}