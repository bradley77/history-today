'use client'

import { useState, useEffect, useRef } from 'react'

export default function ProseContent({ html }) {
  const [lightbox, setLightbox] = useState(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const imgs = container.querySelectorAll('img')
    const handlers = []

    imgs.forEach(img => {
      const handler = () => setLightbox({ src: img.src, alt: img.alt })
      img.addEventListener('click', handler)
      handlers.push({ img, handler })
    })

    return () => {
      handlers.forEach(({ img, handler }) => {
        img.removeEventListener('click', handler)
      })
    }
  }, [html])

  return (
    <>
      <div
        ref={containerRef}
        className="max-w-2xl prose-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {lightbox && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-5xl w-full">
            <img
              src={lightbox.src}
              alt={lightbox.alt}
              className="w-full h-auto rounded-sm shadow-2xl"
            />
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-3 right-3 bg-white text-gray-900 text-xs font-bold uppercase tracking-widest px-3 py-1.5 hover:bg-red-700 hover:text-white transition-colors duration-200"
            >
              Close ✕
            </button>
            <p className="text-gray-400 text-xs uppercase tracking-widest mt-3 text-center">
              Click anywhere to close
            </p>
          </div>
        </div>
      )}
    </>
  )
}
