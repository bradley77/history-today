import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

export const SITE_URL = 'https://echoandchronicle.today'
export const SITE_NAME = 'Echo & Chronicle'
export const DEFAULT_OG_IMAGE = { url: `${SITE_URL}/images/ec-logo.png` }
export const LOGO_URL = `${SITE_URL}/logo.png`

// Next.js replaces (not merges) the layout's openGraph when a page sets its own, so pages
// that set openGraph.url/title/description spread this in to keep the site-wide values.
export function pageOpenGraph({ path: pagePath, title, description }) {
  return {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_US',
    images: [{ ...DEFAULT_OG_IMAGE, width: 500, height: 500 }],
    url: pagePath,
    title,
    description,
  }
}

const MAX_TITLE_WITH_BRAND = 60
const SENTENCE_MIN = 110
const SENTENCE_MAX = 160
const WORD_MAX = 155
const ABBREVIATIONS = /\b(Gen|Col|Maj|Capt|Lt|Brig|Sgt|Cpl|Adm|Cmdr|Sen|Rep|Gov|Pres|Mr|Mrs|Ms|Dr|St|Mt|Ft|No|Co|Jr|Sr|vs|Vol|Hon|Rev|Cmdt|Bvt|U\.S)\.$/

function clean(text) {
  return String(text).replace(/\s+/g, ' ').trim()
}

// Cut at a word boundary so the result, including "...", is at most max characters.
export function truncateAtWord(text, max) {
  const t = clean(text)
  if (t.length <= max) return t
  const cut = t.slice(0, max - 3)
  const lastSpace = cut.lastIndexOf(' ')
  const base = lastSpace > 0 ? cut.slice(0, lastSpace) : cut
  return base.replace(/[\s,;:\-]+$/, '') + '...'
}

// Description of about 155 characters: end on a sentence boundary falling between
// 110 and 160 characters if there is one, otherwise a word boundary plus "...".
export function trimDescription(text) {
  const t = clean(text)
  if (t.length <= SENTENCE_MAX) return t
  const window = t.slice(0, SENTENCE_MAX + 1)
  const ends = /[.!?]["'”’)]?(?=\s|$)/g
  let best = -1
  let m
  while ((m = ends.exec(window)) !== null) {
    const end = m.index + m[0].length
    if (end > SENTENCE_MAX) break
    if (end >= SENTENCE_MIN && !ABBREVIATIONS.test(window.slice(0, end))) best = end
  }
  if (best !== -1) return t.slice(0, best)
  return truncateAtWord(t, WORD_MAX)
}

// First prose paragraph of the markdown body, stripped of markdown syntax.
export function firstParagraph(markdown) {
  const blocks = String(markdown || '').split(/\r?\n\s*\r?\n/)
  for (const block of blocks) {
    const b = block.trim()
    if (!b || /^(#|>|!\[|<|[-*+]\s|\d+\.\s|\||```)/.test(b)) continue
    return clean(
      b
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/[*_`]+/g, '')
    )
  }
  return ''
}

// "YYYY-MM-DD HH:MM" (UTC) to ISO 8601 with a Z suffix. Returns undefined if absent or malformed.
export function toIsoUtc(value) {
  if (!value) return undefined
  const m = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/)
  if (!m) return undefined
  const iso = `${m[1]}T${m[2] || '00'}:${m[3] || '00'}:${m[4] || '00'}Z`
  return Number.isNaN(Date.parse(iso)) ? undefined : iso
}

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
  const slug = article.slug
  const canonical = `${SITE_URL}/articles/${slug}`

  const baseTitle = article.seoTitle || article.title
  const withBrand = `${baseTitle} | ${SITE_NAME}`
  const pageTitle = withBrand.length > MAX_TITLE_WITH_BRAND ? baseTitle : withBrand

  const description =
    article.seoDescription ||
    trimDescription(article.excerpt || firstParagraph(article.content))

  const image = await pickOgImage(article)

  return {
    canonical,
    pageTitle,
    socialTitle: baseTitle,
    description,
    image,
    publishedTime: toIsoUtc(article.publishDate),
  }
}

export function getArticleJsonLd(article, seo) {
  const organization = {
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: LOGO_URL,
  }
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: truncateAtWord(article.title, 110),
    description: seo.description,
    image: seo.image.url,
    ...(seo.publishedTime ? { datePublished: seo.publishedTime } : {}),
    mainEntityOfPage: seo.canonical,
    author: organization,
    publisher: organization,
  }
  return JSON.stringify(ld).replace(/</g, '\\u003c')
}
