import { useState, useEffect, useRef } from 'react';
import Logo from '../components/Logo';
import CoachNote from '../components/CoachNote';

const HISTORY_KEY = () => `pushpal_chat_${new Date().toISOString().split('T')[0]}`;

export default function Coach() {
  const [messages, setMessages] = useState(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY());
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [whoopStatus, setWhoopStatus] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetch('/whoop/status').then(r => r.json()).then(d => setWhoopStatus(d.connected)).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function saveHistory(msgs) {
    try { localStorage.setItem(HISTORY_KEY(), JSON.stringify(msgs)); } catch {}
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg = { role: 'user', content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    saveHistory(nextMessages);
    setInput('');
    setStreaming(true);

    const assistantMsg = { role: 'assistant', content: '' };
    const withAssistant = [...nextMessages, assistantMsg];
    setMessages(withAssistant);

    try {
      const res = await fetch('/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.text) {
              fullText += parsed.text;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: fullText };
                return updated;
              });
            }
          } catch {}
        }
      }

      const final = [...nextMessages, { role: 'assistant', content: fullText }];
      saveHistory(final);
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: 'Error connecting to Push Pal. Check your API key.' };
        return updated;
      });
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 94px)' }}>
      <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Logo size={28} />
          <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Coach</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          <Chip label={`WHOOP ${whoopStatus ? '✓ connected' : '○ not connected'}`} color={whoopStatus ? 'var(--accent)' : 'var(--text-muted)'} />
          <Chip label="Last 14 days context" color="var(--text-muted)" />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', paddingTop: '40px' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>💪</div>
            <p style={{ margin: 0 }}>Ask Push Pal anything about your training,<br />recovery, or race prep.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatBubble key={i} message={msg} />
        ))}
        {streaming && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content === '' && (
          <div style={{ display: 'flex', gap: '4px', padding: '8px 0', alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--brand)', animation: `pp-pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Push Pal..."
            rows={1}
            disabled={streaming}
            style={{
              flex: 1,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '10px 14px',
              color: 'var(--text)',
              fontSize: '14px',
              resize: 'none',
              fontFamily: 'inherit',
              maxHeight: '120px',
              overflowY: 'auto',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || streaming}
            style={{
              background: input.trim() && !streaming ? 'var(--accent)' : 'var(--border)',
              color: input.trim() && !streaming ? '#000' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Send
          </button>
        </div>
      </div>

    </div>
  );
}

function ChatBubble({ message }) {
  const isUser = message.role === 'user';

  // Coach responses get the distinct voice-card treatment. The empty
  // placeholder during streaming renders nothing — the typing dots cover it.
  if (!isUser) {
    if (!message.content) return null;
    return (
      <div style={{ marginBottom: '12px' }}>
        <CoachNote>{message.content}</CoachNote>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
      <div style={{
        maxWidth: '85%',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: '16px 16px 4px 16px',
        padding: '10px 14px',
        fontSize: '14px',
        lineHeight: '1.5',
        color: 'var(--text)',
        whiteSpace: 'pre-wrap',
      }}>
        {message.content}
      </div>
    </div>
  );
}

function Chip({ label, color }) {
  return (
    <span style={{
      fontSize: '11px',
      color,
      background: color + '15',
      border: `1px solid ${color}30`,
      borderRadius: '4px',
      padding: '2px 8px',
    }}>
      {label}
    </span>
  );
}
