import fs from 'fs'
import path from 'path'
import Link from 'next/link'
import { getArticleBySlug, getAllArticles } from '../../lib/articles'
import LightboxImage from './LightboxImage'
import DocImage from '@/components/DocImage'
import ProseContent from './ProseContent'

export async function generateStaticParams() {
  const articles = getAllArticles()
  return articles.map(article => ({
    slug: article.slug,
  }))
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  const heroImageUrl = `https://echoandchronicle.today/images/${slug}.jpg`
  return {
    title: `${article.title} | Echo and Chronicle`,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      url: `https://echoandchronicle.today/articles/${slug}`,
      images: [{ url: heroImageUrl }],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt,
      images: [heroImageUrl],
    },
  }
}

export default async function ArticlePage({ params }) {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  const relatedArticles = getAllArticles().filter(a => a.slug !== slug).slice(0, 3)
  const readingTime = Math.ceil(article.content.split(/\s+/).filter(Boolean).length / 200)
  const docImageExt = ['jpg', 'png'].find(ext =>
    fs.existsSync(path.join(process.cwd(), 'public', 'images', `${article.slug}-document.${ext}`))
  )
  const hasDocImage = !!docImageExt
  const shareBase = `https://echoandchronicle.today/articles/${article.slug}`
  const shareTitle = encodeURIComponent(article.title)
  const shareUrl = encodeURIComponent(shareBase)
  return (
    <main className="min-h-screen bg-white text-gray-900">

      {/* Top Bar */}
      <div className="border-b border-gray-200 px-8 py-2 flex items-center justify-between text-xs text-gray-400" style={{maxWidth: '1152px', margin: '0 auto'}}>
        <a href="/" className="hover:text-gray-900 transition-colors">
          ← Back to Echo and Chronicle
        </a>
        <span>{readingTime} min read</span>
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
            <span className="text-gray-300">·</span>
            <span className="text-gray-400 text-xs">{readingTime} min read</span>
          </div>
          <h1 style={{fontFamily: 'var(--font-playfair)', fontSize: '2.75rem', fontWeight: '700', lineHeight: 1.15}} className="mb-4">
            {article.title}
          </h1>
          <p className="text-gray-500 text-lg leading-relaxed">
            {article.excerpt}
          </p>
        </div>
      </header>

      {/* Primary Source Image */}
      <div className="px-8 py-8" style={{maxWidth: '1152px', margin: '0 auto'}}>
        <div className="flex flex-col md:flex-row gap-8 items-start max-w-2xl">
          <div className="w-96 shrink-0">
            <LightboxImage
              src={`/images/${article.slug}.jpg`}
              alt={`Primary source image for ${article.title}`}
            />
            {article.caption && (
              <p className="text-gray-400 text-xs uppercase tracking-widest mt-2 text-center">
                {article.caption}
              </p>
            )}
          </div>
          <div className="flex flex-col justify-center">
            <div className="accent-line"></div>
            <h3 style={{fontFamily: 'var(--font-playfair)'}} className="text-xl font-bold mb-3">
              {article.category}
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed mb-3">
              {article.excerpt}
            </p>
          </div>
        </div>
      </div>

      {/* Primary Source Document */}
      <div className="px-8 py-4" style={{maxWidth: '1152px', margin: '0 auto'}}>
        <div className="max-w-2xl">
          {hasDocImage && (
            <LightboxImage
              src={`/images/${article.slug}-document.${docImageExt}`}
              alt={`Primary source document for ${article.title}`}
            >
              <DocImage
                src={`/images/${article.slug}-document.${docImageExt}`}
                alt={`Primary source document for ${article.title}`}
                className="object-cover"
                style={{maxWidth: '200px'}}
              />
            </LightboxImage>
          )}
          {article.documentCaption && (
            <p className="text-gray-400 text-xs uppercase tracking-widest mt-6 text-center">
              {article.documentCaption}
            </p>
          )}
          {article.sourceUrl && (
            <div className="mt-4">
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-red-700 text-white text-sm font-bold uppercase tracking-widest px-6 py-3 hover:bg-red-800 transition-colors duration-200 shadow-md"
              >
                {article.sourceName || 'Read the Full Document'} →
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Article Body */}
      <article className="px-8 pb-16" style={{maxWidth: '1152px', margin: '0 auto'}}>
        <ProseContent html={article.contentHtml} />
      </article>

      {/* Newsletter CTA */}
      <div style={{maxWidth: '1152px', margin: '0 auto', padding: '2rem 2rem', borderTop: '1px solid #e5e7eb', backgroundColor: '#f9f9f7'}}>
        <div style={{maxWidth: '600px'}}>
          <p style={{fontSize: '0.75rem', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: '0.5rem', fontWeight: '600', textTransform: 'uppercase'}}>Free Daily Newsletter</p>
          <h3 style={{fontFamily: 'var(--font-playfair)', fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem'}}>Enjoyed this story?</h3>
          <p style={{color: '#6b7280', fontSize: '0.95rem', marginBottom: '1.25rem'}}>Get one like it every morning. One historical story, grounded in primary sources. No ads. Free forever.</p>
          <iframe
            src="https://embeds.beehiiv.com/f41d0e84-f2f8-458d-841c-ea56681b1e10?slim=true"
            data-test-id="beehiiv-embed"
            width="400"
            height="52"
            frameBorder="0"
            scrolling="no"
            style={{display: 'block', backgroundColor: 'transparent', border: 'none'}}
          />
        </div>
      </div>

      {/* Share Buttons */}
      <div style={{maxWidth: '1152px', margin: '0 auto', padding: '2rem 2rem', borderTop: '1px solid #e5e7eb'}}>
        <p style={{fontSize: '0.75rem', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: '1rem', fontWeight: '600', textTransform: 'uppercase'}}>Share This Article</p>
        <div style={{display: 'flex', gap: '1rem', flexWrap: 'wrap'}}>
          <a
            href={`https://twitter.com/intent/tweet?text=${shareTitle}&url=${shareUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#000000', color: '#ffffff', padding: '0.75rem 1.5rem', fontWeight: '700', fontSize: '0.875rem', textDecoration: 'none', borderRadius: '4px'}}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            Post on X
          </a>
          <a
            href={`https://reddit.com/submit?url=${shareUrl}&title=${shareTitle}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#FF4500', color: '#ffffff', padding: '0.75rem 1.5rem', fontWeight: '700', fontSize: '0.875rem', textDecoration: 'none', borderRadius: '4px'}}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>
            Share on Reddit
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#1877F2', color: '#ffffff', padding: '0.75rem 1.5rem', fontWeight: '700', fontSize: '0.875rem', textDecoration: 'none', borderRadius: '4px'}}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            Share on Facebook
          </a>
        </div>
      </div>

      {/* Continue Reading */}
      {relatedArticles.length > 0 && (
        <section className="px-8 py-12 border-t border-gray-200" style={{maxWidth: '1152px', margin: '0 auto'}}>
          <div className="accent-line"></div>
          <h2 style={{fontFamily: 'var(--font-playfair)', fontSize: '1.5rem', fontWeight: '700'}} className="mb-8">Continue Reading</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {relatedArticles.map(related => (
              <Link
                key={related.slug}
                href={`/articles/${related.slug}`}
                className="group border-t-2 border-gray-100 hover:border-red-700 pt-4 transition-all duration-200"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-red-700 text-xs font-bold uppercase tracking-widest">{related.category}</span>
                  <span className="text-gray-300 text-xs">·</span>
                  <span className="text-gray-400 text-xs">{related.date}</span>
                </div>
                <h3 style={{fontFamily: 'var(--font-playfair)'}} className="text-xl font-bold mb-2 leading-snug group-hover:text-red-700 transition-colors duration-200">
                  {related.title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-3">
                  {related.excerpt}
                </p>
                <span className="text-xs font-medium text-gray-900 border-b border-gray-900 pb-0.5 group-hover:text-red-700 group-hover:border-red-700 transition-colors duration-200">
                  Read More
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

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