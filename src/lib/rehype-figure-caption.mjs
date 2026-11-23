/**
 * Lightweight rehype plugin that converts standalone Markdown images
 * (<p><img alt="..." /></p>) into semantic <figure> + centered <figcaption>.
 */
export default function rehypeFigureCaption() {
  return (tree) => {
    function transform(node) {
      if (!node || !Array.isArray(node.children)) return;

      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];

        if (child.type === 'element' && child.tagName === 'p' && Array.isArray(child.children)) {
          const meaningful = child.children.filter(
            (c) => !(c.type === 'text' && /^\s*$/.test(c.value || ''))
          );

          if (
            meaningful.length === 1 &&
            meaningful[0].type === 'element' &&
            meaningful[0].tagName === 'img'
          ) {
            const img = meaningful[0];
            const alt = typeof img.properties?.alt === 'string' ? img.properties.alt.trim() : '';

            if (alt) {
              node.children[i] = {
                type: 'element',
                tagName: 'figure',
                properties: { className: ['prose-figure'] },
                children: [
                  img,
                  {
                    type: 'element',
                    tagName: 'figcaption',
                    properties: {},
                    children: [{ type: 'text', value: alt }],
                  },
                ],
              };
              continue;
            }
          }
        }

        transform(child);
      }
    }

    transform(tree);
  };
}
