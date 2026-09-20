import Link from 'next/link'
import { getAllArticles } from '../lib/articles'
import { getAllSeriesSlugs, getSeriesTitle, getSeriesParts, getSeriesCompletion, getSeriesDescription } from '../lib/series'

export const metadata = {
  title: 'Series | Echo and Chronicle',
  description: 'Multi-part stories, grouped and in order.',
}

export default function SeriesIndexPage() {
  const allArticles = getAllArticles()
  const series = getAllSeriesSlugs(allArticles).map(slug => {
    const parts = getSeriesParts(slug, allArticles)
    return {
      slug,
      title: getSeriesTitle(slug),
      description: getSeriesDescription(slug),
      ...getSeriesCompletion(parts),
    }
  })

  return (
    <main className="min-h-screen bg-white text-gray-900">

      {/* Top Bar */}
      <div style={{maxWidth: '1152px', margin: '0 auto'}} className="border-b border-gray-200 px-8 py-2 flex items-center justify-between text-xs text-gray-400">
        <Link href="/" className="hover:text-gray-900 transition-colors">
          ← Back to Echo and Chronicle
        </Link>
        <span>{series.length} {series.length === 1 ? 'series' : 'series'}</span>
      </div>

      {/* Header */}
      <header style={{maxWidth: '1152px', margin: '0 auto'}} className="border-b border-gray-900 px-8 py-12">
        <div className="accent-line"></div>
        <h1 style={{fontFamily: 'var(--font-playfair)', fontSize: '3rem', fontWeight: '700', lineHeight: 1.15}} className="mb-3">
          Series
        </h1>
        <p className="text-gray-500 text-lg">
          Multi-part stories, grouped and in order.
        </p>
      </header>

      {/* Series List */}
      <div style={{maxWidth: '1152px', margin: '0 auto'}} className="px-8 py-12">
        {series.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {series.map(s => (
              <Link
                key={s.slug}
                href={`/series/${s.slug}`}
                className="article-card cursor-pointer group border-t-2 border-gray-100 hover:border-red-700 pt-4 transition-all duration-200"
              >
                <h2 style={{fontFamily: 'var(--font-playfair)'}} className="text-2xl font-bold mb-2 leading-snug group-hover:text-red-700 transition-colors duration-200">
                  {s.title}
                </h2>
                {s.description && (
                  <p className="text-gray-500 text-sm leading-relaxed mb-3">
                    {s.description}
                  </p>
                )}
                <span className="text-red-700 text-xs font-bold uppercase tracking-widest">
                  {s.published} of {s.total} published
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <p className="text-gray-400 text-sm uppercase tracking-widest">No series published yet</p>
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
            <Link href="/about" className="hover:text-gray-900 transition-colors">About</Link>
          </div>
        </div>
      </footer>

    </main>
  )
}
