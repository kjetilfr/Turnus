'use client'

import Link from 'next/link'

export default function HeroSection() {
  return (
    <div className="max-w-7xl mx-auto py-12 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl md:text-6xl transition-colors duration-300">
          <span className="text-blue-600 dark:text-blue-400">Nurse Scheduler</span>
        </h1>
        <p className="mt-3 max-w-md mx-auto text-base text-gray-500 dark:text-gray-300 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl transition-colors duration-300">
          Create and manage nursing schedules with custom shifts and rotations. 
          Perfect for healthcare facilities and nursing teams.
        </p>
        
        <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
          <div className="rounded-md shadow">
            <Link
              href="/register"
              className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10 transition-colors duration-200"
            >
              Get Started
            </Link>
          </div>
          <div className="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
            <Link
              href="/login"
              className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 md:py-4 md:text-lg md:px-10 transition-colors duration-200 border border-gray-300 dark:border-gray-600"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}