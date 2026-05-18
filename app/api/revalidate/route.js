import { revalidatePath } from 'next/cache'

export async function GET() {
  revalidatePath('/')
  revalidatePath('/archive')

  return Response.json({
    revalidated: true,
    timestamp: new Date().toISOString()
  })
}
