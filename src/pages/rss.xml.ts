import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getRecentPosts, postPath } from '../lib/posts';

export async function GET(context: APIContext) {
  const recent = await getRecentPosts(50);
  return rss({
    title: 'Jiyun Kim',
    description: 'MIR notes and essays between music and literature.',
    site: context.site!,
    items: recent.map(({ section, post }) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: postPath(section, post),
    })),
    customData: '<language>ko</language>',
  });
}
