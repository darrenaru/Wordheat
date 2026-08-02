import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ChatMessage, FriendsPayload } from '@shared/types.ts';
import { api, ApiFailure } from '../lib/api.ts';
import { FALLBACK_AVATAR } from '../lib/avatar.ts';
import { groupChatMessages, isEmojiOnlyMessage } from '../lib/chatGrouping.ts';
import { renderChatText } from '../lib/chatText.tsx';
import { emojiIconUrl } from '../lib/emojis.ts';
import { getFriends, refreshFriends, subscribeFriends } from '../lib/friends.ts';
import { loadProfile } from '../lib/profile.ts';
import { Avatar } from './Avatar.tsx';
import { EmojiPicker } from './EmojiPicker.tsx';
import { PresenceBadge } from './PresenceBadge.tsx';
import { Modal, SendIcon, useToast } from './ui.tsx';

const EMPTY_FRIENDS: FriendsPayload = { friends: [], incoming: [], outgoing: [], invites: [], unreadMessages: 0 };

interface ChatModalProps {
  profileId: string;
  onClose(): void;
}

/**
 * Chat pribadi dengan seorang teman — modal di atas halaman yang sedang
 * dibuka (dipanggil dari tombol "Chat" di `FriendListScreen`), BUKAN
 * navigasi ke halaman terpisah — supaya pemain tidak kehilangan konteks
 * halaman Teman di baliknya.
 *
 * Persisten (tersimpan di database) — isi PESAN-nya sendiri tetap TIDAK
 * real-time (baru kelihatan begitu percakapan dibuka/dimuat ulang), tapi
 * status kehadiran lawan bicara di header (`PresenceBadge`) SUDAH live
 * lewat saluran SSE (`App.tsx`/`lib/presence.ts`).
 */
export function ChatModal({ profileId, onClose }: ChatModalProps) {
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
    // `.chat-thread` sendiri tidak menggulir (lihat CSS) — satu-satunya area
    // gulir modal ini adalah `.modal__body`, induk langsungnya.
    const scrollArea = listRef.current?.parentElement;
    scrollArea?.scrollTo({ top: scrollArea.scrollHeight });
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

  const items = groupChatMessages(messages ?? [], myId);

  return (
    <Modal
      // Identitas lawan bicara langsung di header modal (avatar+nama+
      // username) — bukan judul teks generik + kartu terpisah di body
      // seperti sebelumnya, supaya infonya cuma ada di SATU tempat.
      ariaLabel={friend?.displayName ? `Chat dengan ${friend.displayName}` : 'Chat'}
      headClassName="chat-modal-head"
      bodyClassName="chat-modal-body"
      title={
        <div className="chat-modal-header">
          <Avatar config={friend?.avatar ?? FALLBACK_AVATAR} size={40} alt="" />
          <div className="chat-modal-header__text">
            <span className="chat-modal-header__name">{friend?.displayName ?? 'Chat'}</span>
            {friend?.username && <span className="chat-modal-header__username caption">@{friend.username}</span>}
            {friend && <PresenceBadge profileId={friend.profileId} initialPresence={friend.presence} />}
          </div>
        </div>
      }
      onClose={onClose}
      footer={
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
            autoFocus
          />
          <button
            className="btn btn--primary btn--icon"
            onClick={() => void send()}
            disabled={sending || !text.trim()}
            aria-label="Kirim pesan"
            title="Kirim pesan"
          >
            <SendIcon />
          </button>
        </div>
      }
    >
      <div className="chat-thread" ref={listRef}>
        {messages === null && <p className="empty">Memuat...</p>}
        {messages !== null && messages.length === 0 && (
          <p className="empty">Belum ada pesan. Mulai obrolan!</p>
        )}
        {items.map((item) =>
          item.type === 'divider' ? (
            <div key={item.key} className="chat-divider auth-divider">
              <span>{item.label}</span>
            </div>
          ) : (
            <div key={item.key} className={`chat-row ${item.mine ? 'chat-row--mine' : 'chat-row--theirs'}`}>
              {!item.mine && (
                <div className="chat-row__avatar">
                  {item.showAvatar && (
                    <Avatar config={friend?.avatar ?? FALLBACK_AVATAR} size={24} alt="" />
                  )}
                </div>
              )}
              <div className="chat-bubble-stack">
                {isEmojiOnlyMessage(item.message.body) ? (
                  <div className="chat-bubble chat-bubble--emoji-only">
                    {renderChatText(item.message.body, 40)}
                  </div>
                ) : (
                  <div
                    className={`chat-bubble ${item.mine ? 'chat-bubble--mine' : 'chat-bubble--theirs'}`}
                  >
                    {renderChatText(item.message.body)}
                  </div>
                )}
                {item.showTime && (
                  <span className={`chat-time ${item.mine ? 'chat-time--mine' : 'chat-time--theirs'}`}>
                    {new Date(item.message.createdAt).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
            </div>
          ),
        )}
      </div>
    </Modal>
  );
}
