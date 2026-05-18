'use client'

import { useState } from 'react'

export default function DocImage({ src, alt, className }) {
  const [hidden, setHidden] = useState(false)
  if (hidden) return null
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setHidden(true)}
    />
  )
}
