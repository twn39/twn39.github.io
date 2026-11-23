import { resolvePublicImageMeta } from './image-meta.mjs';

/**
 * Lightweight rehype plugin that converts standalone Markdown images
 * (<p><img alt="..." /></p>) into semantic <figure> + centered <figcaption>,
 * attaching intrinsic width/height, lazy decoding, and WebP <picture> sources.
 */
export default function rehypeFigureCaption() {
  return (tree) => {
    function enrichImage(img) {
      const src = typeof img.properties?.src === 'string' ? img.properties.src : '';
      const meta = resolvePublicImageMeta(src);

      img.properties = {
        ...img.properties,
        loading: img.properties?.loading || 'lazy',
        decoding: img.properties?.decoding || 'async',
        ...(meta.width && meta.height ? { width: meta.width, height: meta.height } : {}),
      };

      if (!meta.webpSrc) return img;

      return {
        type: 'element',
        tagName: 'picture',
        properties: {},
        children: [
          {
            type: 'element',
            tagName: 'source',
            properties: {
              srcSet: meta.webpSrc,
              type: 'image/webp',
            },
            children: [],
          },
          img,
        ],
      };
    }

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
            const mediaNode = enrichImage(img);

            if (alt) {
              node.children[i] = {
                type: 'element',
                tagName: 'figure',
                properties: { className: ['prose-figure'] },
                children: [
                  mediaNode,
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
