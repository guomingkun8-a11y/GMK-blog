import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// 随笔内容集合：每篇文章一个 .md 文件，位于 src/content/notes/<分类>/xxx.md
// 所有 frontmatter 字段均为可选：缺省时自动从「文件名 / 所在文件夹 / 文件修改时间 / 正文」兜底。
// 也就是说，拖一个纯 Markdown 正文（连 frontmatter 都不写）也能正常显示。
const notes = defineCollection({
  loader: glob({ base: './src/content/notes', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string().optional(),
    summary: z.string().optional(),
    category: z.enum(['work', 'study', 'life', 'society']).optional(),
    date: z.coerce.date().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

export const collections = { notes };
