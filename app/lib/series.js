// Manifest of known series: display title, total planned parts, and an
// optional short description. Add an entry here when starting a new series
// so the hub/index pages can show "Coming soon" placeholders and blurbs for
// parts that don't have an article yet.
export const SERIES_MANIFEST = {
  gettysburg: {
    title: 'Gettysburg',
    total: 10,
    description: 'The three-day battle that turned the Civil War, told part by part from the road north to the retreat south.',
  },
  'overland-campaign': {
    title: 'The Overland Campaign',
    total: 5,
    description: 'Grant and Lee\'s brutal six-week collision from the Wilderness to Petersburg, the campaign that decided the war would not end in 1864.',
  },
}

export function getSeriesTitle(slug) {
  const manifestEntry = SERIES_MANIFEST[slug]
  if (manifestEntry?.title) return manifestEntry.title
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Builds the ordered part list for a series: published articles matched to
// their seriesPart, with "Coming soon" placeholders filling any gaps up to
// the known total.
export function getSeriesParts(slug, allArticles) {
  const seriesArticles = allArticles.filter(article => article.series === slug)
  const manifestEntry = SERIES_MANIFEST[slug]
  const total = manifestEntry?.total
    || seriesArticles.reduce((max, article) => Math.max(max, article.seriesTotal || 0), 0)

  const articleByPart = new Map(seriesArticles.map(article => [article.seriesPart, article]))

  const parts = []
  for (let part = 1; part <= total; part++) {
    parts.push({ part, article: articleByPart.get(part) || null })
  }
  return parts
}

// How many parts of a series (from getSeriesParts) are published vs the total.
export function getSeriesCompletion(parts) {
  const published = parts.filter(p => p.article).length
  return { published, total: parts.length }
}

// Every series slug known to the site: manifest entries plus any `series`
// value found on an article (covers a series that hasn't been added to the
// manifest yet).
export function getAllSeriesSlugs(allArticles) {
  const slugs = new Set(Object.keys(SERIES_MANIFEST))
  allArticles.forEach(article => {
    if (article.series) slugs.add(article.series)
  })
  return Array.from(slugs)
}

export function getSeriesDescription(slug) {
  return SERIES_MANIFEST[slug]?.description || null
}
