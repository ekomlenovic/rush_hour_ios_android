import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AdminSettings, AdminSettingsPatch, MultiApi } from '@/utils/multi/api';
import { multiErrorMessage } from '../errors';
import { useAdminRefresh } from './AdminPage';

/** The settings of the server, for a page of them: loaded, pulled again, changed at once */
export function useAdminSettings(api: MultiApi) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AdminSettings | null>(null);

  const load = useCallback(async () => {
    try {
      setSettings(await api.admin.settings());
    } catch (e) {
      Alert.alert(t('common.error'), multiErrorMessage(t, e));
    }
  }, [api, t]);

  useEffect(() => { void load(); }, [load]);
  useAdminRefresh(load);

  /** The new settings, or null when refused (already told) */
  const update = useCallback(async (patch: AdminSettingsPatch) => {
    try {
      const next = await api.admin.updateSettings(patch);
      setSettings(next);
      return next;
    } catch (e) {
      Alert.alert(t('common.error'), multiErrorMessage(t, e));
      return null;
    }
  }, [api, t]);
  const save = useCallback((patch: AdminSettingsPatch) => { void update(patch); }, [update]);

  return { settings, update, save };
}
