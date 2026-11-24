/* tslint:disable */
/* eslint-disable */

export function convert_batch(inputs_js: any): any;

/**
 * Convert a LaTeX string to MathML for use in JavaScript via WebAssembly.
 */
export function convert_to_mathml(latex_input: string, display_mode?: boolean | null): string;

/**
 * Convert with a JS options object (all fields optional).
 *
 * ```js
 * convert_to_mathml_with_options("\\frac{1}{2}", {
 *   display: true,
 *   wrapMath: true,
 *   mathmlCore: true,
 *   emitIntent: false,
 *   maxDepth: 64,
 *   unknownError: false,
 *   allowTrailing: false,
 * });
 * ```
 */
export function convert_to_mathml_with_options(latex_input: string, options_js?: any | null): string;

export function parse_to_ast(latex_input: string): any;

/**
 * Whether a bare or `\cmd` name is known to the converter.
 */
export function wasm_supports_command(cmd: string): boolean;
