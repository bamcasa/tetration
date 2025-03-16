<script lang="ts">
  import { onMount } from "svelte";

  import type { AppActionsType } from "../types";

  export let appState;
  export let appActions: AppActionsType;

  // 로컬 상태로 입력값 관리 (바인딩 문제 방지)
  let x0Value: number;
  let y0Value: number;
  let epsValue: number;
  let nValue: number;
  let ratioXValue: number;
  let ratioYValue: number;
  let maxIterValue: number;
  let escapeRadiusValue: number;
  let thresholdValue: number;
  let fastRenderValue: boolean;
  let useCachingValue: boolean;

  // 계산된 값들
  $: eps_y = $appState.eps * ($appState.ratio_y / $appState.ratio_x);
  $: nx = $appState.n;
  $: ny = parseInt((nx * ($appState.ratio_y / $appState.ratio_x)).toString());
  $: cacheSize = 0; // 실제 캐시 크기를 가져올 방법이 필요함

  // 컴포넌트 마운트 시 초기값 설정
  onMount(() => {
    // 스토어 값으로 로컬 상태 초기화
    updateLocalValues();
  });

  // 스토어 값 변경 시 로컬 값도 업데이트
  $: if ($appState) {
    updateLocalValues();
  }

  function updateLocalValues() {
    x0Value = $appState.x0;
    y0Value = $appState.y0;
    epsValue = $appState.eps;
    nValue = $appState.n;
    ratioXValue = $appState.ratio_x;
    ratioYValue = $appState.ratio_y;
    maxIterValue = $appState.max_iter;
    escapeRadiusValue = $appState.escape_radius;
    thresholdValue = $appState.threshold;
    fastRenderValue = $appState.fastRender;
    useCachingValue = $appState.useCaching;
  }

  // 각 필드별 값 업데이트 함수들
  function updateX0() {
    appActions.updateValue("x0", x0Value);
  }

  function updateY0() {
    appActions.updateValue("y0", y0Value);
  }

  function updateEps() {
    appActions.updateValue("eps", epsValue);
  }

  function updateN() {
    appActions.updateValue("n", nValue);
  }

  function updateRatioX() {
    appActions.updateValue("ratio_x", ratioXValue);
  }

  function updateRatioY() {
    appActions.updateValue("ratio_y", ratioYValue);
  }

  function updateMaxIter() {
    appActions.updateValue("max_iter", maxIterValue);
  }

  function updateEscapeRadius() {
    appActions.updateValue("escape_radius", escapeRadiusValue);
  }

  function updateThreshold() {
    appActions.updateValue("threshold", thresholdValue);
  }

  function updateFastRender(value: boolean) {
    appActions.updateValue("fastRender", value);
  }

  function updateUseCaching(value: boolean) {
    appActions.updateValue("useCaching", value);
  }

  // 비율 변경 적용
  function applyRatioChanges() {
    updateRatioX();
    updateRatioY();
    updateN();
    appActions.startRender();
  }

  // 캐시 정리
  function clearCache() {
    // 캐시 정리를 위해 캐싱을 껐다 켬
    appActions.updateValue("useCaching", false);
    setTimeout(() => {
      appActions.updateValue("useCaching", true);
      // console.log("캐시 정리 완료");
    }, 100);
  }

  // 렌더링 재시작
  function restartRender() {
    appActions.cancelRender();
    setTimeout(() => {
      appActions.startRender();
    }, 100);
  }
</script>

<div class="controls">
  <div class="header">
    <h2>Our Tetration</h2>
    <button on:click={() => appActions.toggleDarkMode()} class="theme-button">
      {#if $appState.isDarkMode}
        ☀️
      {:else}
        🌙
      {/if}
    </button>
  </div>

  <hr />

  <div class="input-group">
    <label for="x0">x0</label>
    <input
      id="x0"
      bind:value={x0Value}
      on:change={updateX0}
      on:blur={updateX0}
      type="number"
      step="0.01"
    />
    <span class="divider"></span>
    <label for="y0">y0</label>
    <input
      id="y0"
      bind:value={y0Value}
      on:change={updateY0}
      on:blur={updateY0}
      type="number"
      step="0.01"
    />
  </div>
  <div class="input-group">
    <label for="eps">eps</label>
    <input
      id="eps"
      bind:value={epsValue}
      on:change={updateEps}
      on:blur={updateEps}
      type="number"
      step="0.01"
    />
  </div>

  <hr />

  <div class="input-group">
    <label for="n">n</label>
    <input id="n" bind:value={nValue} on:change={updateN} type="number" />
  </div>
  <div class="input-group">
    <label for="ratioX">ratio</label>
    <input
      id="ratioX"
      bind:value={ratioXValue}
      on:change={updateRatioX}
      type="number"
      class="small-input"
    />
    <input
      id="ratioY"
      bind:value={ratioYValue}
      on:change={updateRatioY}
      type="number"
      class="small-input"
    />
    <button on:click={applyRatioChanges} class="destructive-button"
      >Apply</button
    >
  </div>
  <p class="hint">Changing n or ratio requires manual apply.</p>

  <hr />

  <div class="button-group">
    <button on:click={() => appActions.startRender()} class="primary-button"
      >Start Render</button
    >
    <button on:click={() => appActions.cancelRender()} class="primary-button"
      >Cancel Render</button
    >
    <button on:click={restartRender} class="destructive-button">Reset</button>
  </div>

  <hr />

  <div class="checkbox-group">
    <input
      type="checkbox"
      id="fastRender"
      bind:checked={fastRenderValue}
      on:change={() => updateFastRender(fastRenderValue)}
    />
    <div>
      <label for="fastRender">Use random_render (fast ∧ noisy)</label>
      <p class="hint">It renders random coordinate.</p>
    </div>
  </div>

  <div class="checkbox-group">
    <input
      type="checkbox"
      id="useCaching"
      bind:checked={useCachingValue}
      on:change={() => updateUseCaching(useCachingValue)}
    />
    <div>
      <label for="useCaching">Use caching</label>
      <p class="hint">Reuse previously calculated points.</p>
    </div>
  </div>

  <div class="button-group">
    <button on:click={clearCache} class="destructive-button">Clear Cache</button
    >
  </div>

  <hr />

  <details>
    <summary>Advanced Preference</summary>
    <div class="advanced-settings">
      <div class="input-group">
        <label for="max_iter">max_iter</label>
        <input
          id="max_iter"
          bind:value={maxIterValue}
          on:change={updateMaxIter}
          on:blur={updateMaxIter}
          type="number"
        />
      </div>
      <div class="input-group">
        <label for="escape_radius">escape_radius</label>
        <input
          id="escape_radius"
          bind:value={escapeRadiusValue}
          on:change={updateEscapeRadius}
          on:blur={updateEscapeRadius}
          type="number"
        />
      </div>
      <div class="input-group">
        <label for="threshold">threshold</label>
        <input
          id="threshold"
          bind:value={thresholdValue}
          on:change={updateThreshold}
          on:blur={updateThreshold}
          type="number"
        />
      </div>
      <div class="input-group">
        <label for="eps_y">eps_y</label>
        <input id="eps_y" disabled value={eps_y.toFixed(6)} type="number" />
      </div>
      <div class="input-group">
        <label for="nx">nx</label>
        <input id="nx" disabled value={nx} type="number" />
        <span class="divider"></span>
        <label for="ny">ny</label>
        <input id="ny" disabled value={ny} type="number" />
      </div>
      <div class="input-group">
        <label for="cache_size">Cache Size</label>
        <input id="cache_size" disabled value={cacheSize} type="number" />
      </div>
    </div>
  </details>

  <div class="render-status">
    <div class="status-indicator" class:active={$appState.isRendering}></div>
    <span>{$appState.isRendering ? "Rendering..." : "Render stopped"}</span>
  </div>
</div>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .header {
    display: flex;
    flex-direction: row;
    gap: 0.5rem;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    font-weight: 600;
    font-size: 1.125rem;
    margin: 0.25rem 0;
  }

  hr {
    margin: 0.25rem 0;
    border: none;
    border-top: 1px solid #ccc;
  }

  .input-group {
    display: flex;
    flex-direction: row;
    gap: 0.5rem;
    align-items: center;
  }

  label {
    font-weight: 600;
  }

  input {
    padding: 0.375rem;
    border: 1px solid #ccc;
    border-radius: 0.25rem;
  }

  .small-input {
    width: 4rem;
  }

  .divider {
    width: 1px;
    height: 1.5rem;
    background-color: #ccc;
  }

  .button-group {
    display: flex;
    flex-direction: row;
    gap: 0.5rem;
  }

  button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 0.25rem;
    font-weight: 500;
    cursor: pointer;
  }

  .primary-button {
    background-color: #3b82f6;
    color: white;
  }

  .destructive-button {
    background-color: #ef4444;
    color: white;
  }

  .theme-button {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f3f4f6;
    border: 1px solid #d1d5db;
  }

  .checkbox-group {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin: 0.5rem 0;
  }

  .hint {
    font-size: 0.75rem;
    color: #6b7280;
    margin: 0.25rem 0;
  }

  summary {
    font-weight: 600;
    cursor: pointer;
    padding: 0.5rem 0;
  }

  .advanced-settings {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem 0;
  }

  input[type="checkbox"] {
    width: 1rem;
    height: 1rem;
    margin-top: 0.25rem;
  }

  .render-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    font-size: 0.875rem;
  }

  .status-indicator {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    background-color: #9ca3af;
  }

  .status-indicator.active {
    background-color: #22c55e;
    box-shadow: 0 0 5px #22c55e;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.6;
    }
    100% {
      opacity: 1;
    }
  }
</style>
