import { create } from 'zustand';

interface StaffDraftState {
  permissions: string[];
  setPermissions: (permissions: string[]) => void;
  reset: () => void;
}

/**
 * Ephemeral (non-persisted) scratch space for the Create/Edit Staff screens to
 * hand a draft permission selection to the dedicated Permissions screen and
 * back, without prop-drilling across stack routes.
 */
export const useStaffDraftStore = create<StaffDraftState>((set) => ({
  permissions: [],
  setPermissions: (permissions) => set({ permissions }),
  reset: () => set({ permissions: [] }),
}));
