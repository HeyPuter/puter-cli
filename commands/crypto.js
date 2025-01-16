import { v4 as uuidv4 } from 'uuid';
import { TextEncoder } from 'util';

class Hash {
  constructor(algorithm) {
    this.algorithm = algorithm;
    this.data = [];
  }

  update(data) {
    if (typeof data === 'string') {
      const encoder = new TextEncoder();
      data = encoder.encode(data);
    }
    this.data.push(Buffer.from(data));
    return this;
  }

  async digest(encoding = 'hex') {
    const concatenatedData = Buffer.concat(this.data);
    const hashBuffer = await crypto.subtle.digest(
      this.algorithm.toUpperCase(),
      concatenatedData
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    
    if (encoding === 'buffer') {
      return Buffer.from(hashArray);
    }
    
    const hashHex = hashArray
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
      
    if (encoding === 'hex') return hashHex;
    if (encoding === 'base64') return Buffer.from(hashHex, 'hex').toString('base64');
    
    throw new Error(`Unsupported encoding: ${encoding}`);
  }
}

class Hmac {
  constructor(algorithm, key) {
    this.algorithm = algorithm;
    this.key = typeof key === 'string' ? Buffer.from(key) : key;
    this.data = [];
  }

  update(data) {
    if (typeof data === 'string') {
      const encoder = new TextEncoder();
      data = encoder.encode(data);
    }
    this.data.push(Buffer.from(data));
    return this;
  }

  async digest(encoding = 'hex') {
    const concatenatedData = Buffer.concat(this.data);
    const key = await crypto.subtle.importKey(
      'raw',
      this.key,
      { name: 'HMAC', hash: { name: this.algorithm.toUpperCase() } },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      concatenatedData
    );
    
    const hashArray = Array.from(new Uint8Array(signature));
    
    if (encoding === 'buffer') {
      return Buffer.from(hashArray);
    }
    
    const hashHex = hashArray
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
      
    if (encoding === 'hex') return hashHex;
    if (encoding === 'base64') return Buffer.from(hashHex, 'hex').toString('base64');
    
    throw new Error(`Unsupported encoding: ${encoding}`);
  }
}

const randomBytes = (size) => {
  const array = new Uint8Array(size);
  crypto.getRandomValues(array);
  return Buffer.from(array);
};

const createHash = (algorithm) => {
  return new Hash(algorithm);
};

const createHmac = (algorithm, key) => {
  return new Hmac(algorithm, key);
};

const randomUUID = () => {
  return uuidv4();
};

const scrypt = async (password, salt, keylen, options = {}) => {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const saltBuffer = encoder.encode(salt);
  
  const N = options.N || 16384;
  const r = options.r || 8;
  const p = options.p || 1;
  
  const key = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const derivedKey = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: N * r * p,
      hash: 'SHA-256'
    },
    key,
    keylen * 8
  );
  
  return Buffer.from(derivedKey);
};

const pbkdf2 = async (password, salt, iterations, keylen, digest) => {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const saltBuffer = encoder.encode(salt);
  
  const key = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const derivedKey = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations,
      hash: digest.toUpperCase()
    },
    key,
    keylen * 8
  );
  
  return Buffer.from(derivedKey);
};

export default {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scrypt,
  pbkdf2,
  Hash,
  Hmac
};