/* eslint-disable no-console */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const axios = require('axios');
const log = require('./log');
const CryptoJS = require('crypto-js');

const secretKey = process.env.HASH_KEY; // Shared secret key

const _ = {};

const config = {
  BASE_URL: process.env.BASE_URL,
  VERIFICATION_CODE_LENGTH: process.env.VERIFICATION_CODE_LENGTH,
  JWT_SECRET: process.env.JWT_SECRET,
};

_.parse = function (data) {
  try {
    return JSON.parse(data);
  } catch (error) {
    return data;
  }
};
_.now = () => {
  const dt = new Date();
  return `[${`${dt}`.split(' ')[4]}:${dt.getMilliseconds()}]`;
};
_.stringify = function (data, offset = 0) {
  return JSON.stringify(data, null, offset);
};
_.toString = function (key) {
  try {
    return key.toString();
  } catch (error) {
    return '';
  }
};
_.clone = function (data = {}) {
  const originalData = data.toObject ? data.toObject() : data; // for mongodb result operations
  const eType = originalData ? originalData.constructor : 'normal';
  if (eType === Object) return { ...originalData };
  if (eType === Array) return [...originalData];
  return data;
  // return JSON.parse(JSON.stringify(data));
};

_.deepClone = function (data) {
  const originalData = !!data.toObject || !!data._doc ? data._doc : data;
  if (originalData.constructor === Object) return this.cloneObject(originalData);
  if (originalData.constructor === Array) return this.cloneArray(originalData);
  return originalData;
};

_.cloneObject = function (object) {
  const newData = {};
  const keys = Object.keys(object);
  for (let i = 0; i < keys.length; i += 1) {
    const eType = object[keys[i]] ? object[keys[i]].constructor : 'normal';
    switch (eType) {
      case 'normal':
        newData[keys[i]] = object[keys[i]];
        break;
      case Array:
        newData[keys[i]] = this.cloneArray(object[keys[i]]);
        break;
      case Object:
        newData[keys[i]] = this.cloneObject(object[keys[i]]);
        break;
      default:
        newData[keys[i]] = object[keys[i]];
        break;
    }
  }
  return newData;
};

_.cloneArray = function (array) {
  const newData = [];
  for (let i = 0; i < array.length; i += 1) {
    const eType = array[i] ? array[i].constructor : 'normal';
    switch (eType) {
      case 'normal':
        newData.push(array[i]);
        break;
      case Array:
        newData.push(this.cloneArray(array[i]));
        break;
      case Object:
        newData.push(this.cloneObject(array[i]));
        break;
      default:
        newData.push(array[i]);
        break;
    }
  }
  return newData;
};

_.pick = function (obj, array) {
  const clonedObj = this.clone(obj);
  return array.reduce((acc, elem) => {
    if (elem in clonedObj) acc[elem] = clonedObj[elem];
    return acc;
  }, {});
};
_.getBoardKey = iBoardId => `${iBoardId.toString()}:ludo`;

_.omit = function (obj, array, deepCloning = false) {
  const clonedObject = deepCloning ? this.deepClone(obj) : this.clone(obj);
  const objectKeys = Object.keys(clonedObject);
  return objectKeys.reduce((acc, elem) => {
    if (!array.includes(elem)) acc[elem] = clonedObject[elem];
    return acc;
  }, {});
};

_.isEmptyObject = function (obj = {}) {
  return !Object.keys(obj).length;
};

_.isEqual = function (id1, id2) {
  return (id1 ? id1.toString() : id1) === (id2 ? id2.toString() : id2);
};

_.formattedDate = function () {
  return new Date().toLocaleString('en-us', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
};

_.isoTimeString = function () {
  const today = new Date();
  return today;
};

_.getDate = function (_date = undefined) {
  const date = _date ? new Date(_date) : new Date();
  date.setHours(0, 0, 0, 0);
  const timeOffset = date.getTimezoneOffset() === 0 ? 19800000 : 0;
  // return new Date(date.toLocaleString('en-us', { day: 'numeric', month: 'short', year: 'numeric' }));
  return new Date(date - timeOffset);
};

_.addDays = function (date, days) {
  const inputDate = new Date(date);
  return new Date(inputDate.setDate(inputDate.getDate() + days));
};

_.addMonth = function (date, month) {
  const inputDate = new Date(date);
  return new Date(inputDate.setMonth(inputDate.getMonth() + month));
};

_.addMilliseconds = function (date, milliseconds) {
  const inputDate = new Date(date);
  return new Date(inputDate.valueOf() + milliseconds);
};

_.encryptPassword = function (password) {
  return crypto.createHmac('sha256', config.JWT_SECRET).update(password).digest('hex');
};

// _.encryptData= function (data) {
//     const cipher = CryptoJS.AES.encrypt(data, CryptoJS.enc.Hex.parse(secretKey), {
//         iv: CryptoJS.enc.Hex.parse(iv.toString()),
//     });
//     return { iv: iv.toString(), encryptedData: cipher.toString() };
// }
_.encryptDataGhetiya = function (text) {
  const iv = CryptoJS.lib.WordArray.random(128 / 8);
  const encrypted = CryptoJS.AES.encrypt(text, CryptoJS.enc.Utf8.parse(secretKey), { iv: iv });
  return { iv: iv.toString(CryptoJS.enc.Hex), content: encrypted.toString() };
};

// _.encryptDataCrypto= function (data) {
//   const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secretKey), iv);
//   let encrypted = cipher.update(data);
//   encrypted = Buffer.concat([encrypted, cipher.final()]);
//   return { iv: iv.toString('hex'), content: encrypted.toString('hex') };
// }

// _.decryptData=function (data) {
//     const decipher = CryptoJS.AES.decrypt(data.encryptedData, CryptoJS.enc.Hex.parse(secretKey), {
//         iv: CryptoJS.enc.Hex.parse(data.iv),
//     });
//     return decipher.toString(CryptoJS.enc.Utf8);
// }

_.decryptDataGhetiya = function (hash) {
  const iv = CryptoJS.enc.Hex.parse(hash.iv);
  const decrypted = CryptoJS.AES.decrypt(hash.content, CryptoJS.enc.Utf8.parse(secretKey), { iv: iv });
  return decrypted.toString(CryptoJS.enc.Utf8);
};

// _.decryptDataCrypto= function decrypt(hash) {
//   let iv = Buffer.from(hash.iv, 'hex');
//   let encryptedText = Buffer.from(hash.content, 'hex');
//   const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secretKey), iv);
//   let decrypted = decipher.update(encryptedText);
//   decrypted = Buffer.concat([decrypted, decipher.final()]);
//   return decrypted.toString();
// }

_.randomizeNumericString = function (length, size) {
  let result = '';
  const output = new Set();
  const characters = '1234567890';
  const charactersLength = characters.length;
  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < length; i += 1) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    output.add(result);
    result = '';
  }
  return [...output];
};

_.salt = function (length, type) {
  // if (process.env.NODE_ENV !== 'prod') return 1234;
  if (type === 'string') {
    return crypto
      .randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .slice(0, length);
  }

  let min = 1;
  let max = 9;
  for (let i = 1; i < length; i += 1) {
    min += '0';
    max += '9';
  }
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

_.validateMobile = function (mobile) {
  const regeX = /^\+?[1-9][0-9]{8,12}$/;
  return !regeX.test(mobile);
};

_.sortByKey = function name(array, key) {
  return _.clone(array).sort((a, b) => a[key] - b[key]);
};

_.randomCode = function (size) {
  // const code = Math.random().toString(32);
  const code = Date.now().toString(36);
  return code.slice(code.length - size);
};

_.encodeToken = function (body, expTime) {
  try {
    return expTime ? jwt.sign(this.clone(body), config.JWT_SECRET, expTime) : jwt.sign(this.clone(body), config.JWT_SECRET);
  } catch (error) {
    return undefined;
  }
};

_.decodeToken = function (token) {
  try {
    return jwt.decode(token, config.JWT_SECRET);
  } catch (error) {
    return undefined;
  }
};

_.verifyToken = function (token) {
  try {
    return jwt.verify(token, config.JWT_SECRET, function (err, decoded) {
      return err ? err.message : decoded; // return true if token expired
    });
  } catch (error) {
    return error ? error.message : error;
  }
};

_.isOtpValid = function (createdAt) {
  const difference = new Date() - createdAt;
  return difference < process.env.OTP_VALIDITY;
};

_.isEmail = function (email) {
  const regeX = /[a-z0-9._%+-]+@[a-z0-9-]+[.]+[a-z]{2,5}$/;
  return !regeX.test(email);
};

_.isUserName = function (name) {
  const regeX = /^[a-zA-Z ]+$/;
  return !regeX.test(name);
};

_.isPassword = function (password) {
  const regeX = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,15}$/;
  return !regeX.test(password);
};

_.randomizeArray = function (array = []) {
  const arrayLength = array.length;
  for (let i = 0; i < arrayLength; i += 1) {
    let randomNumber = Math.floor(Math.random() * arrayLength);
    [array[i], array[randomNumber]] = [array[randomNumber], array[i]];
    randomNumber = Math.floor(Math.random() * arrayLength);
    [array[i], array[randomNumber]] = [array[randomNumber], array[i]];
  }
  return array;
};

_.randomBetween = function (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

_.randomFromArray = function (array) {
  if (!array.length) return false;
  return array[Math.floor(Math.random() * array.length)];
};

_.appendZero = number => (number < 10 ? '0' : '') + number;

_.delay = ttl => new Promise(resolve => setTimeout(resolve, ttl));

_.roundDownToMultiple = function (number, multiple) {
  return number - (number % multiple);
};

_.emptyCallback = (error, response) => {};

_.errorCallback = (error, response) => {
  if (error) console.error(error);
};

_.getUserKey = iUserId => `user:${iUserId}`;

// _.getBoardKey = iBoardId => `${iBoardId}:tbl`;
_.getProtoKey = iProtoId => `${iProtoId}:proto`;

_.getTableCounterKey = id => `${id}:counter`;

_.getTournamentKey = iTableId => `tournament:${iTableId}`;

_.getTournamentCounterKey = id => `counter:${id}`;

_.getSchedulerKey = (sTask, iBoardId = '', iUserId = '', host = process.env.HOST) => `${iBoardId}:scheduler:${sTask}:${iUserId}:${host}`;
_.getSchedulerKeyWithOutHost = (sTask, iBoardId = '', iUserId = '') => `${iBoardId}:scheduler:${sTask}:${iUserId}:*`;

_.generateRandomUserName = function () {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < 5; i += 1) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
};

_.randomizeNumber = function (length, size) {
  let number = new Date().getTime().toString();
  return `0${number.slice(6, 13)}`;
};

_.retryAxiosCall = async function (optionsEndGame, maxRetries = 3, delayMs = 15000) {
  try {
    const response = await axios(optionsEndGame);
    return response.data;
  } catch (error) {
    if (maxRetries <= 0) {
      throw error; // No more retries, propagate the error
    }
    console.error(`API request failed. Retrying in ${delayMs / 1000} seconds...`);
    // Use setTimeout to introduce a delay before retrying the request
    await new Promise(resolve => setTimeout(resolve, delayMs));

    return _.retryAxiosCall(optionsEndGame, maxRetries - 1, delayMs);
  }
};
_.removeKey = (obj, keyToRemove) => {
  // Create a new object by copying all key-value pairs except the one to be removed
  const newObj = Object.fromEntries(Object.entries(obj).filter(([key, value]) => key !== keyToRemove));

  return newObj;
};
_.removeFieldFromArray = async (array, fieldToRemove) => {
  array.forEach(item => {
    delete item[fieldToRemove];
  });
};

module.exports = _;
