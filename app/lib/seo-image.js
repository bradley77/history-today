// Server-only: reads public/ at build time (article pages are statically generated).
// Import this only from the article page, never from routes that render series or static pages.
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { SITE_URL, DEFAULT_OG_IMAGE, buildArticleSeo } from './seo'

// Resolves a site-relative path (e.g. "/images/foo.jpg") to a file inside public/, or null.
function publicFile(sitePath) {
  if (!sitePath || typeof sitePath !== 'string') return null
  const publicDir = path.join(process.cwd(), 'public')
  const file = path.join(publicDir, sitePath)
  if (!file.startsWith(publicDir + path.sep)) return null
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null
}

// Real dimensions of the file, or {} if they cannot be read (never guessed).
async function imageSize(file) {
  try {
    const { width, height } = await sharp(file).metadata()
    return width && height ? { width, height } : {}
  } catch {
    return {}
  }
}

// heroImage from frontmatter, else /images/<slug>.jpg, else the default logo; only files that exist.
async function pickOgImage(article) {
  const candidates = [article.heroImage, `/images/${article.slug}.jpg`]
  for (const sitePath of candidates) {
    const file = publicFile(sitePath)
    if (file) return { url: `${SITE_URL}${sitePath}`, ...(await imageSize(file)), alt: article.title }
  }
  const logo = publicFile('/images/ec-logo.png')
  return { ...DEFAULT_OG_IMAGE, ...(logo ? await imageSize(logo) : {}), alt: article.title }
}

export async function getArticleSeo(article) {
  return buildArticleSeo(article, await pickOgImage(article))
}
