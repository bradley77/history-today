import { revalidatePath } from 'next/cache'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  revalidatePath('/')
  revalidatePath('/archive')
  
  return Response.json({ 
    revalidated: true, 
    timestamp: new Date().toISOString() 
  })
}