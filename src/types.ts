type AppStateType = {
  x0: number;
  y0: number;
  eps: number;
  ratio_x: number;
  ratio_y: number;
  n: number;
  max_iter: number;
  escape_radius: number;
  threshold: number;
  isDarkMode: boolean;
  isRendering: boolean;
  fastRender: boolean;
  useCaching: boolean;
};

interface AppActionsType {
  startRender: () => void;
  cancelRender: () => void;
  toggleDarkMode: () => void;
  updateValue: (key: keyof AppStateType, value: any) => void;
}

export type { AppStateType, AppActionsType };