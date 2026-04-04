import test from 'node:test'
import assert from 'node:assert/strict'
import { isPointerInsideContainer } from './pointerInside.js'

test('isPointerInsideContainer returns true when target is contained', () => {
  const container = {
    contains: (target) => target === 'inside',
    getBoundingClientRect: () => ({ left: 10, right: 20, top: 10, bottom: 20 }),
  }

  assert.equal(isPointerInsideContainer({ target: 'inside' }, container), true)
})

test('isPointerInsideContainer returns true when composedPath contains container', () => {
  const container = {
    contains: () => false,
    getBoundingClientRect: () => ({ left: 10, right: 20, top: 10, bottom: 20 }),
  }

  const event = {
    target: 'outside',
    composedPath: () => ['outside', container, 'document'],
  }

  assert.equal(isPointerInsideContainer(event, container), true)
})

test('isPointerInsideContainer returns true when pointer is inside container bounds', () => {
  const container = {
    contains: () => false,
    getBoundingClientRect: () => ({ left: 100, right: 180, top: 50, bottom: 120 }),
  }

  const event = {
    target: 'outside',
    clientX: 150,
    clientY: 60,
  }

  assert.equal(isPointerInsideContainer(event, container), true)
})

test('isPointerInsideContainer returns false when pointer is outside container bounds', () => {
  const container = {
    contains: () => false,
    getBoundingClientRect: () => ({ left: 100, right: 180, top: 50, bottom: 120 }),
  }

  const event = {
    target: 'outside',
    clientX: 250,
    clientY: 10,
  }

  assert.equal(isPointerInsideContainer(event, container), false)
})

test('isPointerInsideContainer returns true when pointer is inside any provided container bounds', () => {
  const trigger = {
    contains: () => false,
    getBoundingClientRect: () => ({ left: 0, right: 100, top: 0, bottom: 40 }),
  }
  const panel = {
    contains: () => false,
    getBoundingClientRect: () => ({ left: 0, right: 100, top: 48, bottom: 220 }),
  }

  const event = {
    target: 'outside',
    clientX: 95,
    clientY: 120,
  }

  assert.equal(isPointerInsideContainer(event, [trigger, panel]), true)
})
