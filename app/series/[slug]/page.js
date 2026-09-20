import Link from 'next/link'
import { getAllArticles } from '../../lib/articles'
import { getSeriesTitle, getSeriesParts, getSeriesCompletion } from '../../lib/series'

export async function generateMetadata({ params }) {
  const { slug } = await params
  const title = getSeriesTitle(slug)
  return {
    title: `${title} Series | Echo and Chronicle`,
    description: `Every part of the ${title} series, in order.`,
  }
}

export default async function SeriesPage({ params }) {
  const { slug } = await params
  const allArticles = getAllArticles()
  const title = getSeriesTitle(slug)
  const parts = getSeriesParts(slug, allArticles)
  const { published, total } = getSeriesCompletion(parts)

  return (
    <main className="min-h-screen bg-white text-gray-900">

      {/* Top Bar */}
      <div style={{maxWidth: '1152px', margin: '0 auto'}} className="border-b border-gray-200 px-8 py-2 flex items-center justify-between text-xs text-gray-400">
        <Link href="/" className="hover:text-gray-900 transition-colors">
          ← Back to Echo and Chronicle
        </Link>
        <span>{parts.length} {parts.length === 1 ? 'part' : 'parts'}</span>
      </div>

      {/* Header */}
      <header style={{maxWidth: '1152px', margin: '0 auto'}} className="border-b border-gray-900 px-8 py-12">
        <div className="accent-line"></div>
        <p className="text-red-700 text-xs font-bold uppercase tracking-widest mb-3">Series</p>
        <h1 style={{fontFamily: 'var(--font-playfair)', fontSize: '3rem', fontWeight: '700', lineHeight: 1.15}} className="mb-3">
          {title}
        </h1>
        <p className="text-gray-500 text-lg mb-2">
          Every part of this series, in order.
        </p>
        <p className="text-gray-400 text-xs uppercase tracking-widest">
          {published} of {total} published
        </p>
      </header>

      {/* Parts List */}
      <div style={{maxWidth: '1152px', margin: '0 auto'}} className="px-8 py-12">
        <div className="space-y-0">
          {parts.map(({ part, article }) => (
            article ? (
              <Link
                key={part}
                href={`/articles/${article.slug}`}
                className="group flex flex-col md:flex-row md:items-center gap-2 md:gap-8 py-4 border-b border-gray-100 hover:border-gray-300 transition-all duration-200"
              >
                <span className="text-gray-400 text-xs uppercase tracking-widest shrink-0 w-24">
                  Part {part}
                </span>
                <span style={{fontFamily: 'var(--font-playfair)'}} className="font-bold text-lg group-hover:text-red-700 transition-colors duration-200 flex-1">
                  {article.title}
                </span>
                <span className="text-gray-400 text-xs shrink-0">
                  {article.date}
                </span>
              </Link>
            ) : (
              <div
                key={part}
                className="flex flex-col md:flex-row md:items-center gap-2 md:gap-8 py-4 border-b border-gray-100 opacity-50"
              >
                <span className="text-gray-400 text-xs uppercase tracking-widest shrink-0 w-24">
                  Part {part}
                </span>
                <span style={{fontFamily: 'var(--font-playfair)'}} className="font-bold text-lg text-gray-400 flex-1">
                  Coming soon
                </span>
              </div>
            )
          ))}
        </div>

        {parts.length === 0 && (
          <div className="text-center py-24">
            <p className="text-gray-400 text-sm uppercase tracking-widest">No parts published yet</p>
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
