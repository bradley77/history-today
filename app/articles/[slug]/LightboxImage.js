'use client'

import { useState } from 'react'

export default function LightboxImage({ src, alt, children, errorText, objectPosition }) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [imgError, setImgError] = useState(false)

  return (
    <>
      {children ? (
        <div
          className="cursor-zoom-in hover:opacity-90 transition-opacity duration-200"
          onClick={() => setLightboxOpen(true)}
        >
          {children}
        </div>
      ) : imgError ? (
        <div style={{color: 'red', padding: '1rem', border: '1px solid red', backgroundColor: '#fff5f5', borderRadius: '4px', fontSize: '0.875rem'}}>
          {errorText || `Image missing: ${src}`}
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className="rounded-sm w-full object-cover shadow-md border border-gray-200 cursor-zoom-in hover:opacity-90 transition-opacity duration-200"
          style={{ objectPosition: objectPosition || 'center' }}
          onClick={() => setLightboxOpen(true)}
          onError={errorText ? () => setImgError(true) : undefined}
        />
      )}
      {lightboxOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative max-w-5xl w-full">
            <img
              src={src}
              alt={alt}
              className="w-full h-auto rounded-sm shadow-2xl"
            />
            <button
              onClick={() => setLightboxOpen(false)}
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
