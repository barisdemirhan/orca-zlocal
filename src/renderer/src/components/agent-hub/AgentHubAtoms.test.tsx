/** @vitest-environment happy-dom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { HubCrumb } from './AgentHubAtoms'

afterEach(cleanup)

it('keeps the host label beside the breadcrumb text on every hub surface', () => {
  const { container } = render(
    <HubCrumb
      location={{ group: 'Group', project: 'Project', workspace: 'Long workspace', host: 'workhost' }}
    />
  )
  const host = screen.getByText('workhost').closest('[data-variant="hostContext"]')
  expect(host?.previousElementSibling?.textContent).toBe('Group›Project·Long workspace')
  expect(host?.parentElement).toBe(container.firstElementChild)
})

it('omits the host badge for single-host locations', () => {
  const { container } = render(
    <HubCrumb location={{ group: null, project: 'Folder', workspace: null }} />
  )
  expect(screen.getByText('Folder')).toBeTruthy()
  expect(container.querySelector('[data-variant="hostContext"]')).toBeNull()
})
