import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetSnapshot } from './snapshot';
import { SNAP_URL } from './snapshot';

// Android home-screen widgets, drawn with react-native-android-widget.
// Both open `realquick://snap?from=widget`: the app opens straight into the
// running camera, snaps, shows "Got it!" and closes itself again.

const INK = '#2B2350';
const BLUSH = '#FF9EB5';
const DAY_BG: `#${string}`[] = ['#CFF2E2', '#FFDCC9', '#E4DCFF', '#FFF1B8', '#FFD8E6', '#D3ECFF', '#E2F0C6'];
const DAY_RING: `#${string}`[] = ['#3FAF82', '#F07E45', '#7C63E0', '#E0A417', '#EC5A8C', '#3F8ED6', '#6FA22E'];

const CAMERA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 8.5C4 7.4 4.9 6.5 6 6.5h1.8l1.3-2h5.8l1.3 2H18c1.1 0 2 .9 2 2V17c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V8.5Z" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><circle cx="12" cy="12.6" r="3.6" fill="none" stroke="${INK}" stroke-width="2.2"/></svg>`;

const fmt = (v: number) => Math.round(v).toLocaleString();

export function SnapWidget() {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: SNAP_URL }}
      accessibilityLabel="Snap food"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: BLUSH,
        borderRadius: 28,
        borderWidth: 3,
        borderColor: INK,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <SvgWidget svg={CAMERA_SVG} style={{ height: 40, width: 40 }} />
    </FlexWidget>
  );
}

export function TodayWidget({ s }: { s: WidgetSnapshot | null }) {
  const bg = DAY_BG[s?.weekday ?? 0];
  const ring = DAY_RING[s?.weekday ?? 0];
  const left = s ? s.goal - s.kcal : 0;
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: bg,
        borderRadius: 28,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <FlexWidget style={{ flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
        <TextWidget text={s?.label.today ?? 'Today'} style={{ fontSize: 13, fontFamily: 'Nunito-ExtraBold', color: INK }} />
        <TextWidget text={s ? fmt(s.kcal) : '–'} style={{ fontSize: 40, fontFamily: 'Fredoka-SemiBold', color: INK }} />
        <TextWidget
          text={s ? `${s.label.of} ${fmt(s.goal)} ${s.unit} · ${left >= 0 ? s.label.left.replace('{n}', fmt(left)) : `+${fmt(-left)}`}` : ''}
          style={{ fontSize: 12, fontFamily: 'Nunito-ExtraBold', color: INK }}
        />
        <TextWidget
          text={s ? `P ${s.protein}g · C ${s.carbs}g · F ${s.fat}g` : ''}
          style={{ fontSize: 12, fontFamily: 'Nunito-ExtraBold', color: ring }}
        />
      </FlexWidget>
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: SNAP_URL }}
        accessibilityLabel={s?.label.snap ?? 'Snap'}
        style={{
          height: 64,
          width: 64,
          backgroundColor: BLUSH,
          borderRadius: 32,
          borderWidth: 3,
          borderColor: INK,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <SvgWidget svg={CAMERA_SVG} style={{ height: 30, width: 30 }} />
      </FlexWidget>
    </FlexWidget>
  );
}
