import cjs from "./tex2math.js";

export const {
  convert_batch,
  convert_to_mathml,
  convert_to_mathml_with_options,
  parse_to_ast,
  wasm_supports_command,
} = cjs;

export function initSync() {
  return undefined;
}

export default async function init() {
  return undefined;
}
