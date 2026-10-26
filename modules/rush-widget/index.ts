import { requireOptionalNativeModule } from 'expo';

/** Native side of the home screen widget (issue 151): absent in Expo Go, on the web and in the tests */
interface RushWidgetModule {
  /** Saves what the widget shows (utils/widget.ts) where the widget reads it, then redraws it */
  setData(json: string): void;
}

const RushWidget = requireOptionalNativeModule<RushWidgetModule>('RushWidget');

export const isWidgetAvailable = RushWidget !== null;

export function setWidgetData(json: string): void {
  RushWidget?.setData(json);
}
