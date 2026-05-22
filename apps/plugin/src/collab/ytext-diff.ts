import * as Y from 'yjs'

/**
 * Apply the minimal common-prefix/common-suffix diff between `oldContent` and
 * `newContent` to `ytext`. Only the bytes that actually changed are touched,
 * which preserves Y.RelativePosition anchors outside the changed region —
 * critical for keeping editor cursors stable when remote/external content
 * changes are imported into Y.Text.
 *
 * The previous implementation here was `ytext.delete(0, len) + ytext.insert(0, content)`,
 * which invalidates every relative position and snaps editor cursors to a
 * fallback location.
 */
export function applyTextDiffToYText(
  ydoc: Y.Doc,
  ytext: Y.Text,
  oldContent: string,
  newContent: string
): void {
  if (oldContent === newContent) return

  let prefix = 0
  const minLen = Math.min(oldContent.length, newContent.length)
  while (prefix < minLen && oldContent.charCodeAt(prefix) === newContent.charCodeAt(prefix)) {
    prefix++
  }

  let suffix = 0
  const maxSuffix = Math.min(oldContent.length - prefix, newContent.length - prefix)
  while (
    suffix < maxSuffix
    && oldContent.charCodeAt(oldContent.length - 1 - suffix)
      === newContent.charCodeAt(newContent.length - 1 - suffix)
  ) {
    suffix++
  }

  const deleteLength = oldContent.length - prefix - suffix
  const insertContent = newContent.slice(prefix, newContent.length - suffix)

  if (deleteLength === 0 && insertContent.length === 0) return

  ydoc.transact(() => {
    if (deleteLength > 0) {
      ytext.delete(prefix, deleteLength)
    }
    if (insertContent.length > 0) {
      ytext.insert(prefix, insertContent)
    }
  })
}
