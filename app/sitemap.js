import { getAllArticles } from './lib/articles'

const SITE_URL = 'https://echoandchronicle.today'

export const revalidate = 3600

export default function sitemap() {
  const articleEntries = getAllArticles().map(article => ({
    url: `${SITE_URL}/articles/${article.slug}`,
    ...(article.publishDate && { lastModified: new Date(article.publishDate) }),
  }))

  return [{ url: SITE_URL },...articleEntries]
}
