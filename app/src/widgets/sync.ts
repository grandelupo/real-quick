import React from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from '../i18n';
import { getState, onChange } from '../store';
import { APP_GROUP, SNAPSHOT_KEY, buildSnapshot, type WidgetSnapshot } from './snapshot';

// Pushes the snapshot to the platform's widgets, debounced so a burst of
// edits costs one reload, and skipped entirely when nothing visible changed.

let last = '';
let timer: ReturnType<typeof setTimeout> | null = null;

function labels(): WidgetSnapshot['label'] {
  return { of: t('of'), left: t('left'), snap: t('snapA11y'), today: t('today') };
}

async function push() {
  const snap = buildSnapshot(getState(), labels());
  const json = JSON.stringify(snap);
  if (json === last) return;
  last = json;
  try {
    if (Platform.OS === 'ios') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ExtensionStorage } = require('@bacons/apple-targets') as typeof import('@bacons/apple-targets');
      const storage = new ExtensionStorage(APP_GROUP);
      storage.set(SNAPSHOT_KEY, json);
      ExtensionStorage.reloadWidget();
    } else if (Platform.OS === 'android') {
      await AsyncStorage.setItem(SNAPSHOT_KEY, json);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { requestWidgetUpdate } = require('react-native-android-widget') as typeof import('react-native-android-widget');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { TodayWidget } = require('./android') as typeof import('./android');
      await requestWidgetUpdate({ widgetName: 'Today', renderWidget: () => React.createElement(TodayWidget, { s: snap }) });
    }
  } catch {
    // widgets are a bonus surface; never break the app over them
  }
}

export function startWidgetSync() {
  onChange(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void push(), 1200);
  });
  void push();
}
