// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import { defineConfig } from 'astro/config';
import remarkBreaks from 'remark-breaks';
import remarkLinkCard from 'remark-link-card-plus';

// https://astro.build/config
export default defineConfig({
	site: 'https://ulxsth.com',
	output: 'static',
	compressHTML: true,
	integrations: [mdx(), sitemap()],
	markdown: {
		processor: unified({ remarkPlugins: [
			remarkBreaks,
			[
				remarkLinkCard,
				{
					thumbnailPosition: 'left',
					shortenUrl: false,
					ignoreExtensions: ['.mp4', '.pdf'],
				},
			],
		] }),
	},
});
