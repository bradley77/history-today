import { revalidatePath } from 'next/cache'

export async function GET(request) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token || token !== process.env.REVALIDATE_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  revalidatePath('/')
  revalidatePath('/archive')

  return Response.json({
    revalidated: true,
    timestamp: new Date().toISOString()
  })
}
