import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Send, MessageCircle } from 'lucide-react';
import { ArtistAvatar } from '../shared/ArtistAvatar';
import * as dmApi from '../../lib/api/dm';

// 메시지 app: a thread list that opens into a chat view. Incoming messages are
// generated server-side; replying stores your message and returns a canned
// answer. Opening a thread marks it read (the backend does this on GET).
export function DmApp() {
  const [threads, setThreads] = useState(null);
  const [openKey, setOpenKey] = useState(null);

  async function loadThreads() {
    try { setThreads(await dmApi.getThreads()); } catch { setThreads([]); }
  }
  useEffect(() => { loadThreads(); }, []);

  if (openKey) {
    return <ThreadView threadKey={openKey} onBack={() => { setOpenKey(null); loadThreads(); }} />;
  }

  if (threads === null) return <div className="p-6 text-center text-muted text-xs">불러오는 중…</div>;
  if (!threads.length) {
    return (
      <div className="p-8 text-center text-muted text-xs flex flex-col items-center gap-2">
        <MessageCircle size={22} className="text-accent2" />
        아직 받은 메시지가 없어요.
      </div>
    );
  }

  return (
    <div className="py-1">
      {threads.map((t) => (
        <button
          key={t.thread_key}
          onClick={() => setOpenKey(t.thread_key)}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer bg-transparent border-0 border-b border-white/6"
        >
          <ArtistAvatar name={t.name} color={t.color || '#8B8496'} size={40} rounded={20} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-semibold text-text truncate">{t.name}</span>
              {t.last_date && <span className="me-mono text-[9px] text-faint ml-auto shrink-0">{t.last_date.slice(5)}</span>}
            </div>
            <div className="text-[11px] text-muted truncate">{t.last_body}</div>
          </div>
          {t.unread > 0 && (
            <span className="shrink-0 rounded-full text-[9px] font-bold flex items-center justify-center"
              style={{ minWidth: 18, height: 18, padding: '0 5px', background: '#E893A6', color: '#12101A' }}>
              {t.unread}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function ThreadView({ threadKey, onBack }) {
  const [thread, setThread] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  async function load() {
    try { setThread(await dmApi.getThread(threadKey)); } catch { setThread({ name: '', messages: [] }); }
  }
  useEffect(() => { load(); }, [threadKey]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [thread]);

  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try { setThread(await dmApi.sendMessage(threadKey, body)); setText(''); }
    catch { /* keep text so it can be retried */ }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col" style={{ minHeight: '100%' }}>
      <div className="flex items-center gap-2 px-2 py-2 border-b border-white/8 sticky top-0" style={{ background: '#0E0C15' }}>
        <button onClick={onBack} aria-label="목록으로" className="w-7 h-7 flex items-center justify-center rounded-full text-text/80 hover:bg-white/8 cursor-pointer bg-transparent border-0">
          <ChevronLeft size={18} />
        </button>
        {thread && <ArtistAvatar name={thread.name} color={thread.color || '#8B8496'} size={26} rounded={13} />}
        <span className="text-[13px] font-semibold text-text">{thread?.name || ''}</span>
      </div>

      <div className="flex-1 px-3 py-3 flex flex-col gap-2">
        {thread === null ? (
          <div className="text-center text-muted text-xs">불러오는 중…</div>
        ) : (
          thread.messages.map((m) => (
            <div key={m.id} className={`flex ${m.from_me ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[78%] px-3 py-2 text-[12px] leading-relaxed"
                style={{
                  borderRadius: 14,
                  background: m.from_me ? 'var(--color-accent)' : 'rgba(255,255,255,0.08)',
                  color: m.from_me ? '#12101A' : '#EDE9F0',
                  borderBottomRightRadius: m.from_me ? 4 : 14,
                  borderBottomLeftRadius: m.from_me ? 14 : 4,
                }}
              >
                {m.body}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="flex items-center gap-1.5 px-3 py-2 border-t border-white/8 sticky bottom-0" style={{ background: '#0E0C15' }}>
        <input
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="메시지 보내기…"
          className="flex-1 text-[12px] text-text px-3 py-2 rounded-full outline-none border border-border bg-transparent"
        />
        <button onClick={send} disabled={busy || !text.trim()} aria-label="보내기"
          className="w-8 h-8 flex items-center justify-center rounded-full shrink-0 cursor-pointer border-0 disabled:opacity-40"
          style={{ background: 'var(--color-accent)' }}>
          <Send size={15} color="#12101A" />
        </button>
      </div>
    </div>
  );
}
