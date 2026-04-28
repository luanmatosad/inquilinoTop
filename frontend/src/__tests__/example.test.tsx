import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Example component for testing
function Counter() {
  const [count, setCount] = React.useState(0)
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <button onClick={() => setCount(count - 1)}>Decrement</button>
    </div>
  )
}

import React from 'react'

describe('Counter Component', () => {
  it('renders counter with initial value 0', () => {
    render(<Counter />)
    expect(screen.getByText('Count: 0')).toBeInTheDocument()
  })

  it('increments count on button click', async () => {
    const user = userEvent.setup()
    render(<Counter />)

    const incrementBtn = screen.getByRole('button', { name: /increment/i })
    await user.click(incrementBtn)

    expect(screen.getByText('Count: 1')).toBeInTheDocument()
  })

  it('decrements count on button click', async () => {
    const user = userEvent.setup()
    render(<Counter />)

    const decrementBtn = screen.getByRole('button', { name: /decrement/i })
    await user.click(decrementBtn)

    expect(screen.getByText('Count: -1')).toBeInTheDocument()
  })

  it('handles multiple increments', async () => {
    const user = userEvent.setup()
    render(<Counter />)

    const incrementBtn = screen.getByRole('button', { name: /increment/i })
    await user.click(incrementBtn)
    await user.click(incrementBtn)
    await user.click(incrementBtn)

    expect(screen.getByText('Count: 3')).toBeInTheDocument()
  })
})
