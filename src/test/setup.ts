import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom has no modal dialogs; emulate the parts the app uses.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute('open', '')
}
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.removeAttribute('open')
  this.dispatchEvent(new Event('close'))
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
