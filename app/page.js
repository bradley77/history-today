import Link from 'next/link'
import { getAllArticles } from './lib/articles'

export default async function Home() {
  const realArticles = getAllArticles()
  const featured = realArticles[0]
  const rest = realArticles.slice(1)

  return (
    <main className="min-h-screen bg-white text-gray-900 overflow-x-hidden">

      <div style={{maxWidth: '1152px', margin: '0 auto'}} className="border-b border-gray-200 px-8 py-2 flex items-center justify-between text-xs text-gray-400">
        <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        <span>History meets today</span>
      </div>

      <header style={{maxWidth: '1152px', margin: '0 auto'}} className="border-b border-gray-900 px-8">
        <div className="py-8 text-center">
          <h1 style={{fontFamily: 'var(--font-playfair)', fontSize: '3.5rem', fontWeight: '700', letterSpacing: '-0.02em', lineHeight: 1}}>
            Echo and Chronicle
          </h1>
          <p className="text-xs tracking-widest uppercase text-gray-400 mt-2">
            The historical moment behind todays news
          </p>
        </div>
        <nav className="flex items-center justify-center gap-8 pb-4 text-sm font-medium">
          {['Home', 'Archive', 'Documents', 'On This Day', 'Newsletter'].map(item => (
            <a
              key={item}
              href={item === 'Archive' ? '/archive' : '#'}
              className="hover:text-red-700 transition-colors duration-200 pb-1 border-b-2 border-transparent hover:border-red-700"
            >
              {item}
            </a>
          ))}
        </nav>
      </header>

      <div className="bg-gray-900 text-white px-8 py-2">
        <div style={{maxWidth: '1152px', margin: '0 auto'}} className="flex items-center gap-4">
          <span className="bg-red-700 text-white text-xs font-bold px-2 py-0.5 uppercase tracking-wider shrink-0">
            On This Day
          </span>
          <span className="text-sm text-gray-300">
            November 9, 1989 — The Berlin Wall falls · July 20, 1969 — Apollo 11 lands on the moon · October 29, 1929 — Black Tuesday · June 6, 1944 — D-Day begins
          </span>
        </div>
      </div>

      <div style={{maxWidth: '1152px', margin: '0 auto'}} className="px-8 py-10">

        {/* Featured Story */}
        {featured && (
          <section className="mb-12">
            <div className="accent-line"></div>
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-6 font-medium">Featured Story</p>
            <Link href={`/articles/${featured.slug}`} className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center article-card cursor-pointer group">
              <div className="bg-gray-100 aspect-video rounded-sm flex items-center justify-center overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300"></div>
                <div className="relative text-center px-8">
                  <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Primary Source</p>
                  <p className="text-gray-500 text-sm">Historical document image</p>
                </div>
                <div className="absolute bottom-3 left-3 bg-red-700 text-white text-xs px-2 py-1 uppercase tracking-wider font-bold">
                  {featured.tag}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-red-700 text-xs font-bold uppercase tracking-widest">{featured.category}</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-gray-400 text-xs">{featured.date}</span>
                </div>
                <h2 style={{fontFamily: 'var(--font-playfair)'}} className="text-4xl font-bold mb-4 leading-tight group-hover:text-red-700 transition-colors duration-200">
                  {featured.title}
                </h2>
                <p className="text-gray-500 text-base leading-relaxed mb-6">
                  {featured.excerpt}
                </p>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium border-b-2 border-gray-900 pb-0.5 group-hover:border-red-700 group-hover:text-red-700 transition-colors duration-200">
                    Read the full story
                  </span>
                  <span className="text-gray-400 text-xs">{featured.readTime}</span>
                </div>
              </div>
            </Link>
          </section>
        )}

        <hr className="section-divider" />

        {/* Article Grid */}
        <section className="mt-8">
          {rest.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {rest.map((article) => (
                <Link
                  key={article.slug}
                  href={`/articles/${article.slug}`}
                  className="article-card cursor-pointer group border-t-2 border-gray-100 hover:border-red-700 pt-4 transition-all duration-200"
                >
                  <div className="bg-gray-100 aspect-video rounded-sm mb-4 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 group-hover:from-gray-200 group-hover:to-gray-300 transition-all duration-300"></div>
                    <div className="absolute bottom-2 left-2 bg-red-700 text-white text-xs px-2 py-0.5 uppercase tracking-wider font-bold">
                      {article.tag}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-red-700 text-xs font-bold uppercase tracking-widest">{article.category}</span>
                    <span className="text-gray-300 text-xs">·</span>
                    <span className="text-gray-400 text-xs">{article.date}</span>
                  </div>
                  <h3 style={{fontFamily: 'var(--font-playfair)'}} className="text-xl font-bold mb-2 leading-snug group-hover:text-red-700 transition-colors duration-200">
                    {article.title}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-3">
                    {article.excerpt}
                  </p>
                  <span className="text-xs text-gray-400">{article.readTime}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-gray-400 text-sm uppercase tracking-widest">More stories coming soon</p>
            </div>
          )}
        </section>

        <hr className="section-divider mt-12" />

        {/* Newsletter */}
        <section className="py-12 text-center max-w-xl mx-auto">
          <div className="accent-line mx-auto"></div>
          <h3 style={{fontFamily: 'var(--font-playfair)'}} className="text-3xl font-bold mb-3">
            History in your inbox
          </h3>
          <p className="text-gray-500 text-sm mb-6">
            One story. One original document. Every morning. Free forever.
          </p>
          <div className="flex gap-2 max-w-md mx-auto">
            <input
              type="email"
              placeholder="your@email.com"
              autoComplete="off"
              suppressHydrationWarning={true}
              className="flex-1 border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:border-gray-900 transition-colors"
            />
            <button className="bg-gray-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-red-700 transition-colors duration-200 uppercase tracking-wider">
              Subscribe
            </button>
          </div>
        </section>

      </div>

      <footer className="border-t border-gray-200 px-8 py-8">
        <div style={{maxWidth: '1152px', margin: '0 auto'}} className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-400">
          <p style={{fontFamily: 'var(--font-playfair)'}} className="text-sm font-bold text-gray-900">Echo and Chronicle</p>
          <p>© {new Date().getFullYear()} · All historical documents sourced from public domain archives</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-gray-900 transition-colors">About</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Archive</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Contact</a>
          </div>
        </div>
      </footer>

    </main>
  )
}