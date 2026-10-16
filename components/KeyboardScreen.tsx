import React from 'react';
import { KeyboardAvoidingView, type StyleProp, type ViewStyle } from 'react-native';

interface Props {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * A screen with text fields: its content is pushed above the keyboard, on Android too.
 * The app is edge-to-edge on Android (app.json), so the window is no longer resized
 * when the keyboard opens: without this, it covers the field being typed in.
 * Put the fields in a ScrollView inside, so that the focused one scrolls into view.
 */
export default function KeyboardScreen({ style, children }: Props) {
  return (
    <KeyboardAvoidingView style={[{ flex: 1 }, style]} behavior="padding">
      {children}
    </KeyboardAvoidingView>
  );
}
