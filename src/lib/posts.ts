import { getCollection, type CollectionEntry } from 'astro:content';

export type Section = 'mir' | 'essays';
export type Post = CollectionEntry<'mir'> | CollectionEntry<'essays'>;

export async function getPosts(section: Section): Promise<Post[]> {
  const entries = await getCollection(section, ({ data }) => !data.draft);
  return entries.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function getRecentPosts(limit = 5): Promise<{ section: Section; post: Post }[]> {
  const [mir, essays] = await Promise.all([getPosts('mir'), getPosts('essays')]);
  return [
    ...mir.map((post) => ({ section: 'mir' as const, post })),
    ...essays.map((post) => ({ section: 'essays' as const, post })),
  ]
    .sort((a, b) => b.post.data.date.getTime() - a.post.data.date.getTime())
    .slice(0, limit);
}

export function postPath(section: Section, post: Post): string {
  return `/${section}/${post.id}/`;
}
