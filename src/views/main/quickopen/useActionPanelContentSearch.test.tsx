import { describe, expect, mock, test } from "bun:test"
import { act, useEffect } from "react"
import { createRoot } from "react-dom/client"
import type { Root } from "react-dom/client"
import { Window } from "happy-dom"
import type { ContentSearchResult } from "../../../shared/types"

type SearchParams = { readonly roots: string[]; readonly query: string }
type SearchContent = (params: SearchParams) => Promise<ContentSearchResult[]>

function deferred<T>(): { readonly promise: Promise<T>; readonly resolve: (value: T) => void } {
  let resolvePromise: (value: T) => void = () => undefined
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })
  return { promise, resolve: resolvePromise }
}

const browserWindow = new Window()
Object.assign(globalThis, {
  window: browserWindow,
  document: browserWindow.document,
  Node: browserWindow.Node,
  HTMLElement: browserWindow.HTMLElement,
  Event: browserWindow.Event,
  CustomEvent: browserWindow.CustomEvent,
  navigator: browserWindow.navigator,
  IS_REACT_ACT_ENVIRONMENT: true,
})

let searchContent: SearchContent = async () => []

mock.module("../rpc/client", () => ({
  rpc: {
    request: {
      searchContent: (params: SearchParams) => searchContent(params),
    },
  },
}))

const { useActionPanelContentSearch } = await import("./useActionPanelContentSearch")

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function useReportMatches(
  matches: readonly ContentSearchResult[],
  onMatches: (matches: readonly ContentSearchResult[]) => void,
) {
  useEffect(() => {
    onMatches(matches)
  }, [matches, onMatches])
}

interface HarnessProps {
  readonly isActive: boolean
  readonly query: string
  readonly folders: string[]
  readonly onMatches: (matches: readonly ContentSearchResult[]) => void
}

function Harness({ isActive, query, folders, onMatches }: HarnessProps) {
  const matches = useActionPanelContentSearch(isActive, query, folders)
  useReportMatches(matches, onMatches)
  return null
}

function mountHarness(): { readonly root: Root; readonly container: HTMLDivElement } {
  const container = document.createElement("div")
  document.body.append(container)
  return { root: createRoot(container), container }
}

describe("useActionPanelContentSearch", () => {
  test("should ignore a stale search result after the search becomes inactive", async () => {
    let renderedMatches: readonly ContentSearchResult[] = []
    let searchCalls = 0
    const search = deferred<ContentSearchResult[]>()
    searchContent = async () => {
      searchCalls += 1
      return search.promise
    }
    const { root, container } = mountHarness()
    const onMatches = (matches: readonly ContentSearchResult[]) => {
      renderedMatches = matches
    }

    await act(async () => {
      root.render(<Harness isActive={true} query="robust" folders={["/workspace"]} onMatches={onMatches} />)
    })
    await act(async () => {
      await sleep(170)
    })
    expect(searchCalls).toBe(1)

    await act(async () => {
      root.render(<Harness isActive={false} query="" folders={["/workspace"]} onMatches={onMatches} />)
    })
    expect(renderedMatches).toEqual([])

    await act(async () => {
      search.resolve([{ name: "Plan.md", path: "/workspace/Plan.md", lineNumber: 3, snippet: "robust panel" }])
      await Promise.resolve()
    })

    expect(renderedMatches).toEqual([])
    await act(async () => root.unmount())
    container.remove()
  })
})
