export type MessagePart = { type?: string; text?: string }
export type SessionMessage = { role?: string; content?: string | MessagePart[] }
export type ExistingDoc = { path: string; content: string }

export type SummaryPayload = {
  action: "overwrite" | "new"
  targetPath: string
  title: string
  filename: string
  tags: string[]
  markdown: string
}

export type IdleEventProperties = { sessionID?: string }
export type MessageDeltaProperties = {
  sessionID?: string
  messageID?: string
  partID?: string
  field?: string
  delta?: string
}
export type MessagePartUpdatedProperties = {
  sessionID?: string
  part?: { messageID?: string; id?: string; text?: string }
}

export type RawEvent = { type: string; properties?: unknown }
