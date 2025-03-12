<script>
import { onMount } from 'svelte';

  import { complexPow, complexAbs, complexSub, getRandomInt } from '../lib/utils';

  function asyncFor(start, len, callback){
    return new Promise((resolve) => {
        let i = start;
        function iterate() {
            if (i < len && isRendering) {
                callback(i);
                i++;
                setTimeout(iterate, 0);
            } else {
                resolve();
            }
        }
        if (isRendering) {
            iterate();
        } else {
            resolve();
        }
    });
}


  // Add a cache to store previously calculated points
  const resultsCache = new Map();

  let canvas;
  let ctx;
  let isDarkMode = false;

  let ratio_x = 1;
  let ratio_y = 1;

  let under_digit = 5;
  let d = 10 ** under_digit;

  // (x,y,eps,h)=(-3.216768, 0.001434, 5e-4, 1k)

  let x0 = Math.floor(Math.random() * getRandomInt(-1, 1) * d) / d;
  // let x0 = -3.216768;
  let y0 = Math.floor(Math.random() * getRandomInt(-1, 1) * d) / d;
  // let y0 = 0.001434

  let eps = Math.floor(Math.random() * d) / d;
  // let eps = 5e-4;

  $: eps_y = eps * (ratio_y / ratio_x);

  let max_iter = 1500;
  let escape_radius = 1e10;
  let threshold = 1e-10;

  let divergence_map = [];
  let isRendering = false;

  let n = 854;
  $: nx = n;
  $: ny = parseInt((nx * (ratio_y / ratio_x)).toString());

  let fastRender = false;
  let useCaching = true; // New flag to enable/disable caching

  $: description = '(x, y, eps) = (' + x0 + ', ' + y0 + ', ' + eps + ')';

  // Generate a cache key based on parameters
  function generateCacheKey(c_x, c_y, max_iter, threshold, escape_radius) {
    return `${c_x.toFixed(6)},${c_y.toFixed(6)},${max_iter},${threshold},${escape_radius}`;
  }

  // Check if we have cached results for the given parameters
  function getCachedResult(c_x, c_y, max_iter, threshold, escape_radius) {
    if (!useCaching) return null;
    
    const key = generateCacheKey(c_x, c_y, max_iter, threshold, escape_radius);
    return resultsCache.get(key);
  }

  // Store result in cache
  function cacheResult(c_x, c_y, max_iter, threshold, escape_radius, result) {
    if (!useCaching) return;
    
    const key = generateCacheKey(c_x, c_y, max_iter, threshold, escape_radius);
    resultsCache.set(key, result);
  }

  // Clear cache if it's getting too large (optional)
  function clearCacheIfNeeded(maxSize = 1000000) {
    if (resultsCache.size > maxSize) {
      console.log(`Clearing cache (size: ${resultsCache.size})`);
      resultsCache.clear();
    }
  }

  function compute_tetration_divergence(
    nx,
    ny,
    max_iter,
    threshold,
    escape_radius
  ) {
    let a1 = x0 - eps;
    let d = (2 * eps) / nx;
    let b1 = y0 - eps_y;
    let e = (2 * eps_y) / ny;

    ctx = canvas.getContext('2d');

    let xAsync;
    let yAsyncs = [];

    if (fastRender) {
    // fastRender는 랜덤 좌표를 사용하여 빠르게 렌더링하는 옵션입니다.
      xAsync = asyncFor(0, nx * 4, (newI) => {
        let yAsync = asyncFor(0, ny * 4, (newJ) => {
          let r_x = getRandomInt(0, nx);
          let r_y = getRandomInt(0, ny);

          let c_x = a1 + r_x * d;
          let c_y = b1 + r_y * e;
          
          // Check if we have a cached result
          const cachedResult = getCachedResult(c_x, c_y, max_iter, threshold, escape_radius);
          
          if (cachedResult !== undefined) {
            // Use cached result
            // console.log('Using cached result');
            ctx.fillStyle = cachedResult ? 'white' : 'black';
            ctx.fillRect(r_x, r_y, 1, 1);
          } else {
            // Calculate new result
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
                ctx.fillRect(newI, newJ, 1, 1);
                result = true;
                break;
              }
              if (complexAbs(complexSub(z, prev_z)) < threshold) {
                // 수렴
                ctx.fillStyle = 'black';
                ctx.fillRect(newI, newJ, 1, 1);
                result = false;
                break;
              }
              prev_z = z;
            }
            
            // Cache the result
            cacheResult(c_x, c_y, max_iter, threshold, escape_radius, result);
          }
        });
        yAsyncs.push(yAsync);
      });
    } else {
      // 기존의 렌더링 방식
      xAsync = asyncFor(0, nx, (newI) => {
        let yAsync = asyncFor(0, ny, (newJ) => {
          let c_x = a1 + newI * d;
          let c_y = b1 + newJ * e;
          
          // Check if we have a cached result
          const cachedResult = getCachedResult(c_x, c_y, max_iter, threshold, escape_radius);
          
          if (cachedResult !== undefined) {
            // Use cached result
            ctx.fillStyle = cachedResult ? 'white' : 'black';
            ctx.fillRect(newI, newJ, 1, 1);
          } else {
            // Calculate new result
            let c_val = [c_x, c_y];
            let z = [c_x, c_y];

            ctx.fillStyle = 'black';
            ctx.fillRect(newI, newJ, 1, 1);
            
            let result = false; // false = black, true = white
            
            let prev_z = z;
            for (let k = 0; k < max_iter; k++) {
              z = complexPow(c_val, z);
              if (complexAbs(z) > escape_radius) {
                // 발산 
                ctx.fillStyle = 'white';
                ctx.fillRect(newI, newJ, 1, 1);
                result = true;
                break;
              }
              if (complexAbs(complexSub(z, prev_z)) < threshold) {
                // 수렴
                ctx.fillStyle = 'black';
                ctx.fillRect(newI, newJ, 1, 1);
                result = false;
                break;
              }
              prev_z = z;
            }
            
            // Cache the result
            cacheResult(c_x, c_y, max_iter, threshold, escape_radius, result);
          }
        });
        yAsyncs.push(yAsync);
      });
    }

    // Check if cache needs to be cleared
    clearCacheIfNeeded();

    return [xAsync, yAsyncs];
  }

  onMount(() => {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');

    if (window.innerWidth < 768) {
      n = window.innerWidth - 16;
      nx = n;
      ny = parseInt((nx * (ratio_y / ratio_x)).toString());
    }

    ResetCanvas();
    startRender();
  });

  function ResetCanvas() {
    if (!canvas || !ctx) return;
    
    canvas.width = nx;
    canvas.height = ny;

    if (isDarkMode) {
      ctx.fillStyle = '#505050';
    } else {
      ctx.fillStyle = '#808080';
    }
    ctx.fillRect(0, 0, nx, ny);
  }

  function CancelRender() {
    isRendering = false;
}

  function startRender() {
    CancelRender();
    isRendering = true;
    ResetCanvas();
    divergence_map = compute_tetration_divergence(nx, ny, max_iter, threshold, escape_radius);
  }

  function toggleMode() {
    isDarkMode = !isDarkMode;
    ResetCanvas();
    startRender();
  }

  function applyRatioChanges() {
    ResetCanvas();
    startRender();
  }

  function saveImage() {
    let link = document.createElement('a');
    link.download = 'ourtetration.png';
    link.href = canvas.toDataURL();
    link.click();
  }

  function copyDescription() {
    const text = `#mytetration\n${description}`;
    navigator.clipboard.writeText(text).catch(err => {
      // 클립보드 API가 지원되지 않는 경우를 위한 fallback
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('클립보드에 복사할 수 없습니다:', err);
      }
      document.body.removeChild(textArea);
    });
  }

  function clearCache() {
    resultsCache.clear();
    console.log("Cache cleared");
  }
</script>

<div class="container">
  <div class="canvas-container">
    <canvas class="canvas" id="canvas"></canvas>
    <div class="description">
      {description}
    </div>
  </div>
  <div class="controls">
    <div class="header">
      <h2>Our Tetration</h2>
      <button on:click={toggleMode} class="theme-button">
        {#if isDarkMode}
          ☀️
        {:else}
          🌙
        {/if}
      </button>
    </div>
    
    <hr />
    
    <div class="input-group">
      <label>x0</label>
      <input bind:value={x0} type="number" step="0.01" />
      <span class="divider"></span>
      <label>y0</label>
      <input bind:value={y0} type="number" step="0.01" />
    </div>
    <div class="input-group">
      <label>eps</label>
      <input bind:value={eps} type="number" step="0.01" />
    </div>
    
    <hr />
    
    <div class="input-group">
      <label>n</label>
      <input bind:value={n} type="number" />
    </div>
    <div class="input-group">
      <label>ratio</label>
      <input bind:value={ratio_x} type="number" class="small-input" />
      <input bind:value={ratio_y} type="number" class="small-input" />
      <button on:click={applyRatioChanges} class="destructive-button">Apply</button>
    </div>
    <p class="hint">Changing n or ratio requires manual apply.</p>
    
    <hr />
    
    <div class="button-group">
      <button on:click={startRender} class="primary-button">Start Render</button>
      <button on:click={CancelRender} class="primary-button">Cancel Render</button>
      <button on:click={() => {
        ResetCanvas();
        startRender();
      }} class="destructive-button">Reset</button>
    </div>
    
    <hr />
    
    <div class="checkbox-group">
      <input type="checkbox" id="fastRender" bind:checked={fastRender} />
      <div>
        <label for="fastRender">Use random_render (fast ∧ noisy)</label>
        <p class="hint">It renders random coordinate.</p>
      </div>
    </div>
    
    <div class="checkbox-group">
      <input type="checkbox" id="useCaching" bind:checked={useCaching} />
      <div>
        <label for="useCaching">Use caching</label>
        <p class="hint">Reuse previously calculated points.</p>
      </div>
    </div>
    
    <div class="button-group">
      <button on:click={clearCache} class="destructive-button">Clear Cache</button>
    </div>
    
    <hr />
    
    <details>
      <summary>Advanced Preference</summary>
      <div class="advanced-settings">
        <div class="input-group">
          <label>max_iter</label>
          <input bind:value={max_iter} type="number" />
        </div>
        <div class="input-group">
          <label>escape_radius</label>
          <input bind:value={escape_radius} type="number" />
        </div>
        <div class="input-group">
          <label>threshold</label>
          <input bind:value={threshold} type="number" />
        </div>
        <div class="input-group">
          <label>eps_y</label>
          <input disabled value={eps_y} type="number" />
        </div>
        <div class="input-group">
          <label>nx</label>
          <input disabled value={nx} type="number" />
          <span class="divider"></span>
          <label>ny</label>
          <input disabled value={ny} type="number" />
        </div>
        <div class="input-group">
          <label>Cache Size</label>
          <input disabled value={resultsCache.size || 0} type="number" />
        </div>
      </div>
    </details>
    
    <div class="button-group">
      <button on:click={saveImage} class="primary-button">Save</button>
      <button on:click={copyDescription} class="primary-button">Copy</button>
    </div>
  </div>
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
  
  .canvas-container {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
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
</style>