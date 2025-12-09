import { Schema } from "effect"
import { randomUUID } from "crypto"

export const generateEventId = (timestamp: string, type: string): string => {
  const datePart = timestamp.replace(/:/g, '-').replace(/\./g, '-')
  const uuid = randomUUID().replace(/-/g, '').substring(0, 8)
  return `${datePart}_${type}_${uuid}`
}

export const EventIdSchema = Schema.String
