import * as React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, CardContent } from '@/components/ui/card';
import { Body, Display, Mono } from '@/components/ui/typography';

type PlaceholderScreenProps = {
  eyebrow: string;
  title: string;
  accent?: string;
  description: string;
  note: string;
  children?: React.ReactNode;
};

export function PlaceholderScreen({
  eyebrow,
  title,
  accent,
  description,
  note,
  children,
}: PlaceholderScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-center gap-6 px-6">
        <Mono>{eyebrow}</Mono>
        <View>
          <Display className="text-4xl leading-tight">{title}</Display>
          {accent ? (
            <Display italic className="text-4xl leading-tight text-accent">
              {accent}
            </Display>
          ) : null}
        </View>
        <Body className="text-muted-foreground">{description}</Body>
        <Card>
          <CardContent className="pt-6">
            <Body className="text-sm text-muted-foreground">{note}</Body>
          </CardContent>
        </Card>
        {children}
      </View>
    </SafeAreaView>
  );
}
