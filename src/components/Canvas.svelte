<script lang="ts">
  import { onMount } from 'svelte';
  import { complexPow, complexAbs, complexSub, getRandomInt } from '../lib/utils';

  import type { AppActionsType } from '../types';

  export let appState: any;
  export let appActions: AppActionsType;
  
  $: description = '(x, y, eps) = (' + $appState.x0 + ', ' + $appState.y0 + ', ' + $appState.eps + ')';
  $: eps_y = $appState.eps * ($appState.ratio_y / $appState.ratio_x);
  $: nx = $appState.n;
  $: ny = parseInt((nx * ($appState.ratio_y / $appState.ratio_x)).toString());
  
  // 캐시 관리
  const resultsCache = new Map<string, boolean>();
  
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null;
  let divergence_map: [Promise<void>, Promise<void>[]] = [Promise.resolve(), []];

  
    onMount(() => {
    // canvas 요소 가져오기
    canvas = document.getElementById('canvas') as HTMLCanvasElement;
    ctx = canvas.getContext('2d');
    
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
  function generateCacheKey(c_x: number, c_y: number, max_iter: number, threshold: number, escape_radius: number): string {
    return `${c_x.toFixed(6)},${c_y.toFixed(6)},${max_iter},${threshold},${escape_radius}`;
  }

  function getCachedResult(c_x: number, c_y: number, max_iter: number, threshold: number, escape_radius: number): boolean | undefined {
    if (!$appState.useCaching) return undefined;
    
    const key = generateCacheKey(c_x, c_y, max_iter, threshold, escape_radius);
    return resultsCache.get(key);
  }

  function cacheResult(c_x: number, c_y: number, max_iter: number, threshold: number, escape_radius: number, result: boolean): void {
    if (!$appState.useCaching) return;
    
    const key = generateCacheKey(c_x, c_y, max_iter, threshold, escape_radius);
    resultsCache.set(key, result);
  }

  function clearCacheIfNeeded(maxSize = 1000000): void {
    if (resultsCache.size > maxSize) {
      console.log(`Clearing cache (size: ${resultsCache.size})`);
      resultsCache.clear();
    }
  }
  
  // Exported for potential external use
  export function clearCache(): void {
    resultsCache.clear();
    console.log("Cache cleared");
  }
  // 비동기 반복 함수
  function asyncFor(start: number, len: number, callback: (idx: number) => void): Promise<void> {
    return new Promise<void>((resolve) => {
        let i = start;
        function iterate() {
            if (i < len && $appState.isRendering) {
                callback(i);
                i++;
                setTimeout(iterate, 0);
            } else {
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
      ctx.fillStyle = '#505050';
    } else {
      ctx.fillStyle = '#808080';
    }
    ctx.fillRect(0, 0, nx, ny);
    console.log("Canvas reset");
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
    
    divergence_map = computeTetrationDivergence(
      nx, 
      ny, 
      $appState.max_iter, 
      $appState.threshold, 
      $appState.escape_radius
    );
  }
  // 테트레이션 발산 계산
  function computeTetrationDivergence(nx: number, ny: number, max_iter: number, threshold: number, escape_radius: number): [Promise<void>, Promise<void>[]] {
    let a1 = $appState.x0 - $appState.eps;
    let d = (2 * $appState.eps) / nx;
    let b1 = $appState.y0 - eps_y;
    let e = (2 * eps_y) / ny;

    ctx = canvas.getContext('2d');

    let xAsync: Promise<void>;
    let yAsyncs: Promise<void>[] = [];
    if ($appState.fastRender) {
      // 랜덤 좌표를 사용하여 빠르게 렌더링
      xAsync = asyncFor(0, nx * 4, (_) => {
        let yAsync = asyncFor(0, ny * 4, (_) => {
          let r_x = getRandomInt(0, nx);
          let r_y = getRandomInt(0, ny);

          let c_x = a1 + r_x * d;
          let c_y = b1 + r_y * e;
          
          // 캐시된 결과 확인
          const cachedResult = getCachedResult(c_x, c_y, max_iter, threshold, escape_radius);
          
          if (cachedResult !== undefined && ctx) {
            ctx.fillStyle = cachedResult ? 'white' : 'black';
            ctx.fillRect(r_x, r_y, 1, 1);
          } else if (ctx) {
            // 새로운 결과 계산
            let c_val = [c_x, c_y];
            let z = [c_x, c_y];

            ctx.fillStyle = 'black';
            ctx.fillRect(r_x, r_y, 1, 1);
            
            let result = false; // false = black, true = white
            
            let prev_z = z;
            for (let k = 0; k < max_iter; k++) {
              z = complexPow(c_val, z);
              if (complexAbs(z) > escape_radius) {
                // 발산 
                ctx.fillStyle = 'white';
                ctx.fillRect(r_x, r_y, 1, 1);
                result = true;
                break;
              }
              if (complexAbs(complexSub(z, prev_z)) < threshold) {
                // 수렴
                ctx.fillStyle = 'black';
                ctx.fillRect(r_x, r_y, 1, 1);
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
      });
    } else {
      // 기존의 렌더링 방식
      xAsync = asyncFor(0, nx, (i) => {
        let yAsync = asyncFor(0, ny, (j) => {
          let c_x = a1 + i * d;
          let c_y = b1 + j * e;
          
          // 캐시된 결과 확인
          const cachedResult = getCachedResult(c_x, c_y, max_iter, threshold, escape_radius);
          
          if (cachedResult !== undefined && ctx) {
            ctx.fillStyle = cachedResult ? 'white' : 'black';
            ctx.fillRect(i, j, 1, 1);
          } else if (ctx) {
            // 새로운 결과 계산
            let c_val = [c_x, c_y];
            let z = [c_x, c_y];

            ctx.fillStyle = 'black';
            ctx.fillRect(i, j, 1, 1);
            
            let result = false; // false = black, true = white
            
            let prev_z = z;
            for (let k = 0; k < max_iter; k++) {
              z = complexPow(c_val, z);
              if (complexAbs(z) > escape_radius) {
                // 발산 
                ctx.fillStyle = 'white';
                ctx.fillRect(i, j, 1, 1);
                result = true;
                break;
              }
              if (complexAbs(complexSub(z, prev_z)) < threshold) {
                // 수렴
                ctx.fillStyle = 'black';
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
      });
      };
    

    // 필요시 캐시 정리
    clearCacheIfNeeded();

    return [xAsync, yAsyncs];
  }
  
  
  // 이미지 저장
  function saveImage() {
    let link = document.createElement('a');
    link.download = 'ourtetration.png';
    link.href = canvas.toDataURL();
    link.click();
  }
  // 설명 복사
  function copyDescription() {
    const text = `#mytetration\n${description}`;
    navigator.clipboard.writeText(text).catch(_ => {
      // 클립보드 API가 지원되지 않는 경우를 위한 fallback
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        // @ts-ignore: document.execCommand는 deprecated API이지만 fallback으로 사용
        document.execCommand('copy');
      } catch (error) {
        console.error('클립보드에 복사할 수 없습니다:', error);
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
