import Link from 'next/link'

export const metadata = {
  title: 'About | Echo and Chronicle',
  description: 'Echo & Chronicle exists because history doesn\'t stay in the past.',
}

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">

      {/* Top Bar */}
      <div className="border-b border-gray-200 px-8 py-2 flex items-center justify-between text-xs text-gray-400" style={{maxWidth: '1152px', margin: '0 auto'}}>
        <Link href="/" className="hover:text-gray-900 transition-colors">
          ← Back to Echo and Chronicle
        </Link>
      </div>

      {/* Header */}
      <header className="border-b border-gray-200 px-8 py-6" style={{maxWidth: '1152px', margin: '0 auto'}}>
        <div className="max-w-2xl">
          <div className="accent-line"></div>
          <h1 style={{fontFamily: 'var(--font-playfair)', fontSize: '2.75rem', fontWeight: '700', lineHeight: 1.15}} className="mb-4">
            About
          </h1>
        </div>
      </header>

      {/* Body */}
      <article className="px-8 py-12" style={{maxWidth: '1152px', margin: '0 auto'}}>
        <div className="max-w-2xl prose-content">
          <p>Echo &amp; Chronicle exists because history doesn&#8217;t stay in the past.</p>
          <p>Every day, the news carries echoes of decisions made decades or centuries ago. A Supreme Court ruling. A diplomatic miscalculation. A law passed in a moment of crisis. Understanding where we are requires understanding how we got here.</p>
          <p>That&#8217;s what this publication is for.</p>
          <p>My name is Brad. I work in Palm Beach County and I hold a degree in history. I&#8217;ve spent most of my life reading about the moments that shaped the world we live in, particularly American history, World War II, and the Cold War. The further I got into those subjects the more I noticed how often today&#8217;s headlines are just older stories wearing new clothes.</p>
          <p>Echo &amp; Chronicle publishes one story every day. Each one connects a moment from the historical record to something alive in the present. We work from primary sources wherever possible, original documents, court opinions, diplomatic cables, firsthand accounts, because the real record is almost always more interesting than the summary.</p>
          <p>There are no ads here. No sponsored content. No algorithm chasing clicks. Just history, told carefully, every day.</p>
          <p>If you find something worth reading here, share it with someone who would appreciate it. That&#8217;s how this grows.</p>
        </div>
      </article>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-8 py-8">
        <div style={{maxWidth: '1152px', margin: '0 auto'}} className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-400">
          <p style={{fontFamily: 'var(--font-playfair)'}} className="text-sm font-bold text-gray-900">
            Echo and Chronicle
          </p>
          <p>© {new Date().getFullYear()} · All historical documents sourced from public domain archives</p>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
            <Link href="/archive" className="hover:text-gray-900 transition-colors">Archive</Link>
            <Link href="/about" className="hover:text-gray-900 transition-colors">About</Link>
          </div>
        </div>
      </footer>

    </main>
  )
}
