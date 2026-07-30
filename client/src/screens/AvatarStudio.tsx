import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { AvatarConfig } from '@shared/types.ts';
import {
  AVATAR_BACKGROUNDS,
  AVATAR_PART_NONE,
  avatarEngineVersion,
  avatarKey,
  avatarParts,
  avatarResolvedParts,
  ensureAvatarEngine,
  randomAvatar,
  subscribeAvatarEngine,
  surfaceHexColor,
  withPart,
  type AvatarPart,
} from '../lib/avatar.ts';
import { Avatar } from '../components/Avatar.tsx';
import {
  CheckIcon,
  DiceIcon,
  DropletIcon,
  EarringIcon,
  EyebrowIcon,
  EyeIcon,
  GlassesIcon,
  HairIcon,
  Modal,
  MouthIcon,
  SparkleIcon,
  UndoIcon,
} from '../components/ui.tsx';

/** Satu ikon per bagian, dipakai di baris tab — supaya sembilan tab teks
 *  polos yang terlihat mirip semua tidak perlu dibedakan cuma lewat kata. */
const PART_ICONS: Record<string, () => JSX.Element> = {
  hair: HairIcon,
  hairColor: DropletIcon,
  eyebrows: EyebrowIcon,
  eyes: EyeIcon,
  mouth: MouthIcon,
  skinColor: DropletIcon,
  glasses: GlassesIcon,
  earrings: EarringIcon,
  features: SparkleIcon,
};

/** `hairColor` digabung ke tab "Rambut" (sama-sama soal rambut), `skinColor`
 *  digabung ke tab "Detail wajah" (features) — sisanya memetakan ke dirinya
 *  sendiri (satu tab = satu bagian, seperti semula). */
const TAB_GROUP_OF: Record<string, string> = { hairColor: 'hair', skinColor: 'features' };

interface TabGroup {
  key: string;
  label: string;
  parts: AvatarPart[];
}

function groupParts(parts: AvatarPart[]): TabGroup[] {
  const groups: TabGroup[] = [];
  const byKey = new Map<string, TabGroup>();
  for (const part of parts) {
    const groupKey = TAB_GROUP_OF[part.key] ?? part.key;
    let group = byKey.get(groupKey);
    if (!group) {
      // Label tab pakai punya bagian PERTAMA dalam grup (mis. "Rambut", bukan
      // "Warna rambut") — itulah yang tampil sebagai teks tab.
      group = { key: groupKey, label: parts.find((p) => p.key === groupKey)?.label ?? part.label, parts: [] };
      byKey.set(groupKey, group);
      groups.push(group);
    }
    group.parts.push(part);
  }
  return groups;
}

/**
 * Palet latar, ditambah warna yang sedang dipakai bila kebetulan sudah tidak
 * ada di daftar. Profil yang dibuat sebelum palet berubah tetap sah — tanpa ini
 * pemiliknya membuka studio dan melihat tidak ada satu pun warna yang tersorot.
 */
function backgroundChoices(current: string): string[] {
  return AVATAR_BACKGROUNDS.includes(current)
    ? AVATAR_BACKGROUNDS
    : [current, ...AVATAR_BACKGROUNDS];
}

interface AvatarStudioProps {
  avatar: AvatarConfig;
  onSave(avatar: AvatarConfig): void;
  onClose(): void;
}

export function AvatarStudio({ avatar: initial, onSave, onClose }: AvatarStudioProps) {
  const [draft, setDraft] = useState<AvatarConfig>(initial);

  // Daftar bagian ikut dalam chunk DiceBear yang dimuat terpisah; berlangganan
  // supaya panelnya muncul begitu chunk-nya siap.
  useSyncExternalStore(subscribeAvatarEngine, avatarEngineVersion, () => 0);
  ensureAvatarEngine();
  const parts = avatarParts();
  const groups = parts ? groupParts(parts) : null;

  // Bagian yang benar-benar terpakai, termasuk yang dipilih seed. Inilah yang
  // membuat nomor pilihan dan tombol panah tetap benar walau belum dipatok.
  const resolved = avatarResolvedParts(draft);

  const [activeKey, setActiveKey] = useState<string | null>(null);
  useEffect(() => {
    if (groups && groups.length > 0 && activeKey === null) setActiveKey(groups[0].key);
  }, [groups, activeKey]);

  // Di layar sempit baris tab jadi satu baris yang digulir mendatar (lihat
  // `.parts__tabs` di `game.css`) — tanpa ini, berpindah bagian lewat panah
  // ↑ ↓ bisa membuat tab yang aktif keluar layar tanpa isyarat sama sekali.
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tabsRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeKey]);

  const activeGroup = groups?.find((group) => group.key === activeKey) ?? null;
  // Tab "Rambut" membungkus dua bagian (gaya + warna) — panah kiri/kanan cuma
  // menyusuri bagian PERTAMA di grup itu (gaya rambut), bukan warnanya. Warna
  // tetap bisa diganti lewat klik langsung ke swatch-nya.
  const active = activeGroup?.parts[0] ?? null;

  const setAvatar = (next: AvatarConfig) => setDraft(next);
  const pick = (key: string, value: string | null) => setAvatar(withPart(draft, key, value));

  const dirty = avatarKey(draft) !== avatarKey(initial);

  /**
   * Varian yang sedang tampil untuk sebuah bagian: yang dipatok kalau ada,
   * kalau tidak yang dipilih seed. `null` berarti bagian itu sedang kosong.
   */
  const currentValue = (part: AvatarPart): string | null => {
    const pinned = draft.parts?.[part.key];
    if (pinned === AVATAR_PART_NONE) return null;
    return pinned ?? resolved?.[part.key] ?? null;
  };

  const stepOption = (part: AvatarPart, delta: number) => {
    const current = currentValue(part);
    const index = current ? part.values.indexOf(current) : -1;
    const next =
      index < 0
        ? delta > 0
          ? 0
          : part.values.length - 1
        : (index + delta + part.values.length) % part.values.length;
    pick(part.key, part.values[next]);
  };

  const stepPart = (delta: number) => {
    if (!groups || !activeGroup) return;
    const index = groups.findIndex((group) => group.key === activeGroup.key);
    setActiveKey(groups[(index + delta + groups.length) % groups.length].key);
  };

  /**
   * Panah dipasang di seluruh studio, bukan hanya panel pilihan, supaya bisa
   * dipakai tepat setelah membuka modal.
   */
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement) return;
    if (!active) return;

    const moves: Record<string, () => void> = {
      ArrowRight: () => stepOption(active, 1),
      ArrowLeft: () => stepOption(active, -1),
      ArrowDown: () => stepPart(1),
      ArrowUp: () => stepPart(-1),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    move();
  };

  return (
    <Modal
      title="Ubah Avatar"
      onClose={onClose}
      wide
      bodyClassName="studio__body"
      footer={
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn--secondary" onClick={onClose}>
            Batal
          </button>
          <button
            className="btn btn--primary"
            style={{ flex: 1 }}
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            Simpan
          </button>
        </div>
      }
    >
      <div className="studio" onKeyDown={onKeyDown}>
        <div className="studio__side">
          <div className="studio__preview">
            <div className="studio__preview-ring">
              <Avatar config={draft} size={196} square alt="Pratinjau avatar" />
            </div>
          </div>

          <div className="studio__actions">
            <button
              className="btn btn--secondary btn--block"
              onClick={() => setAvatar(randomAvatar())}
            >
              <DiceIcon />
              Acak semua
            </button>
            <p className="caption studio__actions-hint">
              Acak semua akan memilih kombinasi secara acak dari semua kategori.
            </p>

            <button
              className="btn btn--ghost btn--block btn--sm"
              onClick={() => setDraft(initial)}
              disabled={!dirty}
              title={dirty ? 'Buang perubahan yang belum disimpan' : 'Belum ada perubahan'}
            >
              <UndoIcon />
              Kembalikan
            </button>
          </div>
        </div>

        <div className="studio__main">
          {groups === null ? (
            <p className="empty">Menyiapkan pilihan avatar...</p>
          ) : (
            <>
              <div
                ref={tabsRef}
                className="parts__tabs"
                role="tablist"
                aria-label="Bagian karakter"
              >
                {groups.map((group) => {
                  const PartIcon = PART_ICONS[group.key];
                  return (
                    <button
                      key={group.key}
                      role="tab"
                      className="parts__tab"
                      aria-selected={group.key === activeKey}
                      onClick={() => setActiveKey(group.key)}
                    >
                      {PartIcon && <PartIcon />}
                      {group.label}
                    </button>
                  );
                })}
              </div>

              <div className="studio__intro">
                <h3>Kustomisasi Avatar</h3>
                <p className="caption">Sesuaikan avatar sesuai gayamu!</p>
              </div>

              {/* Terpisah dari baris tab di atas: di layar sempit cuma bagian ini
                  yang menggulir (lihat `.studio__scroll` di `game.css`), supaya
                  tab pemilih bagian selalu terlihat dan bisa diklik kapan saja —
                  tanpa bergantung pada `position: sticky`, yang di percobaan
                  sebelumnya malah memicu bug rendering di WebKit mobile. */}
              <div className="studio__scroll">
                {activeGroup?.parts.map((part) => (
                  <PartPanel
                    key={part.key}
                    part={part}
                    avatar={draft}
                    current={currentValue(part)}
                    pinned={draft.parts?.[part.key]}
                    onPick={(value) => pick(part.key, value)}
                    onShuffle={() => {
                      const current = currentValue(part);
                      const pool = part.values.filter((value) => value !== current);
                      pick(part.key, pool[Math.floor(Math.random() * pool.length)]);
                    }}
                  />
                ))}

                <div className="field">
                  <span className="field__label">Warna latar</span>
                  <div className="swatches">
                    {backgroundChoices(draft.backgroundColor).map((color) => (
                      <button
                        key={color}
                        className="swatch"
                        style={{ background: `#${color}` }}
                        aria-pressed={draft.backgroundColor === color}
                        aria-label={`Latar #${color}`}
                        onClick={() => setAvatar({ ...draft, backgroundColor: color })}
                      />
                    ))}
                  </div>
                </div>

                <p className="caption studio__hint">
                  Panah ← → berpindah pilihan, ↑ ↓ berpindah bagian.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ bagian */

interface PartPanelProps {
  part: AvatarPart;
  avatar: AvatarConfig;
  /** Varian yang sedang tampil, atau `null` bila bagian ini kosong. */
  current: string | null;
  /** Nilai yang dipatok pemain. `undefined` berarti masih mengikuti seed. */
  pinned: string | undefined;
  onPick(value: string | null): void;
  onShuffle(): void;
}

function PartPanel({ part, avatar, current, pinned, onPick, onShuffle }: PartPanelProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  // Menyusuri 45 rambut dengan panah tidak ada gunanya kalau pilihan yang aktif
  // berada di luar area gulir.
  //
  // Tapi jangan pada pemasangan pertama: komponen ini di-key per bagian, jadi
  // membuka studio atau berpindah tab akan langsung menggulir modal dan
  // mendorong baris tab keluar dari pandangan.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    gridRef.current
      ?.querySelector('[data-current="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  const index = current ? part.values.indexOf(current) : -1;
  const keterangan = current
    ? `${part.kind === 'color' ? `#${current}` : current} · ${index + 1} dari ${part.values.length}`
    : 'Tanpa';

  return (
    <div className="parts__panel" role="tabpanel" aria-label={part.label}>
      <div className="parts__head">
        <div className="parts__head-text">
          <span className="parts__head-label">{part.label}</span>
          <span className="caption tnum">
            {keterangan}
            {pinned === undefined && ' · dari acak'}
          </span>
        </div>
        <button
          className="btn btn--ghost btn--icon"
          onClick={onShuffle}
          aria-label={`Acak ${part.label.toLowerCase()}`}
          title={`Acak ${part.label.toLowerCase()}`}
        >
          <DiceIcon />
        </button>
      </div>

      <div
        ref={gridRef}
        className={part.kind === 'color' ? 'swatches' : 'parts__grid'}
        role="group"
        aria-label={`Pilihan ${part.label.toLowerCase()}`}
      >
        <button
          className={
            part.kind === 'color' ? 'swatch swatch--auto' : 'parts__option parts__option--text'
          }
          aria-pressed={pinned === undefined}
          onClick={() => onPick(null)}
          title="Ikut hasil acak"
        >
          {part.kind === 'color' ? <DiceIcon /> : 'Acak'}
        </button>

        {part.optional && (
          <button
            className="parts__option parts__option--text"
            aria-pressed={pinned === AVATAR_PART_NONE}
            onClick={() => onPick(AVATAR_PART_NONE)}
          >
            Tanpa
          </button>
        )}

        {part.values.map((value) => {
          const isCurrent = value === current;
          const shared = {
            'aria-pressed': pinned === value,
            // Menandai varian yang sedang tampil meski belum dipatok — tanpa ini
            // pemain di mode "Acak" tidak punya petunjuk sedang di mana.
            'data-current': isCurrent || undefined,
            tabIndex: isCurrent ? 0 : -1,
            onClick: () => onPick(value),
          };

          const isPinned = pinned === value;

          return part.kind === 'color' ? (
            <button
              key={value}
              {...shared}
              className="swatch"
              style={{ background: `#${value}` }}
              aria-label={`${part.label} #${value}`}
            >
              {isPinned && (
                <span className="option-badge" aria-hidden="true">
                  <CheckIcon />
                </span>
              )}
            </button>
          ) : (
            <button
              key={value}
              {...shared}
              className="parts__option"
              aria-label={`${part.label} ${value}`}
            >
              {/* Pratinjau memakai avatar yang sedang dirakit, hanya bagian ini
                  yang ditukar — jadi pemain melihat pilihannya di wajahnya
                  sendiri, bukan di wajah contoh. Latarnya disamakan dengan
                  ubinnya supaya warna latar pilihan pemain tidak menyamarkan
                  bedanya, dan karakternya seolah digambar langsung di ubin. */}
              <Avatar
                config={{
                  ...withPart(avatar, part.key, value),
                  backgroundColor: surfaceHexColor(),
                }}
                size={60}
              />
              {isPinned && (
                <span className="option-badge" aria-hidden="true">
                  <CheckIcon />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
