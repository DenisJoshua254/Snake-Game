import SnakeGame from './SnakeGame'

export default function App() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      background: '#fafaf8',
    }}>
      <SnakeGame />
    </div>
  )
}
