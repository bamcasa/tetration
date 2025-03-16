<script lang="ts">
  import { onMount } from "svelte";
  import {
    complexPow,
    complexAbs,
    complexSub,
    getRandomInt,
  } from "../lib/utils";

  import type { AppActionsType } from "../types";

  let renderStartTime: number = 0;
  let renderEndTime: number = 0;

  export let appState: any;
  export let appActions: AppActionsType;

  $: description =
    "(x, y, eps) = (" +
    $appState.x0 +
    ", " +
    $appState.y0 +
    ", " +
    $appState.eps +
    ")";
  $: eps_y = $appState.eps * ($appState.ratio_y / $appState.ratio_x);
  $: nx = $appState.n;
  $: ny = parseInt((nx * ($appState.ratio_y / $appState.ratio_x)).toString());

  // 캐시 관리
  const resultsCache = new Map<string, boolean>();

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null;
  let divergence_map: [Promise<void>, Promise<void>[]] = [
    Promise.resolve(),
    [],
  ];

  onMount(() => {
    // canvas 요소 가져오기
    canvas = document.getElementById("canvas") as HTMLCanvasElement;
    ctx = canvas.getContext("2d");

    resetCanvas();
    // testPixelDrawing();

    startRender();
  });

  // isRendering이 변경될 때마다 렌더링 시작/취소
  $: if ($appState.isRendering) {
    startRender();
  } else {
    cancelRender();
  }

  // 캐시 관련 함수들
  function generateCacheKey(
    c_x: number,
    c_y: number,
    max_iter: number,
    threshold: number,
    escape_radius: number
  ): string {
    return `${c_x.toFixed(6)},${c_y.toFixed(6)},${max_iter},${threshold},${escape_radius}`;
  }

  function getCachedResult(
    c_x: number,
    c_y: number,
    max_iter: number,
    threshold: number,
    escape_radius: number
  ): boolean | undefined {
    if (!$appState.useCaching) return undefined;

    const key = generateCacheKey(c_x, c_y, max_iter, threshold, escape_radius);
    return resultsCache.get(key);
  }

  function cacheResult(
    c_x: number,
    c_y: number,
    max_iter: number,
    threshold: number,
    escape_radius: number,
    result: boolean
  ): void {
    if (!$appState.useCaching) return;

    const key = generateCacheKey(c_x, c_y, max_iter, threshold, escape_radius);
    resultsCache.set(key, result);
  }

  function clearCacheIfNeeded(maxSize = 1000000): void {
    if (resultsCache.size > maxSize) {
      // console.log(`Clearing cache (size: ${resultsCache.size})`);
      resultsCache.clear();
    }
  }

  // Exported for potential external use
  export function clearCache(): void {
    resultsCache.clear();
    // console.log("Cache cleared");
  }
  // 비동기 반복 함수
  function asyncFor(
    start: number,
    len: number,
    callback: (idx: number) => void
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      let i = start;

      function iterate() {
        // 더 많은 반복을 한 번에 처리하여 성능 향상
        const batchSize = 10; // 한 번에 처리할 항목 수
        let count = 0;

        while (i < len && count < batchSize && $appState.isRendering) {
          callback(i);
          i++;
          count++;
        }

        if (i < len && $appState.isRendering) {
          // 아직 처리할 항목이 남아있고 렌더링 중이면 다음 배치 예약
          setTimeout(iterate, 0);
        } else {
          // 모든 항목 처리 완료 또는 렌더링 중단됨
          resolve();
        }
      }

      if ($appState.isRendering) {
        iterate();
      } else {
        resolve();
      }
    });
  }

  // 캔버스 초기화
  function resetCanvas() {
    if (!canvas || !ctx) return;

    canvas.width = nx;
    canvas.height = ny;

    if ($appState.isDarkMode) {
      ctx.fillStyle = "#505050";
    } else {
      ctx.fillStyle = "#808080";
    }
    ctx.fillRect(0, 0, nx, ny);
    // console.log("Canvas reset");
  }

  // 렌더링 취소
  function cancelRender() {
    appActions.cancelRender(); // appActions.updateValue('isRendering', false);
  }

  // 렌더링 시작
  function startRender() {
    // cancelRender();
    resetCanvas();
    // appActions.startRender(); // appActions.updateValue('isRendering', true);

    renderStartTime = performance.now();
    console.log("Rendering started", renderStartTime);

    divergence_map = computeTetrationDivergence(
      nx,
      ny,
      $appState.max_iter,
      $appState.threshold,
      $appState.escape_radius
    );
  }
  // 테트레이션 발산 계산
  function computeTetrationDivergence(
    nx: number,
    ny: number,
    max_iter: number,
    threshold: number,
    escape_radius: number
  ): [Promise<void>, Promise<void>[]] {
    let a1 = $appState.x0 - $appState.eps;
    let d = (2 * $appState.eps) / nx;
    let b1 = $appState.y0 - eps_y;
    let e = (2 * eps_y) / ny;

    ctx = canvas.getContext("2d");

    let yAsyncs: Promise<void>[] = [];
    let allPromises: Promise<void>[] = [];

    // x축 처리 Promise 생성
    const xAsync = asyncFor(0, nx, (i) => {
      // y축 처리를 위한 Promise 생성
      const yAsync = asyncFor(0, ny, (j) => {
        if (!$appState.isRendering) return; // 렌더링 중단 확인

        let c_x = a1 + i * d;
        let c_y = b1 + j * e;

        // 캐시된 결과 확인
        const cachedResult = getCachedResult(
          c_x,
          c_y,
          max_iter,
          threshold,
          escape_radius
        );

        if (cachedResult !== undefined && ctx) {
          ctx.fillStyle = cachedResult ? "white" : "black";
          ctx.fillRect(i, j, 1, 1);
        } else if (ctx) {
          // 새로운 결과 계산
          let c_val = [c_x, c_y];
          let z = [c_x, c_y];

          ctx.fillStyle = "black";
          ctx.fillRect(i, j, 1, 1);

          let result = false; // false = black, true = white

          let prev_z = z;
          for (let k = 0; k < max_iter; k++) {
            z = complexPow(c_val, z);
            if (complexAbs(z) > escape_radius) {
              // 발산
              ctx.fillStyle = "white";
              ctx.fillRect(i, j, 1, 1);
              result = true;
              break;
            }
            if (complexAbs(complexSub(z, prev_z)) < threshold) {
              // 수렴
              ctx.fillStyle = "black";
              ctx.fillRect(i, j, 1, 1);
              result = false;
              break;
            }
            prev_z = z;
          }

          // 결과 캐싱
          cacheResult(c_x, c_y, max_iter, threshold, escape_radius, result);
        }
      });

      yAsyncs.push(yAsync);
      allPromises.push(yAsync);
    });

    allPromises.push(xAsync);

    // 모든 Promise 관리를 위한 단일 Promise 생성
    const allRendering = Promise.all(allPromises);

    // 렌더링 완료 모니터링
    allRendering
      .then(() => {
        console.log("모든 렌더링 작업 완료!");
        if ($appState.isRendering) {
          renderEndTime = performance.now();
          const renderTime = ((renderEndTime - renderStartTime) / 1000).toFixed(
            2
          );
          console.log(`렌더링 완료: ${renderTime}초 소요됨`);
        }
      })
      .catch((error) => {
        console.error("렌더링 중 오류 발생:", error);
        appActions.updateValue("isRendering", false);
      });

    // 필요시 캐시 정리
    clearCacheIfNeeded();

    return [xAsync, yAsyncs];
  }

  // 이미지 저장
  function saveImage() {
    let link = document.createElement("a");
    link.download = "ourtetration.png";
    link.href = canvas.toDataURL();
    link.click();
  }
  // 설명 복사
  function copyDescription() {
    const text = `#mytetration\n${description}`;
    navigator.clipboard.writeText(text).catch((_) => {
      // 클립보드 API가 지원되지 않는 경우를 위한 fallback
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        // @ts-ignore: document.execCommand는 deprecated API이지만 fallback으로 사용
        document.execCommand("copy");
      } catch (error) {
        console.error("클립보드에 복사할 수 없습니다:", error);
      }
      document.body.removeChild(textArea);
    });
  }
</script>

<div class="canvas-container">
  <canvas class="canvas" id="canvas"></canvas>
  <div class="description">
    {description}
  </div>
  <div class="button-group">
    <button on:click={saveImage} class="primary-button">Save</button>
    <button on:click={copyDescription} class="primary-button">Copy</button>
  </div>
</div>

<style>
  .canvas-container {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
  }

  .canvas {
    border-radius: 0.375rem;
  }

  .description {
    font-weight: 600;
    font-size: 0.875rem;
  }

  @media (min-width: 768px) {
    .description {
      font-size: 1rem;
    }
  }

  .button-group {
    display: flex;
    flex-direction: row;
    gap: 0.5rem;
  }

  .primary-button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 0.25rem;
    font-weight: 500;
    cursor: pointer;
    background-color: #3b82f6;
    color: white;
  }
</style>
