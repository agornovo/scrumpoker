import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WelcomeScreen from '../components/WelcomeScreen.jsx'

describe('WelcomeScreen', () => {
  it('renders name and room id inputs', () => {
    render(<WelcomeScreen onJoin={vi.fn()} />)
    expect(screen.getByLabelText('Your Name')).toBeTruthy()
    expect(screen.getByLabelText('Room ID')).toBeTruthy()
  })

  it('shows alert when joining without name', () => {
    window.alert = vi.fn()
    render(<WelcomeScreen onJoin={vi.fn()} />)
    fireEvent.click(screen.getByText('Join Room'))
    expect(window.alert).toHaveBeenCalledWith('Please enter your name')
  })

  it('calls onJoin with correct data', () => {
    const fn = vi.fn()
    render(<WelcomeScreen onJoin={fn} />)
    fireEvent.change(screen.getByLabelText('Your Name'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('Room ID'), { target: { value: 'ABC123' } })
    fireEvent.click(screen.getByText('Join Room'))
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({
      userName: 'Alice',
      roomId: 'ABC123',
      isObserver: false,
    }))
  })

  it('calls onJoin with isObserver true when observer checked', () => {
    const fn = vi.fn()
    render(<WelcomeScreen onJoin={fn} />)
    fireEvent.change(screen.getByLabelText('Your Name'), { target: { value: 'Bob' } })
    fireEvent.click(screen.getByLabelText(/Join as Observer/))
    fireEvent.click(screen.getByText('Join Room'))
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ isObserver: true }))
  })

  it('renders card set options', () => {
    render(<WelcomeScreen onJoin={vi.fn()} />)
    expect(screen.getByDisplayValue(/Standard/)).toBeTruthy()
  })

  it('renders help section with expandable details', () => {
    render(<WelcomeScreen onJoin={vi.fn()} />)
    expect(screen.getByText('How to use the app')).toBeTruthy()
  })
})
