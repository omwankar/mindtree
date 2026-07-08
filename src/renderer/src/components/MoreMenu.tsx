import { useEffect, useRef } from 'react'

interface MoreMenuProps {
  open: boolean
  onClose: () => void
  onSettings: () => void
  onClear: () => void
}

const HOTKEYS = [
  { keys: 'Ctrl+Shift+Space', action: 'Toggle overlay' },
  { keys: 'Ctrl+Shift+A', action: 'Trigger Assist' },
  { keys: 'Ctrl+Shift+S', action: 'Scan screen now' },
  { keys: 'Ctrl+Shift+C', action: 'Clear session' },
  { keys: 'Ctrl+Shift+↑↓←→', action: 'Move overlay' }
]

export function MoreMenu({ open, onClose, onSettings, onClear }: MoreMenuProps): JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="more-menu" ref={ref}>
      <button className="more-item" onClick={() => { onSettings(); onClose() }}>
        <span>⚙</span> Settings
      </button>
      <button className="more-item danger" onClick={() => { onClear(); onClose() }}>
        <span>⌫</span> Clear session
      </button>
      <div className="more-divider" />
      <div className="more-hotkeys">
        <span className="more-hotkeys-title">Hotkeys</span>
        {HOTKEYS.map((h) => (
          <div className="more-hotkey-row" key={h.keys}>
            <kbd>{h.keys}</kbd>
            <span>{h.action}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
