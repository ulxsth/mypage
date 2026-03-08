import fs from "node:fs";
import path from "node:path";
import type { CollectionEntry } from "astro:content";

export function getPostPubDate(post: CollectionEntry<"blog">): Date {
  if (post.data.pubDate) {
    return post.data.pubDate;
  }

  try {
    // Astro 5のglobローダーが持つfilePathがあればそれを使用
    if ('filePath' in post && typeof post.filePath === 'string') {
      return fs.statSync(post.filePath as string).mtime;
    }

    // 指定がない場合、ディレクトリ構造から手動で探索
    const basePath = path.join(process.cwd(), "src", "content", "blog");
    const mdPath = path.join(basePath, `${post.id}.md`);
    const mdxPath = path.join(basePath, `${post.id}.mdx`);

    if (fs.existsSync(mdPath)) {
      return fs.statSync(mdPath).mtime;
    }
    if (fs.existsSync(mdxPath)) {
      return fs.statSync(mdxPath).mtime;
    }
  } catch (e) {
    console.warn(`Failed to get mtime for post: ${post.id}`, e);
  }

  // すべて失敗した場合は現在日時をフォールバックとして返す
  return new Date();
}

export function enhancePostWithDate(post: CollectionEntry<"blog">) {
  return {
    ...post,
    calculatedPubDate: getPostPubDate(post),
  };
}
