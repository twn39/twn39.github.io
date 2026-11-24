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

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly convert_batch: (a: any) => [number, number, number];
    readonly convert_to_mathml: (a: number, b: number, c: number) => [number, number, number, number];
    readonly convert_to_mathml_with_options: (a: number, b: number, c: number) => [number, number, number, number];
    readonly parse_to_ast: (a: number, b: number) => [number, number, number];
    readonly wasm_supports_command: (a: number, b: number) => number;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
