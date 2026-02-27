/**
 * Manual mock for react-native used by Jest.
 * Only the APIs actually referenced by non-component code are stubbed here.
 */

export const Platform = {
  OS: "ios",
  select: (obj: Record<string, any>) => obj.ios ?? obj.default,
};

export const AppState = {
  currentState: "active",
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
};

export const NativeModules = {};
export const NativeEventEmitter = jest.fn().mockImplementation(() => ({
  addListener: jest.fn(),
  removeListeners: jest.fn(),
}));
