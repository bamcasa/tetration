
// fastPow를 사용할지 여부를 결정하는 플래그 (정수 지수일 때만 사용하는 것이 안전)
const useFastPow = true;

function fastPow(x: number, y: number): number {
  // 음수 지수 지원
  if (y < 0) {
    return 1 / fastPow(x, -y);
  }
  let result = 1;
  while (y > 0) {
    if (y % 2 === 1) {
      result *= x;
    }
    x *= x;
    y = Math.floor(y / 2);
  }
  return result;
}

function complexPow(c: number[], z: number[]): number[] {
  const [a, b] = c;
  const [x, y] = z;

  // 복소수 c의 극좌표 표현
  const r = Math.hypot(a, b); // 절댓값
  const theta = Math.atan2(b, a); // 각도
  const logR = Math.log(r);

  // x가 정수이고 useFastPow가 true이면 fastPow를, 아니면 Math.pow 사용
  const rPowX =
    useFastPow && Number.isInteger(x) ? fastPow(r, x) : Math.pow(r, x);

  // 계산: c^z = exp(z * log(c)) = r^x * exp(-y * theta) * [cos(angle) + i*sin(angle)]
  // 각도 계산 및 보정
  let angle = y * logR + x * theta;
  angle = angle % (2 * Math.PI);

  // 지수 계산 오차 보정
  // 작은 값은 0으로 처리
  const factor = rPowX * Math.exp(-y * theta);

  return [factor * Math.cos(angle), factor * Math.sin(angle),];
}


function complexAbs(z: number[]): number {
  return Math.sqrt(z[0] * z[0] + z[1] * z[1]);
}

function complexSub(a : number[], b: number[]): number[] {
  return [a[0] - b[0], a[1] - b[1]];
}

function getRandomInt(min : number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export { complexPow, complexAbs, complexSub , getRandomInt };

