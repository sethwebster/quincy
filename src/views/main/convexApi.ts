import { anyApi } from "convex/server"
import type { api as generatedApi } from "../../../convex/_generated/api"

type RendererApi = {
  readonly documents: typeof generatedApi.documents
  readonly assistant: typeof generatedApi.assistant
}

export const api: RendererApi = {
  documents: {
    list: anyApi.documents.list,
    get: anyApi.documents.get,
    create: anyApi.documents.create,
    update: anyApi.documents.update,
    remove: anyApi.documents.remove,
  },
  assistant: {
    listByDocKey: anyApi.assistant.listByDocKey,
    appendMessage: anyApi.assistant.appendMessage,
    clearThread: anyApi.assistant.clearThread,
  },
}
