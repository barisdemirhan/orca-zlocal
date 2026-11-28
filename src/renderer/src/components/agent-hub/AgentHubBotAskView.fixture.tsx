import { defineFixture } from '../../component-fixtures/component-fixture'
import { Button } from '@/components/ui/button'
import { AgentHubBotAskView } from './AgentHubBotAskView'
import type { AgentHubBotAskModel } from './use-agent-hub-bot-ask-steps'

const no = (): void => {}
const questions = [
  {
    question: 'Which environment should the migration run on first?',
    replies: ['Staging', 'Production']
  },
  { question: 'Rotate the leaked token now?', replies: ['Rotate now', 'Rotate after the release'] },
  { question: 'Close the incident item?', replies: ['Close it', 'Keep it open'] },
  { question: 'Notify the customer?', replies: ['Yes, today', 'No'] },
  { question: 'Archive the old logs?', replies: ['Archive', 'Delete'] }
]

function model(patch: Partial<AgentHubBotAskModel>): AgentHubBotAskModel {
  return {
    phase: 'open',
    waiting: true,
    number: 7,
    title: 'Migration needs your call',
    total: 1,
    context:
      'The `orders` migration adds a required column. CI is green and the rollback script is ready.',
    folded: [],
    openKey: 'q0',
    question: questions[0].question,
    replies: questions[0].replies.map((label, i) => ({ label, recommended: i === 0 })),
    multi: false,
    held: null,
    nav: null,
    answeredCount: 0,
    heldCount: 0,
    openCount: 0,
    heldFiles: 0,
    step: no,
    reopen: no,
    pick: no,
    reply: no,
    sendHeld: no,
    retry: no,
    ...patch
  }
}

const actions = (
  <>
    <Button size="xs" variant="ghost" onClick={no}>
      Later
    </Button>
    <Button size="xs" variant="ghost" onClick={no}>
      Open #7
    </Button>
  </>
)

const five = model({ total: 5, nav: { at: 0, count: 5 } })
const twoHeld = model({
  total: 5,
  nav: { at: 2, count: 5 },
  openKey: 'q2',
  question: questions[2].question,
  replies: questions[2].replies.map((label, i) => ({ label, recommended: i === 0 })),
  folded: [
    { index: 0, question: questions[0].question, words: 'Staging', reopens: true },
    { index: 1, question: questions[1].question, words: 'Rotate now', reopens: true }
  ],
  answeredCount: 2,
  heldCount: 2,
  openCount: 5,
  heldFiles: 1
})
const multiPick = model({
  total: 2,
  nav: { at: 0, count: 2 },
  multi: true,
  question: 'Which regions should get the rollout?',
  replies: ['eu-west', 'us-east', 'ap-south'].map((label, i) => ({ label, recommended: i === 0 }))
})
const freeText = model({
  question: 'What should the release be called?',
  replies: [],
  context: ''
})
const single = model({})
const longContext = model({
  context: [
    'The `orders` migration adds a required column and backfills it from the invoices table.',
    'On production that locks the table for about four minutes; staging holds a copy of last week’s data, so a dry run there is safe.',
    'CI is green on the branch, the rollback script is ready, and Olcay asked to hear before anything touches production.',
    'The backfill can also run in batches overnight instead.'
  ].join('\n\n')
})
const sent = model({ phase: 'answered', total: 5, answeredCount: 5 })

const render = (ask: AgentHubBotAskModel) => (
  <div className="bg-background p-3">
    <AgentHubBotAskView ask={ask} actions={actions} />
  </div>
)
const both = { narrow: 320, wide: 640 }

export const fiveQuestionsFirstOpen = defineFixture({
  width: both.narrow,
  render: () => render(five)
})
export const fiveQuestionsFirstOpenWide = defineFixture({
  width: both.wide,
  render: () => render(five)
})
export const twoHeldAnswers = defineFixture({ width: both.narrow, render: () => render(twoHeld) })
export const twoHeldAnswersWide = defineFixture({ width: both.wide, render: () => render(twoHeld) })
export const multiPickQuestion = defineFixture({
  width: both.narrow,
  render: () => render(multiPick)
})
export const freeTextQuestion = defineFixture({
  width: both.narrow,
  render: () => render(freeText)
})
export const longContextFolded = defineFixture({
  width: both.narrow,
  render: () => render(longContext)
})
export const singleQuestion = defineFixture({ width: both.narrow, render: () => render(single) })
export const singleQuestionWide = defineFixture({ width: both.wide, render: () => render(single) })
export const sentAnswered = defineFixture({ width: both.narrow, render: () => render(sent) })
