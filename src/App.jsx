import { useEffect } from 'react';
import { CanvasBoard } from './components/CanvasBoard.jsx';
import { initSocket } from './socket/socket.js';
import './App.css';

function App() {
  // Connect to server as soon as app loads so collaboration is ready
  useEffect(() => {
    initSocket();
  }, []);

  return (
    <div className="App">
      <CanvasBoard />
    </div>
  );
}

export default App;
