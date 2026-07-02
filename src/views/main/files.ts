import { rpc } from "./rpc/client"

/** Create an empty, uniquely-named markdown file in `dir` and announce it so
 *  the tree refreshes. Returns what the editor needs to open it. */
export async function createMarkdownFileIn(dir: string): Promise<{ path: string; mtimeMs: number }> {
  const entries = await rpc.request.listDirectory({ path: dir })
  const names = new Set(entries.map((entry) => entry.name))
  let name = "Untitled.md"
  for (let i = 2; names.has(name); i += 1) name = `Untitled ${i}.md`
  const path = `${dir}/${name}`
  const { mtimeMs } = await rpc.request.writeFile({ path, content: "" })
  window.dispatchEvent(new CustomEvent("quincy:fileCreated", { detail: path }))
  return { path, mtimeMs }
}
