import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type {
  AccountLinkResult,
  FriendRequestSummary,
  FriendsPayload,
  PlayerProfile,
  Presence,
  RoomInviteSummary,
} from '@shared/types.ts';
import { api } from './lib/api.ts';
import { registerCoinFxOrigin } from './lib/coinFx.ts';
import { getFriends, refreshFriends, subscribeFriends } from './lib/friends.ts';
import { applyInventory } from './lib/inventory.ts';
import { applyPresenceUpdate } from './lib/presence.ts';
import { hasChosenSignInMethod, loadProfile, resetProfile, saveProfile } from './lib/profile.ts';
import { navigate, useRoute } from './lib/router.ts';
import {
  initSoundtrack,
  isSoundtrackAvailable,
  isSoundtrackOn,
  subscribeSoundtrack,
  toggleSoundtrack,
} from './lib/soundtrack.ts';
import { getAuthSession, isAuthAvailable, signOut, subscribeAuth } from './lib/supabase.ts';
import { applyBalance, getBalance, subscribeWallet } from './lib/wallet.ts';
import { AccountLinkConflictModal } from './components/AccountLinkConflictModal.tsx';
import { Avatar } from './components/Avatar.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { CoinFxLayer } from './components/CoinFx.tsx';
import { IncomingPopups } from './components/IncomingPopups.tsx';
import { ProfileModal } from './components/ProfileModal.tsx';
import { BackIcon, SoundOffIcon, SoundOnIcon, UsersIcon } from './components/ui.tsx';
import { WelcomeModal } from './components/WelcomeModal.tsx';
import { FriendListScreen } from './screens/FriendListScreen.tsx';
import { HomeScreen } from './screens/HomeScreen.tsx';
import { LeaderboardScreen } from './screens/LeaderboardScreen.tsx';
import { RoomScreen } from './screens/RoomScreen.tsx';
import { ShopScreen } from './screens/ShopScreen.tsx';
import { SoloScreen } from './screens/SoloScreen.tsx';

const EMPTY_FRIENDS: FriendsPayload = { friends: [], incoming: [], outgoing: [], invites: [], unreadMessages: 0 };

export function App() {
  const route = useRoute();
  const [profile, setProfile] = useState<PlayerProfile>(loadProfile);
  const [showProfile, setShowProfile] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const balance = useSyncExternalStore(subscribeWallet, getBalance, () => 0);
  const friendsPayload = useSyncExternalStore(subscribeFriends, getFriends, () => EMPTY_FRIENDS);
  const pendingFriendCount =
    friendsPayload.incoming.length + friendsPayload.invites.length + friendsPayload.unreadMessages;
  const coinChipRef = useRef<HTMLButtonElement>(null);
  const previousBalance = useRef(balance);
  /** Denyut singkat pada chip saldo tiap kali nilainya berubah — turun
   *  (belanja powerup) memakai warna panas, naik (menang) memakai "correct". */
  const [coinPulse, setCoinPulse] = useState<'gain' | 'spend' | null>(null);

  useEffect(() => {
    registerCoinFxOrigin(coinChipRef.current);
  }, []);

  useEffect(() => {
    if (balance === previousBalance.current) return;
    setCoinPulse(balance > previousBalance.current ? 'gain' : 'spend');
    previousBalance.current = balance;
    const timer = window.setTimeout(() => setCoinPulse(null), 420);
    return () => window.clearTimeout(timer);
  }, [balance]);

  const soundOn = useSyncExternalStore(subscribeSoundtrack, isSoundtrackOn, () => false);
  const soundAvailable = useSyncExternalStore(
    subscribeSoundtrack,
    isSoundtrackAvailable,
    () => false,
  );
  useEffect(initSoundtrack, []);

  const session = useSyncExternalStore(subscribeAuth, getAuthSession, () => null);

  const [showWelcome, setShowWelcome] = useState(
    () => isAuthAvailable() && !hasChosenSignInMethod(),
  );

  const updateProfile = (next: PlayerProfile) => {
    setProfile(next);
    saveProfile(next);
  };

  // Permintaan pertemanan/undangan room yang BARU SAJA masuk lewat SSE —
  // ditampilkan sebagai popup dari atas layar (`IncomingPopups`) di mana
  // pun pemain sedang berada di app. Data "resmi"-nya tetap di store
  // `friends.ts` (lewat `refreshFriends()`, dipanggil di listener yang
  // sama) — array ini cuma daftar popup yang sedang tampil, dikosongkan
  // begitu ditindak/ditutup/kedaluwarsa.
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestSummary[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<RoomInviteSummary[]>([]);
  const dismissIncomingRequest = (id: string) =>
    setIncomingRequests((current) => current.filter((r) => r.id !== id));
  const dismissIncomingInvite = (id: string) =>
    setIncomingInvites((current) => current.filter((i) => i.id !== id));

  // Saluran notifikasi real-time (Server-Sent Events, `GET /api/events`
  // di server) — dibuka selama app ini terbuka, TIDAK terikat ke ruang
  // permainan mana pun, supaya permintaan pertemanan/undangan room yang
  // masuk langsung terasa (badge + `FriendListScreen` ikut ter-update
  // lewat `refreshFriends()` karena keduanya sama-sama baca dari store
  // `friends.ts`) di mana pun pemain sedang berada di app, tanpa perlu
  // refresh. Dibuka ulang tiap kali `profile.id` berganti (login/logout/
  // account-link) — `EventSource` browser sudah otomatis coba sambung
  // ulang sendiri kalau koneksi putus, jadi tidak perlu logika retry
  // manual di sini.
  useEffect(() => {
    const source = new EventSource(`/api/events?profileId=${encodeURIComponent(profile.id)}`);
    source.addEventListener('friend-request', (event) => {
      const data = JSON.parse((event as MessageEvent).data) as FriendRequestSummary;
      refreshFriends();
      setIncomingRequests((current) => [...current, data]);
    });
    source.addEventListener('room-invite', (event) => {
      const data = JSON.parse((event as MessageEvent).data) as RoomInviteSummary;
      refreshFriends();
      setIncomingInvites((current) => [...current, data]);
    });
    // Presence murni state client-side yang di-patch langsung (beda dari
    // dua listener di atas) — tidak perlu refetch apa pun, lihat
    // `lib/presence.ts`.
    source.addEventListener('presence-update', (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { profileId: string; presence: Presence };
      applyPresenceUpdate(data.profileId, data.presence);
    });
    return () => source.close();
  }, [profile.id]);

  // Konflik "akun ini sudah punya progres di device/sesi lain" (Kasus B
  // spesifikasi akun) — non-`null` berarti `AccountLinkConflictModal` harus
  // ditampilkan. Diisi oleh effect linking di bawah, dikosongkan lagi oleh
  // handler confirm/cancel-nya.
  const [linkConflict, setLinkConflict] = useState<Extract<AccountLinkResult, { conflict: true }>['canonical'] | null>(
    null,
  );
  const [linkBusy, setLinkBusy] = useState(false);

  /** Terapkan hasil link yang TIDAK berkonflik — sama seperti sebelumnya:
   *  cuma menyegarkan wallet/inventory/friends kalau `profileId` benar-benar
   *  berganti (device ini baru saja "menjadi" profil kanonik akun itu). */
  const applyLinkedProfile = (linked: Extract<AccountLinkResult, { conflict: false }>) => {
    if (linked.profileId === profile.id) return;
    updateProfile({
      ...profile,
      id: linked.profileId,
      name: linked.displayName ?? profile.name,
      avatar: linked.avatar ?? profile.avatar,
    });
    void api.wallet().then(applyBalance).catch(() => {});
    void api.inventory().then(applyInventory).catch(() => {});
    refreshFriends();
  };

  // Ditautkan sekali tiap kali akun berbeda login — kalau akun itu sudah
  // pernah dipakai sebelumnya (di perangkat ini atau lain), server membalas
  // `profileId` kanonik akun itu SEKALIGUS `displayName`/`avatar` yang
  // tersimpan untuknya, supaya identitas akun yang dipulihkan ke layar,
  // bukan cuma id-nya yang berganti sementara nama/avatar tetap punya
  // profil device yang lama. `linkedUserId` menjaga supaya ini tidak
  // diulang tiap render selama sesinya masih akun yang sama.
  //
  // Kalau server melaporkan `conflict: true` (akun ini sudah punya progres
  // di device/sesi lain), TIDAK langsung diterapkan — `linkConflict` diisi
  // supaya `AccountLinkConflictModal` tampil dulu, dan progres Guest device
  // ini TIDAK disentuh sama sekali sampai pemain menyetujui lewat modal itu
  // (lihat `confirmLinkConflict`/`cancelLinkConflict` di bawah).
  const linkedUserId = useRef<string | null>(null);
  useEffect(() => {
    const userId = session?.user.id ?? null;
    if (!userId || linkedUserId.current === userId) return;
    linkedUserId.current = userId;
    api
      .linkAccount(profile.name, profile.avatar)
      .then((result) => {
        if (result.conflict) {
          setLinkConflict(result.canonical);
          return;
        }
        applyLinkedProfile(result);
      })
      .catch(() => {});
  }, [session]);

  const confirmLinkConflict = () => {
    if (!linkConflict) return;
    setLinkBusy(true);
    api
      .linkAccount(profile.name, profile.avatar, true)
      .then((result) => {
        if (!result.conflict) applyLinkedProfile(result);
      })
      .catch(() => {})
      .finally(() => {
        setLinkBusy(false);
        setLinkConflict(null);
      });
  };

  // Batal cuma boleh membatalkan TAWARAN login — profil Guest device ini
  // (identitas + progres yang sudah ada SEBELUM mencoba login) harus utuh
  // apa adanya, BUKAN direset ke tamu baru acak. `signOut()` di sini
  // memang memicu transisi `session` non-null→null yang sama seperti
  // logout sungguhan, jadi `skipNextLogoutReset` dipakai menandai effect
  // logout di bawah supaya melewati `resetProfile()`-nya sekali untuk
  // transisi ini saja.
  const skipNextLogoutReset = useRef(false);
  const cancelLinkConflict = () => {
    skipNextLogoutReset.current = true;
    setLinkConflict(null);
    void signOut();
  };

  // Logout tidak boleh sekadar mengosongkan sesi Supabase — `profile.id`
  // di localStorage harus ikut diganti ke tamu baru, kalau tidak permainan
  // "tamu" berikutnya di device ini diam-diam masih tercatat ke akun yang
  // baru saja logout (header `x-player-id` tidak pernah berubah dengan
  // sendirinya). `wasSignedIn` membedakan transisi logout SUNGGUHAN dari
  // render pertama yang memang belum ada sesi sama sekali.
  const wasSignedIn = useRef(false);
  useEffect(() => {
    const signedIn = session !== null;
    const justSignedOut = wasSignedIn.current && !signedIn;
    wasSignedIn.current = signedIn;
    if (!justSignedOut) return;

    linkedUserId.current = null;

    // Lihat komentar `cancelLinkConflict` — transisi ini dipicu OLEH kita
    // sendiri untuk membatalkan tawaran link, bukan logout pemain
    // sungguhan, jadi profil Guest device ini TIDAK boleh direset.
    if (skipNextLogoutReset.current) {
      skipNextLogoutReset.current = false;
      return;
    }

    setProfile(resetProfile());
    void api.wallet().then(applyBalance).catch(() => {});
    void api.inventory().then(applyInventory).catch(() => {});
    refreshFriends();
    setShowProfile(false);
    setShowWelcome(true);
  }, [session]);

  return (
    <div className="app">
      <div className={`shell${route.name === 'home' ? ' shell--wide' : ''}`}>
        <header className="topbar">
          {route.name === 'home' ? (
            <span className="brand">
              <img className="brand__mark" src="/logo.svg" alt="" />
              Wordheat
            </span>
          ) : (
            <button className="btn btn--ghost btn--sm" onClick={() => navigate('/')}>
              <BackIcon />
              Beranda
            </button>
          )}

          <div className="topbar__right">
            {soundAvailable && (
              <button
                className="btn btn--ghost btn--icon"
                onClick={toggleSoundtrack}
                aria-pressed={soundOn}
                aria-label={soundOn ? 'Matikan musik' : 'Nyalakan musik'}
                title={soundOn ? 'Matikan musik' : 'Nyalakan musik'}
              >
                {soundOn ? <SoundOnIcon /> : <SoundOffIcon />}
              </button>
            )}
            <button
              ref={coinChipRef}
              className={`btn btn--ghost btn--sm${coinPulse ? ` coin-chip--${coinPulse}` : ''}`}
              onClick={() => navigate('/shop')}
              aria-label={`Shop — saldo ${balance} coin`}
            >
              <img src="/coin.svg" width={18} height={18} alt="" />
              {balance}
            </button>
            <button
              className="btn btn--ghost btn--sm friends-btn"
              onClick={() => navigate('/teman')}
              aria-label={
                pendingFriendCount > 0
                  ? `Teman — ${pendingFriendCount} menunggu`
                  : 'Teman'
              }
            >
              <UsersIcon />
              <span className="friends-btn__label">Teman</span>
              {pendingFriendCount > 0 && (
                <span className="friends-btn__badge tnum">{pendingFriendCount}</span>
              )}
            </button>
            {isAuthAvailable() && !session && (
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setShowAuth(true)}
                aria-label="Masuk"
              >
                Masuk
              </button>
            )}
            <button
              className="btn btn--ghost avatar-btn"
              onClick={() => setShowProfile(true)}
              aria-label={`Profil saya (sekarang: ${profile.name})`}
            >
              <Avatar config={profile.avatar} size={36} />
            </button>
          </div>
        </header>

        <main>
          {route.name === 'home' && <HomeScreen />}
          {route.name === 'solo' && <SoloScreen key={route.mode} mode={route.mode} />}
          {route.name === 'room' && (
            <RoomScreen key={route.code} code={route.code} profile={profile} />
          )}
          {route.name === 'shop' && <ShopScreen />}
          {route.name === 'leaderboard' && <LeaderboardScreen />}
          {route.name === 'friends' && <FriendListScreen />}
        </main>

        <footer className="footer">
          <p className="caption footer__credit">developed by darren:3</p>
        </footer>
      </div>

      {showWelcome && <WelcomeModal onContinueAsGuest={() => setShowWelcome(false)} />}
      {showProfile && (
        <ProfileModal
          profile={profile}
          onSave={updateProfile}
          onClose={() => setShowProfile(false)}
        />
      )}
      {showAuth && (
        <AuthModal onClose={() => setShowAuth(false)} onSignedIn={() => setShowAuth(false)} />
      )}
      {linkConflict && (
        <AccountLinkConflictModal
          canonical={linkConflict}
          busy={linkBusy}
          onConfirm={confirmLinkConflict}
          onCancel={cancelLinkConflict}
        />
      )}
      <IncomingPopups
        requests={incomingRequests}
        invites={incomingInvites}
        onDismissRequest={dismissIncomingRequest}
        onDismissInvite={dismissIncomingInvite}
      />
      <CoinFxLayer />
    </div>
  );
}
