// utils.ts
import createWasmModule from "./wasm.js";

// WASM 모듈 타입 정의
interface WasmModule {
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  HEAPF64: Float64Array;
  ccall: (
    funcName: string,
    returnType: string | null,
    argTypes: string[],
    args: any[]
  ) => any;
  cwrap: (
    funcName: string,
    returnType: string | null,
    argTypes: string[]
  ) => (...args: any[]) => any;
  onRuntimeInitialized?: () => void;
  locateFile?: (path: string) => string;
}

let wasmModule: WasmModule | null = null;
let wasmInitPromise: Promise<WasmModule> | null = null;

// WASM 모듈 초기화 (한 번만 실행되도록 Promise 캐싱)
export async function initWasm(): Promise<WasmModule> {
  if (wasmModule) return wasmModule;
  if (wasmInitPromise) return wasmInitPromise;

  wasmInitPromise = new Promise(async (resolve, reject) => {
    console.log("Initializing WASM module");
    try {
      // WASM 파일 경로 (배포 시 base 설정에 따라 /tetration/ 아래에 위치)
      const wasmPath = "/tetration/wasm.wasm";

      wasmModule = (await createWasmModule({
        locateFile: (path: string) => {
          return path.endsWith(".wasm") ? wasmPath : path;
        },
      })) as WasmModule;

      if (wasmModule.onRuntimeInitialized) {
        wasmModule.onRuntimeInitialized = () => {
          console.log("WASM initialized successfully");
          resolve(wasmModule!);
        };
      } else {
        console.warn(
          "onRuntimeInitialized not found; assuming module is ready"
        );
        resolve(wasmModule!);
      }
    } catch (error) {
      console.error("WASM Initialization Failed:", error);
      reject(error);
    }
  });
  return wasmInitPromise;
}

// 전역 메모리 풀: 복소수 연산에 필요한 버퍼들을 한 번 할당하여 재사용
// 복소수 연산에 필요한 버퍼 크기는 2개의 double (즉, 2 * 8 bytes)입니다.
let complexOpPool: {
  ptr1: number; // 예: c 또는 a
  ptr2: number; // 예: z 또는 b
  ptrResult: number; // 결과 버퍼
  bufferSize: number;
} | null = null;

function getComplexOpPool(Module: WasmModule) {
  if (!complexOpPool) {
    const bufferSize = 2 * Float64Array.BYTES_PER_ELEMENT;
    const ptr1 = Module._malloc(bufferSize);
    const ptr2 = Module._malloc(bufferSize);
    const ptrResult = Module._malloc(bufferSize);
    complexOpPool = { ptr1, ptr2, ptrResult, bufferSize };
  }
  return complexOpPool;
}

// 래핑 함수 캐시 (ccall 대신 cwrap 사용)
let wrappedFunctions: {
  complexPow?: (cPtr: number, zPtr: number, resultPtr: number) => void;
  complexSub?: (aPtr: number, bPtr: number, resultPtr: number) => void;
  complexAbs?: (zPtr: number) => number;
  getRandomInt?: (min: number, max: number) => number;
} = {};

async function initWrappedFunctions() {
  const Module = await initWasm();
  if (!wrappedFunctions.complexPow) {
    wrappedFunctions.complexPow = Module.cwrap("complexPow", null, [
      "number",
      "number",
      "number",
    ]);
  }
  if (!wrappedFunctions.complexSub) {
    wrappedFunctions.complexSub = Module.cwrap("complexSub", null, [
      "number",
      "number",
      "number",
    ]);
  }
  if (!wrappedFunctions.complexAbs) {
    wrappedFunctions.complexAbs = Module.cwrap("complexAbs", "number", [
      "number",
    ]);
  }
  if (!wrappedFunctions.getRandomInt) {
    wrappedFunctions.getRandomInt = Module.cwrap("getRandomInt", "number", [
      "number",
      "number",
    ]);
  }
}

// 복소수 거듭제곱 함수 (메모리 풀 재사용)
export async function complexPow(c: number[], z: number[]): Promise<number[]> {
  await initWrappedFunctions();
  const Module = await initWasm();
  const pool = getComplexOpPool(Module); // 재사용 가능한 버퍼 사용

  // 입력 데이터 복사: pool.ptr1 <- c, pool.ptr2 <- z
  Module.HEAPF64.set(c, pool.ptr1 / Float64Array.BYTES_PER_ELEMENT);
  Module.HEAPF64.set(z, pool.ptr2 / Float64Array.BYTES_PER_ELEMENT);

  // 복소수 연산 수행
  wrappedFunctions.complexPow!(pool.ptr1, pool.ptr2, pool.ptrResult);

  // 결과 읽기
  const result = Array.from(
    new Float64Array(Module.HEAPF64.buffer, pool.ptrResult, 2)
  );
  return result;
}

// 배치 처리: 여러 개의 complexPow 연산을 한 번에 처리
export async function batchComplexPow(
  operations: { c: number[]; z: number[] }[]
): Promise<number[][]> {
  await initWrappedFunctions();
  const Module = await initWasm();
  const pool = getComplexOpPool(Module);
  const results: number[][] = [];

  for (const op of operations) {
    Module.HEAPF64.set(op.c, pool.ptr1 / Float64Array.BYTES_PER_ELEMENT);
    Module.HEAPF64.set(op.z, pool.ptr2 / Float64Array.BYTES_PER_ELEMENT);
    wrappedFunctions.complexPow!(pool.ptr1, pool.ptr2, pool.ptrResult);
    const res = Array.from(
      new Float64Array(Module.HEAPF64.buffer, pool.ptrResult, 2)
    );
    results.push(res);
  }
  return results;
}

// 복소수 뺄셈 함수 (메모리 풀 재사용)
export async function complexSub(a: number[], b: number[]): Promise<number[]> {
  await initWrappedFunctions();
  const Module = await initWasm();
  const pool = getComplexOpPool(Module);

  Module.HEAPF64.set(a, pool.ptr1 / Float64Array.BYTES_PER_ELEMENT);
  Module.HEAPF64.set(b, pool.ptr2 / Float64Array.BYTES_PER_ELEMENT);
  wrappedFunctions.complexSub!(pool.ptr1, pool.ptr2, pool.ptrResult);
  const result = Array.from(
    new Float64Array(Module.HEAPF64.buffer, pool.ptrResult, 2)
  );
  return result;
}

// 복소수 절댓값 함수 (메모리 풀 재사용: pool의 ptr1 재사용)
export async function complexAbs(z: number[]): Promise<number> {
  await initWrappedFunctions();
  const Module = await initWasm();
  const pool = getComplexOpPool(Module);

  Module.HEAPF64.set(z, pool.ptr1 / Float64Array.BYTES_PER_ELEMENT);
  const absValue = wrappedFunctions.complexAbs!(pool.ptr1);
  return absValue;
}

// getRandomInt은 메모리 할당 없이 호출
export async function getRandomInt(min: number, max: number): Promise<number> {
  await initWrappedFunctions();
  try {
    return wrappedFunctions.getRandomInt!(min, max);
  } catch (error) {
    console.error("getRandomInt failed:", error);
    return Math.floor(Math.random() * (max - min + 1)) + min; // Fallback
  }
}

// ※ 앱 종료 시나 필요에 따라, 할당된 메모리 풀을 해제하는 함수를 구현할 수도 있음.
// function freeComplexOpPool(Module: WasmModule) {
//   if (complexOpPool) {
//     Module._free(complexOpPool.ptr1);
//     Module._free(complexOpPool.ptr2);
//     Module._free(complexOpPool.ptrResult);
//     complexOpPool = null;
//   }
// }
