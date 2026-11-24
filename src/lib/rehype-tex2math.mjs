import init, { convert_to_mathml_with_options } from '@twn39/tex2math';

await init();

const VOID_XML_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeXmlEntities(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (_, entity) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      return String.fromCodePoint(parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith('#')) {
      return String.fromCodePoint(parseInt(entity.slice(1), 10));
    }
    return VOID_XML_ENTITIES[entity] ?? `&${entity};`;
  });
}

function parseAttributes(attrSource) {
  const properties = {};
  const attrRegex = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = attrRegex.exec(attrSource)) !== null) {
    const [, name, dq, sq] = match;
    properties[name] = decodeXmlEntities(dq ?? sq ?? '');
  }
  return properties;
}

/**
 * Parse a MathML XML fragment produced by tex2math into HAST ElementContent nodes.
 */
function parseMathMLToHast(xml) {
  const root = { children: [] };
  const stack = [root];
  const tokenRegex = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^<>]*?)?)(\s*\/)?>|([^<]+)/g;
  let match;

  while ((match = tokenRegex.exec(xml)) !== null) {
    const [, closing, tagName, attrSource, selfClosing, text] = match;
    const current = stack[stack.length - 1];

    if (text !== undefined) {
      current.children.push({
        type: 'text',
        value: decodeXmlEntities(text),
      });
      continue;
    }

    if (closing) {
      if (stack.length > 1 && stack[stack.length - 1].tagName === tagName) {
        stack.pop();
      }
      continue;
    }

    const element = {
      type: 'element',
      tagName,
      properties: attrSource ? parseAttributes(attrSource) : {},
      children: [],
    };
    current.children.push(element);

    if (!selfClosing) {
      stack.push(element);
    }
  }

  return root.children;
}

function extractText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.value || '';
  if (!Array.isArray(node.children)) return '';
  return node.children.map(extractText).join('');
}

/**
 * Rehype plugin that renders `remark-math` inline/display math nodes into
 * native MathML via `@twn39/tex2math` (Rust/WASM, zero client-side JS).
 */
export default function rehypeTex2math(options = {}) {
  const { mathmlCore = true, emitIntent = false, unknownError = false } = options;

  return (tree, file) => {
    function transform(node) {
      if (!node || !Array.isArray(node.children)) return;

      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child.type !== 'element') continue;

        let target = null;
        let displayMode = false;

        // Standalone paragraph containing only a single math element (e.g. single-line $$...$$):
        // promote to display math and replace the <p> wrapper.
        if (child.tagName === 'p' && Array.isArray(child.children)) {
          const meaningful = child.children.filter(
            (c) => !(c.type === 'text' && /^\s*$/.test(c.value || ''))
          );
          if (
            meaningful.length === 1 &&
            meaningful[0].type === 'element' &&
            Array.isArray(meaningful[0].properties?.className) &&
            (meaningful[0].properties.className.includes('language-math') ||
              meaningful[0].properties.className.includes('math-inline') ||
              meaningful[0].properties.className.includes('math-display'))
          ) {
            target = meaningful[0];
            displayMode = true;
          }
        }

        // Block math from remark-math ($$\n...\n$$) or fenced ```math blocks:
        // <pre><code class="language-math math-display">...</code></pre>
        if (!target && child.tagName === 'pre' && Array.isArray(child.children)) {
          const codeEl = child.children.find(
            (c) =>
              c.type === 'element' &&
              c.tagName === 'code' &&
              Array.isArray(c.properties?.className) &&
              (c.properties.className.includes('language-math') ||
                c.properties.className.includes('math-display'))
          );
          if (codeEl) {
            target = codeEl;
            displayMode = true;
          }
        }

        // Inline math ($...$) or standalone math element:
        if (!target && Array.isArray(child.properties?.className)) {
          const classes = child.properties.className;
          const isDisplay = classes.includes('math-display');
          const isInline = classes.includes('math-inline') || classes.includes('language-math');
          if (isDisplay || isInline) {
            target = child;
            displayMode = isDisplay;
          }
        }

        if (!target) {
          transform(child);
          continue;
        }

        const latex = extractText(target).trim();
        let replacement;

        try {
          const mathml = convert_to_mathml_with_options(latex, {
            display: displayMode,
            wrapMath: true,
            mathmlCore,
            emitIntent,
            unknownError,
          });
          const mathNodes = parseMathMLToHast(mathml);

          if (displayMode) {
            replacement = [
              {
                type: 'element',
                tagName: 'div',
                properties: { className: ['math-display'] },
                children: mathNodes,
              },
            ];
          } else {
            replacement = mathNodes;
          }
        } catch (err) {
          const message = err?.message || String(err);
          file?.message?.(`tex2math failed to render formula: ${message}`, {
            place: child.position,
            source: 'rehype-tex2math',
          });
          replacement = [
            {
              type: 'element',
              tagName: displayMode ? 'div' : 'span',
              properties: {
                className: ['tex2math-error'],
                title: message,
              },
              children: [{ type: 'text', value: latex }],
            },
          ];
        }

        node.children.splice(i, 1, ...replacement);
        i += replacement.length - 1;
      }
    }

    transform(tree);
  };
}
