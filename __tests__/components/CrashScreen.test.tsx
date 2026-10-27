import './setup';
import React from 'react';
import { Alert, Text } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import i18n from '@/utils/i18n';
import CrashScreen, { crashDetails } from '@/components/CrashScreen';
import { ErrorBoundary } from '@/app/_layout';
import { decodeSave } from '@/utils/saveTransfer';
import { useGameStore } from '@/store/gameStore';

const error = Object.assign(new Error('boom'), { stack: 'Error: boom\n    at GameScreen' });

describe('CrashScreen (ErrorBoundary of the root layout)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('is the ErrorBoundary exported by the root layout: a render that throws never gives a blank screen', () => {
    expect(ErrorBoundary).toBe(CrashScreen);
  });

  it('explains that the progress is safe and offers to try again', async () => {
    const retry = jest.fn(async () => {});
    await render(<CrashScreen error={error} retry={retry} />);
    expect(screen.getByRole('header', { name: i18n.t('crash.title') })).toBeTruthy();
    expect(screen.getByText(i18n.t('crash.body'))).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: i18n.t('crash.retry_btn') }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('exports the save as a file when the device can share files', async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValueOnce(true);
    await render(<CrashScreen error={error} retry={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('crash.export_btn') }));

    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledTimes(1));
    expect(jest.mocked(Sharing.shareAsync).mock.calls[0][0]).toMatch(/rush-hours-\d{4}-\d{2}-\d{2}\.rushsave$/);
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
  });

  it('copies the save code instead when the device cannot share files', async () => {
    useGameStore.setState({ currentStreak: 4, bestStreak: 4 });
    await render(<CrashScreen error={error} retry={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('crash.export_btn') }));

    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1));
    const save = decodeSave(jest.mocked(Clipboard.setStringAsync).mock.calls[0][0]);
    expect(typeof save).toBe('object');
    expect((save as { state: Record<string, unknown> }).state.currentStreak).toBe(4);
    expect(Alert.alert).toHaveBeenCalledWith(i18n.t('save.copied_title'), i18n.t('save.copied_body'));
  });

  it('says so when the save cannot be exported, instead of crashing again', async () => {
    const getState = jest.spyOn(useGameStore, 'getState').mockImplementation(() => { throw new Error('broken store'); });
    await render(<CrashScreen error={error} retry={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('crash.export_btn') }));
    getState.mockRestore();

    expect(Alert.alert).toHaveBeenCalledWith(i18n.t('crash.export_failed_title'), i18n.t('crash.export_failed_body'));
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
  });

  it('copies the error details for a bug report (nothing is sent)', async () => {
    await render(<CrashScreen error={error} retry={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('crash.copy_error_btn') }));

    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith(crashDetails(error)));
    expect(crashDetails(error)).toBe('Error: boom\nError: boom\n    at GameScreen');
  });
});

describe('a screen that throws', () => {
  it('shows the oops screen of the root layout, and Try again renders it again', async () => {
    const { renderRouter } = require('expo-router/testing-library');
    jest.spyOn(console, 'error').mockImplementation(() => {});
    let crash = true;
    const Home = () => {
      if (crash) throw new Error('boom');
      return <Text>{'home'}</Text>;
    };
    await renderRouter({ _layout: require('@/app/_layout'), index: Home }, { initialUrl: '/' });
    expect(screen.getByText(i18n.t('crash.title'))).toBeTruthy();

    crash = false;
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('crash.retry_btn') }));
    await waitFor(() => expect(screen.getByText('home')).toBeTruthy());
  });
});
