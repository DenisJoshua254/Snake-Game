import { useState, useEffect, useRef, useCallback } from 'react'

const COLS = 22
const ROWS = 22
const CELL = 22
const W = COLS * CELL
const H = ROWS * CELL

const DIFFICULTIES = {
  easy: { label: 'Easy', speed: 280 },
  hard: { label: 'Hard', speed: 140 },
  pro:  { label: 'Pro',  speed: 55  },
}

function randPos(exclude) {
  let pos
  do {
    pos = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS),
    }
  } while (exclude.some(s => s.x === pos.x && s.y === pos.y))
  return pos
}

const dpadBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 52,
  height: 52,
  background: '#f0f0ed',
  border: '1px solid #ddd',
  borderRadius: 10,
  fontSize: 20,
  cursor: 'pointer',
  color: '#333',
  fontFamily: 'inherit',
  transition: 'background 0.1s, transform 0.1s',
  WebkitTapHighlightColor: 'transparent',
}

export default function SnakeGame() {
  const canvasRef = useRef(null)

  const s = useRef({
    snake: [],
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food: { x: 5, y: 5 },
    particles: [],
    running: false,
    paused: false,
    score: 0,
    level: 1,
    speed: 280,
    timer: null,
  })

  const [difficulty, setDifficulty] = useState('easy')
  const [ui, setUi] = useState({ score: 0, best: 0, level: 1, screen: 'start' })

  // ─── Drawing ─────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { snake, dir, food, particles } = s.current
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches

    const p = {
      bg:     dark ? '#1a1a18' : '#f7f6f2',
      grid:   dark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.04)',
      snakeH: dark ? '#5dcaa5' : '#1d9e75',
      snakeB: dark ? '#1d9e75' : '#5dcaa5',
      eye:    dark ? '#1a1a18' : '#f7f6f2',
      food:   dark ? '#f0997b' : '#d85a30',
    }

    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, W, H)

    ctx.strokeStyle = p.grid
    ctx.lineWidth = 0.5
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, H); ctx.stroke()
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL); ctx.stroke()
    }

    const fx = food.x * CELL + CELL / 2
    const fy = food.y * CELL + CELL / 2
    const fr = CELL * 0.38
    ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2)
    ctx.fillStyle = p.food; ctx.fill()
    ctx.beginPath(); ctx.arc(fx - fr * 0.3, fy - fr * 0.3, fr * 0.28, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill()

    snake.forEach((seg, i) => {
      const x = seg.x * CELL, y = seg.y * CELL
      ctx.beginPath()
      ctx.roundRect(x + 1.5, y + 1.5, CELL - 3, CELL - 3, i === 0 ? 6 : 3)
      ctx.fillStyle = i === 0 ? p.snakeH : p.snakeB
      ctx.globalAlpha = Math.max(0.45, 1 - i * 0.035)
      ctx.fill()
      ctx.globalAlpha = 1
    })

    if (snake.length > 0) {
      const head = snake[0]
      const { x: dx, y: dy } = dir
      const ox = dy, oy = -dx
      const hcx = head.x * CELL + CELL / 2
      const hcy = head.y * CELL + CELL / 2
      const off = CELL * 0.18, er = CELL * 0.1
      ;[
        [hcx + ox * off + dx * off, hcy + oy * off + dy * off],
        [hcx - ox * off + dx * off, hcy - oy * off + dy * off],
      ].forEach(([ex, ey]) => {
        ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2)
        ctx.fillStyle = p.eye; ctx.fill()
      })
    }

    s.current.particles = particles.filter(pt => pt.life > 0.05)
    s.current.particles.forEach(pt => {
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 3 * pt.life, 0, Math.PI * 2)
      ctx.fillStyle = p.food
      ctx.globalAlpha = pt.life; ctx.fill(); ctx.globalAlpha = 1
      pt.x += pt.vx; pt.y += pt.vy; pt.life -= 0.12
    })
  }, [])

  // ─── Game Over ───────────────────────────────────────────────────────────
  const endGame = useCallback(() => {
    const g = s.current
    g.running = false
    clearTimeout(g.timer)
    setUi(prev => ({
      ...prev,
      best: Math.max(prev.best, g.score),
      screen: 'gameover',
    }))
  }, [])

  // ─── Game Loop ───────────────────────────────────────────────────────────
  const step = useCallback(() => {
    const g = s.current
    if (!g.running || g.paused) return

    g.dir = g.nextDir
    const head = { x: g.snake[0].x + g.dir.x, y: g.snake[0].y + g.dir.y }

    if (
      head.x < 0 || head.x >= COLS ||
      head.y < 0 || head.y >= ROWS ||
      g.snake.some(seg => seg.x === head.x && seg.y === head.y)
    ) {
      endGame(); return
    }

    g.snake.unshift(head)

    if (head.x === g.food.x && head.y === g.food.y) {
      g.score++
      g.level = Math.floor(g.score / 5) + 1
      g.food = randPos(g.snake)

      const px = head.x * CELL + CELL / 2
      const py = head.y * CELL + CELL / 2
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 / 8) * i
        g.particles.push({
          x: px, y: py,
          vx: Math.cos(angle) * 2.2,
          vy: Math.sin(angle) * 2.2,
          life: 1,
        })
      }
      setUi(prev => ({ ...prev, score: g.score, level: g.level }))
    } else {
      g.snake.pop()
    }

    draw()
    g.timer = setTimeout(step, g.speed)
  }, [draw, endGame])

  // ─── Start / Restart ─────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    const g = s.current
    const preset = DIFFICULTIES[difficulty]
    const cx = Math.floor(COLS / 2), cy = Math.floor(ROWS / 2)
    g.snake = [
      { x: cx,     y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ]
    g.dir       = { x: 1, y: 0 }
    g.nextDir   = { x: 1, y: 0 }
    g.score     = 0
    g.level     = 1
    g.speed     = preset.speed
    g.particles = []
    g.running   = true
    g.paused    = false
    g.food      = randPos(g.snake)

    setUi(prev => ({ ...prev, score: 0, level: 1, screen: 'playing' }))
    clearTimeout(g.timer)
    draw()
    g.timer = setTimeout(step, g.speed)
  }, [draw, step, difficulty])

  // ─── Keyboard Controls ───────────────────────────────────────────────────
  useEffect(() => {
    draw()

    const dirMap = {
      ArrowUp:    { x: 0,  y: -1 },
      ArrowDown:  { x: 0,  y:  1 },
      ArrowLeft:  { x: -1, y:  0 },
      ArrowRight: { x: 1,  y:  0 },
    }

    const handleKey = (e) => {
      const g = s.current
      if (dirMap[e.key]) {
        const nd = dirMap[e.key]
        if (nd.x !== -g.dir.x || nd.y !== -g.dir.y) g.nextDir = nd
        e.preventDefault()
      }
      if (e.key === ' ' && g.running) {
        g.paused = !g.paused
        if (!g.paused) g.timer = setTimeout(step, g.speed)
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      clearTimeout(s.current.timer)
    }
  }, [draw, step])

  // ─── D-pad handler ───────────────────────────────────────────────────────
  const press = (dx, dy) => {
    const g = s.current
    if (!g.running) return
    const nd = { x: dx, y: dy }
    if (nd.x !== -g.dir.x || nd.y !== -g.dir.y) g.nextDir = nd
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 14,
      padding: '28px 0',
      fontFamily: "'Share Tech Mono', monospace",
      userSelect: 'none',
    }}>

      {/* HUD */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: W,
        fontSize: 13,
        color: '#888',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>
        <div>score <span style={{ color: '#222', fontSize: 16, fontWeight: 500 }}>{ui.score}</span></div>
        <div>best  <span style={{ color: '#222', fontSize: 16, fontWeight: 500 }}>{ui.best}</span></div>
        <div>level <span style={{ color: '#222', fontSize: 16, fontWeight: 500 }}>{ui.level}</span></div>
      </div>

      {/* Canvas + Overlay */}
      <div style={{ position: 'relative', border: '1px solid #ddd', borderRadius: 10, overflow: 'hidden', lineHeight: 0 }}>
        <canvas ref={canvasRef} width={W} height={H} />

        {ui.screen !== 'playing' && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 12,
            background: 'rgba(0,0,0,0.62)',
            borderRadius: 10,
          }}>
            <h2 style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 24, fontWeight: 500,
              color: '#fff', letterSpacing: '0.1em',
              textTransform: 'uppercase', margin: 0,
            }}>
              {ui.screen === 'start' ? 'Snake' : 'Game Over'}
            </h2>
            <p style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 13, color: 'rgba(255,255,255,0.7)',
              letterSpacing: '0.05em', margin: 0,
            }}>
              {ui.screen === 'start'
                ? "eat • grow • don't crash"
                : `Score: ${ui.score}  •  Best: ${ui.best}`}
            </p>

            {/* Difficulty selector */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {Object.entries(DIFFICULTIES).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => setDifficulty(key)}
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 12,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    padding: '6px 14px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    border: difficulty === key
                      ? '1px solid #fff'
                      : '1px solid rgba(255,255,255,0.25)',
                    background: difficulty === key
                      ? 'rgba(255,255,255,0.18)'
                      : 'transparent',
                    color: difficulty === key
                      ? '#fff'
                      : 'rgba(255,255,255,0.5)',
                    transition: 'all 0.15s',
                  }}
                >
                  {val.label}
                </button>
              ))}
            </div>

            <button
              onClick={startGame}
              style={{
                marginTop: 2,
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 14, letterSpacing: '0.1em',
                textTransform: 'uppercase',
                background: 'transparent', color: '#fff',
                border: '1px solid rgba(255,255,255,0.5)',
                borderRadius: 8, padding: '10px 32px',
                cursor: 'pointer',
              }}
            >
              {ui.screen === 'start' ? 'Start' : 'Play Again'}
            </button>
          </div>
        )}
      </div>

      {/* D-pad */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 52px)',
        gridTemplateRows: 'repeat(2, 52px)',
        gap: 6,
        marginTop: 4,
      }}>
        <div />
        <button onClick={() => press(0, -1)}  style={dpadBtnStyle}>↑</button>
        <div />
        <button onClick={() => press(-1, 0)}  style={dpadBtnStyle}>←</button>
        <button onClick={() => press(0,  1)}  style={dpadBtnStyle}>↓</button>
        <button onClick={() => press(1,  0)}  style={dpadBtnStyle}>→</button>
      </div>

      <p style={{ fontSize: 12, color: '#aaa', letterSpacing: '0.04em' }}>
        arrow keys or d-pad &nbsp;•&nbsp; space to pause
      </p>
    </div>
  )
}