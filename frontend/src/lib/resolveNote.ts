// 从一篇 notes 集合条目推导出完整展示字段。
// 设计目标：用户只要把 .md 文件拖进 src/content/notes/<分类>/ 文件夹，
// 不需要写任何 frontmatter，也能自动得到标题、摘要、分类、日期。
import type { CollectionEntry } from 'astro:content';
import { getCategory, type NoteCategory, type NoteCategoryId } from '../data/notes';

export type NoteEntry = CollectionEntry<'notes'>;

// 从 entry.id（形如 "life/coffee-health-effects"）提取分类 id（第一段）和 slug（最后一段文件名）
export function parseEntryId(id: string): { categoryId: string; slug: string } {
  const parts = id.split('/');
  const slug = parts[parts.length - 1] ?? id;
  const categoryId = parts.length > 1 ? parts[0] : 'life';
  return { categoryId, slug };
}

// 文件名转标题：去掉扩展名，把 - 和 _ 换成空格
export function fileNameToTitle(slug: string): string {
  const noExt = slug.replace(/\.md$/, '');
  const title = noExt.replace(/[-_]+/g, ' ').trim();
  return title || '未命名';
}

// 正文提取摘要：去掉 Markdown 标记，取前 ~120 字
export function bodyToSummary(body: string | undefined): string {
  const plain = bodyToPlainText(body);
  return truncate(plain, 120);
}

export interface ResolvedNote {
  entry: NoteEntry;
  category: NoteCategory;
  slug: string;
  title: string;
  summary: string;
  date: Date;
  tags: string[];
}

// 把一条 raw entry 解析成完整展示字段（带各种兜底）
export function resolveNote(entry: NoteEntry): ResolvedNote {
  const { categoryId, slug } = parseEntryId(entry.id);

  // 分类：优先 frontmatter，其次文件夹名，兜底 life
  const catId =
    (entry.data.category as NoteCategoryId | undefined) ??
    (getCategory(categoryId) ? (categoryId as NoteCategoryId) : 'life');
  const category = getCategory(catId) ?? getCategory('life')!;

  // 标题：frontmatter > 文件名
  const title = entry.data.title?.trim() || fileNameToTitle(slug);

  // 摘要：frontmatter > 正文前 120 字
  const summary = entry.data.summary?.trim() || bodyToSummary(entry.body);

  // 日期：frontmatter > 文件修改时间（mtime）> 当前时间
  const date =
    entry.data.date ??
    (entry.fileInfo?.mtime ? new Date(entry.fileInfo.mtime) : new Date());

  const tags = entry.data.tags ?? [];

  return { entry, category, slug, title, summary, date, tags };
}

// 正文转纯文本（剥离 Markdown 标记）
export function bodyToPlainText(body: string | undefined): string {
  if (!body) return '';
  return body
    .replace(/```[\s\S]*?```/g, ' ') // 代码块
    .replace(/`([^`]*)`/g, '$1') // 行内代码
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接
    .replace(/^#{1,6}\s+/gm, '') // 标题
    .replace(/^\s*>\s?/gm, '') // 引用
    .replace(/^\s*[-*+]\s+/gm, '') // 列表
    .replace(/[*_~#|]/g, '') // 其余标记
    .replace(/\s+/g, ' ')
    .trim();
}

// 截取前 N 字（用于时间线折叠预览），超出加省略号
export function truncate(text: string, maxLen = 100): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}

// 日期格式化：2026.10.06
export function displayDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

// 日期时间格式：2026-10-06（用于 <time datetime>）
export function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
