'use client'

import { useState, useEffect } from 'react'

interface Screenshot {
  title: string
  description: string
  imageUrl?: string // Optional: use real image URL
  placeholderText?: string // Optional: fallback text when no image
  gradientFrom?: string // Optional: gradient for placeholder
  gradientTo?: string // Optional: gradient for placeholder
  iconColor?: string // Optional: icon color for placeholder
  icon?: React.ReactNode // Optional: icon for placeholder
}

// ADD YOUR SCREENSHOTS HERE - Just add or remove items from this array
const screenshots: Screenshot[] = [
  {
    title: 'Turnusplanlegging',
    description: 'Bygg din turnus slik den ser ut og test',
    // Option 1: Use a real image (recommended)
    imageUrl: '/images/slideshow/my_plans.png', // Put your image in public/images/
    // Option 2: If no image, use placeholder (remove imageUrl and uncomment below)
    // placeholderText: 'Screenshot: Turnusgrid med drag & drop',
    // gradientFrom: 'from-indigo-100',
    // gradientTo: 'to-purple-100',
    // iconColor: 'text-indigo-300',
    // icon: (
    //   <svg className="w-24 h-24 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    //     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    //   </svg>
    // )
  },
  {
    title: 'Lovsjekkar',
    description: 'Få umiddelbar tilbakemelding på om turnusen følgjer lover og reglar',
    imageUrl: '/images/slideshow/lovsjekk_fail.png',
  },
  {
    title: 'Vakter',
    description: 'Lag dagvakter, langvakter, kveldsvakter eller nattevakter',
    imageUrl: '/images/slideshow/shifts.png',
  },
  {
    title: 'Lag turnus',
    description: 'Sett inn vaktene dine i turnusen',
    imageUrl: '/images/slideshow/turnus_80_total.png',
  },
  // ADD MORE SCREENSHOTS HERE:
  // {
  //   title: 'Statistikk',
  //   description: 'Detaljert oversikt over arbeidstid',
  //   imageUrl: '/images/screenshot-stats.png',
  // },
]

export default function ScreenshotCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  // Auto-advance slides
  useEffect(() => {
    if (!isAutoPlaying) return

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % screenshots.length)
    }, 5000) // Change slide every 5 seconds

    return () => clearInterval(interval)
  }, [isAutoPlaying])

  const goToSlide = (index: number) => {
    setCurrentSlide(index)
    setIsAutoPlaying(false) // Pause auto-play when user manually changes slide
    
    // Resume auto-play after 10 seconds
    setTimeout(() => setIsAutoPlaying(true), 10000)
  }

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % screenshots.length)
    setIsAutoPlaying(false)
    setTimeout(() => setIsAutoPlaying(true), 10000)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + screenshots.length) % screenshots.length)
    setIsAutoPlaying(false)
    setTimeout(() => setIsAutoPlaying(true), 10000)
  }

  return (
    <div className="relative max-w-5xl mx-auto">
      <div className="rounded-xl overflow-hidden shadow-2xl relative">
        {/* Screenshot Slides */}
        {screenshots.map((screenshot, index) => (
          <div
            key={index}
            className={`bg-white p-8 transition-all duration-500 ${
              currentSlide === index ? 'block' : 'hidden'
            }`}
            style={{
              animation: currentSlide === index ? 'fadeIn 0.5s ease-in-out' : 'none'
            }}
          >
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{screenshot.title}</h3>
              <p className="text-gray-600">{screenshot.description}</p>
            </div>
            
            {/* Image or Placeholder */}
            <div className="aspect-video rounded-lg overflow-hidden">
              {screenshot.imageUrl ? (
                // Real image
                <img
                  src={screenshot.imageUrl}
                  alt={screenshot.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                // Placeholder with gradient and icon
                <div className={`w-full h-full bg-gradient-to-br ${screenshot.gradientFrom || 'from-gray-100'} ${screenshot.gradientTo || 'to-gray-200'} flex items-center justify-center`}>
                  <div className="text-center p-8">
                    {screenshot.icon && (
                      <div className={screenshot.iconColor || 'text-gray-300'}>
                        {screenshot.icon}
                      </div>
                    )}
                    {screenshot.placeholderText && (
                      <p className={`${screenshot.iconColor || 'text-gray-400'} text-sm`}>
                        {screenshot.placeholderText}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Navigation Arrows */}
        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition-all hover:scale-110"
          aria-label="Previous screenshot"
        >
          <svg className="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition-all hover:scale-110"
          aria-label="Next screenshot"
        >
          <svg className="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Carousel Navigation Dots */}
      <div className="flex justify-center gap-2 mt-8">
        {screenshots.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-3 h-3 rounded-full transition-all ${
              currentSlide === index
                ? 'bg-indigo-600 w-8'
                : 'bg-gray-300 hover:bg-gray-400'
            }`}
            aria-label={`Go to screenshot ${index + 1}`}
          />
        ))}
      </div>

      {/* Slide Counter */}
      <div className="text-center mt-4 text-sm text-gray-600">
        {currentSlide + 1} / {screenshots.length}
      </div>
    </div>
  )
}