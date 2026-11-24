import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

import { createListingSchema } from '../shared/listings.ts';

const moduleUrl = new URL('../src/hooks/use-listing-media.ts', import.meta.url).href;
const dataModule = (source) => 'data:text/javascript,' + encodeURIComponent(source);
const reactUrl = dataModule(`
  const states = [];
  let cursor = 0;
  export function beginRender() { cursor = 0; }
  export function useState(initial) {
    const index = cursor++;
    if (!(index in states)) states[index] = initial;
    return [states[index], (next) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
  }
  export const useCallback = (callback) => callback;
`);
const pickerUrl = dataModule(`
  export const requestCameraPermissionsAsync = async () => ({ granted: true });
  export const launchCameraAsync = async () => ({ canceled: false, assets: [{ uri: 'file:///document.jpg' }] });
  export const getDocumentAsync = async () => ({ canceled: false, assets: [{ uri: 'file:///deed.pdf', name: 'deed.pdf' }] });
`);
const uploadUrl = dataModule(`
  export const useUploadMedia = () => ({ mutateAsync: async ({ purpose }) => ({
    key: 'documents/test-user/document.pdf', purpose, url: null,
    name: 'confirmed-document.pdf', mimeType: 'application/pdf', size: 4096,
  }) });
`);

test('picked and photographed documents publish using confirmed upload metadata when the picker omits size', async () => {
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (context.parentURL === moduleUrl) {
        const replacements = {
          react: reactUrl,
          'react-native': dataModule('export const Platform = { OS: "android" };'),
          'expo-document-picker': pickerUrl,
          'expo-image-picker': pickerUrl,
          '@/hooks/use-properties': uploadUrl,
          '../../shared/listings': new URL('../shared/listings.ts', import.meta.url).href,
        };
        if (replacements[specifier]) return { url: replacements[specifier], shortCircuit: true };
      }
      return next(specifier, context);
    },
  });
  try {
    const { useListingMedia } = await import(moduleUrl);
    const { beginRender } = await import(reactUrl);
    const render = () => { beginRender(); return useListingMedia({ signedIn: true, onNeedsSignIn: () => assert.fail('Unexpected sign-in request') }); };
    for (const action of ['addDocument', 'captureDocument']) {
      const media = render();
      media.resetMedia();
      await render()[action]('ownership');
      // The picker starts its upload asynchronously; flush its settled state.
      await Promise.resolve();
      const complete = render();
      assert.equal(complete.uploading, false);
      assert.equal(complete.attachedDocuments[0].size, 4096);
      assert.equal(complete.attachedDocuments[0].name, 'confirmed-document.pdf');
      assert.equal(complete.attachedDocuments[0].mimeType, 'application/pdf');
      const input = {
        requestId: 'document-client-test', title: 'Test family house', kind: 'House', locality: 'Bank Colony',
        town: 'raichur', price: 21000, mode: 'sale', areaSqft: 1200, imageAsset: 'house',
        documents: complete.attachedDocuments,
      };
      assert.equal(createListingSchema.safeParse(input).success, true);
    }
  } finally { hooks.deregister(); }
});
