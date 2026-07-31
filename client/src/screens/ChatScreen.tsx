import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ChatMessage, FriendsPayload } from '@shared/types.ts';
import { api, ApiFailure } from '../lib/api.ts';
import { renderChatText } from '../lib/chatText.tsx';
import { emojiIconUrl } from '../lib/emojis.ts';
import { getFriends, refreshFriends, subscribeFriends } from '../lib/friends.ts';
import { loadProfile } from '../lib/profile.ts';
import { navigate } from '../lib/router.ts';
import { Avatar } from '../components/Avatar.tsx';
import { EmojiPicker } from '../components/EmojiPicker.tsx';
import { BackIcon, useToast } from '../components/ui.tsx';

const FALLBACK_AVATAR = { seed: 'pemain', backgroundColor: '2A2A2E' };
const EMPTY_FRIENDS: FriendsPayload = { friends: [], incoming: [], outgoing: [], invites: [], unreadMessages: 0 };

interface ChatScreenProps {
  profileId: string;
}

/**
 * Chat pribadi dengan seorang teman — persisten (tersimpan di database),
 * TIDAK real-time: pesan baru baru kelihatan begitu percakapan dibuka/
 * dimuat ulang, sama seperti keterbatasan yang sudah ada di undangan room/
 * permintaan pertemanan (app ini belum punya koneksi live di luar sesi
 * ruang multiplayer).
 */
export function ChatScreen({ profileId }: ChatScreenProps) {
  const friendsPayload = useSyncExternalStore(subscribeFriends, getFriends, () => EMPTY_FRIENDS);
  const friend = friendsPayload.friends.find((f) => f.user.profileId === profileId)?.user;
  const myId = loadProfile().id;

  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const toast = useToast();
  const listRef = useRef<HTMLDivElement>(null);

  const load = () => {
    api
      .conversation(profileId)
      .then((result) => {
        setMessages(result);
        // Membuka percakapan menandai pesan masuknya terbaca di server
        // (lihat `listConversation`) — segarkan store lokal supaya badge
        // "Teman" di header ikut turun tanpa perlu reload halaman.
        refreshFriends();
      })
      .catch(() => setMessages([]));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await api.sendMessage(profileId, trimmed);
      setText('');
      load();
    } catch (err) {
      toast.show(err instanceof ApiFailure ? err.message : 'Gagal mengirim pesan.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row" style={{ alignItems: 'center', gap: 12, flexWrap: 'nowrap' }}>
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={() => navigate('/teman')}
          aria-label="Kembali ke Teman"
        >
          <BackIcon />
        </button>
        <Avatar config={friend?.avatar ?? FALLBACK_AVATAR} size={36} />
        <h1 style={{ margin: 0, fontSize: 22 }}>{friend?.displayName ?? 'Chat'}</h1>
      </div>

      <div className="chat-thread card" ref={listRef}>
        {messages === null && <p className="empty">Memuat...</p>}
        {messages !== null && messages.length === 0 && (
          <p className="empty">Belum ada pesan. Mulai obrolan!</p>
        )}
        {messages?.map((message) => (
          <div
            key={message.id}
            className={`chat-bubble ${
              message.fromProfileId === myId ? 'chat-bubble--mine' : 'chat-bubble--theirs'
            }`}
          >
            {renderChatText(message.body)}
          </div>
        ))}
      </div>

      <div className="chat-composer">
        {showEmoji && (
          <EmojiPicker
            onPick={(slug) => setText((current) => `${current}:${slug}:`)}
            onClose={() => setShowEmoji(false)}
          />
        )}
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={() => setShowEmoji((current) => !current)}
          aria-label="Pilih emoji"
        >
          <img src={emojiIconUrl('slightly-smiling-face')} alt="" width={20} height={20} />
        </button>
        <input
          className="input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void send();
          }}
          placeholder="Tulis pesan..."
          maxLength={500}
        />
        <button
          className="btn btn--primary"
          onClick={() => void send()}
          disabled={sending || !text.trim()}
        >
          Kirim
        </button>
      </div>
    </div>
  );
}
