import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { SnapWidget, TodayWidget } from './android';
import { SNAPSHOT_KEY, type WidgetSnapshot } from './snapshot';

// Runs headless when Android asks a widget to draw. Reads the last snapshot
// the app wrote — never the network.

async function readSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as WidgetSnapshot) : null;
  } catch {
    return null;
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetAction === 'WIDGET_DELETED') return;
  if (props.widgetInfo.widgetName === 'Snap') {
    props.renderWidget(<SnapWidget />);
    return;
  }
  const s = await readSnapshot();
  // A snapshot from yesterday shows zero for today, not stale numbers.
  const today = new Date();
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  props.renderWidget(<TodayWidget s={s && s.day === key ? s : s ? { ...s, day: key, kcal: 0, protein: 0, carbs: 0, fat: 0, pending: 0 } : null} />);
}
