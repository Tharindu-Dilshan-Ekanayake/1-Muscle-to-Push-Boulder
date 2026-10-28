import { useEffect, useState } from 'react'

import { isMuted, onMutedChange, setMuted } from '../../audio/sfx'
import { useGame } from '../../store/game'
import AuthHUD from '../AuthHUD'
import Icon from '../Icon'
import { AlertBadge, ChunkyButton } from './parts'
import { GRADIENTS, u } from './style'

function RoundButton({ icon, label, onClick, alert, iconSize = 38 }) {
  return (
    <ChunkyButton gradient={GRADIENTS.slate} onClick={onClick} title={label} radius={32} style={{ width: u(64), height: u(64) }}>
      <Icon name={icon} size={u(iconSize)} />
      {alert && <AlertBadge size={26} style={{ top: u(-8), right: u(-8) }} />}
    </ChunkyButton>
  )
}

/** Turns the music and sound effects on and off (remembered on this device). */
function SoundButton() {
  const [muted, setMutedState] = useState(isMuted)
  useEffect(() => onMutedChange(setMutedState), [])
  return <RoundButton icon={muted ? 'soundOff' : 'sound'} label={muted ? 'Sound: off' : 'Sound: on'} onClick={() => setMuted(!muted)} iconSize={36} />
}

/**
 * The top-right corner: sound, leaderboards and your name tag. (Daily rewards are the
 * Gifts tile on the left.)
 */
export function TopBar() {
  const openPanel = useGame((s) => s.openPanel)

  return (
    <div className="pointer-events-none absolute flex items-center" style={{ right: u(16), top: u(14), gap: u(12) }}>
      <SoundButton />
      <RoundButton icon="star" label="Leaderboards" onClick={() => openPanel('leaderboards')} iconSize={34} />
      <AuthHUD />
    </div>
  )
}

export default TopBar
