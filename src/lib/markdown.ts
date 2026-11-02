// Notes are Markdown, as Cosmos keeps them (cosmos-lite HANDOFF 6.132): CreateNoteSheet's editor (react-native-enriched)
// gives HTML and convertSupportedHtmlToMarkdown turns it into Markdown. The web page's htmlToMarkdown (public/markdown.js),
// step for step: <ul> lists as "- " lines, <br> as a line break, <h1> / <h2> as # / ##, <strong> / <b> as **, <em> / <i>
// as *, <u> / <ins> lose their mark (Markdown has no underline), </p> / </div> end a paragraph, every other tag goes,
// spaces before a line end go, three or more line ends become two. One step moved: the entities come back last, so
// words typed as "<like this>" are kept (Cosmos turns them back first and loses them as tags).
export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  return html
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, list: string) => {
      const items = Array.from(list.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)).map(([, item]) => `- ${item.trim()}`);
      return items.length ? `${items.join('\n')}\n\n` : '';
    })
    .replace(/\r\n?/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (_, _tag, inner: string) => `**${inner.trim()}**`)
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, (_, _tag, inner: string) => `*${inner.trim()}*`)
    .replace(/<(u|ins)[^>]*>([\s\S]*?)<\/\1>/gi, (_, _tag, inner: string) => inner.trim())
    .replace(/<\/(p|div)>/gi, '\n\n')
    .replace(/<(p|div|html|body)[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
