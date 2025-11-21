// App.tsx
import Button from './components/ui/Button/Button';

function App() {
  return (
    <div style={{ padding: '50px' }}>
      <h1>Мой корпоративный мессенджер</h1>
      <Button variant="primary" onClick={() => alert('Clicked!')}>
        Primary Button
      </Button>
      <Button variant="secondary" style={{ marginLeft: '10px' }}>
        Secondary Button
      </Button>
    </div>
  );
}

export default App;