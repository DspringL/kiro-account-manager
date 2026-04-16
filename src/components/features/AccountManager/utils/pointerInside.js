export function isPointerInsideContainer(event, containers) {
  const containerList = Array.isArray(containers) ? containers.filter(Boolean) : [containers].filter(Boolean)
  if (!event || containerList.length === 0) return false

  for (const container of containerList) {
    if (typeof container.contains === 'function' && container.contains(event.target)) {
      return true
    }
  }

  if (typeof event.composedPath === 'function') {
    const path = event.composedPath()
    if (Array.isArray(path) && containerList.some(container => path.includes(container))) {
      return true
    }
  }

  const { clientX, clientY } = event
  if (typeof clientX !== 'number' || typeof clientY !== 'number') {
    return false
  }

  return containerList.some((container) => {
    if (typeof container.getBoundingClientRect !== 'function') {
      return false
    }

    const rect = container.getBoundingClientRect()
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    )
  })
}
