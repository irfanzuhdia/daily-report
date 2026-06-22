'use server'

import { revalidatePath, revalidateTag } from 'next/cache'

/**
 * Revalidate Next.js cache paths and tags from server actions.
 */
export async function revalidatePathsAndTags(paths: string[], tags: string[] = []) {
  for (const tag of tags) {
    revalidateTag(tag, 'max');
  }
  for (const path of paths) {
    revalidatePath(path);
  }
  revalidatePath('/', 'layout');
}
