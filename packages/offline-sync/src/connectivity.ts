export interface Connectivity {
  isOnline(): Promise<boolean>;
}

export function createMemoryConnectivity(online: boolean): Connectivity {
  return {
    isOnline: async () => online,
  };
}

interface NetInfoState {
  isConnected: boolean | null;
}

interface NetInfoModule {
  fetch(): Promise<NetInfoState>;
}

// shortcut: @react-native-community/netinfo is an optional peer loaded via
// non-literal dynamic import so typecheck passes without it installed
export async function createNetInfoConnectivity(): Promise<Connectivity> {
  const moduleName = '@react-native-community/netinfo';
  const netInfo = (await import(moduleName)).default as NetInfoModule;
  return {
    isOnline: async () => {
      const state = await netInfo.fetch();
      return state.isConnected !== false;
    },
  };
}
