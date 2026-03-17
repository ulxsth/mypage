// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import remarkBreaks from 'remark-breaks';
import remarkLinkCard from 'remark-link-card-plus';

// https://astro.build/config
export default defineConfig({
	site: 'https://example.com',
	integrations: [mdx(), sitemap()],
	markdown: {
		remarkPlugins: [
			remarkBreaks,
			[
				remarkLinkCard,
				{
					thumbnailPosition: 'left',
					shortenUrl: false,
					ignoreExtensions: ['.mp4', '.pdf'],
				},
			],
		],
	},
});
