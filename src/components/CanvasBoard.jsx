import { useEffect, useState, useRef, useCallback } from 'react';
import { useCanvasDrawing } from '../hooks/useCanvasDrawing.js';
import { getSocket } from '../socket/socket.js';

/**
 * CanvasBoard Component
 * React orchestrates, canvas does the drawing
 */
export const CanvasBoard = () => {
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState(null);
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const [strokes, setStrokes] = useState([]);
  const [cursors, setCursors] = useState(new Map());
  const canvasWrapperRef = useRef(null);
  const strokesRef = useRef(strokes);
  const userIdRef = useRef(userId);
  const usernameRef = useRef(username);
  const usernameForEmitRef = useRef('');
  const lastCursorEmitRef = useRef(0);
  const CURSOR_THROTTLE_MS = 80; // Throttle cursor updates to reduce lag
  strokesRef.current = strokes;
  userIdRef.current = userId;
  usernameRef.current = username;

  const {
    canvasRef,
    startDrawing,
    draw,
    stopDrawing,
    drawStroke,
    clearCanvas,
    redrawAllStrokes
  } = useCanvasDrawing({
    color: isEraser ? '#ffffff' : color,
    lineWidth,
    userId,
    onStrokeEnd: (stroke) => {
      setStrokes(prev => [...prev, stroke]);
    },
    onCanvasResize: () => {
      redrawAllStrokes(strokesRef.current);
    }
  });

  const drawStrokeRef = useRef(drawStroke);
  const redrawAllStrokesRef = useRef(redrawAllStrokes);
  drawStrokeRef.current = drawStroke;
  redrawAllStrokesRef.current = redrawAllStrokes;

  useEffect(() => {
    const socket = getSocket();

    socket.on('user_id', (id) => {
      setUserId(id);
    });

    socket.on('stroke_history', (history) => {
      const list = Array.isArray(history) ? history : [];
      setStrokes(list);
      if (redrawAllStrokesRef.current) {
        redrawAllStrokesRef.current(list);
      }
    });

    socket.on('stroke_added', (stroke) => {
      if (!stroke || !stroke.points || !Array.isArray(stroke.points)) return;
      const isOwnStroke = stroke.userId === userIdRef.current;
      setStrokes(prev => {
        const exists = prev.some(s => s.strokeId === stroke.strokeId);
        if (exists) return prev;
        return [...prev, stroke];
      });
      if (!isOwnStroke) {
        requestAnimationFrame(() => {
          if (drawStrokeRef.current) drawStrokeRef.current(stroke);
        });
      }
    });

    socket.on('cursor_move', (data) => {
      setCursors(prev => {
        const newCursors = new Map(prev);
        newCursors.set(data.userId, {
          x: data.x,
          y: data.y,
          color: data.color || '#000000',
          username: (data.username && String(data.username).trim()) || 'Guest'
        });
        return newCursors;
      });
    });

    socket.on('cursor_leave', (data) => {
      setCursors(prev => {
        const newCursors = new Map(prev);
        newCursors.delete(data.userId);
        return newCursors;
      });
    });

    return () => {
      socket.off('user_id');
      socket.off('stroke_history');
      socket.off('stroke_added');
      socket.off('cursor_move');
      socket.off('cursor_leave');
    };
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const canvas = canvasRef.current;
    if (!canvas || !userId || !username) return;

    const handleMouseMove = (e) => {
      const now = Date.now();
      if (now - lastCursorEmitRef.current < CURSOR_THROTTLE_MS) return;
      lastCursorEmitRef.current = now;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const name = (usernameForEmitRef.current || username || '').trim() || 'Guest';
      socket.emit('cursor_move', { x, y, color, username: name });
    };

    const handleTouchMove = (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchmove', handleTouchMove);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('touchmove', handleTouchMove);
    };
  }, [userId, color, username]);

  const handleUndo = useCallback(() => {
    if (!userId) return;
    getSocket().emit('undo');
  }, [userId]);


  const handleClear = useCallback(() => {
    getSocket().emit('clear');
  }, []);

  const handleRedo = useCallback(() => {
    if (!userId) return;
    getSocket().emit('redo');
  }, [userId]);


  // Redo: enable if any stroke in redo stack for this user (sent from server as not visible, so we track locally)
  // For now, always enable Redo button (since redo stack is not tracked on client)
  // For a more robust solution, you could emit a 'canRedo' event from server or track locally.
  const canUndo = strokes.some(stroke => stroke.userId === userId);
  const [canRedo, setCanRedo] = useState(true); // Always enabled for now

  const handleUsernameSubmit = (e) => {
    e.preventDefault();
    const name = (e.target.username?.value || '').trim();
    if (name) {
      usernameForEmitRef.current = name;
      setUsername(name);
    }
  };

  return (
    <>
      <div className="app-container">
        <div className="toolbar">
          <div className="color-picker">
            <label>Color:</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
              disabled={isEraser}
            />
          </div>
          <button
            onClick={() => setIsEraser(false)}
            style={{
              background: !isEraser ? '#1976d2' : '#4a4a4a',
              color: '#fff',
              border: !isEraser ? '2px solid #fff' : 'none',
              marginRight: 4,
              fontWeight: !isEraser ? 'bold' : 'normal',
              width: 36,
              height: 36,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20
            }}
            title="Brush"
          >
            {/* Modern Brush Icon */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 22s0-4 4-4 4 4 4 4" fill="#1976d2" stroke="#1976d2"/>
              <path d="M16.24 7.76l-9.19 9.19a2 2 0 0 0 2.83 2.83l9.19-9.19a2 2 0 0 0-2.83-2.83z" fill="#1976d2" stroke="#1976d2"/>
              <path d="M15 2l7 7" stroke="#1976d2"/>
            </svg>
          </button>
          <button
            onClick={() => setIsEraser(true)}
            style={{
              background: isEraser ? '#e57373' : '#4a4a4a',
              color: '#fff',
              border: isEraser ? '2px solid #fff' : 'none',
              marginRight: 8,
              fontWeight: isEraser ? 'bold' : 'normal',
              width: 36,
              height: 36,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20
            }}
            title="Eraser"
          >
            {/* Modern Eraser Icon */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="17" width="13" height="4" rx="2" fill="#e57373" stroke="#e57373"/>
              <rect x="8" y="3" width="13" height="8" rx="2" fill="#fff" stroke="#e57373"/>
              <path d="M8 7l8 8" stroke="#e57373"/>
            </svg>
          </button>
          <div className="width-control">
            <label>Width:</label>
            <input
              type="range"
              min="1"
              max="20"
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
            />
            <span>{lineWidth}px</span>
          </div>
          <button onClick={handleUndo} disabled={!canUndo}>
            Undo
          </button>
          <button onClick={handleRedo} disabled={!canRedo}>
            Redo
          </button>
          <button onClick={handleClear}>Clear</button>
          <div className="user-info">
            {username || '—'}
          </div>
        </div>
        <div
          className="canvas-wrapper"
          ref={canvasWrapperRef}
        >
          <div className="canvas-container">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              style={{
                cursor: isEraser
                  ? `url('data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><rect x='4' y='20' width='24' height='8' rx='2' fill='%23e57373' stroke='%234a4a4a' stroke-width='2'/><path d='M11 20V10a5 5 0 0 1 10 0v10' stroke='%234a4a4a' stroke-width='2' fill='none'/></svg>') 0 32, auto`
                  : `url('data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><path d='M2 30c0 1.104.896 2 2 2s2-.896 2-2-.896-2-2-2-2 .896-2 2zm13.293-2.707l-8.586-8.586c-.391-.391-.391-1.023 0-1.414l2.586-2.586c.391-.391 1.023-.391 1.414 0l8.586 8.586c.391.391.391 1.023 0 1.414l-2.586 2.586c-.391.391-1.023.391-1.414 0z' fill='%231976d2' stroke='%234a4a4a' stroke-width='2'/></svg>') 0 32, auto`
              }}
            />
            <div className="cursor-overlay">
              {Array.from(cursors.entries()).map(([cursorUserId, cursor]) => (
                <div
                  key={cursorUserId}
                  className="ghost-cursor ghost-cursor-letter"
                  style={{
                    left: `${cursor.x}px`,
                    top: `${cursor.y}px`,
                    borderColor: cursor.color,
                    backgroundColor: cursor.color,
                    color: '#fff'
                  }}
                >
                  {(cursor.username || 'G').charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {!username && (
        <div className="username-modal-overlay">
          <div className="username-modal">
            <h2>Enter your name</h2>
            <form onSubmit={handleUsernameSubmit}>
              <input
                type="text"
                name="username"
                placeholder="Your name"
                maxLength={20}
                autoFocus
                autoComplete="off"
              />
              <button type="submit">Join</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
