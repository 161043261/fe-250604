// import crypto from 'node:crypto';

// const randBytes = new Uint8Array(16);
// crypto.getRandomValues(randBytes);
// const secretKey = Array.from(randBytes)
//   .map((byte) => byte.toString(16).padStart(2, '0'))
//   .join('');
const secretKey = '00000000000000000000000000000000';

async function importKey() {
  const encoder = new TextEncoder();
  const encodedKey: Uint8Array = encoder.encode(secretKey);
  const importedKey = await crypto.subtle.importKey('raw', encodedKey, { name: 'AES-GCM' }, false, [
    'encrypt', // 可以加密
    'decrypt', // 可以解密
  ]);
  return importedKey;
}

// AES 加密
export async function encrypt(plaintext: string) {
  const importedKey = await importKey();
  const cipherText = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: /** crypto.randomBytes(16), */ new Uint8Array(16),
    },
    importedKey,
    new TextEncoder().encode(plaintext),
  );
  return Array.from(new Uint8Array(cipherText))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

// AES 解密
export async function decrypt(cipherText: string) {
  const importedKey = await importKey();
  const buffer = new Uint8Array(cipherText.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: /** crypto.randomBytes(16), */ new Uint8Array(16),
    },
    importedKey,
    buffer,
  );
  return new TextDecoder().decode(plaintext);
}

export function genRandStr() {
  const randValues = new Uint32Array(4);
  crypto.getRandomValues(randValues);
  return Array.from(randValues, (decimal) => decimal.toString(16)).join('');
}
