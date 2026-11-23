export interface PublicImageMeta {
  width?: number;
  height?: number;
  webpSrc?: string;
}

export function resolvePublicImageMeta(src: string): PublicImageMeta;
