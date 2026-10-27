import { Dimensions, Platform } from 'react-native';

/**
 * The web version on a big screen (computer, tablet): the game stays a phone, a column of at most
 * WEB_MAX_WIDTH in the middle of the page (#root and the modals in public/index.html). The game
 * sizes itself on the width of the window (RFValue, the board, the map): it reads the column's
 * instead, else a 2000 px wide window drew a 2000 px board. Imported first by the root layout,
 * before anything reads the size of the window. Nothing on iOS and Android.
 */
export const WEB_MAX_WIDTH = 480;

type Size = ReturnType<typeof Dimensions.get>;
type Change = { window: Size; screen: Size };
type Handler = (change: Change) => void;

const column = (window: Size): Size => (window.width > WEB_MAX_WIDTH ? { ...window, width: WEB_MAX_WIDTH } : window);

if (Platform.OS === 'web') {
  const get = Dimensions.get.bind(Dimensions);
  const add = Dimensions.addEventListener.bind(Dimensions);
  const remove = (Dimensions as unknown as { removeEventListener?: (type: string, handler: Handler) => void }).removeEventListener?.bind(Dimensions);
  const wrapped = new WeakMap<Handler, Handler>();

  Dimensions.get = ((dimension: 'window' | 'screen') => (dimension === 'window' ? column(get('window')) : get(dimension))) as typeof Dimensions.get;
  Dimensions.addEventListener = ((type: 'change', handler: Handler) => {
    const inColumn: Handler = change => handler({ ...change, window: column(change.window) });
    wrapped.set(handler, inColumn);
    return add(type, inColumn as never);
  }) as typeof Dimensions.addEventListener;
  // useWindowDimensions of react-native-web unsubscribes with its own handler
  if (remove) {
    (Dimensions as unknown as { removeEventListener: (type: string, handler: Handler) => void }).removeEventListener =
      (type, handler) => remove(type, wrapped.get(handler) ?? handler);
  }
}
