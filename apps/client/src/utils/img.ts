export function genBase64(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas.toDataURL();
}
