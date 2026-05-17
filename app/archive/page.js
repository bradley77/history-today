import Link from 'next/link'
import { getAllArticles } from '../lib/articles'

export const metadata = {
  title: 'Archive | Echo and Chronicle',
  description: 'Every story we have ever published.',
}

export default function ArchivePage() {
  const articles = getAllArticles()

  const groupedByYear = articles.reduce((acc, article) => {
    const year = new Date(article.date).getFullYear()
    if (!acc[year]) acc[year] = []
    acc[year].push(article)
    return acc
  }, {})

  const years = Object.keys(groupedByYear).sort((a, b) => b - a)

  return (
    <main className="min-h-screen bg-white text-gray-900">

      {/* Top Bar */}
      <div style={{maxWidth: '1152px', margin: '0 auto'}} className="border-b border-gray-200 px-8 py-2 flex items-center justify-between text-xs text-gray-400">
        <Link href="/" className="hover:text-gray-900 transition-colors">
          ← Back to Echo and Chronicle
        </Link>
        <span>{articles.length} {articles.length === 1 ? 'story' : 'stories'} published</span>
      </div>

      {/* Header */}
      <header style={{maxWidth: '1152px', margin: '0 auto'}} className="border-b border-gray-900 px-8 py-12">
        <div className="accent-line"></div>
        <h1 style={{fontFamily: 'var(--font-playfair)', fontSize: '3rem', fontWeight: '700', lineHeight: 1.15}} className="mb-3">
          The Archive
        </h1>
        <p className="text-gray-500 text-lg">
          Every story, every document, every dispatch. Permanent and searchable.
        </p>
      </header>

      {/* Article List */}
      <div style={{maxWidth: '1152px', margin: '0 auto'}} className="px-8 py-12">
        {years.map(year => (
          <div key={year} className="mb-12">

            {/* Year Header */}
            <div className="flex items-center gap-4 mb-6">
              <h2 style={{fontFamily: 'var(--font-playfair)'}} className="text-2xl font-bold">
                {year}
              </h2>
              <div className="flex-1 border-t border-gray-200"></div>
              <span className="text-gray-400 text-xs uppercase tracking-widest">
                {groupedByYear[year].length} {groupedByYear[year].length === 1 ? 'story' : 'stories'}
              </span>
            </div>

            {/* Articles for this year */}
            <div className="space-y-0">
              {groupedByYear[year].map((article, index) => (
                <Link
                  key={article.slug}
                  href={`/articles/${article.slug}`}
                  className="group flex flex-col md:flex-row md:items-center gap-2 md:gap-8 py-4 border-b border-gray-100 hover:border-gray-300 transition-all duration-200"
                >
                  <span className="text-gray-400 text-xs uppercase tracking-widest shrink-0 w-32">
                    {article.date}
                  </span>
                  <span className="text-red-700 text-xs font-bold uppercase tracking-widest shrink-0 w-24">
                    {article.category}
                  </span>
                  <span style={{fontFamily: 'var(--font-playfair)'}} className="font-bold text-lg group-hover:text-red-700 transition-colors duration-200 flex-1">
                    {article.title}
                  </span>
                  <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 uppercase tracking-wider shrink-0 group-hover:bg-red-700 group-hover:text-white transition-colors duration-200">
                    {article.tag}
                  </span>
                </Link>
              ))}
            </div>

          </div>
        ))}

        {articles.length === 0 && (
          <div className="text-center py-24">
            <p className="text-gray-400 text-sm uppercase tracking-widest">No stories published yet</p>
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
            <a href="#" className="hover:text-gray-900 transition-colors">Contact</a>
          </div>
        </div>
      </footer>

    </main>
  )
}
