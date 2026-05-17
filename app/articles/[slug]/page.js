import { getArticleBySlug, getAllArticles } from '../../lib/articles'

export async function generateStaticParams() {
  const articles = getAllArticles()
  return articles.map(article => ({
    slug: article.slug,
  }))
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  return {
    title: `${article.title} | Echo and Chronicle`,
    description: article.excerpt,
  }
}

export default async function ArticlePage({ params }) {
  const { slug } = await params
  const article = await getArticleBySlug(slug)

  return (
    <main className="min-h-screen bg-white text-gray-900">

      {/* Top Bar */}
      <div className="border-b border-gray-200 px-8 py-2 flex items-center justify-between text-xs text-gray-400" style={{maxWidth: '1152px', margin: '0 auto'}}>
        <a href="/" className="hover:text-gray-900 transition-colors">
          ← Back to Echo and Chronicle
        </a>
        <span>{article.readTime}</span>
      </div>

      {/* Header */}
      <header className="border-b border-gray-200 px-8 py-6" style={{maxWidth: '1152px', margin: '0 auto'}}>
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-red-700 text-white text-xs px-2 py-0.5 uppercase tracking-wider font-bold">
              {article.tag}
            </span>
            <span className="text-red-700 text-xs font-bold uppercase tracking-widest">
              {article.category}
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-gray-400 text-xs">{article.date}</span>
          </div>
          <h1 style={{fontFamily: 'var(--font-playfair)', fontSize: '2.75rem', fontWeight: '700', lineHeight: 1.15}} className="mb-4">
            {article.title}
          </h1>
          <p className="text-gray-500 text-lg leading-relaxed">
            {article.excerpt}
          </p>
        </div>
      </header>

      <div className="px-8 py-8" style={{maxWidth: '1152px', margin: '0 auto'}}>
        <div className="flex flex-col md:flex-row gap-8 items-start max-w-2xl">
          {/* Portrait */}
          <div className="w-48 shrink-0">
            <img
              src="/images/AJohnson.jpg"
              alt="Portrait of President Andrew Johnson"
              className="rounded-sm w-full object-cover shadow-md"
            />
            <p className="text-gray-400 text-xs uppercase tracking-widest mt-2 text-center">
              Library of Congress
            </p>
          </div>
          {/* Caption Block */}
          <div className="flex flex-col justify-center">
            <div className="accent-line"></div>
            <h3 style={{fontFamily: 'var(--font-playfair)'}} className="text-xl font-bold mb-3">
              Andrew Johnson
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed mb-3">
              17th President of the United States. A Southern Democrat who inherited the presidency after Lincoln&apos;s assassination in 1865, Johnson clashed repeatedly with a Republican-controlled Congress over Reconstruction policy.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed">
              His removal of Secretary of War Edwin Stanton in February 1868 triggered the impeachment that would define his presidency — and American constitutional law — forever.
            </p>
          </div>
        </div>
      </div>

      <div className="px-8 py-4" style={{maxWidth: '1152px', margin: '0 auto'}}>
        <div className="w-full max-w-2xl relative">
          <img
            src="/images/senate-vote-1868.png"
            alt="Congressional Globe page 415 showing the Senate impeachment vote"
            className="rounded-sm w-full object-cover shadow-md border border-gray-200"
            style={{transform: 'rotate(0.5deg)'}}
          />
          <div className="mt-2 text-center">
            <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">
              The Congressional Globe · Page 415 · May 16, 1868 · The actual Senate vote record
            </p>
            <a
              href="https://congress.gov/congressional-globe/congress-40-session-2-The-Impeachment-Trial-of-President-Andrew-Johnson.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-red-700 text-white text-sm font-bold uppercase tracking-widest px-6 py-3 hover:bg-red-800 transition-colors duration-200 mt-2 shadow-md"
            >
              Read the Full Congressional Record →
            </a>
          </div>
        </div>
      </div>

      {/* Article Body */}
      <article className="px-8 pb-16" style={{maxWidth: '1152px', margin: '0 auto'}}>
        <div
          className="max-w-2xl prose-content"
          dangerouslySetInnerHTML={{ __html: article.contentHtml }}
        />
      </article>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-8 py-8">
        <div style={{maxWidth: '1152px', margin: '0 auto'}} className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-400">
          <p style={{fontFamily: 'var(--font-playfair)'}} className="text-sm font-bold text-gray-900">
            Echo and Chronicle
          </p>
          <p>© {new Date().getFullYear()} · All historical documents sourced from public domain archives</p>
          <div className="flex gap-6">
            <a href="/" className="hover:text-gray-900 transition-colors">Home</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Archive</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Contact</a>
          </div>
        </div>
      </footer>

    </main>
  )
}