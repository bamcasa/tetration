<script lang="ts">
  import Canvas from "./components/Canvas.svelte";
  import Controls from "./components/Controls.svelte";

  import { onMount } from "svelte";
  import { writable } from "svelte/store";

  import type { AppStateType, AppActionsType } from "./types";

  // 상태를 저장소(store)로 관리
  const appState = writable<AppStateType>({
    x0:
      Math.floor(Math.random() * (Math.random() < 0.5 ? -1 : 1) * 10 ** 5) /
      10 ** 5,
    y0:
      Math.floor(Math.random() * (Math.random() < 0.5 ? -1 : 1) * 10 ** 5) /
      10 ** 5,
    eps: Math.floor(Math.random() * 10 ** 5) / 10 ** 5,
    ratio_x: 1,
    ratio_y: 1,
    n: 854,
    max_iter: 500,
    escape_radius: 1e10,
    threshold: 1e-10,
    batchSize: 10,
    isDarkMode: true,
    isRendering: false,
    fastRender: false,
    useCaching: true,
  });

  // 공통 상태 업데이트 함수들
  const appActions: AppActionsType = {
    startRender: () => {
      // console.log("렌더링 시작(isRendering: true)");
      appState.update((state) => {
        const newState = { ...state, isRendering: true };
        // console.log("새 상태:", newState);
        return newState;
      });
    },
    cancelRender: () => {
      // console.log("렌더링 취소(isRendering: false)");
      appState.update((state) => {
        const newState = { ...state, isRendering: false };
        // console.log("새 상태:", newState);
        return newState;
      });
    },
    toggleDarkMode: () => {
      appState.update((state) => {
        const newState = { ...state, isDarkMode: !state.isDarkMode };
        // console.log("다크모드 토글:", newState.isDarkMode);
        return newState;
      });
    },
    updateValue: (key: keyof AppStateType, value: any) => {
      console.log(`${key} 업데이트:`, value);
      appState.update((state) => {
        const newState = { ...state, [key]: value };
        console.log("새 상태:", newState);
        return newState;
      });
    },
  };

  onMount(() => {
    if (window.innerWidth < 768) {
      appActions.updateValue("n", window.innerWidth - 16);
    }
  });
</script>

<div class="container">
  <Canvas {appState} {appActions} />
  <Controls {appState} {appActions} />
</div>

<style>
  .container {
    display: flex;
    padding: 0.5rem;
    gap: 0.75rem;
    flex-direction: column;
    font-family: sans-serif;
  }

  @media (min-width: 768px) {
    .container {
      flex-direction: row;
    }
  }
</style>
