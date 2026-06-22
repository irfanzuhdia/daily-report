'use server'

import { revalidatePath, revalidateTag } from 'next/cache'

/**
 * Revalidate Next.js cache paths and tags from client components.
 * This invalidates both Server-Side Data cache and Browser Client-Side Router cache.
 */
export async function revalidatePathsAndTags(paths: string[], tags: string[] = []) {
  for (const tag of tags) {
    revalidateTag(tag, 'max')
  }
  for (const path of paths) {
    revalidatePath(path)
  }
}
