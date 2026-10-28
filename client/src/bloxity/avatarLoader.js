import { TextureLoader } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'

import { configureAvatarTexture } from '../game/avatarRig'
import { assetUrls, isRealId, PART_SLOTS, skinCompositeUrl, skinIdOrDefault } from './avatarAssets'

/**
 * Imperative loaders for the equipped-cosmetic assets.
 *
 * Why not drei's `useGLTF` / `useLoader` for these: the set of equipped slots is
 * dynamic (0-8 parts, changing at runtime via `onAvatarChanged`), and React hooks
 * cannot be called conditionally or in a variable-length loop. The base `player.glb`
 * is a fixed URL and *is* loaded with `useGLTF` in PlayerAvatar; everything dynamic
 * goes through here.
 *
 * Every loader resolves to `null` instead of throwing on failure - a 404 on an
 * unequipped or delisted asset must degrade to the base mesh, never break the scene.
 */

const gltfLoader = new GLTFLoader()
const objLoader = new OBJLoader()
const textureLoader = new TextureLoader()

/** url -> Promise<result|null>. Keeps a re-equip from re-downloading known parts. */
const cache = new Map()

function cached(url, produce) {
  if (!cache.has(url)) {
    cache.set(
      url,
      produce().catch((err) => {
        console.warn(`[bloxity] avatar asset unavailable, using base mesh: ${url}`, err)
        return null
      }),
    )
  }
  return cache.get(url)
}

/**
 * Loads a part GLB.
 * Not cloned: `applyPart` only reads geometry off it and clones that itself.
 * @returns {Promise<import('three').Object3D|null>}
 */
export function loadPartGLB(url) {
  return cached(url, () => gltfLoader.loadAsync(url).then((gltf) => gltf.scene))
}

/**
 * Loads an accessory OBJ. Cloned per call, since the result is added to the scene
 * graph and would otherwise be reparented away from any other user of it.
 * @returns {Promise<import('three').Object3D|null>}
 */
export function loadOBJ(url) {
  return cached(url, () => objLoader.loadAsync(url)).then((obj) =>
    obj ? obj.clone(true) : null,
  )
}

/** @returns {Promise<import('three').Texture|null>} */
export function loadTexture(url) {
  return cached(url, () =>
    textureLoader.loadAsync(url).then((tex) => configureAvatarTexture(tex)),
  )
}

/**
 * Starts (or joins, as the loader caches by URL) the downloads of everything `equipped`
 * wears: the skin, the body parts and the hat and back items. Resolves to what each
 * gave, for assembly; one that fails gives null.
 */
export function loadLook(equipped) {
  const jobs = []

  // Skin always loads - "0" is the fallback, since the base body has no baked map.
  // With a face, shirt or pants worn it's the server-composited version; if that
  // can't be fetched, the bare skin is better than an untextured body.
  const compositeUrl = skinCompositeUrl(equipped)
  const plainSkinUrl = assetUrls.skinTexture(skinIdOrDefault(equipped?.skinId))
  jobs.push(
    (compositeUrl ? loadTexture(compositeUrl) : Promise.resolve(null))
      .then((texture) => texture || loadTexture(plainSkinUrl))
      .then((texture) => ({ kind: 'skin', texture })),
  )

  // Body parts: fetch only real ids; a missing slot resets to the base geometry.
  for (const [slot, cfg] of Object.entries(PART_SLOTS)) {
    const id = equipped?.[cfg.idKey]
    if (!isRealId(id)) {
      jobs.push(Promise.resolve({ kind: 'part', slot, scene: null }))
      continue
    }
    jobs.push(loadPartGLB(assetUrls.part(slot, id)).then((scene) => ({ kind: 'part', slot, scene })))
  }

  // Accessories.
  for (const [kind, idKey, meshUrl, texUrl] of [
    ['hat', 'hatId', assetUrls.hatMesh, assetUrls.hatTexture],
    ['back', 'backId', assetUrls.backMesh, assetUrls.backTexture],
  ]) {
    const id = equipped?.[idKey]
    if (!isRealId(id)) continue
    jobs.push(Promise.all([loadOBJ(meshUrl(id)), loadTexture(texUrl(id))]).then(([object, texture]) => ({ kind: 'accessory', accessory: kind, object, texture })))
  }
  return Promise.all(jobs)
}

/**
 * Gets your avatar's clothes downloading at start-up, alongside everything else, rather
 * than only once its body has loaded - so being dressed doesn't hold the game up.
 */
export function prefetchLook(equipped) {
  loadLook(equipped)
}

/** Clears the module cache. Only useful for tests / a forced refresh. */
export function clearAvatarCache() {
  cache.clear()
}
