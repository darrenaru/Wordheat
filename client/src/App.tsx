import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { FriendsPayload, PlayerProfile } from '@shared/types.ts';
import { api } from './lib/api.ts';
import { registerCoinFxOrigin } from './lib/coinFx.ts';
import { getFriends, subscribeFriends } from './lib/friends.ts';
import { applyInventory } from './lib/inventory.ts';
import { hasChosenSignInMethod, loadProfile, saveProfile } from './lib/profile.ts';
import { navigate, useRoute } from './lib/router.ts';
import {
  initSoundtrack,
  isSoundtrackAvailable,
  isSoundtrackOn,
  subscribeSoundtrack,
  toggleSoundtrack,
} from './lib/soundtrack.ts';
import { getAuthSession, isAuthAvailable, subscribeAuth } from './lib/supabase.ts';
import { applyBalance, getBalance, subscribeWallet } from './lib/wallet.ts';
import { Avatar } from './components/Avatar.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { CoinFxLayer } from './components/CoinFx.tsx';
import { ProfileModal } from './components/ProfileModal.tsx';
import { BackIcon, HelpIcon, SoundOffIcon, SoundOnIcon, UsersIcon } from './components/ui.tsx';
import { WelcomeModal } from './components/WelcomeModal.tsx';
import { FriendListScreen } from './screens/FriendListScreen.tsx';
import { HomeScreen } from './screens/HomeScreen.tsx';
import { LeaderboardScreen } from './screens/LeaderboardScreen.tsx';
import { RoomScreen } from './screens/RoomScreen.tsx';
import { RulesModal } from './screens/RulesModal.tsx';
import { ShopScreen } from './screens/ShopScreen.tsx';
import { SoloScreen } from './screens/SoloScreen.tsx';

const EMPTY_FRIENDS: FriendsPayload = { friends: [], incoming: [], outgoing: [], invites: [] };

export function App() {
  const route = useRoute();
  const [profile, setProfile] = useState<PlayerProfile>(loadProfile);
  const [showRules, setShowRules] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const balance = useSyncExternalStore(subscribeWallet, getBalance, () => 0);
  const friendsPayload = useSyncExternalStore(subscribeFriends, getFriends, () => EMPTY_FRIENDS);
  const pendingFriendCount = friendsPayload.incoming.length + friendsPayload.invites.length;
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

  // Ditautkan sekali tiap kali akun berbeda login — kalau akun itu sudah
  // pernah dipakai sebelumnya (di perangkat ini atau lain), server membalas
  // `profileId` kanonik akun itu SEKALIGUS `displayName`/`avatar` yang
  // tersimpan untuknya, supaya identitas akun yang dipulihkan ke layar,
  // bukan cuma id-nya yang berganti sementara nama/avatar tetap punya
  // profil device yang lama. `linkedUserId` menjaga supaya ini tidak
  // diulang tiap render selama sesinya masih akun yang sama.
  const linkedUserId = useRef<string | null>(null);
  useEffect(() => {
    const userId = session?.user.id ?? null;
    if (!userId || linkedUserId.current === userId) return;
    linkedUserId.current = userId;
    api
      .linkAccount(profile.name, profile.avatar)
      .then((linked) => {
        if (linked.profileId === profile.id) return;
        updateProfile({
          ...profile,
          id: linked.profileId,
          name: linked.displayName ?? profile.name,
          avatar: linked.avatar ?? profile.avatar,
        });
        void api.wallet().then(applyBalance).catch(() => {});
        void api.inventory().then(applyInventory).catch(() => {});
      })
      .catch(() => {});
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
              className="btn btn--ghost btn--icon"
              onClick={() => setShowRules(true)}
              aria-label="Cara bermain"
            >
              <HelpIcon />
            </button>
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
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
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
      <CoinFxLayer />
    </div>
  );
}
