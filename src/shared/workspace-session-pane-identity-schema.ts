import { z } from 'zod'
import { salvagedOptional, salvagingRecord } from './validation/zod-salvage'

export const workspaceSessionPaneIdentityFields = {
  terminalSpawnedByPaneKey: salvagedOptional(
    'terminalSpawnedByPaneKey',
    salvagingRecord(z.string(), z.object({ paneKey: z.string().min(1) }))
  ),
  terminalPtyIncarnationsByPaneKey: salvagedOptional(
    'terminalPtyIncarnationsByPaneKey',
    salvagingRecord(z.string(), z.string().min(1).max(128))
  )
}
