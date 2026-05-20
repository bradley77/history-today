import Link from 'next/link'
import { getAllArticles } from '../lib/articles'
import DocImage from '@/components/DocImage'

export const metadata = {
  title: 'Primary Sources | Echo and Chronicle',
  description: 'Original documents from the historical record.',
}

export default function DocumentsPage() {
  const articles = getAllArticles().filter(article => article.sourceUrl)

  return (
    <main className="min-h-screen bg-white text-gray-900">

      {/* Top Bar */}
      <div style={{maxWidth: '1152px', margin: '0 auto'}} className="border-b border-gray-200 px-8 py-2 flex items-center justify-between text-xs text-gray-400">
        <Link href="/" className="hover:text-gray-900 transition-colors">
          ← Back to Echo and Chronicle
        </Link>
        <span>{articles.length} {articles.length === 1 ? 'document' : 'documents'}</span>
      </div>

      {/* Header */}
      <header style={{maxWidth: '1152px', margin: '0 auto'}} className="border-b border-gray-900 px-8 py-12">
        <div className="accent-line"></div>
        <h1 style={{fontFamily: 'var(--font-playfair)', fontSize: '3rem', fontWeight: '700', lineHeight: 1.15}} className="mb-3">
          Primary Sources
        </h1>
        <p className="text-gray-500 text-lg">
          Original documents from the historical record.
        </p>
      </header>

      {/* Document Grid */}
      <div style={{maxWidth: '1152px', margin: '0 auto'}} className="px-8 py-12">
        {articles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {articles.map(article => (
              <div key={article.slug} className="border-t-2 border-gray-100 pt-4">
                <DocImage
                  src={`/images/${article.slug}-document.jpg`}
                  alt={`Primary source document for ${article.title}`}
                  className="w-full object-cover mb-3"
                />
                {article.documentCaption && (
                  <p className="text-gray-400 text-xs uppercase tracking-widest mb-3">
                    {article.documentCaption}
                  </p>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-red-700 text-xs font-bold uppercase tracking-widest">{article.category}</span>
                  <span className="text-gray-300 text-xs">·</span>
                  <span className="text-gray-400 text-xs">{article.date}</span>
                </div>
                <h2 style={{fontFamily: 'var(--font-playfair)'}} className="text-xl font-bold mb-4 leading-snug">
                  {article.title}
                </h2>
                <div className="flex flex-wrap items-center gap-4">
                  <a
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-red-700 text-white text-xs font-bold uppercase tracking-widest px-5 py-2.5 hover:bg-red-800 transition-colors duration-200"
                  >
                    View Document →
                  </a>
                  <Link
                    href={`/articles/${article.slug}`}
                    className="text-xs font-medium text-gray-900 border-b border-gray-900 pb-0.5 hover:text-red-700 hover:border-red-700 transition-colors duration-200"
                  >
                    Read the Article
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <p className="text-gray-400 text-sm uppercase tracking-widest">No documents available yet</p>
          </div>
        )}
      </div>

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
