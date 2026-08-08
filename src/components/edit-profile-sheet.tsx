import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import * as React from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Body, Mono } from '@/components/ui/typography';
import { getMe } from '@/lib/seed';
import { saveProfile, usePersistedState } from '@/lib/store';
import { cn } from '@/lib/utils';

export type EditProfileSheetHandle = { present: () => void };

/** Same three options onboarding's looking-for step offers — one place, same wording either time. */
const LOOKING_FOR_OPTIONS = ['Date', 'Friends', 'See where it goes'] as const;

/**
 * The You tab's edit sheet — name and dating preference, the two profile
 * fields that make sense to revisit after onboarding. Age and campus stay
 * fixed once set; nothing else on the You tab needed its own editor.
 */
const EditProfileSheet = React.forwardRef<EditProfileSheetHandle>(
  function EditProfileSheet(_props, ref) {
    const sheetRef = React.useRef<BottomSheetModal>(null);
    const { profile } = usePersistedState();
    const [name, setName] = React.useState(getMe().name);
    const [lookingFor, setLookingFor] = React.useState<string | null>(
      profile.lookingFor ?? null,
    );

    React.useImperativeHandle(ref, () => ({
      present: () => {
        // Re-seed the draft from the current values every time the sheet opens,
        // so a dismissed-without-saving edit never lingers into the next open.
        setName(getMe().name);
        setLookingFor(profile.lookingFor ?? null);
        sheetRef.current?.present();
      },
    }));

    const save = () => {
      const trimmed = name.trim();
      if (trimmed) saveProfile({ name: trimmed, lookingFor });
      sheetRef.current?.dismiss();
    };

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['50%']}
        backgroundStyle={{ backgroundColor: '#1B1815' }}
        handleIndicatorStyle={{ backgroundColor: '#8B857A' }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
          />
        )}
      >
        <BottomSheetView className="gap-5 px-5 pb-8 pt-2">
          <Mono className="px-1">Edit profile</Mono>

          <View className="gap-2">
            <Mono>Name</Mono>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your first name"
              placeholderClassName="text-muted-foreground"
              autoCapitalize="words"
              className="rounded-2xl border border-border bg-card px-4 py-3 font-body text-lg text-foreground"
            />
          </View>

          <View className="gap-2">
            <Mono>Looking for</Mono>
            <View className="flex-row flex-wrap gap-2">
              {LOOKING_FOR_OPTIONS.map((option) => {
                const selected = lookingFor === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setLookingFor(option)}
                    className={cn(
                      'rounded-full border px-4 py-2.5 active:opacity-80',
                      selected
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-card',
                    )}
                  >
                    <Body
                      className={selected ? 'text-accent' : 'text-foreground'}
                    >
                      {option}
                    </Body>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Button size="lg" onPress={save} disabled={name.trim().length === 0}>
            <Text>Save</Text>
          </Button>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

export { EditProfileSheet };
