import { useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, Plus, Send, X, Sparkles } from 'lucide-react';
import { ArtistAvatar } from '../shared/ArtistAvatar';
import { CoverThumb } from '../cover/CoverThumb';
import * as snsApi from '../../lib/api/sns';
import { useGameStore } from '../../state/useGameStore';

const IMG = 300; // square art size — fits the phone frame with margin

function PostImage({ post }) {
  if (post.image_kind === 'cover' && post.image_ref) {
    return (
      <div className="flex justify-center py-1">
        <CoverThumb songId={post.image_ref} size={IMG} rounded={14} title="" />
      </div>
    );
  }
  const c = post.author_color || '#8B7FD1';
  let h = 200;
  for (let i = 0; i < (post.author_name || '').length; i++) h = (h * 31 + post.author_name.charCodeAt(i)) % 360;
  return (
    <div
      className="w-full flex items-center justify-center"
      style={{ height: 150, background: `linear-gradient(${h}deg, ${c}55, #12101A 130%)` }}
    >
      <span style={{ fontSize: 54 }}>{post.image_ref || '🎵'}</span>
    </div>
  );
}

function PostCard({ post, onLike, onComment }) {
  const [showComment, setShowComment] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try { await onComment(post.id, body); setText(''); setShowComment(false); }
    finally { setBusy(false); }
  }

  return (
    <div className="border-b border-white/8 pb-3 mb-1">
      <div className="flex items-center gap-2 px-3 py-2">
        <ArtistAvatar name={post.author_name} color={post.author_color || '#8B8496'} size={32} rounded={16} />
        <span className="text-[12px] font-semibold text-text">{post.author_name}</span>
        {post.is_me && <span className="text-[8px] px-1 rounded" style={{ background: 'rgba(232,163,61,0.2)', color: '#E8A33D' }}>나</span>}
        {post.game_date && <span className="me-mono text-[9px] text-faint ml-auto">{post.game_date.slice(5)}</span>}
      </div>

      <PostImage post={post} />

      <div className="flex items-center gap-4 px-3 pt-2">
        <button onClick={() => onLike(post.id)} className="flex items-center gap-1 bg-transparent border-0 cursor-pointer" aria-label="좋아요">
          <Heart size={18} fill={post.liked ? '#E893A6' : 'none'} color={post.liked ? '#E893A6' : '#EDE9F0'} />
          <span className="text-[11px] text-text/90">{Number(post.likes).toLocaleString('ko-KR')}</span>
        </button>
        <button onClick={() => setShowComment((v) => !v)} className="flex items-center gap-1 bg-transparent border-0 cursor-pointer" aria-label="댓글">
          <MessageCircle size={17} color="#EDE9F0" />
          <span className="text-[11px] text-text/90">{post.comment_count}</span>
        </button>
      </div>

      {post.caption && (
        <div className="px-3 pt-1.5 text-[12px] text-text leading-relaxed">
          <span className="font-semibold mr-1.5">{post.author_name}</span>{post.caption}
        </div>
      )}

      {post.comments?.length > 0 && (
        <div className="px-3 pt-1.5 flex flex-col gap-0.5">
          {post.comments.map((c) => (
            <div key={c.id} className="text-[11px] text-muted">
              <span className="font-semibold mr-1.5" style={{ color: c.author_color || undefined }}>{c.author_name}</span>{c.body}
            </div>
          ))}
        </div>
      )}

      {showComment && (
        <div className="px-3 pt-2 flex items-center gap-1.5">
          <input
            value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="댓글 달기…" autoFocus
            className="flex-1 text-[11px] text-text px-2.5 py-1.5 rounded-full outline-none border border-border bg-transparent"
          />
          <button onClick={submit} disabled={busy || !text.trim()} aria-label="댓글 전송"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-transparent border-0 cursor-pointer disabled:opacity-40">
            <Send size={15} color="#4FD1C5" />
          </button>
        </div>
      )}
    </div>
  );
}

function Composer({ onClose, onPosted }) {
  const character = useGameStore((s) => s.character);
  const refreshCharacter = useGameStore((s) => s.refreshCharacter);
  const [caption, setCaption] = useState('');
  const [songId, setSongId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const songs = character?.songs || [];

  async function post() {
    if (busy) return;
    setBusy(true); setMsg('');
    try {
      const res = await snsApi.createPost(caption, songId || null);
      if (res.boosted) { await refreshCharacter(); setMsg('곡을 홍보해 조회수와 팬이 늘었어요!'); }
      onPosted(res);
      if (!res.boosted) onClose();
      else setTimeout(onClose, 900);
    } catch (e) { setMsg(e.message || '게시에 실패했어요'); }
    finally { setBusy(false); }
  }

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm text-text">새 게시물</span>
        <button onClick={onClose} aria-label="닫기" className="text-faint hover:text-text bg-transparent border-0 cursor-pointer"><X size={16} /></button>
      </div>
      <textarea
        value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} maxLength={300}
        placeholder="지금 무슨 생각을 하고 있나요?"
        className="w-full text-[12px] text-text p-2.5 rounded-lg outline-none border border-border bg-transparent resize-none"
      />
      {songs.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] text-faint mb-1">곡 홍보 (선택) — 처음 홍보하는 곡은 조회수·팬이 올라요</div>
          <select
            value={songId} onChange={(e) => setSongId(e.target.value)}
            className="w-full text-[12px] text-text px-2 py-1.5 rounded-lg outline-none border border-border"
            style={{ background: 'var(--color-groove)' }}
          >
            <option value="">홍보 안 함</option>
            {songs.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </div>
      )}
      {msg && <div className="text-[11px] text-accent2 mt-2">{msg}</div>}
      <button
        onClick={post} disabled={busy || (!caption.trim() && !songId)}
        className="me-btn-primary w-full justify-center mt-3 disabled:opacity-40"
      >{busy ? '게시 중…' : '게시하기'}</button>
    </div>
  );
}

export function SnsApp() {
  const character = useGameStore((s) => s.character);
  const [tab, setTab] = useState('feed'); // feed | profile
  const [feed, setFeed] = useState(null);
  const [profile, setProfile] = useState(null);
  const [composing, setComposing] = useState(false);
  const loadedProfile = useRef(false);

  async function loadFeed() {
    try { setFeed(await snsApi.getFeed()); } catch { setFeed([]); }
  }
  async function loadProfile() {
    try { setProfile(await snsApi.getProfile()); } catch { setProfile({ posts: [], post_count: 0, followers: 0, following: 0 }); }
  }
  useEffect(() => { loadFeed(); }, []);
  useEffect(() => { if (tab === 'profile' && !loadedProfile.current) { loadedProfile.current = true; loadProfile(); } }, [tab]);

  function patchPost(list, id, patch) {
    return list?.map((p) => (p.id === id ? { ...p, ...patch } : p));
  }

  async function onLike(id) {
    // optimistic
    const cur = feed?.find((p) => p.id === id);
    if (cur) setFeed((f) => patchPost(f, id, { liked: !cur.liked, likes: cur.likes + (cur.liked ? -1 : 1) }));
    try {
      const res = await snsApi.likePost(id);
      setFeed((f) => patchPost(f, id, res));
      setProfile((pr) => (pr ? { ...pr, posts: patchPost(pr.posts, id, res) } : pr));
    } catch { loadFeed(); }
  }

  async function onComment(id, body) {
    const c = await snsApi.commentPost(id, body);
    const add = (p) => ({ ...p, comment_count: p.comment_count + 1, comments: [...(p.comments || []), c].slice(-3) });
    setFeed((f) => f?.map((p) => (p.id === id ? add(p) : p)));
    setProfile((pr) => (pr ? { ...pr, posts: pr.posts?.map((p) => (p.id === id ? add(p) : p)) } : pr));
  }

  function onPosted(post) {
    setFeed((f) => [post, ...(f || [])]);
    loadedProfile.current = false; // refresh profile next time it's opened
    setProfile(null);
  }

  return (
    <div className="min-h-full">
      {/* tab bar */}
      <div className="flex items-center border-b border-white/8 sticky top-0 z-10" style={{ background: '#0E0C15' }}>
        {[['feed', '피드'], ['profile', '프로필']].map(([k, label]) => (
          <button
            key={k} onClick={() => setTab(k)}
            className="flex-1 py-2.5 text-[12px] cursor-pointer bg-transparent border-0"
            style={{ color: tab === k ? '#E893A6' : '#8B8496', borderBottom: tab === k ? '2px solid #E893A6' : '2px solid transparent' }}
          >{label}</button>
        ))}
        <button onClick={() => setComposing(true)} aria-label="새 게시물"
          className="px-3 py-2.5 cursor-pointer bg-transparent border-0" style={{ color: '#E893A6' }}>
          <Plus size={18} />
        </button>
      </div>

      {composing && (
        <div className="border-b border-white/10" style={{ background: '#12101A' }}>
          <Composer onClose={() => setComposing(false)} onPosted={onPosted} />
        </div>
      )}

      {tab === 'feed' ? (
        feed === null ? <div className="p-6 text-center text-muted text-xs">불러오는 중…</div>
          : feed.length === 0 ? (
            <div className="p-8 text-center text-muted text-xs flex flex-col items-center gap-2">
              <Sparkles size={22} className="text-pink" />
              아직 게시물이 없어요. ＋ 로 첫 글을 올려보세요!
            </div>
          ) : (
            <div className="pt-1">
              {feed.map((p) => <PostCard key={p.id} post={p} onLike={onLike} onComment={onComment} />)}
            </div>
          )
      ) : (
        <ProfileView profile={profile} character={character} onLike={onLike} onComment={onComment} />
      )}
    </div>
  );
}

function ProfileView({ profile, character, onLike, onComment }) {
  if (profile === null) return <div className="p-6 text-center text-muted text-xs">불러오는 중…</div>;
  return (
    <div>
      <div className="flex flex-col items-center text-center px-4 py-5 border-b border-white/8">
        <ArtistAvatar name={character.artistName} color="#E8A33D" size={60} />
        <div className="me-display font-extrabold text-base mt-2.5">{character.artistName}</div>
        <div className="flex gap-6 mt-3">
          {[['게시물', profile.post_count], ['팔로워', profile.followers], ['팔로잉', profile.following]].map(([l, v]) => (
            <div key={l} className="text-center">
              <div className="font-bold text-sm text-text">{Number(v).toLocaleString('ko-KR')}</div>
              <div className="text-[10px] text-faint">{l}</div>
            </div>
          ))}
        </div>
      </div>
      {profile.posts?.length ? (
        <div>{profile.posts.map((p) => <PostCard key={p.id} post={p} onLike={onLike} onComment={onComment} />)}</div>
      ) : (
        <div className="p-8 text-center text-muted text-xs">아직 올린 게시물이 없어요.</div>
      )}
    </div>
  );
}
