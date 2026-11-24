import { IMAGE_PATHS } from './image-manifest';

const cdnUrl = process.env.EXPO_PUBLIC_IMAGE_CDN_URL;
export function imageSource(asset: keyof typeof IMAGE_PATHS, local: number): number | { uri: string } {
  if (!cdnUrl) return local;
  try {
    const base = new URL(cdnUrl.endsWith('/') ? cdnUrl : `${cdnUrl}/`);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) return local;
    return { uri: new URL(IMAGE_PATHS[asset], base).href };
  } catch { return local; }
}
