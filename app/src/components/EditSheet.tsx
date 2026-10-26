import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { entryMacros, toUnit, type Entry, type Settings } from '../engine';
import { n, t } from '../i18n';
import { removeEntry, updateEntry } from '../store';
import { deletePhoto } from '../photos';
import { INK_HAIR, INK_SOFT, MACRO } from '../theme';
import { T } from '../ui/kit';
import { Button, Field, SectionTitle, Segmented } from '../ui/controls';
import { Sheet } from './Sheet';

// Fix an entry: rename it, change the portion, or type the calories you know.

const PORTIONS = ['0.5', '0.75', '1', '1.25', '1.5', '2'] as const;
type Portion = (typeof PORTIONS)[number];

export function EditSheet({ entry, visible, settings, onClose }: { entry: Entry | null; visible: boolean; settings: Settings; onClose(): void }) {
  const [title, setTitle] = useState('');
  const [portion, setPortion] = useState<Portion>('1');
  const [kcalText, setKcalText] = useState('');

  useEffect(() => {
    if (!entry) return;
    setTitle(entry.title ?? entry.items[0]?.name ?? entry.text ?? '');
    const match = PORTIONS.find((p) => Math.abs(Number(p) - entry.scale) < 0.01);
    setPortion(match ?? '1');
    setKcalText('');
  }, [entry]);

  if (!entry) return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;

  const ready = entry.status === 'ready';
  const base = entryMacros({ ...entry, scale: 1 });
  const typedKcal = Number(kcalText.replace(',', '.'));
  const shownScale = kcalText && typedKcal > 0 && base.kcal > 0 ? typedKcal / toUnit(base.kcal, settings.unit) : Number(portion);
  const shown = toUnit(base.kcal * shownScale, settings.unit);

  const save = () => {
    updateEntry(entry.id, { title: title.trim() || entry.title, scale: Math.max(0.05, Math.min(20, shownScale)) });
    onClose();
  };

  const remove = () => {
    const gone = removeEntry(entry.id);
    deletePhoto(gone?.photoUri);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.head}>
        {entry.photoUri ? <Image source={{ uri: entry.photoUri }} style={styles.photo} /> : null}
        <View style={{ flex: 1 }}>
          <T v="title" numberOfLines={2}>
            {ready ? `${n(shown)} ${settings.unit}` : t('counting')}
          </T>
          <T v="small" color={INK_SOFT}>
            {t(`addedBy.${entry.source}`)} · {new Date(entry.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          </T>
        </View>
      </View>

      <SectionTitle>{t('name')}</SectionTitle>
      <Field value={title} onChangeText={setTitle} maxLength={60} accessibilityLabel={t('name')} />

      {ready && (
        <>
          <SectionTitle>{t('portion')}</SectionTitle>
          <Segmented
            options={PORTIONS.map((p) => ({ value: p, label: p === '0.5' ? '½' : p === '0.75' ? '¾' : p === '1.25' ? '1¼' : p === '1.5' ? '1½' : `${p}×` }))}
            value={portion}
            onChange={(v) => {
              setPortion(v);
              setKcalText('');
            }}
          />
          <SectionTitle>{t('calories')}</SectionTitle>
          <Field
            value={kcalText}
            onChangeText={(v) => setKcalText(v.replace(/[^0-9.,]/g, ''))}
            keyboardType="numeric"
            placeholder={`${n(toUnit(base.kcal * Number(portion), settings.unit))} ${settings.unit}`}
            accessibilityLabel={t('calories')}
          />
          {entry.items.length > 0 && (
            <>
              <SectionTitle>{t('items')}</SectionTitle>
              {entry.items.map((it, i) => (
                <View key={i} style={styles.item}>
                  <View style={[styles.itemDot, { backgroundColor: [MACRO.protein, MACRO.carbs, MACRO.fat][i % 3] }]} />
                  <T v="body" style={{ flex: 1 }} numberOfLines={1}>
                    {it.name}
                    {it.grams ? <T v="small" color={INK_SOFT}>{`  ${n(it.grams * shownScale)} g`}</T> : null}
                  </T>
                  <T v="label">{n(toUnit(it.kcal * entry.multiplier * shownScale, settings.unit))}</T>
                </View>
              ))}
            </>
          )}
        </>
      )}

      <View style={{ height: 22 }} />
      {ready && <Button label={t('save')} onPress={save} />}
      <View style={{ height: 10 }} />
      <Button label={t('remove')} kind="danger" onPress={remove} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  photo: { width: 72, height: 72, borderRadius: 18 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: INK_HAIR },
  itemDot: { width: 8, height: 8, borderRadius: 4 },
});
