import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { remark } from 'remark'
import html from 'remark-html'

const contentDirectory = path.join(process.cwd(), 'content')

export function getAllArticles() {
  const fileNames = fs.readdirSync(contentDirectory)
  const now = new Date()

  const articles = fileNames
    .filter(fileName => fileName.endsWith('.md'))
    .map(fileName => {
      const slug = fileName.replace(/\.md$/, '')
      const fullPath = path.join(contentDirectory, fileName)
      const fileContents = fs.readFileSync(fullPath, 'utf8')
      const { data } = matter(fileContents)

      return {
        slug,
        ...data,
      }
    })
    .filter(article => {
      if (!article.publishDate) return true
      return new Date(article.publishDate) <= now
    })

  return articles.sort((a, b) => new Date(b.date) - new Date(a.date))
}

export async function getArticleBySlug(slug) {
  const fullPath = path.join(contentDirectory, `${slug}.md`)
  const fileContents = fs.readFileSync(fullPath, 'utf8')
  const { data, content } = matter(fileContents)

  const processedContent = await remark()
    .use(html)
    .process(content)
  
  const contentHtml = processedContent.toString()

  return {
    slug,
    contentHtml,
    ...data,
  }
}