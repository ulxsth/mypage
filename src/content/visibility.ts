export function shouldIncludePost(published: boolean): boolean {
	return import.meta.env.DEV || published;
}
